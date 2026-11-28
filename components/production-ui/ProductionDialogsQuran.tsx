'use client';

/**
 * ProductionDialogsQuran — حوارات «مكتبة القرآن» و«المشاريع» و«الترجمة»:
 * اختيار السورة، مدى الآيات، القراء، الترجمة، فتح مشروع، حفظ باسم.
 */
import { useMemo, useState } from 'react';
import { BookOpen, FolderOpen, Languages, Save, ScrollText, UserRound } from 'lucide-react';
import { RECITERS, TRANSLATIONS } from '@/lib/quran-data';
import { formatProductionClock } from '@/lib/production/production-types';
import type { ProductionStudioController } from '@/hooks/use-production-studio';
import { Field, GoldButton, PlainButton, ProdDialog, TextInput } from './ProductionDialogShell';

function relativeAr(at: number): string {
  const sec = Math.max(0, (Date.now() - at) / 1000);
  if (sec < 60) return 'الآن';
  if (sec < 3600) return `قبل ${Math.round(sec / 60)} دقيقة`;
  if (sec < 86400) return `قبل ${Math.round(sec / 3600)} ساعة`;
  return `قبل ${Math.round(sec / 86400)} يوم`;
}

export function SurahPickerDialog({ ctl }: { ctl: ProductionStudioController }) {
  const [q, setQ] = useState('');
  const close = () => ctl.setDialog(null);
  const list = useMemo(() => {
    const chapters = ctl.verses.chapters;
    const norm = q.trim();
    if (!norm) return chapters.slice(0, 114);
    return chapters.filter(
      (c) =>
        c.name_arabic.includes(norm) ||
        c.name_simple.toLowerCase().includes(norm.toLowerCase()) ||
        String(c.id) === norm
    );
  }, [ctl.verses.chapters, q]);

  const pick = async (id: number, versesCount: number) => {
    ctl.setSurahId(id);
    ctl.setFromAyah(1);
    ctl.setToAyah(Math.min(versesCount, 20));
    if (versesCount > 20) {
      close();
      ctl.showToast(`سورة من ${versesCount} آية — ضُبط المدى أول ٢٠ آية (عدّله من «الآيات»)`);
      ctl.setDialog('verse-range');
      return;
    }
    close();
    await ctl.waitForChapter(id, 6000);
    await ctl.loadRecitation({ surah: id, from: 1, to: versesCount });
  };

  return (
    <ProdDialog title="مكتبة القرآن — السور" icon={<BookOpen className="h-4 w-4" />} onClose={close} wide>
      <div className="mb-3">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم السورة أو رقمها…"
          aria-label="بحث السور"
        />
      </div>
      <div className="studio-scroll grid max-h-[52vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => void pick(c.id, c.verses_count)}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-right text-sm font-semibold ${
              c.id === ctl.surahId
                ? 'border-[#d4af37] bg-[#fdf8ea] text-[#123c22]'
                : 'border-[var(--border-hairline)] bg-white text-[var(--ink-primary)] hover:bg-[#f5f2e8]'
            }`}
          >
            <span>{c.name_arabic}</span>
            <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">{c.verses_count} آية</span>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-3 py-8 text-center text-sm text-[var(--ink-muted)]">لا نتائج</p>}
      </div>
    </ProdDialog>
  );
}

export function VerseRangeDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const total = ctl.verses.currentChapter?.verses_count ?? 7;
  const from = Math.min(ctl.fromAyah, total);
  const to = Math.min(Math.max(ctl.toAyah, from), total);

  const apply = async () => {
    ctl.setFromAyah(from);
    ctl.setToAyah(to);
    close();
    await ctl.loadRecitation({ from, to });
  };

  return (
    <ProdDialog title="مكتبة القرآن — مدى الآيات" icon={<ScrollText className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--ink-muted)]">
          سورة {ctl.surahName} — {total} آية. اختر المدى ثم حمّل التلاوة.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من الآية">
            <TextInput
              type="number"
              min={1}
              max={total}
              value={from}
              onChange={(e) => ctl.setFromAyah(Math.max(1, Math.min(total, Number(e.target.value) || 1)))}
            />
          </Field>
          <Field label="إلى الآية">
            <TextInput
              type="number"
              min={from}
              max={total}
              value={to}
              onChange={(e) => ctl.setToAyah(Math.max(from, Math.min(total, Number(e.target.value) || from)))}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <PlainButton onClick={close}>إلغاء</PlainButton>
          <GoldButton onClick={() => void apply()}>تحميل التلاوة</GoldButton>
        </div>
      </div>
    </ProdDialog>
  );
}

export function RecitersDialog({ ctl }: { ctl: ProductionStudioController }) {
  const [q, setQ] = useState('');
  const close = () => ctl.setDialog(null);
  const list = useMemo(() => {
    const norm = q.trim();
    const base = RECITERS.filter((r) => !r.style || r.style === 'murattal' || r.style === 'mujawwad');
    if (!norm) return base;
    return base.filter((r) => r.name.includes(norm) || r.slug.includes(norm.toLowerCase()));
  }, [q]);

  const pick = async (slug: string, name: string) => {
    ctl.setReciterSlug(slug);
    close();
    await ctl.loadRecitation({ reciter: slug });
    ctl.showToast(`القارئ الآن: ${name}`);
  };

  return (
    <ProdDialog title="مكتبة القرآن — القراء" icon={<UserRound className="h-4 w-4" />} onClose={close} wide>
      <div className="mb-3">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم القارئ…" aria-label="بحث القراء" />
      </div>
      <div className="studio-scroll flex max-h-[56vh] flex-col gap-1.5 overflow-y-auto">
        {list.map((r) => (
          <button
            key={r.slug}
            type="button"
            onClick={() => void pick(r.slug, r.name)}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-right text-sm ${
              r.slug === ctl.reciterSlug
                ? 'border-[#d4af37] bg-[#fdf8ea] font-bold text-[#123c22]'
                : 'border-[var(--border-hairline)] bg-white text-[var(--ink-primary)] hover:bg-[#f5f2e8]'
            }`}
          >
            <span>{r.name}</span>
            <span className="text-[11px] text-[var(--ink-muted)]">
              {r.styleLabel} · {r.country}
            </span>
          </button>
        ))}
      </div>
    </ProdDialog>
  );
}

export function TranslationDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const groups = useMemo(() => {
    const byLang = new Map<string, typeof TRANSLATIONS>();
    for (const t of TRANSLATIONS) {
      const key = t.langLabel ?? t.lang ?? 'أخرى';
      const arr = byLang.get(key) ?? [];
      arr.push(t);
      byLang.set(key, arr);
    }
    return [...byLang.entries()];
  }, []);

  return (
    <ProdDialog title="الترجمة — ترجمة معاني الآيات" icon={<Languages className="h-4 w-4" />} onClose={close} wide>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--ink-muted)]">
          تُجلب الترجمة مع الآيات وتُعرض أسفل الآية عند تفعيل «إظهار الترجمة».
        </p>
        {groups.map(([langLabel, items]) => (
          <div key={langLabel}>
            <p className="mb-1.5 text-xs font-bold text-[var(--ink-muted)]">{langLabel}</p>
            <div className="flex flex-col gap-1.5">
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    ctl.setTranslationId(t.id);
                    ctl.setVisuals((v) => ({ ...v, showTranslation: true }));
                    close();
                    ctl.showToast(`الترجمة: ${t.name}`);
                  }}
                  className={`rounded-xl border px-3 py-2 text-right text-sm ${
                    t.id === ctl.translationId
                      ? 'border-[#d4af37] bg-[#fdf8ea] font-bold text-[#123c22]'
                      : 'border-[var(--border-hairline)] bg-white text-[var(--ink-primary)] hover:bg-[#f5f2e8]'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ProdDialog>
  );
}

export function OpenProjectDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  return (
    <ProdDialog title="المشاريع — فتح مشروع" icon={<FolderOpen className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-3">
        {ctl.project.projects.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--ink-muted)]">لا مشاريع محفوظة بعد</p>
        )}
        <div className="studio-scroll flex max-h-[48vh] flex-col gap-1.5 overflow-y-auto">
          {ctl.project.projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--ink-primary)]">{p.name}</p>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  {p.surahName} {p.fromAyah}–{p.toAyah} · {p.reciterName} · {formatProductionClock(p.durationSec)} ·{' '}
                  {relativeAr(p.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <GoldButton
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    const data = ctl.project.openProject(p.id);
                    if (data) {
                      close();
                      void ctl.applyProjectData(data);
                    }
                  }}
                >
                  فتح
                </GoldButton>
                <PlainButton
                  className="h-8 px-3 text-xs"
                  onClick={() => ctl.project.deleteProject(p.id)}
                  aria-label={`حذف ${p.name}`}
                >
                  حذف
                </PlainButton>
              </div>
            </div>
          ))}
        </div>
        <PlainButton
          onClick={() => {
            close();
            const data = ctl.project.restoreAutosave();
            if (data) void ctl.applyProjectData(data);
          }}
        >
          استعادة آخر حفظ تلقائي
        </PlainButton>
      </div>
    </ProdDialog>
  );
}

export function SaveAsDialog({ ctl }: { ctl: ProductionStudioController }) {
  const [name, setName] = useState(ctl.projectName === 'مشروع جديد' ? `${ctl.surahName} — تلاوة مخصصة` : ctl.projectName);
  const close = () => ctl.setDialog(null);
  return (
    <ProdDialog title="المشاريع — حفظ باسم" icon={<Save className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <Field label="اسم المشروع">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم المشروع" />
        </Field>
        <p className="text-[11px] text-[var(--ink-muted)]">
          يُحفظ التحديد والتحرير والإعدادات في المتصفح — الصوت يُعاد جلبه تلقائياً عند الفتح.
        </p>
        <div className="flex justify-end gap-2">
          <PlainButton onClick={close}>إلغاء</PlainButton>
          <GoldButton
            onClick={() => {
              ctl.setProjectName(name);
              ctl.project.saveProject(name);
              close();
            }}
          >
            حفظ
          </GoldButton>
        </div>
      </div>
    </ProdDialog>
  );
}
