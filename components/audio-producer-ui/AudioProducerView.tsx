'use client';

/**
 * AudioProducerView — صفحة «منتج الصوت» (مسار /audio-producer) بتخطيط
 * محرر فيديو احترافي (NLE) وفق المراجع:
 * - المنطقة العلوية: مكتبة الآيات المجلوبة من الموقع (بطاقات قابلة
 *   للتحديد والحذف) | معاينة الآية الجارية بالرسم العثماني + النقل.
 * - المنطقة السفلية: الخط الزمني — شريط أدوات (فصل/حذف/قصّ/تراجع/
 *   تطبيع/تقريب) + مسار مقاطع الآيات (كل آية مقطع مستقل) + مسار
 *   الموجة الكامل + مفتش المقاطع العائم.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radar, Sparkles } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { fetchChapterVerses, fetchChapters } from '@/lib/qul-client';
import { RECITERS, type QulChapter, type QulVerse } from '@/lib/quran-data';
import { getStudioActiveReciters } from '@/lib/reciter-filter';
import { toArabicDigits } from '@/lib/quran-utils';
import { buildVerseViews } from '@/lib/audio-producer/verse-views';
import { useAudioProducer } from '@/hooks/use-audio-producer';
import { ProducerSourceBar, ProducerEmptyState } from './ProducerSourceBar';
import { ProducerVerseLibrary } from './ProducerVerseLibrary';
import { ProducerPreviewPanel } from './ProducerPreviewPanel';
import { ProducerTimeline } from './ProducerTimeline';

const DEFAULT_FROM = 1;
const DEFAULT_TO = 7;

export function AudioProducerView() {
  const router = useRouter();
  const { config, showToast } = useApp();

  const [chapters, setChapters] = useState<QulChapter[]>([]);
  const [verses, setVerses] = useState<QulVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(true);
  const [surahId, setSurahId] = useState(1);
  const [fromAyah, setFromAyah] = useState(DEFAULT_FROM);
  const [toAyah, setToAyah] = useState(DEFAULT_TO);
  const [reciterSlug, setReciterSlug] = useState(RECITERS[0]?.slug ?? 'ar.alafasy');
  const [boundaryCount, setBoundaryCount] = useState(7);
  const [sending, setSending] = useState(false);
  const [selectedVerseIdx, setSelectedVerseIdx] = useState<number | null>(null);

  const producer = useAudioProducer({ showToast });
  const {
    source,
    edit,
    loadState,
    loadVerses,
    loadFile,
    detectFileBoundaries,
  } = producer;

  const reciters = useMemo(
    () => getStudioActiveReciters(config.customReciters, config.disabledReciters),
    [config.customReciters, config.disabledReciters]
  );

  // ── تحميل الفهارس والآيات من الموقع ──────────────────────────────
  useEffect(() => {
    let active = true;
    void fetchChapters().then((list) => {
      if (active) setChapters(list);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // تأجيل إعداد الحالة داخل الأثر إلى مهمة كلية — نمط المشروع نفسه
    // (react-hooks/set-state-in-effect).
    const tid = setTimeout(() => {
      setLoadingVerses(true);
      void fetchChapterVerses(surahId).then((list) => {
        if (!active) return;
        setVerses(list);
        const count = list.length || 7;
        setFromAyah((f) => Math.min(f, count));
        setToAyah((t) => Math.min(t, count));
        setLoadingVerses(false);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(tid);
    };
  }, [surahId]);

  const versesCount = verses.length || 7;
  // اختيار الآيات بفهرسة الشرائح — النمط نفسه المستخدم في الاستوديو
  // (بعض استجابات API بلا verse_number، والفهرسة دائماً متاحة).
  const selectedVerses = useMemo(() => {
    if (!verses.length) return [];
    const startIdx = Math.max(0, fromAyah - 1);
    const endIdx = Math.min(verses.length, toAyah);
    return verses.slice(startIdx, Math.max(startIdx + 1, endIdx));
  }, [verses, fromAyah, toAyah]);

  // ── اختصارات لوحة المفاتيح ─────────────────────────────────────────
  const shortcutsRef = useRef({ producer });
  useEffect(() => {
    shortcutsRef.current = { producer };
  }, [producer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return;
      }
      const p = shortcutsRef.current.producer;
      if (!p.source) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          p.togglePlay();
          break;
        case 'Home':
          e.preventDefault();
          p.seekToEdge('start');
          break;
        case 'End':
          e.preventDefault();
          p.seekToEdge('end');
          break;
        case 'ArrowRight':
          e.preventDefault();
          p.seekEdited(p.playheadEditedSec + (e.shiftKey ? 10 : 2));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          p.seekEdited(Math.max(0, p.playheadEditedSec - (e.shiftKey ? 10 : 2)));
          break;
        case '+':
        case '=':
          e.preventDefault();
          p.zoomIn();
          break;
        case '-':
          e.preventDefault();
          p.zoomOut();
          break;
        case 'Delete':
          if (p.activeVerseIdx >= 0) {
            e.preventDefault();
            p.removeVerse(p.activeVerseIdx);
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) p.redo();
            else p.undo();
          }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            p.redo();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── إجراءات ────────────────────────────────────────────────────────
  const handleLoadClick = useCallback(() => {
    if (loadingVerses || selectedVerses.length === 0) {
      showToast(loadingVerses ? 'لا تزال الآيات تُحمَّل…' : 'لا آيات في هذا النطاق');
      return;
    }
    const reciterName = reciters.find((r) => r.slug === reciterSlug)?.name;
    setSelectedVerseIdx(null);
    void loadVerses(reciterSlug, selectedVerses, reciterName);
  }, [loadingVerses, selectedVerses, reciterSlug, reciters, loadVerses, showToast]);

  const handleQuickExample = useCallback(() => {
    setSurahId(1);
    setFromAyah(1);
    setToAyah(7);
    setReciterSlug(RECITERS[0]?.slug ?? reciterSlug);
  }, [reciterSlug]);

  const handleSurahChange = useCallback(
    (id: number) => {
      setSurahId(id);
      setFromAyah(DEFAULT_FROM);
      setToAyah(DEFAULT_TO);
    },
    []
  );

  const handleSendToStudio = useCallback(async () => {
    setSending(true);
    try {
      const ok = await producer.sendToStudio({ surahId, fromAyah, toAyah });
      if (ok) {
        router.push('/studio');
      }
    } finally {
      setSending(false);
    }
  }, [producer, router, surahId, fromAyah, toAyah]);

  /** اختيار آية (من المكتبة أو من مسار المقاطع): تحديد + قفز. */
  const handleSelectVerse = useCallback(
    (idx: number) => {
      setSelectedVerseIdx(idx);
      producer.seekToVerse(idx);
    },
    [producer]
  );

  // ── مشتقّات العرض ─────────────────────────────────────────────────
  const isFileMode = source?.kind === 'file';
  const hasSource = Boolean(source && edit);
  const verseViews = useMemo(
    () => (source && edit ? buildVerseViews(source, edit) : []),
    [source, edit]
  );
  // نصوص الآيات متاحة فقط في وضع القارئ المدمج (الملف المرفوع بلا نصوص).
  const verseTexts = useMemo<string[] | null>(() => {
    if (isFileMode || !source || source.kind !== 'verses') return null;
    // تتطابق فهارسياً مع ترتيب الآيات المُحمَّلة إلى المصدر
    const texts = selectedVerses.map((v) => v.text_uthmani);
    return texts.length > 0 ? texts : null;
  }, [isFileMode, selectedVerses, source]);

  const activeClipId = useMemo(() => {
    if (!source || !edit) return null;
    const t = producer.playheadSourceSec;
    const hit = edit.intervals.find((it) => t >= it.startSec && t < it.endSec);
    return hit?.id ?? null;
  }, [source, edit, producer.playheadSourceSec]);

  const currentChapter = chapters.find((c) => c.id === surahId) ?? null;
  const displayedReciterName = !isFileMode
    ? reciters.find((r) => r.slug === reciterSlug)?.name ?? null
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-3 py-2.5 sm:px-6 sm:py-3 2xl:max-w-[1720px] xl:min-h-0 xl:overflow-hidden">
      <ProducerSourceBar
        chapters={chapters}
        verses={verses}
        reciters={reciters}
        surahId={surahId}
        fromAyah={fromAyah}
        toAyah={toAyah}
        reciterSlug={reciterSlug}
        sourceLabel={source?.label ?? null}
        sourceKind={source?.kind ?? null}
        sourceDurationSec={source?.durationSec ?? 0}
        verseCount={source?.verseMarkersSec.length ?? 0}
        loadStatus={loadState.status}
        loadDone={loadState.done}
        loadTotal={loadState.total}
        rendering={producer.rendering || sending}
        isFileMode={isFileMode}
        onSurahChange={handleSurahChange}
        onRangeChange={(from, to) => {
          setFromAyah(from);
          setToAyah(to);
        }}
        onReciterChange={setReciterSlug}
        onLoadClick={handleLoadClick}
        onFileUpload={(file) => void loadFile(file)}
        onExportWav={() => void producer.exportWav()}
        onSendToStudio={() => void handleSendToStudio()}
      />

      {hasSource && source && edit ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 xl:overflow-hidden">
          {/* ── المنطقة العلوية: المكتبة | المعاينة ─────────────────── */}
          <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <ProducerVerseLibrary
              verseViews={verseViews}
              verseTexts={verseTexts}
              activeVerseIdx={producer.activeVerseIdx}
              selectedVerseIdx={selectedVerseIdx}
              isPlaying={producer.isPlaying}
              thresholdRatio={producer.silenceOpts.thresholdRatio}
              minSilenceSec={producer.silenceOpts.minSilenceSec}
              silencesCount={producer.silences.length}
              hasSilences={producer.silences.length > 0}
              onThresholdChange={(v) =>
                producer.setSilenceOpts((prev) => ({ ...prev, thresholdRatio: v }))}
              onMinSilenceChange={(v) =>
                producer.setSilenceOpts((prev) => ({ ...prev, minSilenceSec: v }))}
              onDetectSilences={() => {
                const n = producer.detectSilences();
                if (n === 0) showToast('لا سكوت يطابق هذه العتبة — جرّب خفضها');
                else showToast(`اكتُشف ${n} فترة سكوت`);
              }}
              onRemoveSilences={producer.removeSilences}
              onSelectVerse={handleSelectVerse}
              onRemoveVerse={producer.removeVerse}
            />
            <ProducerPreviewPanel
              verseTexts={verseTexts}
              surahName={currentChapter?.name_arabic ?? null}
              reciterName={displayedReciterName}
              sourceLabel={source.label}
              activeVerseIdx={producer.activeVerseIdx}
              verseCount={source.verseMarkersSec.length}
              activeVerseNumber={
                source.verseNumbers[producer.activeVerseIdx] ?? null
              }
              isPlaying={producer.isPlaying}
              playheadEditedSec={producer.playheadEditedSec}
              editedTotalSec={producer.editedTotalSec}
              keptPct={producer.keptPct}
              volume={producer.volume}
              rate={producer.rate}
              onTogglePlay={producer.togglePlay}
              onSeekToEdge={producer.seekToEdge}
              onPrevVerse={() =>
                producer.seekToVerse(Math.max(0, producer.activeVerseIdx - 1))}
              onNextVerse={() =>
                producer.seekToVerse(
                  Math.min(
                    Math.max(0, source.verseMarkersSec.length - 1),
                    producer.activeVerseIdx + 1
                  )
                )}
              onVolumeChange={producer.setVolume}
              onRateChange={producer.setRate}
              onSelectVerse={handleSelectVerse}
            />
          </div>

          {/* ── المنطقة السفلية: الخط الزمني (مسار مقاطع + موجة) ─────── */}
          {/* كشف حدود الآيات للملف المرفوع */}
          {isFileMode && source.verseMarkersSec.length === 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-3 py-2">
              <Radar className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
              <span className="text-[11px] font-bold text-[var(--ink-primary)]">
                كشف حدود الآيات داخل الملف (لمسار المقاطع والتنقّل والتصدير):
              </span>
              <label className="flex items-center gap-1 text-[11px] font-bold text-[var(--ink-muted)]">
                عدد الآيات
                <input
                  type="number"
                  min={1}
                  max={286}
                  value={boundaryCount}
                  onChange={(e) =>
                    setBoundaryCount(Math.max(1, Math.min(286, Number(e.target.value) || 1)))}
                  className="w-12 rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-1 py-0.5 text-center text-[11px] font-bold tabular-nums outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => detectFileBoundaries(boundaryCount)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-2 py-1 text-[11px] font-bold text-[var(--ink-primary)] hover:bg-[var(--brand-gold)]/20"
              >
                <Sparkles className="h-3 w-3 text-[var(--brand-gold)]" aria-hidden="true" />
                كشف تلقائي
              </button>
            </div>
          )}
          <ProducerTimeline
            source={source}
            edit={edit}
            verseViews={verseViews}
            verseTexts={verseTexts}
            view={producer.view}
            selection={producer.selection}
            silences={producer.silences}
            playheadSourceSec={producer.playheadSourceSec}
            isPlaying={producer.isPlaying}
            activeVerseIdx={producer.activeVerseIdx}
            selectedVerseIdx={selectedVerseIdx}
            activeClipId={activeClipId}
            canUndo={producer.canUndo}
            canRedo={producer.canRedo}
            hasSelection={Boolean(producer.selection)}
            masterGainDb={edit.masterGainDb}
            normalizeOn={edit.normalize}
            onSplitAtPlayhead={producer.splitAtPlayhead}
            onRemoveVerse={producer.removeVerse}
            onCutSelection={producer.cutSelection}
            onRestore={producer.restoreFull}
            onUndo={producer.undo}
            onRedo={producer.redo}
            onMasterGainChange={producer.setMasterGain}
            onNormalizeChange={producer.setNormalizeOn}
            onZoomIn={producer.zoomIn}
            onZoomOut={producer.zoomOut}
            onZoomFit={producer.zoomFit}
            onSelectVerse={handleSelectVerse}
            onSeekSource={producer.seekSource}
            onSelectionChange={(span) => producer.setSelection(span)}
            onZoomAt={producer.zoomAt}
            onScrollBy={producer.scrollBySec}
            onClipGainChange={producer.setClipGain}
            onClipFadesChange={producer.setClipFades}
            onSeekEdited={producer.seekEdited}
            showToast={showToast}
          />
        </div>
      ) : (
        <div className="mt-3 grid min-h-[300px] flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          <ProducerEmptyState
            loadStatus={loadState.status}
            message={loadState.message}
            onPickExample={handleQuickExample}
          />
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 text-center">
            <p className="text-xs font-bold text-[var(--ink-muted)]">
              {toArabicDigits(versesCount)} آية متاحة في السورة المختارة
            </p>
            <p className="max-w-[240px] text-[10px] leading-relaxed text-[var(--ink-muted)]">
              بعد التحميل: مكتبة الآيات ببطاقات قابلة للتحديد والحذف، معاينة الآية
              الجارية بخط عثماني، وخط زمني بمسار مقاطع — كل آية مقطع مستقل.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
