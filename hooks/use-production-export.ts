'use client';

/**
 * use-production-export — خط تصدير «استوديو الإنتاج».
 *
 * صوت: مزج غير متصل (تلاوة محرَّرة + موسيقى + محيطات) → WAV فوري أو
 * MP3 عبر /api/production/encode (FFmpeg).
 *
 * فيديو: تسجيل حي للمعاينة نفسها (canvas.captureStream + مِكسر الصوت
 * عبر MediaRecorder) — ما تراه في المعاينة هو حرفياً ما يُصدَّر (الكاليوكي
 * والخلفية والمؤثرات كلها داخل الملف). WebM فوري، أو MP4 عبر ترميز
 * الخادم عند الطلب.
 */
import { useCallback, useRef, useState } from 'react';
import { renderEdited, encodeWav16bit } from '@/lib/audio-producer/audio-producer-engine';
import { buildAmbientLoop } from '@/lib/production/production-ambient';
import type {
  ProductionEffectClip,
  ProductionExportSettings,
} from '@/lib/production/production-types';
import { formatProductionClock } from '@/lib/production/production-types';
import type { ProducerSource } from '@/lib/audio-producer/audio-producer-engine';
import type { ProducerEditState } from '@/lib/audio-producer/audio-producer-edit';
import type { ProducerEchoSettings } from '@/lib/audio-producer/producer-echo';

export interface ExportProgress {
  phase: string;
  ratio: number; // 0..1
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** أسماء ملفات نظيفة مع طابع زمني. */
function stampName(prefix: string, ext: string): string {
  const d = new Date();
  const two = (v: number) => String(v).padStart(2, '0');
  return `${prefix}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.${ext}`;
}

export function useProductionExport(options: {
  showToast: (msg: string) => void;
}) {
  const { showToast } = options;
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const cancelRef = useRef(false);

  /** طلب ترميز الخادم (FFmpeg) — يرفع الملف وينزّل الناتج. */
  const encodeViaServer = useCallback(
    async (blob: Blob, format: 'mp3' | 'mp4' | 'wav', bitrate: number, width?: number, height?: number): Promise<Blob | null> => {
      const form = new FormData();
      form.append('file', blob, 'input.bin');
      form.append('format', format);
      form.append('bitrate', String(bitrate));
      if (width && height) {
        form.append('width', String(width));
        form.append('height', String(height));
      }
      try {
        const res = await fetch('/api/production/encode', { method: 'POST', body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          showToast(err?.error ?? 'فشل ترميز الملف على الخادم');
          return null;
        }
        return await res.blob();
      } catch {
        showToast('تعذّر الاتصال بخدمة الترميز');
        return null;
      }
    },
    [showToast]
  );

  /** المزج الصوتي غير المتصل (تلاوة + موسيقى + محيطات) → AudioBuffer. */
  const renderMixedAudio = useCallback(
    async (input: {
      source: ProducerSource;
      edit: ProducerEditState;
      echo: ProducerEchoSettings;
      musicBuffer: AudioBuffer | null;
      musicGain: number;
      effectClips: ProductionEffectClip[];
      totalSec: number;
    }): Promise<AudioBuffer | null> => {
      const { source, edit, echo, musicBuffer, musicGain, effectClips, totalSec } = input;
      try {
        const rendered = await renderEdited(source, edit, echo.enabled ? echo : undefined);
        if (!rendered) return null;
        const sampleRate = rendered.sampleRate;
        const tail = 1.2; // ذيل صدى/محيط
        const total = Math.max(rendered.duration, musicBuffer?.duration ?? 0, totalSec) + tail;
        const off = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate);
        // التلاوة المحرَّرة
        const rec = off.createBufferSource();
        rec.buffer = rendered;
        rec.connect(off.destination);
        rec.start(0);
        // الموسيقى (حلقة تغطي المدة، بمكسبها)
        if (musicBuffer) {
          const mus = off.createBufferSource();
          mus.buffer = musicBuffer;
          mus.loop = true;
          const g = off.createGain();
          g.gain.value = Math.max(0.001, musicGain);
          mus.connect(g);
          g.connect(off.destination);
          mus.start(0, 0);
          // إخماد لطيف لآخر ثانية
          g.gain.setValueAtTime(Math.max(0.001, musicGain), Math.max(0, total - 1));
          g.gain.linearRampToValueAtTime(0.0001, total);
        }
        // المحيطات النشطة (حلقات داخل فترات مقاطعها)
        for (const clip of effectClips) {
          if (clip.kind !== 'ambient') continue;
          const buf = buildAmbientLoop(off, clip.ambient);
          if (!buf) continue;
          const node = off.createBufferSource();
          node.buffer = buf;
          node.loop = true;
          const g = off.createGain();
          g.gain.value = Math.max(0.0001, clip.gain);
          node.connect(g);
          g.connect(off.destination);
          node.start(clip.startSec, 0);
          node.stop(Math.min(total, Math.max(clip.startSec + 0.1, clip.endSec)));
        }
        return await off.startRendering();
      } catch {
        showToast('تعذّر مزج الصوت');
        return null;
      }
    },
    [showToast]
  );

  /** تصدير صوتي: WAV مباشر أو MP3 عبر الخادم. */
  const exportAudio = useCallback(
    async (input: {
      source: ProducerSource;
      edit: ProducerEditState;
      echo: ProducerEchoSettings;
      musicBuffer: AudioBuffer | null;
      musicGain: number;
      effectClips: ProductionEffectClip[];
      totalSec: number;
      settings: ProductionExportSettings;
    }): Promise<boolean> => {
      cancelRef.current = false;
      setExporting(true);
      setProgress({ phase: 'مزج الصوت…', ratio: 0.15 });
      try {
        const mixed = await renderMixedAudio(input);
        if (!mixed || cancelRef.current) return false;
        setProgress({ phase: 'ترميز الملف…', ratio: 0.7 });
        if (input.settings.format === 'wav') {
          const blob = encodeWav16bit(mixed);
          downloadBlob(blob, stampName('تلاوة-استوديو', 'wav'));
          showToast('صُدِّر الصوت WAV (مزيج كامل مع المؤثرات)');
          return true;
        }
        const wav = encodeWav16bit(mixed);
        const encoded = await encodeViaServer(wav, 'mp3', input.settings.bitrateKbps);
        if (!encoded) return false;
        downloadBlob(encoded, stampName('تلاوة-استوديو', 'mp3'));
        showToast(`صُدِّر الصوت MP3 بمعدل ${input.settings.bitrateKbps} كبت/ث`);
        return true;
      } finally {
        setExporting(false);
        setProgress(null);
      }
    },
    [encodeViaServer, renderMixedAudio, showToast]
  );

  /**
   * تصدير مرئي: تسجيل حي للمعاينة من الصفر إلى النهاية.
   * يُدار التشغيل من الخارج (startPlayback) ويتوقف عند وصول رأس القراءة
   * النهاية (getPlayheadSec) أو الإلغاء. يُرجع Blob.
   */
  const recordVideo = useCallback(
    async (input: {
      canvas: HTMLCanvasElement;
      audioStream: MediaStream | null;
      totalSec: number;
      settings: ProductionExportSettings;
      startPlayback: () => Promise<void>;
      stopPlayback: () => void;
      getPlayheadSec: () => number;
    }): Promise<Blob | null> => {
      cancelRef.current = false;
      setExporting(true);
      setProgress({ phase: 'تسجيل الفيديو…', ratio: 0 });
      const canvasStream = input.canvas.captureStream(30);
      const tracks = [...canvasStream.getVideoTracks()];
      if (input.audioStream) tracks.push(...input.audioStream.getAudioTracks());
      const stream = new MediaStream(tracks);
      const wantsMp4 = input.settings.format === 'mp4';
      const candidates = wantsMp4
        ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
        : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = candidates.find(
        (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
      );
      if (!mime) {
        showToast('المتصفح لا يدعم تسجيل الفيديو');
        setExporting(false);
        setProgress(null);
        return null;
      }
      const bitrate = input.settings.quality === '1080' ? 8_000_000 : input.settings.quality === '720' ? 5_000_000 : 2_500_000;
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: Math.min(256000, input.settings.bitrateKbps * 1000 || 192000),
      });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const finished = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });
      rec.start(500);
      await input.startPlayback();
      const started = Date.now();
      const totalMs = Math.max(1, input.totalSec * 1000);
      const progTimer = setInterval(() => {
        const ratio = Math.min(1, (Date.now() - started) / totalMs);
        setProgress({
          phase: `تسجيل الفيديو… ${formatProductionClock(ratio * input.totalSec)} / ${formatProductionClock(input.totalSec)}`,
          ratio,
        });
      }, 250);
      // انتظار انتهاء التشغيل (رأس القراءة بلغ النهاية) أو الإلغاء —
      // مع سقف زمني ١.٢× المدة كوقاية من التعلّق.
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (cancelRef.current || input.getPlayheadSec() >= input.totalSec - 0.06) {
            clearInterval(check);
            resolve();
          }
        }, 200);
        setTimeout(() => {
          clearInterval(check);
          resolve();
        }, totalMs * 1.2 + 4000);
      });
      clearInterval(progTimer);
      input.stopPlayback();
      try {
        rec.stop();
      } catch {
        // تجاهل
      }
      const raw = await finished;
      canvasStream.getTracks().forEach((t) => t.stop());
      if (!raw || raw.size < 1000) {
        showToast('التسجيل فارغ — تأكد من وجود تلاوة محمَّلة');
        setExporting(false);
        setProgress(null);
        return null;
      }
      // WebM فوري أو MP4 عبر الخادم
      if (mime.startsWith('video/webm') && wantsMp4) {
        setProgress({ phase: 'ترميز MP4 على الخادم…', ratio: 0.96 });
        const encoded = await encodeViaServer(raw, 'mp4', input.settings.bitrateKbps);
        setExporting(false);
        setProgress(null);
        if (!encoded) return null;
        downloadBlob(encoded, stampName('تلاوة-مرئية', 'mp4'));
        showToast('صُدِّر الفيديو MP4 (المعاينة نفسها بالكاليوكي والخلفية)');
        return encoded;
      }
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      downloadBlob(raw, stampName('تلاوة-مرئية', ext));
      setExporting(false);
      setProgress(null);
      showToast(`صُدِّر الفيديو ${ext.toUpperCase()} — المعاينة نفسها بالكاليوكي والخلفية`);
      return raw;
    },
    [encodeViaServer, showToast]
  );

  const cancelExport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return {
    exporting,
    progress,
    exportAudio,
    recordVideo,
    cancelExport,
    downloadBlob,
    stampName,
  };
}
