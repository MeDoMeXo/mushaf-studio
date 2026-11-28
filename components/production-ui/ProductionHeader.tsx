'use client';

/**
 * ProductionHeader — الشريط العلوي لاستوديو تحرير القرآن الكريم:
 * (أ) رأس رئيسي أخضر داكن بتدرج ونمط هندسي إسلامي (نجمة ثمانية عبر
 *     SVG data-URI بشفافية ~8%) يحمل الشعار الذهبي والعنوان وأزرار
 *     الإعدادات/المساعدة/التصدير/حفظ المشروع.
 * (ب) شريط قوائم أفقي (10 قوائم منسدلة مخصصة) يُغلق بالنقر خارجها.
 * كل الأزرار تُصدر أوامر ProductionMenuActionId عبر onAction.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftRight,
  AudioLines,
  AudioWaveform,
  Badge,
  Blend,
  BookMarked,
  BookOpen,
  BookOpenText,
  CaseSensitive,
  ChevronDown,
  Clapperboard,
  Eye,
  EyeOff,
  FileAudio,
  FilePlus2,
  FileVideo,
  FolderOpen,
  Frame,
  Gauge,
  Globe,
  HelpCircle,
  History,
  Highlighter,
  Image as ImageIcon,
  Landmark,
  Languages,
  Loader2,
  Merge,
  Mic,
  Move,
  Save,
  ScrollText,
  Settings,
  Settings2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Timer,
  Type,
  Upload,
  UserRound,
  VolumeOff,
} from 'lucide-react';
import type { ProductionMenuActionId } from '@/lib/production/production-types';

/** نوع أيقونة lucide مشتق من أحد الأيقونات (بلا استيراد نوع إضافي). */
type IconType = typeof BookOpenText;

/** نمط النجمة الثمانية (خاتم) — طبقة SVG شبه شفافة فوق تدرج الرأس الأخضر. */
const STAR_PATTERN_URL =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52' ` +
  `viewBox='0 0 52 52'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.08)' stroke-width='1'%3E` +
  `%3Crect x='14' y='14' width='24' height='24'/%3E` +
  `%3Crect x='14' y='14' width='24' height='24' transform='rotate(45 26 26)'/%3E` +
  `%3Ccircle cx='26' cy='26' r='2'/%3E%3C/g%3E%3C/svg%3E")`;

export interface ProductionHeaderProps {
  onAction: (id: ProductionMenuActionId) => void;
  showTranslation: boolean;
  canSave: boolean;
  saveState: 'saved' | 'dirty' | 'saving';
}

interface MenuItemDef {
  id: ProductionMenuActionId;
  label: string;
  icon: IconType;
  hint?: string;
}

interface MenuDef {
  key: string;
  label: string;
  icon: IconType;
  items: MenuItemDef[];
}

/** بناء تعريفات القوائم العشر (تعتمد على حالة الترجمة فقط). */
function buildMenus(showTranslation: boolean): MenuDef[] {
  return [
    {
      key: 'projects',
      label: 'المشاريع',
      icon: FolderOpen,
      items: [
        { id: 'project:new', label: 'جديد', icon: FilePlus2 },
        { id: 'project:open', label: 'فتح', icon: FolderOpen },
        { id: 'project:save', label: 'حفظ', icon: Save },
        { id: 'project:restore', label: 'استعادة', icon: History },
      ],
    },
    {
      key: 'quran',
      label: 'مكتبة القرآن',
      icon: BookOpen,
      items: [
        { id: 'quran:surahs', label: 'السور', icon: ScrollText, hint: 'اختيار السورة والمدى' },
        { id: 'quran:verses', label: 'الآيات', icon: Highlighter },
        { id: 'quran:recitation', label: 'التلاوات', icon: AudioLines },
        { id: 'quran:reciters', label: 'القراء', icon: UserRound },
      ],
    },
    {
      key: 'sound',
      label: 'مكتبة الصوت',
      icon: AudioLines,
      items: [
        { id: 'sound:recordings', label: 'تسجيلات', icon: Mic },
        { id: 'sound:effects', label: 'مؤثرات', icon: Sparkles },
        { id: 'sound:ambient', label: 'خلفيات صوتية', icon: AudioWaveform },
      ],
    },
    {
      key: 'images',
      label: 'مكتبة الصور',
      icon: ImageIcon,
      items: [
        { id: 'images:backgrounds', label: 'خلفيات إسلامية', icon: Landmark },
        { id: 'images:ornaments', label: 'زخارف', icon: Frame },
        { id: 'images:logos', label: 'شعارات', icon: Badge },
      ],
    },
    {
      key: 'audio',
      label: 'تحرير الصوت',
      icon: SlidersHorizontal,
      items: [
        { id: 'audio:clean', label: 'تنقية', icon: Sparkles },
        { id: 'audio:denoise', label: 'إزالة الضوضاء', icon: VolumeOff },
        { id: 'audio:level', label: 'مستوى الصوت', icon: Gauge },
      ],
    },
    {
      key: 'video',
      label: 'تحرير الفيديو',
      icon: Clapperboard,
      items: [
        { id: 'video:cut', label: 'قص', icon: Scissors },
        { id: 'video:merge', label: 'دمج', icon: Merge },
        { id: 'video:transitions', label: 'انتقالات', icon: Blend },
        { id: 'video:animate', label: 'تحريك', icon: Move },
      ],
    },
    {
      key: 'text',
      label: 'النصوص',
      icon: Type,
      items: [
        { id: 'text:verses', label: 'الآيات', icon: BookMarked },
        { id: 'text:surah', label: 'أسماء السور', icon: Tag },
        { id: 'text:reciter', label: 'اسم القارئ', icon: UserRound },
        { id: 'text:custom', label: 'نص مخصص', icon: CaseSensitive },
      ],
    },
    {
      key: 'translation',
      label: 'الترجمة',
      icon: Languages,
      items: [
        { id: 'translation:pick', label: 'ترجمة معاني الآيات', icon: Globe, hint: 'اختيار لغة الترجمة' },
        {
          id: 'translation:toggle',
          label: showTranslation ? 'إخفاء الترجمة' : 'إظهار الترجمة',
          icon: showTranslation ? EyeOff : Eye,
        },
      ],
    },
    {
      key: 'sync',
      label: 'التوقيت والمزامنة',
      icon: Timer,
      items: [
        { id: 'sync:verses', label: 'مزامنة الآيات مع التلاوة', icon: ArrowLeftRight, hint: 'محاذاة تلقائية' },
      ],
    },
    {
      key: 'export',
      label: 'التصدير',
      icon: Upload,
      items: [
        { id: 'export:mp3', label: 'MP3', icon: FileAudio },
        { id: 'export:wav', label: 'WAV', icon: FileAudio },
        { id: 'export:mp4', label: 'MP4', icon: FileVideo },
        { id: 'export:quality', label: 'إعدادات الجودة', icon: Settings2, hint: 'الدقة ومعدل البت' },
      ],
    },
  ];
}

/** قائمة منسدلة واحدة: زر داخل شريط التمرير + بطاقة عناصر عبر portal
 *  (ثابتة الموضع) كي لا تقصّها حاوية overflow-x، وتُغلق بالنقر الخارجي
 *  أو بـ Escape أو عند أي تمرير. */
function HeaderMenu({ menu, onAction }: { menu: MenuDef; onAction: (id: ProductionMenuActionId) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    const el = btnRef.current?.getBoundingClientRect();
    if (el) {
      // RTL: تثبيت الحافة اليمنى للبطاقة مع الحافة اليمنى للزر، داخل الشاشة.
      const right = Math.max(8, Math.min(el.right, window.innerWidth - 8));
      setAnchor({ top: el.bottom + 4, right });
    }
    setOpen(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // البطاقة مُنفَّذة إلى body — تُعدّ داخل القائمة (وإلا لابتلع mousedown
      // العناصرَ قبل click فلا يصل الأمر أبداً).
      const inside =
        (rootRef.current && rootRef.current.contains(target)) ||
        (cardRef.current && cardRef.current.contains(target));
      if (!inside) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onAnyScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('touchstart', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onAnyScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('touchstart', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onAnyScroll, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-8 items-center gap-1 rounded-md px-3 text-sm text-[#e8e6df] hover:bg-white/10 ${
          open ? 'bg-white/10' : ''
        }`}
      >
        <menu.icon className="h-3.5 w-3.5 text-[#e6c75a]" aria-hidden />
        <span>{menu.label}</span>
        <ChevronDown
          className={`h-3 w-3 text-[#e6c75a]/80 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            ref={cardRef}
            role="menu"
            aria-label={menu.label}
            style={{ position: 'fixed', top: `${anchor.top}px`, right: `${anchor.right}px` }}
            className="z-50 w-52 rounded-xl border border-[#e3dac6] bg-white p-1 shadow-xl"
          >
            {menu.items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAction(item.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-[#1f1b16] hover:bg-[#f5f2e8]"
              >
                <item.icon className="h-4 w-4 shrink-0 text-[#0b3d2e]" aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.hint && <span className="ms-auto shrink-0 text-[10px] text-[#6a6155]">{item.hint}</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export function ProductionHeader(props: ProductionHeaderProps) {
  const { onAction, showTranslation, canSave, saveState } = props;
  const menus = useMemo(() => buildMenus(showTranslation), [showTranslation]);

  const saveTitle =
    saveState === 'saving' ? 'جارٍ حفظ المشروع…' : saveState === 'dirty' ? 'توجد تغييرات غير محفوظة' : 'المشروع محفوظ';
  const saveDisabled = !canSave || saveState === 'saving';

  return (
    <header className="w-full">
      {/* الشريط أ — الرأس الرئيسي */}
      <div
        className="flex min-h-16 w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:h-16 sm:flex-nowrap sm:px-4"
        style={{
          backgroundImage: `${STAR_PATTERN_URL}, linear-gradient(to left, #123c22, #0d3320)`,
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/70 bg-[#0d3320]/60"
            aria-hidden
          >
            <BookOpenText className="h-5 w-5 text-[#d4af37]" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <h1 className="truncate font-display text-xl font-bold text-white">استوديو تحرير القرآن الكريم</h1>
            <span className="truncate text-xs text-[#e6c75a]">إنشاء احترافي بجودة عالية</span>
          </div>
        </div>

        {/* عناق الأزرار — الترتيب البصري من اليسار: الإعدادات، مساعدة، تصدير، حفظ */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onAction('app:save')}
            disabled={saveDisabled}
            title={saveTitle}
            aria-label={`حفظ المشروع — ${saveTitle}`}
            className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-l from-[#e8c44a] to-[#c99b2f] px-4 text-sm font-bold text-[#123c22] shadow transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            <span>حفظ المشروع</span>
          </button>
          <button
            type="button"
            onClick={() => onAction('app:export')}
            aria-label="تصدير"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#d4af37]/40 bg-white px-4 text-sm font-semibold text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
          >
            <Upload className="h-4 w-4" aria-hidden />
            <span>تصدير</span>
          </button>
          <button
            type="button"
            onClick={() => onAction('app:help')}
            aria-label="مساعدة"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#d4af37]/40 bg-white px-4 text-sm font-semibold text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
            <span>مساعدة</span>
          </button>
          <button
            type="button"
            onClick={() => onAction('app:settings')}
            aria-label="الإعدادات"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#d4af37]/40 bg-white px-4 text-sm font-semibold text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
          >
            <Settings className="h-4 w-4" aria-hidden />
            <span>الإعدادات</span>
          </button>
        </div>
      </div>

      {/* الشريط ب — شريط القوائم */}
      <nav
        aria-label="قوائم الاستوديو"
        className="relative z-40 flex h-10 w-full items-center gap-1 overflow-x-auto bg-[#0d2e1b] px-2 studio-scroll"
      >
        {menus.map((menu) => (
          <HeaderMenu key={menu.key} menu={menu} onAction={onAction} />
        ))}
      </nav>
    </header>
  );
}
