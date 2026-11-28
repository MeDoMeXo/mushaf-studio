'use client';

/**
 * ProductionMediaLibrary — القائمة اليمنى «مكتبة الوسائط»:
 * أربع تبويبات (المكتبة/الصور/الموسيقى/المؤثرات) + حقل بحث يرشّح
 * بالاسم. تبويب المكتبة يعرض 6 بطاقات (صور مع احتياط تدرج عند فشل
 * التحميل)، تبويب الصور يعرض مدخلتي BUILTIN_BG_LIBRARY التسع كاملة،
 * تبويب الموسيقى يعرض ملف الموسيقى الحالي والمحيطات الأربعة، وتبويب
 * المؤثرات يعرض المقاطع النشطة مع إمكانية الإزالة + المحيطات.
 */
import React, { useState } from 'react';
import {
  AudioWaveform,
  CloudRain,
  FileUp,
  Image as ImageIcon,
  Landmark,
  MoonStar,
  Search,
  Sparkles,
  Star,
  Trees,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import {
  AMBIENT_LIBRARY,
  formatProductionShort,
  type ProductionAmbientKind,
  type ProductionEffectClip,
} from '@/lib/production/production-types';
import { BUILTIN_BG_LIBRARY, getBuiltinBackground } from '@/lib/background-library';

type IconType = typeof Star;

export interface ProductionMediaLibraryProps {
  activeBgId: string;
  onApplyBackground: (bgId: string) => void;
  onAddMusic: () => void;
  onRemoveMusic: () => void;
  hasMusic: boolean;
  musicName: string | null;
  effectClips: ProductionEffectClip[];
  onAddAmbient: (kind: ProductionAmbientKind) => void;
  onRemoveEffect: (id: string) => void;
}

type LibraryTab = 'library' | 'images' | 'music' | 'effects';

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'library', label: 'المكتبة' },
  { id: 'images', label: 'الصور' },
  { id: 'music', label: 'الموسيقى' },
  { id: 'effects', label: 'المؤثرات' },
];

/** بطاقات تبويب «المكتبة» — صور ترشد إلى خلفيات أو موسيقى. */
const LIBRARY_CARDS: {
  key: string;
  name: string;
  img: string;
  bgId: string | null;
  icon: IconType;
}[] = [
  { key: 'mosque', name: 'خلفية إسلامية', img: '/assets/production-library/mosque-bg.png', bgId: 'islamic-1-star-rotate', icon: ImageIcon },
  { key: 'calm-music', name: 'موسيقى هادئة', img: '/assets/production-library/calm-music.png', bgId: null, icon: AudioWaveform },
  { key: 'calm-nature', name: 'طبيعة هادئة', img: '/assets/production-library/calm-nature.png', bgId: 'nature-1-clouds', icon: ImageIcon },
  { key: 'islamic-pattern', name: 'نقوش إسلامية', img: '/assets/production-library/islamic-pattern.png', bgId: 'islamic-2-arabesque', icon: ImageIcon },
  { key: 'light-rays', name: 'إضاءة ونور', img: '/assets/production-library/light-rays.png', bgId: 'islamic-5-light-rays', icon: ImageIcon },
  { key: 'lanterns', name: 'فانوس إسلامي', img: '/assets/production-library/lanterns.png', bgId: 'islamic-4-lanterns', icon: ImageIcon },
];

const MUSIC_POSTER: [string, string] = ['#7c4dc4', '#b493e6'];

/** ألوان احتياط البطاقة (من مكتبة الخلفيات أو بنفسجي الموسيقى). */
function posterFor(bgId: string | null): [string, string] {
  if (!bgId) return MUSIC_POSTER;
  return getBuiltinBackground(bgId)?.posterColors ?? ['#123c22', '#e6c75a'];
}

const AMBIENT_ICONS: Record<ProductionAmbientKind, IconType> = {
  rain: CloudRain,
  night: MoonStar,
  ocean: Waves,
  breeze: Wind,
};

function effectKindLabel(clip: ProductionEffectClip): string {
  if (clip.kind === 'echo') return 'صدى';
  const labels: Record<ProductionAmbientKind, string> = { rain: 'مطر', night: 'ليل', ocean: 'بحر', breeze: 'نسيم' };
  return labels[clip.ambient];
}

export function ProductionMediaLibrary(props: ProductionMediaLibraryProps) {
  const {
    activeBgId,
    onApplyBackground,
    onAddMusic,
    onRemoveMusic,
    hasMusic,
    musicName,
    effectClips,
    onAddAmbient,
    onRemoveEffect,
  } = props;

  const [tab, setTab] = useState<LibraryTab>('library');
  const [query, setQuery] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const q = query.trim();
  const matches = (name: string) => !q || name.includes(q);

  const libraryCards = LIBRARY_CARDS.filter((c) => matches(c.name));
  const bgEntries = BUILTIN_BG_LIBRARY.filter((bg) => matches(bg.name));
  const ambientRows = AMBIENT_LIBRARY.filter((a) => matches(a.label));
  const effectRows = effectClips.filter((c) => matches(effectKindLabel(c)));

  const markFailed = (key: string) => {
    setFailedImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const renderAmbientRows = (rows: typeof ambientRows) => (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#e3dac6] px-2 py-3 text-center text-[11px] text-[var(--ink-muted)]">
          لا نتائج مطابقة
        </p>
      )}
      {rows.map((a) => {
        const AmbientIcon = AMBIENT_ICONS[a.kind];
        return (
          <div key={a.kind} className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-white p-2">
            <AmbientIcon className="h-4 w-4 shrink-0 text-[#7c4dc4]" aria-hidden />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-bold text-[var(--ink-primary)]">{a.label}</span>
              <span className="truncate text-[10px] text-[var(--ink-muted)]">{a.hint}</span>
            </div>
            <button
              type="button"
              onClick={() => onAddAmbient(a.kind)}
              className="ms-auto shrink-0 rounded-full bg-[#0b3d2e] px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-[#0d4a36]"
            >
              إضافة
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <aside
      aria-label="مكتبة الوسائط"
      className="flex w-[260px] max-w-[260px] shrink-0 flex-col gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 shadow-sm"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#123c22] px-3 text-sm font-bold text-white">
        <Star className="h-4 w-4 text-[#e6c75a]" aria-hidden />
        <span>مكتبة الوسائط</span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1" role="tablist" aria-label="أقسام المكتبة">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`h-7 rounded-full border px-3 text-xs font-semibold transition-colors ${
                active
                  ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white'
                  : 'border-[#e3dac6] bg-white text-[#6a6155] hover:border-[#d4af37]/60'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في المكتبة..."
          aria-label="بحث في المكتبة"
          className="h-8 w-full rounded-lg border border-[#e3dac6] bg-white ps-8 pe-2 text-xs text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
        />
      </div>

      <div className="flex min-h-0 max-h-[480px] flex-1 flex-col gap-2 overflow-y-auto studio-scroll" role="tabpanel">
        {/* تبويب المكتبة */}
        {tab === 'library' && (
          <div className="grid grid-cols-2 gap-2">
            {libraryCards.map((card) => {
              const poster = posterFor(card.bgId);
              const active = card.bgId !== null && card.bgId === activeBgId;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => (card.bgId ? onApplyBackground(card.bgId) : onAddMusic())}
                  aria-pressed={active}
                  title={card.bgId ? `تطبيق خلفية: ${card.name}` : 'إضافة موسيقى هادئة'}
                  className={`group overflow-hidden rounded-xl border text-start transition-shadow ${
                    active
                      ? 'border-[#b88a1e] ring-2 ring-[#d4af37]'
                      : 'border-[var(--border-hairline)] hover:border-[#d4af37]/60'
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-subtle)]">
                    {failedImages[card.key] ? (
                      <div
                        className="absolute inset-0"
                        style={{ background: `linear-gradient(135deg, ${poster[0]}, ${poster[1]})` }}
                      />
                    ) : (
                      <img
                        src={card.img}
                        alt={card.name}
                        loading="lazy"
                        onError={() => markFailed(card.key)}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 border-t border-[var(--border-hairline)] bg-white px-2 py-1.5">
                    <card.icon
                      className={`h-3 w-3 shrink-0 ${card.bgId ? 'text-[#123c22]' : 'text-[#7c4dc4]'}`}
                      aria-hidden
                    />
                    <span className="truncate text-xs font-bold text-[var(--ink-primary)]">{card.name}</span>
                  </div>
                </button>
              );
            })}
            {libraryCards.length === 0 && (
              <p className="col-span-2 rounded-lg border border-dashed border-[#e3dac6] px-2 py-3 text-center text-[11px] text-[var(--ink-muted)]">
                لا نتائج مطابقة
              </p>
            )}
          </div>
        )}

        {/* تبويب الصور — كل مدخلات مكتبة الخلفيات المدمجة */}
        {tab === 'images' && (
          <div className="grid grid-cols-2 gap-2">
            {bgEntries.map((bg) => {
              const active = bg.id === activeBgId;
              const CategoryIcon = bg.category === 'islamic' ? Landmark : Trees;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => onApplyBackground(bg.id)}
                  aria-pressed={active}
                  title={bg.name}
                  className={`overflow-hidden rounded-xl border text-start ${
                    active
                      ? 'border-[#b88a1e] ring-2 ring-[#d4af37]'
                      : 'border-[var(--border-hairline)] hover:border-[#d4af37]/60'
                  }`}
                >
                  <div
                    className="relative aspect-[4/3] w-full"
                    style={{ background: `linear-gradient(135deg, ${bg.posterColors[0]}, ${bg.posterColors[1]})` }}
                  >
                    <span className="absolute start-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/25 text-white">
                      <CategoryIcon className="h-3 w-3" aria-hidden />
                    </span>
                  </div>
                  <div className="flex items-center gap-1 border-t border-[var(--border-hairline)] bg-white px-2 py-1.5">
                    <ImageIcon className="h-3 w-3 shrink-0 text-[#123c22]" aria-hidden />
                    <span className="truncate text-xs font-bold text-[var(--ink-primary)]">{bg.name}</span>
                  </div>
                </button>
              );
            })}
            {bgEntries.length === 0 && (
              <p className="col-span-2 rounded-lg border border-dashed border-[#e3dac6] px-2 py-3 text-center text-[11px] text-[var(--ink-muted)]">
                لا نتائج مطابقة
              </p>
            )}
          </div>
        )}

        {/* تبويب الموسيقى */}
        {tab === 'music' && (
          <div className="flex flex-col gap-2">
            {hasMusic ? (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-white p-2">
                <AudioWaveform className="h-4 w-4 shrink-0 text-[#7c4dc4]" aria-hidden />
                <span className="truncate text-xs font-bold text-[var(--ink-primary)]" title={musicName ?? ''}>
                  {musicName ?? 'ملف موسيقى'}
                </span>
                <button
                  type="button"
                  onClick={onRemoveMusic}
                  aria-label="إزالة الموسيقى"
                  className="ms-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#b91c1c] transition-colors hover:bg-[#fdecec]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[#e3dac6] px-2 py-3 text-center text-[11px] text-[var(--ink-muted)]">
                لا توجد موسيقى مضافة
              </p>
            )}
            <button
              type="button"
              onClick={onAddMusic}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#b88a1e]/60 bg-[#fdf8ea] text-xs font-bold text-[#8a6a14] transition-colors hover:bg-[#f8f2dd]"
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden />
              <span>إضافة موسيقى من جهازك</span>
            </button>
            <p className="px-1 text-[10px] font-bold text-[var(--ink-muted)]">خلفيات محيطية</p>
            {renderAmbientRows(ambientRows)}
          </div>
        )}

        {/* تبويب المؤثرات */}
        {tab === 'effects' && (
          <div className="flex flex-col gap-2">
            {effectRows.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#e3dac6] px-2 py-3 text-center text-[11px] text-[var(--ink-muted)]">
                لا مؤثرات مضافة بعد
              </p>
            )}
            {effectRows.map((clip) => (
              <div key={clip.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-white p-2">
                <Sparkles className="h-4 w-4 shrink-0 text-[#f5a13a]" aria-hidden />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-xs font-bold text-[var(--ink-primary)]">{effectKindLabel(clip)}</span>
                  <span dir="ltr" className="text-[10px] tabular-nums text-[var(--ink-muted)]">
                    {formatProductionShort(clip.startSec)} – {formatProductionShort(clip.endSec)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveEffect(clip.id)}
                  aria-label={`إزالة مؤثر ${effectKindLabel(clip)}`}
                  className="ms-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#b91c1c] transition-colors hover:bg-[#fdecec]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
            <p className="px-1 text-[10px] font-bold text-[var(--ink-muted)]">إضافة مؤثر محيط</p>
            {renderAmbientRows(ambientRows)}
          </div>
        )}
      </div>
    </aside>
  );
}
