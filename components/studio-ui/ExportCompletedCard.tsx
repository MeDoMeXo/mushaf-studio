'use client';

import React, { useState } from 'react';
import { Captions, Check, CheckCircle2, Copy, Download, Image as ImageIcon, Loader2, Share2, Upload } from 'lucide-react';
import type { VideoExportFormat } from '@/lib/video-export';
import { verifyAndDownload } from '@/lib/export-network';
import {
  buildVideoFileFromBlob,
  buildVideoShareMetadata,
  formatShareCaptionForClipboard,
  isLikelyMobileDevice,
  shareExportedVideoFile,
  YOUTUBE_UPLOAD_URL,
} from '@/lib/video-share';
import {
  downloadExportThumbnail,
  renderExportThumbnail,
} from '@/lib/export-thumbnail';
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { YouTubePublishKit } from './YouTubePublishKit';

export interface ExportCompletedMeta {
  filename: string;
  format: VideoExportFormat;
  streamUrl: string;
  downloadUrl: string;
  srtUrl: string | null;
  srtEnUrl: string | null;
  sizeMb: string;
  durationSec: string;
  renderSec: string;
  dimensions: string;
  isLocalBlob: boolean;
}

interface ExportCompletedCardProps {
  exportedUrl: string;
  exportedMeta: ExportCompletedMeta;
  exportedBlob: Blob | null;
  surahName: string;
  surahNameEn?: string | null;
  isFullSurah?: boolean;
  translationName?: string | null;
  selectedVerses: QulVerse[];
  studioState: StudioState;
  targetDims: { width: number; height: number };
  getBgImageEl: () => HTMLImageElement | null;
  fromAyah: number;
  toAyah: number;
  reciterName: string;
  onErrorToast: (msg: string) => void;
}

export function ExportCompletedCard({
  exportedUrl,
  exportedMeta,
  exportedBlob,
  surahName,
  surahNameEn,
  isFullSurah,
  translationName,
  selectedVerses,
  studioState,
  targetDims,
  getBgImageEl,
  fromAyah,
  toAyah,
  reciterName,
  onErrorToast,
}: ExportCompletedCardProps) {
  const [videoPreviewError, setVideoPreviewError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'title' | 'desc' | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbFeedback, setThumbFeedback] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const shareMeta = buildVideoShareMetadata({
    surahName,
    fromAyah,
    toAyah,
    reciterName,
    filename: exportedMeta.filename,
  });

  const isMobile =
    typeof navigator !== 'undefined' && isLikelyMobileDevice(navigator.userAgent || '');

  const copyText = (value: string, kind: 'title' | 'desc') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind((prev) => (prev === kind ? null : prev)), 2200);
  };

  const handleDownload = () => {
    void verifyAndDownload(
      exportedMeta.streamUrl,
      exportedMeta.downloadUrl,
      exportedMeta.filename,
      exportedMeta.format,
      { localBlobUrl: exportedMeta.isLocalBlob ? exportedUrl : null, onErrorToast }
    );
  };

  const handleNativeShare = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    setShareFeedback(null);

    try {
      const file = exportedBlob
        ? buildVideoFileFromBlob(exportedBlob, exportedMeta.filename, exportedMeta.format)
        : null;

      const nav =
        typeof navigator !== 'undefined'
          ? (navigator as Navigator & {
              canShare?: (d?: { files?: File[] }) => boolean;
              share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
            })
          : null;

      const outcome = await shareExportedVideoFile({
        nav,
        file,
        title: shareMeta.title,
        text: shareMeta.text,
        onFallbackDownload: handleDownload,
      });

      if (outcome.status === 'shared') {
        setShareFeedback({
          tone: 'success',
          text: isMobile
            ? 'تم فتح قائمة مشاركة النظام مع إرفاق الفيديو — اختر YouTube أو Instagram لإكمال الرفع.'
            : 'تم فتح قائمة مشاركة ويندوز والفيديو مرفق تلقائياً (Instagram وWhatsApp). للرفع إلى YouTube على الكمبيوتر افتح نافذة الرفع واسحب الملف من التنزيلات.',
        });
      } else if (outcome.status === 'unsupported') {
        setShareFeedback({ tone: 'info', text: outcome.reason });
      } else if (outcome.status === 'error') {
        setShareFeedback({ tone: 'error', text: outcome.message });
        onErrorToast(outcome.message);
      }
    } finally {
      setShareBusy(false);
    }
  };

  const handlePrepareYouTubeDesktopUpload = () => {
    copyText(formatShareCaptionForClipboard(shareMeta), 'desc');
    setShareFeedback({
      tone: 'info',
      text: `تم فتح نافذة رفع يوتيوب ونسخ الوصف للحافظة. اسحب ملف (${exportedMeta.filename}) من التنزيلات وأفلته في النافذة — ثم الصق العنوان والوصف والتاغات من «حزمة النشر» أدناه.`,
    });
  };

  const handleDownloadThumbnail = async () => {
    if (thumbBusy) return;
    setThumbBusy(true);
    setThumbFeedback(null);
    try {
      const result = await renderExportThumbnail({
        studioState,
        targetDims,
        surahName,
        reciterName,
        getBgImageEl,
      });
      if (result && downloadExportThumbnail(result)) {
        setThumbFeedback(
          `تم تنزيل صورة المصغرة (${result.filename}) بأبعاد ${targetDims.width}×${targetDims.height} — جاهزة للرفع في خانة Thumbnail بـ YouTube Studio.`
        );
      } else {
        setThumbFeedback(
          'تعذّر توليد صورة المصغرة في هذا المتصفح — استخدم تصدير PNG من الاستوديو كبديل.'
        );
      }
    } finally {
      setThumbBusy(false);
    }
  };

  const hasSrt = Boolean(exportedMeta.srtUrl);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-600/35 bg-emerald-600/8 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <span>اكتمل التصدير بنجاح!</span>
        </div>
        <span className="text-xs text-[var(--ink-muted)] tabular-nums">
          {exportedMeta.dimensions} · {exportedMeta.durationSec} ث · {exportedMeta.sizeMb} MB
          {' · '}أُنجز في {exportedMeta.renderSec} ث
        </span>
      </div>

      <video
        key={exportedUrl}
        src={exportedUrl}
        controls
        playsInline
        preload="auto"
        data-testid="exported-video-preview"
        onLoadedData={() => setVideoPreviewError(null)}
        onError={() =>
          setVideoPreviewError(
            'تعذّرت معاينة الفيديو داخل المتصفح الحالي — يمكنك تنزيل الملف وتشغيله مباشرة على جهازك.'
          )
        }
        className="mx-auto max-h-[260px] w-full rounded-lg bg-black object-contain"
      />

      {videoPreviewError && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
          {videoPreviewError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-emerald)] px-4 py-2.5 text-sm font-bold text-[#FAF7F0] hover:opacity-95"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">تنزيل ({exportedMeta.filename})</span>
        </button>

        <button
          type="button"
          disabled={shareBusy}
          data-testid="share-exported-video-btn"
          onClick={() => void handleNativeShare()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 px-4 py-2.5 text-sm font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/28 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isMobile ? 'مشاركة مباشرة (YouTube · Instagram)' : 'مشاركة النظام (Instagram · WhatsApp)'}</span>
        </button>
      </div>

      {/* Ready-to-paste YouTube / Social Title & Description + PC upload */}
      <div className="space-y-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)]/90 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[var(--ink-primary)]">
            بيانات النشر الجاهزة (يقرأ يوتيوب العنوان تلقائياً من اسم الملف العربي):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="copy-share-title-btn"
              onClick={() => copyText(shareMeta.title, 'title')}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
            >
              {copiedKind === 'title' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKind === 'title' ? 'تم نسخ العنوان' : 'نسخ العنوان'}</span>
            </button>
            <button
              type="button"
              data-testid="copy-share-desc-btn"
              onClick={() => copyText(shareMeta.text, 'desc')}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
            >
              {copiedKind === 'desc' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKind === 'desc' ? 'تم نسخ الوصف' : 'نسخ الوصف'}</span>
            </button>
          </div>
        </div>
        <p className="truncate text-xs font-semibold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
          {shareMeta.title}
        </p>
      </div>

      {/* Upload-ready assets: YouTube upload page + AR/EN subtitles + thumbnail */}
      <div className={`grid grid-cols-1 gap-2 ${hasSrt ? 'sm:grid-cols-2' : ''}`}>
        <a
          href={YOUTUBE_UPLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="youtube-desktop-upload-link"
          onClick={handlePrepareYouTubeDesktopUpload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/45 bg-red-600/10 px-4 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-600/18 dark:text-red-300"
        >
          <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>فتح صفحة رفع YouTube (نسخ الوصف)</span>
        </a>

        <button
          type="button"
          disabled={thumbBusy}
          data-testid="download-thumbnail-btn"
          onClick={() => void handleDownloadThumbnail()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-50"
        >
          {thumbBusy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>تنزيل صورة المصغرة (Thumbnail)</span>
        </button>

        {exportedMeta.srtUrl && (
          <a
            href={exportedMeta.srtUrl}
            download={exportedMeta.filename.replace(/\.(mp4|webm)$/i, '.srt')}
            data-testid="download-srt-ar-link"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Captions className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>ترجمة متزامنة عربية (SRT)</span>
          </a>
        )}

        {exportedMeta.srtEnUrl && (
          <a
            href={exportedMeta.srtEnUrl}
            download={exportedMeta.filename.replace(/\.(mp4|webm)$/i, '.en.srt')}
            data-testid="download-srt-en-link"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Captions className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>English Subtitles (SRT)</span>
          </a>
        )}
      </div>

      {thumbFeedback && (
        <p
          role="status"
          className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200"
        >
          {thumbFeedback}
        </p>
      )}

      {/* Full YouTube metadata pack: bilingual titles/descriptions/tags + chapters */}
      <YouTubePublishKit
        surahNameAr={surahName}
        surahNameEn={surahNameEn}
        fromAyah={fromAyah}
        toAyah={toAyah}
        verseCount={selectedVerses.length}
        isFullSurah={isFullSurah}
        reciterName={reciterName}
        translationName={translationName}
        selectedVerses={selectedVerses}
        srtUrl={exportedMeta.srtUrl}
        durationSec={exportedMeta.durationSec}
      />

      {shareFeedback && (
        <p
          role="status"
          data-testid="video-share-feedback"
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            shareFeedback.tone === 'success'
              ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
              : shareFeedback.tone === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                : 'border-[var(--brand-gold)]/50 bg-[var(--brand-gold)]/10 text-[var(--ink-primary)]'
          }`}
        >
          {shareFeedback.text}
        </p>
      )}
    </div>
  );
}
