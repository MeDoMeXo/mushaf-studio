'use client';

/**
 * ProductionDialogsVisual — حوارات «مكتبة الصور» و«النصوص» البصرية والإعدادات:
 * خلفيات (فيديو/تدرّجات)، زخارف، شعارات/علامة مائية، انتقالات، تحريك
 * النص مع الصوت، إعدادات التصميم، والمساعدة.
 */
import { useState } from 'react';
import { Blend, Frame, HelpCircle, ImageIcon, Move, Settings2, Type } from 'lucide-react';
import { BUILTIN_BG_LIBRARY, getBuiltinBackground } from '@/lib/background-library';
import { STUDIO_GRADIENTS, STUDIO_FONTS, STUDIO_TEXT_COLORS } from '@/lib/quran-data';
import type { ProductionStudioController } from '@/hooks/use-production-studio';
import { Field, GoldButton, PlainButton, ProdDialog, RangeInput, TextInput } from './ProductionDialogShell';

export function BgImagesDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const apply = (bgId: string) => {
    ctl.setVisuals((v) => ({ ...v, bgId }));
    ctl.showToast(`خلفية: ${getBuiltinBackground(bgId)?.name ?? 'تدرّج مخصص'}`);
  };
  return (
    <ProdDialog title="مكتبة الصور — خلفيات إسلامية وطبيعية" icon={<ImageIcon className="h-4 w-4" />} onClose={close} wide>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {BUILTIN_BG_LIBRARY.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => apply(bg.id)}
              className={`overflow-hidden rounded-xl border text-right ${
                ctl.visuals.bgId === bg.id ? 'border-[#d4af37] ring-2 ring-[#d4af37]/50' : 'border-[var(--border-hairline)]'
              }`}
              style={{
                background: `linear-gradient(135deg, ${bg.posterColors[0]}, ${bg.posterColors[1]})`,
              }}
            >
              <span className="flex h-16 items-end p-1.5 text-[11px] font-bold text-white drop-shadow">
                {bg.name}
              </span>
            </button>
          ))}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold text-[var(--ink-muted)]">تدرّجات ملوّنة (بلا فيديو)</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {STUDIO_GRADIENTS.slice(0, 15).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => apply(`gradient:${g.id}`)}
                className={`overflow-hidden rounded-xl border text-right ${
                  ctl.visuals.bgId === `gradient:${g.id}` ? 'border-[#d4af37] ring-2 ring-[#d4af37]/50' : 'border-[var(--border-hairline)]'
                }`}
                style={{
                  background: `linear-gradient(${g.angle}deg, ${g.stops.map((s) => `${s[1]} ${s[0]}%`).join(', ')})`,
                }}
              >
                <span className="flex h-12 items-end p-1.5 text-[10px] font-bold text-white drop-shadow">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ProdDialog>
  );
}

export function OrnamentsDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  return (
    <ProdDialog title="مكتبة الصور — زخارف الإطار" icon={<Frame className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5 text-sm font-bold">
          الإطار الذهبي المزدوج بمعيّنات الزوايا
          <input
            type="checkbox"
            checked={ctl.visuals.goldFrame}
            onChange={(e) => ctl.setVisuals((v) => ({ ...v, goldFrame: e.target.checked }))}
            className="h-4 w-4 accent-[#0b3d2e]"
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5 text-sm font-bold">
          القوسان والقناديل وأفق المسجد والجسيمات
          <span className="text-[11px] font-normal text-[#7a5c10]">دائماً في المشهد</span>
        </label>
        <p className="text-[11px] text-[var(--ink-muted)]">
          الزخارف مرسومة إجرائياً — تعمل فوراً بلا أي أصول خارجية، وتدخل التصدير كما هي.
        </p>
      </div>
    </ProdDialog>
  );
}

export function WatermarkDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const [wm, setWm] = useState(ctl.visuals.watermark);
  return (
    <ProdDialog title="مكتبة الصور — شعار/علامة مائية" icon={<Type className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <Field label="نص العلامة المائية (فراغ = بلا علامة)">
          <TextInput value={wm} onChange={(e) => setWm(e.target.value)} placeholder="مصحف الاستوديو" />
        </Field>
        <div className="flex justify-end gap-2">
          <PlainButton onClick={() => { ctl.setVisuals((v) => ({ ...v, watermark: '' })); close(); }}>
            بلا علامة
          </PlainButton>
          <GoldButton onClick={() => { ctl.setVisuals((v) => ({ ...v, watermark: wm })); close(); }}>
            تطبيق
          </GoldButton>
        </div>
      </div>
    </ProdDialog>
  );
}

export function TransitionsDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const opts: { id: 'none' | 'fade' | 'dissolve'; label: string; hint: string }[] = [
    { id: 'none', label: 'بلا انتقال', hint: 'تبديل الآية مباشرة' },
    { id: 'fade', label: 'تلاشٍ', hint: 'دخول الآية بنعومة' },
    { id: 'dissolve', label: 'ذوبان', hint: 'انتقال هادئ للخلفية' },
  ];
  return (
    <ProdDialog title="تحرير الفيديو — انتقالات الآيات" icon={<Blend className="h-4 w-4" />} onClose={close}>
      <div className="grid gap-2">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => { ctl.setVisuals((v) => ({ ...v, transition: o.id })); close(); }}
            className={`rounded-xl border px-3 py-2.5 text-right ${
              ctl.visuals.transition === o.id
                ? 'border-[#d4af37] bg-[#fdf8ea] font-bold text-[#123c22]'
                : 'border-[var(--border-hairline)] bg-white hover:bg-[#f5f2e8]'
            }`}
          >
            {o.label}
            <span className="block text-[11px] font-normal text-[var(--ink-muted)]">{o.hint}</span>
          </button>
        ))}
      </div>
    </ProdDialog>
  );
}

export function AnimateDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const v = ctl.visuals;
  return (
    <ProdDialog title="تحرير الفيديو — تحريك الآية مع الصوت" icon={<Move className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5 text-sm font-bold">
          تحريك النص لمتابعة التلاوة (نافذة تمرير)
          <input
            type="checkbox"
            checked={v.followAudio}
            onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, followAudio: e.target.checked }))}
            className="h-4 w-4 accent-[#0b3d2e]"
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2.5 text-sm font-bold">
          تلوين الكلمة الجارية أثناء نطقها (كاليوكي)
          <input
            type="checkbox"
            checked={v.karaoke}
            onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, karaoke: e.target.checked }))}
            className="h-4 w-4 accent-[#0b3d2e]"
          />
        </label>
        <Field label={`موضع الآية العمودي — ${Math.round(v.versePosition * 100)}٪`}>
          <RangeInput
            min={0}
            max={1}
            step={0.05}
            value={v.versePosition}
            onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, versePosition: Number(e.target.value) }))}
            aria-label="موضع الآية"
          />
        </Field>
      </div>
    </ProdDialog>
  );
}

export function SettingsDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  const v = ctl.visuals;
  return (
    <ProdDialog title="الإعدادات — تصميم المشهد" icon={<Settings2 className="h-4 w-4" />} onClose={close} wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2 text-sm font-bold">
            الآية في سطر واحد
            <input
              type="checkbox"
              checked={v.oneLine}
              onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, oneLine: e.target.checked }))}
              className="h-4 w-4 accent-[#0b3d2e]"
            />
          </label>
          <Field label="الخط القرآني">
            <select
              value={v.fontFamily}
              onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, fontFamily: e.target.value }))}
              className="h-9 rounded-lg border border-[var(--border-hairline)] bg-white px-2 text-sm"
              aria-label="الخط"
            >
              {STUDIO_FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`حجم الخط — ${v.fontSize}px`}>
          <RangeInput
            min={36}
            max={110}
            step={2}
            value={v.fontSize}
            onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, fontSize: Number(e.target.value) }))}
            aria-label="حجم الخط"
          />
        </Field>
        <Field label={`موضع الآية — ${Math.round(v.versePosition * 100)}٪`}>
          <RangeInput
            min={0}
            max={1}
            step={0.05}
            value={v.versePosition}
            onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, versePosition: Number(e.target.value) }))}
            aria-label="موضع الآية"
          />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-bold text-[var(--ink-muted)]">لون نص الآية</p>
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => ctl.setVisuals((vv) => ({ ...vv, textColor: c }))}
                aria-label={`اللون ${c}`}
                className={`h-8 w-8 rounded-lg border-2 ${v.textColor === c ? 'border-[#d4af37]' : 'border-[var(--border-hairline)]'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['showSurahTitle', 'عنوان السورة'],
            ['showReciterName', 'اسم القارئ'],
            ['showTranslation', 'الترجمة'],
            ['karaoke', 'كاليوكي الكلمة'],
            ['followAudio', 'متابعة الصوت'],
            ['goldFrame', 'الإطار الذهبي'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2 text-sm font-bold">
              {label}
              <input
                type="checkbox"
                checked={v[key]}
                onChange={(e) => ctl.setVisuals((vv) => ({ ...vv, [key]: e.target.checked }))}
                className="h-4 w-4 accent-[#0b3d2e]"
              />
            </label>
          ))}
        </div>
      </div>
    </ProdDialog>
  );
}

export function HelpDialog({ ctl }: { ctl: ProductionStudioController }) {
  const close = () => ctl.setDialog(null);
  void ctl;
  return (
    <ProdDialog title="المساعدة — دليل الاستوديو" icon={<HelpCircle className="h-4 w-4" />} onClose={close}>
      <div className="flex flex-col gap-3 text-sm leading-7 text-[var(--ink-primary)]">
        <p><strong>سير العمل:</strong> مكتبة القرآن ← اختر السورة والمدى والقارئ ← حمّل التلاوة ← حرّر على المسارات ← صدّر MP3/WAV/MP4.</p>
        <p><strong>المسارات:</strong> فيديو (الخلفية) · تلاوة (موجة خضراء بحدود آيات قابلة للسحب) · موسيقى (أرجوانية) · مؤثرات (برتقالية) · نصوص (زرقاء).</p>
        <p><strong>الكاليوكي:</strong> تتلوّن الكلمة الجارية أثناء النطق — المعاينة والتصدير من مسار واحد فما تسمعه وتراه هو الملف.</p>
        <p><strong>المشاريع:</strong> حفظ/فتح/استعادة تلقائية من قائمة «المشاريع» — الصوت يُعاد جلبه عند الفتح تلقائياً.</p>
        <p><strong>اختصارات:</strong> مسافة = تشغيل/إيقاف · Ctrl+Z/‌Ctrl+Shift+Z = تراجع/إعادة (تحرير الصوت) · نقرة على الخط الزمني = قفز.</p>
      </div>
    </ProdDialog>
  );
}
