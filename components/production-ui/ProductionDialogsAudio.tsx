'use client';

/**
 * ProductionDialogsAudio — حوارات تحرير الصوت والمؤثرات والتسجيل والمزامنة:
 * صدى، محيطات، تنقية، بوابة ضجيج، مستوى، قص/تقسيم، تسجيل، موسيقى،
 * تسجيلات، ومزامنة حدود الآيات.
 */
import { useState } from 'react';
import {
  AudioLines,
  Gauge,
  Mic,
  Music,
  Scissors,
  Sparkles,
  Timer,
  VolumeOff,
} from 'lucide-react';
import { AMBIENT_LIBRARY } from '@/lib/production/production-types';
import { ECHO_PRESETS } from '@/lib/audio-producer/producer-echo';
import type { ProductionStudioController } from '@/hooks/use-production-studio';
import { Field, GoldButton, PlainButton, ProdDialog, RangeInput, TextInput } from './ProductionDialogShell';

export function EffectsDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const echo = ctl.producer.echo;
  return (
    <ProdDialog title="تحرير الصوت — صدى الصوت (Reverb)" icon={<Sparkles className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2 text-sm font-bold">
          تفعيل الصدى
          <input
            type="checkbox"
            checked={echo.enabled}
            onChange={(e) => ctl.producer.setEcho({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[#0b3d2e]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ECHO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => ctl.producer.setEcho({ enabled: true, ...p })}
              className="rounded-xl border border-[#d4af37]/50 bg-white px-2 py-2 text-xs font-bold text-[#123c22] hover:bg-[#fdf8ea]"
            >
              {p.label}
              <span className="block text-[10px] font-normal text-[var(--ink-muted)]">
                {Math.round(p.delaySec * 1000)}ms
              </span>
            </button>
          ))}
        </div>
        <Field label={`زمن التأخير — ${Math.round(echo.delaySec * 1000)}ms`}>
          <RangeInput
            min={0.05}
            max={0.9}
            step={0.01}
            value={echo.delaySec}
            onChange={(e) => ctl.producer.setEcho({ delaySec: Number(e.target.value) })}
            aria-label="زمن التأخير"
          />
        </Field>
        <Field label={`التغذية الراجعة — ${Math.round(echo.feedback * 100)}٪`}>
          <RangeInput
            min={0}
            max={0.85}
            step={0.01}
            value={echo.feedback}
            onChange={(e) => ctl.producer.setEcho({ feedback: Number(e.target.value) })}
            aria-label="التغذية الراجعة"
          />
        </Field>
        <Field label={`نسبة الرطوبة — ${Math.round(echo.wet * 100)}٪`}>
          <RangeInput
            min={0}
            max={0.6}
            step={0.01}
            value={echo.wet}
            onChange={(e) => ctl.producer.setEcho({ wet: Number(e.target.value) })}
            aria-label="نسبة الرطوبة"
          />
        </Field>
        <p className="text-[11px] text-[var(--ink-muted)]">
          الصدى يدخل في المعاينة والتصدير معاً — ما تسمعه هو ما يُصدَّر.
        </p>
      </div>
    </ProdDialog>
  );
}

export function AmbientDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  return (
    <ProdDialog title="مكتبة الصوت — خلفيات صوتية (محيطات)" icon={<AudioLines className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-3">
        {AMBIENT_LIBRARY.map((a) => (
          <div
            key={a.kind}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5"
          >
            <div>
              <p className="text-sm font-bold text-[var(--ink-primary)]">{a.label}</p>
              <p className="text-[11px] text-[var(--ink-muted)]">{a.hint}</p>
            </div>
            <GoldButton className="h-8 px-3 text-xs" onClick={() => { ctl.addAmbientClip(a.kind); close(); }}>
              إضافة
            </GoldButton>
          </div>
        ))}
        {ctl.effectClips.length > 0 && (
          <div className="mt-1">
            <p className="mb-1 text-xs font-bold text-[var(--ink-muted)]">المؤثرات المضافة (انقر حذفها)</p>
            <div className="flex flex-col gap-1.5">
              {ctl.effectClips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => ctl.removeEffectClip(c.id)}
                  className="flex items-center justify-between rounded-lg bg-[#fdf3e3] px-3 py-1.5 text-xs font-semibold text-[#7a4b12] hover:bg-[#f9e8c9]"
                >
                  <span>{AMBIENT_LIBRARY.find((a) => a.kind === c.ambient)?.label ?? c.ambient}</span>
                  <span className="text-[10px]">حذف ✕</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProdDialog>
  );
}

export function CleanDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const opts = ctl.producer.silenceOpts;
  const silences = ctl.producer.silences;
  return (
    <ProdDialog title="تحرير الصوت — تنقية (قصّ السكوت)" icon={<Sparkles className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <Field label={`عتبة السكوت — ${Math.round(opts.thresholdRatio * 100)}٪ من الذروة`}>
          <RangeInput
            min={0.02}
            max={0.2}
            step={0.01}
            value={opts.thresholdRatio}
            onChange={(e) => ctl.producer.setSilenceOpts((o) => ({ ...o, thresholdRatio: Number(e.target.value) }))}
            aria-label="عتبة السكوت"
          />
        </Field>
        <Field label={`أدنى مدة سكوت — ${opts.minSilenceSec.toFixed(1)} ث`}>
          <RangeInput
            min={0.15}
            max={2}
            step={0.05}
            value={opts.minSilenceSec}
            onChange={(e) => ctl.producer.setSilenceOpts((o) => ({ ...o, minSilenceSec: Number(e.target.value) }))}
            aria-label="أدنى مدة سكوت"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <PlainButton
            onClick={() => {
              const n = ctl.producer.detectSilences();
              ctl.showToast(n ? `اكتُشف ${n} فترة سكوت` : 'لا فترات سكوت بهذه العتبة');
            }}
          >
            كشف السكوت
          </PlainButton>
          <GoldButton
            disabled={silences.length === 0}
            onClick={() => {
              ctl.producer.removeSilences();
              close();
            }}
          >
            قصّ السكوت المكتشف ({silences.length})
          </GoldButton>
        </div>
        <p className="text-[11px] text-[var(--ink-muted)]">
          القصّ يزيل الفترات من الخط الزمني المحرَّر (غير مدمّر — تراجع يعيدها).
        </p>
      </div>
    </ProdDialog>
  );
}

export function DenoiseDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const opts = ctl.producer.silenceOpts;
  return (
    <ProdDialog title="تحرير الصوت — إزالة الضوضاء (بوابة الضجيج)" icon={<VolumeOff className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--ink-muted)]">
          بوابة الضجيج: ترفع عتبة «التنقية» فتُقصّ كل ما دونها (همسات/أزيز/فراغات) وتُبقي التلاوة.
        </p>
        <Field label={`عتبة البوابة — ${Math.round(opts.thresholdRatio * 100)}٪ من الذروة`}>
          <RangeInput
            min={0.02}
            max={0.3}
            step={0.01}
            value={opts.thresholdRatio}
            onChange={(e) => ctl.producer.setSilenceOpts((o) => ({ ...o, thresholdRatio: Number(e.target.value) }))}
            aria-label="عتبة البوابة"
          />
        </Field>
        <Field label={`أدنى مدة قطع — ${opts.minSilenceSec.toFixed(1)} ث`}>
          <RangeInput
            min={0.1}
            max={1.5}
            step={0.05}
            value={opts.minSilenceSec}
            onChange={(e) => ctl.producer.setSilenceOpts((o) => ({ ...o, minSilenceSec: Number(e.target.value) }))}
            aria-label="أدنى مدة قطع"
          />
        </Field>
        <GoldButton
          onClick={() => {
            ctl.producer.detectSilences();
            ctl.producer.removeSilences();
            ctl.showToast('طُبّقت بوابة الضجيج على المقطع');
            close();
          }}
        >
          تطبيق البوابة الآن
        </GoldButton>
      </div>
    </ProdDialog>
  );
}

export function LevelDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const edit = ctl.producer.edit;
  const gain = edit?.masterGainDb ?? 0;
  const normalize = edit?.normalize ?? false;
  return (
    <ProdDialog title="تحرير الصوت — مستوى الصوت" icon={<Gauge className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <Field label={`المكسب الرئيسي — ${gain.toFixed(1)} dB`}>
          <RangeInput
            min={-12}
            max={12}
            step={0.5}
            value={gain}
            onChange={(e) => ctl.producer.setMasterGain(Number(e.target.value))}
            aria-label="المكسب الرئيسي"
          />
        </Field>
        <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2 text-sm font-bold">
          تطبيع الذروة إلى ٩٥٪ عند التصدير
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => ctl.producer.setNormalizeOn(e.target.checked)}
            className="h-4 w-4 accent-[#0b3d2e]"
          />
        </label>
        <p className="text-[11px] text-[var(--ink-muted)]">
          التطبيع يوازن المستوى الصوتي النهائي في المعاينة والتصدير معاً.
        </p>
      </div>
    </ProdDialog>
  );
}

export function CutDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const p = ctl.producer;
  return (
    <ProdDialog title="تحرير الفيديو/الصوت — قص وتقسيم" icon={<Scissors className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--ink-muted)]">
          العمليات عند رأس القراءة الحالي — كلها غير مدمّرة (قابلة للتراجع).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <GoldButton onClick={() => { p.splitAtPlayhead(); ctl.showToast('قُسّم المقطع عند رأس القراءة'); }}>
            تقسيم عند الرأس
          </GoldButton>
          <PlainButton onClick={() => { p.trimBeforePlayhead(); close(); ctl.showToast('اقتُطع ما قبل رأس القراءة'); }}>
            قصّ ما قبل الرأس
          </PlainButton>
          <PlainButton onClick={() => { p.trimAfterPlayhead(); close(); ctl.showToast('اقتُطع ما بعد رأس القراءة'); }}>
            قصّ ما بعد الرأس
          </PlainButton>
          <PlainButton onClick={() => { p.restoreFull(); close(); }}>
            استعادة الكامل
          </PlainButton>
        </div>
      </div>
    </ProdDialog>
  );
}

export function RecordDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
    const [loadingFile, setLoadingFile] = useState(false);
  return (
    <ProdDialog title="تسجيل صوت — تلاوتك بصوتك" icon={<Mic className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        {ctl.recording ? (
          <>
            <p className="text-center text-sm font-bold text-[#7a1f1f]">
              جارٍ التسجيل… {ctl.recorderSec} ث
            </p>
            <GoldButton
              onClick={async () => {
                const file = await ctl.finishRecording();
                if (file) {
                  ctl.setRecordings((prev) => [...prev, { name: file.name, file }]);
                  setLoadingFile(true);
                  await ctl.producer.loadFile(file);
                  setLoadingFile(false);
                  ctl.showToast('حُمّل التسجيل إلى المحرر — اضبط حدود الآيات من المزامنة');
                }
                close();
              }}
            >
              إيقاف وتحميل التسجيل
            </GoldButton>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--ink-muted)]">
              سجّل تلاوتك من الميكروفون ثم حرّرها بالأدوات نفسها (كشف حدود الآيات من «التوقيت والمزامنة»).
            </p>
            <GoldButton
              onClick={async () => {
                const file = await ctl.startRecording();
                if (!file) return;
                // التسجيل يبدأ — الحوار يبقى مفتوحاً حتى الإيقاف.
                void file;
              }}
            >
              بدء التسجيل
            </GoldButton>
            <label className="cursor-pointer text-center">
              <span className="text-xs font-bold text-[var(--brand-gold)]">أو ارفع ملف صوتي (MP3/WAV)</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setLoadingFile(true);
                  await ctl.producer.loadFile(f);
                  setLoadingFile(false);
                  close();
                }}
              />
            </label>
          </>
        )}
        {loadingFile && <p className="text-center text-xs text-[var(--ink-muted)]">جارٍ فك ترميز التسجيل…</p>}
        {ctl.recordings.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-bold text-[var(--ink-muted)]">تسجيلات الجلسة</p>
            <div className="flex flex-col gap-1.5">
              {ctl.recordings.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    void ctl.producer.loadFile(r.file);
                    ctl.showToast(`حُمّل ${r.name}`);
                  }}
                  className="rounded-lg border border-[var(--border-hairline)] bg-white px-3 py-1.5 text-right text-xs font-semibold hover:bg-[#f5f2e8]"
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProdDialog>
  );
}

export function MusicDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  return (
    <ProdDialog title="إضافة موسيقى — خلفية صوتية" icon={<Music className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        {ctl.musicState ? (
          <>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5">
              <p className="truncate text-sm font-bold">{ctl.musicState.name}</p>
              <p className="text-[11px] text-[var(--ink-muted)]">
                {ctl.musicState.durationSec.toFixed(1)} ث — تُعاد حلقتها عبر المدة كلها
              </p>
            </div>
            <Field label={`مستوى الموسيقى — ${Math.round(ctl.musicGain * 100)}٪`}>
              <RangeInput
                min={0}
                max={1}
                step={0.05}
                value={ctl.musicGain}
                onChange={(e) => ctl.setMusicGain(Number(e.target.value))}
                aria-label="مستوى الموسيقى"
              />
            </Field>
            <PlainButton onClick={() => ctl.removeMusic()}>إزالة الموسيقى</PlainButton>
          </>
        ) : (
          <label className="cursor-pointer rounded-xl border-2 border-dashed border-[#d4af37]/60 px-4 py-8 text-center hover:bg-[#fdf8ea]">
            <span className="text-sm font-bold text-[#123c22]">ارفع ملف موسيقى (MP3/WAV/OGG…)</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await ctl.loadMusic(f);
                close();
              }}
            />
          </label>
        )}
        <p className="text-[11px] text-[var(--ink-muted)]">
          الموسيقى تدخل المعاينة والتصدير معاً بمستوى منضبط.
        </p>
      </div>
    </ProdDialog>
  );
}

export function RecordingsDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  return (
    <ProdDialog title="مكتبة الصوت — تسجيلاتك" icon={<Mic className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-3">
        {ctl.recordings.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
            لا تسجيلات بعد — سجّل من أداة «تسجيل صوت»
          </p>
        )}
        {ctl.recordings.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => {
              void ctl.producer.loadFile(r.file);
              ctl.showToast(`حُمّل ${r.name}`);
              close();
            }}
            className="rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5 text-right text-sm font-semibold hover:bg-[#f5f2e8]"
          >
            {r.name}
            <span className="block text-[11px] font-normal text-[var(--ink-muted)]">
              {(r.file.size / 1024 / 1024).toFixed(1)} ميغابايت — انقر للتحميل إلى المحرر
            </span>
          </button>
        ))}
      </div>
    </ProdDialog>
  );
}

export function SyncDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const p = ctl.producer;
  const markers = p.source?.verseMarkersSec ?? [];
  return (
    <ProdDialog title="التوقيت والمزامنة — حدود الآيات مع التلاوة" icon={<Timer className="h-4 w-4" />} onClose={close} wide>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--ink-muted)]">
          اسحب الحد على الخط الزمني مباشرة أو ازحْه هنا بدقة — يُحدّث موضع الآية في النص والتصدير معاً.
        </p>
        {p.source?.kind === 'file' && (
          <PlainButton
            onClick={() => {
              const ok = p.detectFileBoundaries(markers.length || 7);
              if (!ok) ctl.showToast('اضبط عدد الآيات بجوار الحدود يدوياً أو خفّف العتبة');
            }}
          >
            كشف حدود الآيات تلقائياً (للملف المرفوع)
          </PlainButton>
        )}
        <div className="studio-scroll flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {markers.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-white px-3 py-1.5"
            >
              <button
                type="button"
                onClick={() => p.seekToVerse(i)}
                className="text-xs font-bold text-[#123c22] hover:underline"
                title="استمع من هذه الآية"
              >
                الآية {p.source?.verseNumbers[i] ?? i + 1}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => p.nudgeVerse(i, -0.1)}
                  className="rounded-md border px-1.5 text-xs font-bold hover:bg-[#f5f2e8]"
                  aria-label="إزاحة مبكرة"
                >
                  −٠٫١
                </button>
                <span className="tabular-nums text-xs font-bold">{m.toFixed(2)}ث</span>
                <button
                  type="button"
                  onClick={() => p.nudgeVerse(i, 0.1)}
                  className="rounded-md border px-1.5 text-xs font-bold hover:bg-[#f5f2e8]"
                  aria-label="إزاحة متأخرة"
                >
                  +٠٫١
                </button>
                <button
                  type="button"
                  onClick={() => p.setVerseMarker(i, p.playheadSourceSec)}
                  className="rounded-md bg-[#0b3d2e] px-2 py-0.5 text-[11px] font-bold text-white"
                  title="لصق رأس القراءة الحالي كبدء للآية"
                >
                  عند الرأس
                </button>
              </div>
            </div>
          ))}
          {markers.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--ink-muted)]">حمّل تلاوة أولاً</p>
          )}
        </div>
      </div>
    </ProdDialog>
  );
}

export function CustomTextDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const [text, setText] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.max(5, ctl.producer.editedTotalSec * 0.5));
  const [color, setColor] = useState('#e6c75a');
  return (
    <ProdDialog title="النصوص — نص مخصص" icon={<Sparkles className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <Field label="النص">
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب النص المرافق…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="البداية (ث)">
            <TextInput type="number" min={0} step={0.5} value={start} onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="النهاية (ث)">
            <TextInput type="number" min={start + 0.5} step={0.5} value={end} onChange={(e) => setEnd(Math.max(start + 0.5, Number(e.target.value) || 5))} />
          </Field>
        </div>
        <Field label="اللون">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-20 rounded-lg border" aria-label="لون النص" />
        </Field>
        <GoldButton
          disabled={!text.trim()}
          onClick={() => {
            ctl.addTextClip({ text: text.trim(), kind: 'custom', startSec: start, endSec: end, color, scale: 1 });
            ctl.showToast('أُضيف مقطع النص على مسار النصوص');
            close();
          }}
        >
          إضافة النص
        </GoldButton>
      </div>
    </ProdDialog>
  );
}
