'use client';

/**
 * ProducerClipInspector — لوحة «المقاطع والآيات» في «منتج الصوت»:
 * بطاقة المصدر + قائمة المقاطع المحفوظة (مدة/مكسب/تلاشٍ لكل مقطع، ونقر
 * للانتقال إليه) + جدول الآيات بمددها على الخط المحرَّر.
 */
import React, { useMemo } from 'react';
import { ListMusic, Layers } from 'lucide-react';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import {
  mapSourceToEditedSec,
  totalKeptSec,
  type ProducerEditState,
} from '@/lib/audio-producer/audio-producer-edit';
import type { ProducerSource } from '@/lib/audio-producer/audio-producer-engine';

interface ProducerClipInspectorProps {
  source: ProducerSource;
  edit: ProducerEditState;
  activeClipId: number | null;
  onSeekEditedSec: (sec: number) => void;
  onClipGainChange: (id: number, db: number) => void;
  onClipFadesChange: (id: number, fadeIn: number, fadeOut: number) => void;
}

export function ProducerClipInspector({
  source,
  edit,
  activeClipId,
  onSeekEditedSec,
  onClipGainChange,
  onClipFadesChange,
}: ProducerClipInspectorProps) {
  const keptSec = useMemo(() => totalKeptSec(edit), [edit]);
  const removedCount = edit.intervals.length - 1;

  // بداية كل مقطع على الخط المحرَّر (تراكمي) — للانتقال بالنقر.
  const clipStarts = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const it of edit.intervals) {
      out.push(acc);
      acc += it.endSec - it.startSec;
    }
    return out;
  }, [edit.intervals]);

  const verseRows = useMemo(() => {
    if (source.verseMarkersSec.length === 0) return [];
    return source.verseMarkersSec.map((m, i) => {
      const end = i + 1 < source.verseMarkersSec.length ? source.verseMarkersSec[i + 1] : source.durationSec;
      const editedStart = mapSourceToEditedSec(edit, m);
      const editedEnd = mapSourceToEditedSec(edit, end);
      return {
        idx: i,
        number: source.verseNumbers[i] ?? i + 1,
        sourceDur: end - m,
        editedDur: Math.max(0, editedEnd - editedStart),
        cut: editedEnd - editedStart < (end - m) * 0.5,
      };
    });
  }, [source, edit]);

  const activeIdx = useMemo(
    () => edit.intervals.findIndex((it) => it.id === activeClipId),
    [edit.intervals, activeClipId]
  );

  return (
    <div className="studio-scroll min-h-0 flex-1 space-y-3 overflow-y-auto" data-testid="producer-clips">
      {/* بطاقة المصدر */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatBox label="مدة المصدر" value={formatAudioTime(source.durationSec)} />
        <StatBox label="المدة المحفوظة" value={formatAudioTime(keptSec)} gold />
        <StatBox label="عدد الآيات" value={toArabicDigits(source.verseMarkersSec.length || source.verseNumbers.length)} />
        <StatBox label="معدل العينات" value={`${toArabicDigits(Math.round(source.sampleRate / 1000))}k Hz`} />
        <StatBox
          label="درزات قصّ"
          value={toArabicDigits(Math.max(0, removedCount))}
        />
        <StatBox
          label="القنوات"
          value={toArabicDigits(source.buffer.numberOfChannels) === '١' ? 'أحادي' : 'ستيريو'}
        />
      </div>

      {/* المقاطع المحفوظة */}
      <div className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
        <h3 className="text-xs font-bold text-[var(--ink-primary)]">
          المقاطع المحفوظة ({toArabicDigits(edit.intervals.length)})
        </h3>
      </div>
      <ol className="space-y-1.5">
        {edit.intervals.map((it, i) => {
          const active = it.id === activeClipId;
          const len = it.endSec - it.startSec;
          return (
            <li
              key={it.id}
              className={`rounded-lg border p-2 transition-colors ${
                active
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/10'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-card)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSeekEditedSec(clipStarts[i] + 0.01)}
                className="flex w-full items-center justify-between text-right"
                aria-label={`الانتقال إلى المقطع ${i + 1}`}
              >
                <span className="text-[11px] font-bold text-[var(--ink-primary)] tabular-nums">
                  مقطع {toArabicDigits(i + 1)}
                </span>
                <span className="text-[10px] font-bold text-[var(--ink-muted)] tabular-nums">
                  {formatAudioTime(it.startSec)} ← {formatAudioTime(it.endSec)} · {toArabicDigits(len.toFixed(1))} ث
                </span>
              </button>
              <div className="mt-1.5 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--ink-muted)]">
                  <span className="shrink-0">مكسب</span>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={it.gainDb}
                    onChange={(e) => onClipGainChange(it.id, Number(e.target.value))}
                    aria-label={`مكسب المقطع ${i + 1}`}
                    className="h-1.5 min-w-0 flex-1 accent-[var(--brand-gold)]"
                  />
                  <span className="w-12 shrink-0 text-left tabular-nums">
                    {toArabicDigits(it.gainDb.toFixed(1))}dB
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <FadeInput
                    label="دخول"
                    value={it.fadeInSec}
                    onChange={(v) => onClipFadesChange(it.id, v, it.fadeOutSec)}
                  />
                  <FadeInput
                    label="خروج"
                    value={it.fadeOutSec}
                    onChange={(v) => onClipFadesChange(it.id, it.fadeInSec, v)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* جدول الآيات */}
      {verseRows.length > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <ListMusic className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <h3 className="text-xs font-bold text-[var(--ink-primary)]">الآيات بعد التحرير</h3>
          </div>
          <div className="space-y-0.5">
            {verseRows.map((v) => (
              <div
                key={v.idx}
                className={`flex items-center justify-between rounded-md border px-2 py-1 text-[10px] tabular-nums ${
                  v.cut
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-card)]/70 text-[var(--ink-muted)]'
                }`}
                title={v.cut ? 'قُصّ أكثر من نصف هذه الآية' : undefined}
              >
                <span className="font-bold text-[var(--ink-primary)]">آية {toArabicDigits(v.number)}</span>
                <span dir="ltr" className="font-mono">
                  {formatAudioTime(v.editedDur)} / {formatAudioTime(v.sourceDur)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-[var(--surface-subtle)]/70 px-2.5 py-2">
      <p className="text-[10px] font-semibold text-[var(--ink-muted)]">{label}</p>
      <p
        className={`mt-0.5 text-xs font-bold tabular-nums ${
          gold ? 'text-[var(--brand-gold)]' : 'text-[var(--ink-primary)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FadeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-1 items-center gap-1 rounded-md bg-[var(--surface-subtle)] px-1.5 py-1 text-[9px] font-semibold text-[var(--ink-muted)]">
      <span className="shrink-0">تلاشي {label}</span>
      <input
        type="number"
        min={0}
        max={10}
        step={0.1}
        value={Number(value.toFixed(1))}
        onChange={(e) => onChange(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
        aria-label={`مدة تلاشي ${label}`}
        className="w-10 rounded bg-transparent text-center text-[10px] font-bold text-[var(--ink-primary)] tabular-nums outline-none focus:bg-[var(--surface-card)]"
      />
      <span className="shrink-0">ث</span>
    </label>
  );
}
