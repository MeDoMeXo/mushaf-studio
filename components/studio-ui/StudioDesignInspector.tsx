'use client';

/**
 * StudioDesignInspector — style inspector shell.
 * Per the 600-line file rule, the five tab bodies live in dedicated panels:
 * templates (inline, small), ornaments, background, text, and audio.
 */
import React from 'react';
import { motion } from 'motion/react';
import {
  BookmarkPlus,
  Check,
  FileDown,
  FileUp,
  Image as ImageIcon,
  Palette,
  Share2,
  Trash2,
  Type,
  Upload,
  Video,
  Volume2,
} from 'lucide-react';
import {
  STUDIO_TEMPLATES,
  type AspectPresetId,
  type SavedCustomTemplate,
  type StudioState,
  type StudioTemplate,
} from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import { filterTemplatesByCategory } from '@/lib/islamic-ornaments';
import type { VideoExportSettings } from '@/lib/video-export';
import { StudioOrnamentsPanel } from '../StudioOrnamentsPanel';
import { StudioAudioPanel } from './StudioAudioPanel';
import type { BuiltinBackground } from '@/lib/background-library';
import { StudioBackgroundPanel } from './StudioBackgroundPanel';
import { StudioTextPanel } from './StudioTextPanel';
import {
  InspectorSectionsProvider,
  StudioInspectorSection,
} from './StudioInspectorSection';
import { StudioInspectorSectionsToolbar } from './StudioInspectorSectionsToolbar';
import { useInspectorSectionVisibility } from '@/hooks/use-inspector-section-visibility';
import {
  StudioTabPanel,
  StudioTabsList,
  StudioTabsRoot,
  StudioTabTrigger,
} from './StudioTabs';

export type StyleTab = 'templates' | 'ornaments' | 'background' | 'text' | 'audio';
export type TemplateCategory =
  | 'all'
  | 'mushaf'
  | 'haramain'
  | 'andalus'
  | 'nature'
  | 'minimal';

const STYLE_TABS: { id: StyleTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'templates', label: 'قوالب', icon: Palette },
  { id: 'ornaments', label: 'زخارف', icon: ImageIcon },
  { id: 'background', label: 'الخلفية', icon: Video },
  { id: 'text', label: 'النص', icon: Type },
  { id: 'audio', label: 'الصوت', icon: Volume2 },
];

const STYLE_TAB_VALUES: StyleTab[] = ['templates', 'ornaments', 'background', 'text', 'audio'];

const TEMPLATE_CATEGORIES = [
  { id: 'all', label: `الكل (${toArabicDigits(STUDIO_TEMPLATES.length)})` },
  { id: 'mushaf', label: 'مصحفي' },
  { id: 'haramain', label: 'الحرمين' },
  { id: 'andalus', label: 'أندلسي وعثماني' },
  { id: 'nature', label: 'طبيعة وسماء' },
  { id: 'minimal', label: 'هادئ' },
] as const;

interface StudioDesignInspectorProps {
  state: StudioState;
  styleTab: StyleTab;
  templateCat: TemplateCategory;
  customTemplates: SavedCustomTemplate[];
  newTemplateName: string;
  bgVideoUrl: string | null;
  bgVideoFile: File | null;
  bgVideoName: string;
  bgVideoReady: boolean;
  bgVideoPlaying: boolean;
  exportSettings: VideoExportSettings;
  activeQualityPresetId: string;
  previewTargetDims: { width: number; height: number };
  previewEstimatedSizeMb: number;
  bgFileInputRef: React.RefObject<HTMLInputElement | null>;
  bgVideoFileInputRef: React.RefObject<HTMLInputElement | null>;
  onStyleTabChange: (tab: StyleTab) => void;
  onTemplateCatChange: (cat: TemplateCategory) => void;
  onPatchState: (patch: Partial<StudioState>) => void;
  onApplyTemplate: (tpl: StudioTemplate) => void;
  onNewTemplateNameChange: (name: string) => void;
  onSaveCustomTemplate: (e: React.FormEvent) => void;
  onApplyCustomTemplate: (tpl: SavedCustomTemplate) => void;
  onDeleteCustomTemplate: (id: string) => void;
  onExportTemplates: (templates: SavedCustomTemplate[]) => void;
  onImportTemplates: (file: File) => void;
  onBgFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBgVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBgVideoPlaying: () => void;
  onRemoveBgVideo: () => void;
  onSelectBgLibrary: (bg: BuiltinBackground) => void;
  onUpdateExportSettings: (patch: Partial<VideoExportSettings>) => void;
  onSelectQualityPreset: (presetId: string) => void;
  onAspectSelect: (presetId: AspectPresetId) => void;
  onOpenExportModal: () => void;
}

export function StudioDesignInspector({
  state,
  styleTab,
  templateCat,
  customTemplates,
  newTemplateName,
  bgVideoUrl,
  bgVideoFile,
  bgVideoName,
  bgVideoReady,
  bgVideoPlaying,
  exportSettings,
  activeQualityPresetId,
  previewTargetDims,
  previewEstimatedSizeMb,
  bgFileInputRef,
  bgVideoFileInputRef,
  onStyleTabChange,
  onTemplateCatChange,
  onPatchState,
  onApplyTemplate,
  onNewTemplateNameChange,
  onSaveCustomTemplate,
  onApplyCustomTemplate,
  onDeleteCustomTemplate,
  onExportTemplates,
  onImportTemplates,
  onBgFileUpload,
  onBgVideoUpload,
  onToggleBgVideoPlaying,
  onRemoveBgVideo,
  onSelectBgLibrary,
  onUpdateExportSettings,
  onSelectQualityPreset,
  onAspectSelect,
  onOpenExportModal,
}: StudioDesignInspectorProps) {
  const filteredTemplates = React.useMemo(
    () => filterTemplatesByCategory(STUDIO_TEMPLATES, templateCat),
    [templateCat]
  );

  // إدارة ظهور الأقسام: تفضيل محلي في المتصفح (localStorage) — الترطيب بعد
  // التحميل فقط كي لا يكسر SSR ولا يسبب تعارض ترطيب.
  const sectionVisibility = useInspectorSectionVisibility();

  return (
    <aside
      aria-label="التنسيق والقوالب"
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] xl:h-full"
    >
      {/* Inspector Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
        <h2 className="font-display flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
          <Palette className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
          <span>التصميم والتنسيق</span>
        </h2>
        <span className="text-[11px] font-medium text-[var(--ink-muted)]">
          {STYLE_TABS.find((t) => t.id === styleTab)?.label}
        </span>
      </div>

      {/* شريط إدارة ظهور الأقسام (كل الأقسام عبر التبويبات الخمسة) */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-1.5">
        <span className="text-[10px] font-semibold text-[var(--ink-muted)]">
          ظهور أقسام اللوحة
        </span>
        <StudioInspectorSectionsToolbar api={sectionVisibility} />
      </div>

      {/* Hydration-Safe Tabs with Motion Shared Indicator */}
      <InspectorSectionsProvider api={sectionVisibility}>
      <StudioTabsRoot
        idPrefix="studio-inspector"
        dir="rtl"
        value={styleTab}
        tabValues={STYLE_TAB_VALUES}
        hasPanels
        onValueChange={onStyleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-[var(--border-hairline)] px-3 py-2">
          <StudioTabsList
            aria-label="أدوات التنسيق"
            className="grid grid-cols-5 gap-1 rounded-xl bg-[var(--surface-subtle)] p-1"
          >
            {STYLE_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = styleTab === tab.id;
              return (
                <StudioTabTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`relative flex flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] ${
                    active
                      ? 'text-[#1F1705]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="studio-inspector-tab"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-[var(--brand-gold)] shadow-sm"
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="relative z-10">{tab.label}</span>
                </StudioTabTrigger>
              );
            })}
          </StudioTabsList>
        </div>

        {/* Scrollable Inspector Body */}
        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {/* TAB 1: Templates */}
          <StudioTabPanel value="templates" className="space-y-4 focus:outline-none">
            <StudioInspectorSection id="tpl-gallery" title="قوالب التصميم الجاهزة">
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={templateCat === cat.id}
                  onClick={() => onTemplateCatChange(cat.id)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    templateCat === cat.id
                      ? 'bg-[var(--brand-emerald)] text-[#FAF7F0] dark:bg-[var(--brand-gold)] dark:text-[#1F1705]'
                      : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {filteredTemplates.map((tpl) => {
                const isCoverTpl = tpl.id === 'unified-channel-cover';
                const isSelected = isCoverTpl
                  ? Boolean(state.coverMode)
                  : !state.coverMode && state.activeTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    data-testid={`studio-template-${tpl.id}`}
                    aria-pressed={isSelected}
                    onClick={() => onApplyTemplate(tpl)}
                    className={`group overflow-hidden rounded-xl border bg-[var(--surface-subtle)]/50 text-right transition-all ${
                      isSelected
                        ? 'border-[var(--brand-gold)] ring-2 ring-[var(--brand-gold)]/35'
                        : 'border-[var(--border-hairline)] hover:border-[var(--brand-gold)]/70'
                    }`}
                  >
                    <div
                      style={{
                        background: tpl.previewBg,
                        color: tpl.previewTextColor,
                      }}
                      className="relative grid h-20 place-items-center overflow-hidden px-2 text-center"
                    >
                      {tpl.frameStyle !== 'none' && (
                        <span
                          aria-hidden="true"
                          style={{ borderColor: tpl.accentColor }}
                          className={`pointer-events-none absolute inset-1.5 border opacity-75 ${
                            tpl.frameStyle === 'mihrab'
                              ? 'rounded-t-[28px] rounded-b-sm'
                              : tpl.frameStyle === 'ottoman'
                                ? 'rounded-md border-double border-2'
                                : 'rounded-sm'
                          }`}
                        />
                      )}
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute left-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-[var(--brand-gold)] text-[#1F1705] shadow-sm"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <span className="font-quran relative z-10 text-base">
                        {isCoverTpl ? '﴿ غلاف المقطع ﴾' : '﴿ بِسْمِ ٱللَّهِ ﴾'}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="truncate text-xs font-bold text-[var(--ink-primary)]">
                        {tpl.name}
                      </p>
                      <p className="truncate text-[10px] text-[var(--ink-muted)]">
                        {tpl.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            </StudioInspectorSection>

            {/* Saved Custom Templates */}
            <StudioInspectorSection id="tpl-custom" title="قوالبي المحفوظة ومشاركتها">
            <div className="border-t border-[var(--border-hairline)] pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--ink-primary)]">
                  قوالبي المحفوظة ({toArabicDigits(customTemplates.length)})
                </h3>
              </div>
              <form
                onSubmit={onSaveCustomTemplate}
                className="mt-2 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => onNewTemplateNameChange(e.target.value)}
                  placeholder="اسم القالب (مثال: تصميمي الذهبي)"
                  aria-label="اسم القالب الجديد"
                  className="h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-3 text-xs font-bold text-[#FAF7F0] transition-opacity hover:opacity-90"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>حفظ</span>
                </button>
              </form>

              {customTemplates.length > 0 && (
                <div className="mt-2.5 divide-y divide-[var(--border-hairline)]/60 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40">
                  {customTemplates.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => onApplyCustomTemplate(ct)}
                        className="truncate text-xs font-semibold text-[var(--ink-primary)] hover:text-[var(--brand-emerald)] dark:hover:text-[#E6C75A]"
                      >
                        {ct.name}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onExportTemplates([ct])}
                          aria-label={`مشاركة القالب ${ct.name}`}
                          title="مشاركة هذا القالب كملف JSON"
                          className="text-[var(--ink-muted)] transition-colors hover:text-[var(--brand-gold)]"
                        >
                          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCustomTemplate(ct.id)}
                          aria-label={`حذف القالب ${ct.name}`}
                          className="text-[var(--ink-muted)] transition-colors hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Share templates (roadmap item 7): export all as JSON / import */}
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onExportTemplates(customTemplates)}
                  disabled={customTemplates.length === 0}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-40"
                >
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تصدير القوالب</span>
                </button>
                <label className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]">
                  <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>استيراد قوالب</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportTemplates(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            </StudioInspectorSection>
          </StudioTabPanel>

          {/* TAB 2: Islamic Ornaments */}
          <StudioTabPanel value="ornaments" className="focus:outline-none">
            <StudioOrnamentsPanel state={state} onPatch={onPatchState} />
          </StudioTabPanel>

          {/* TAB 3: Background */}
          <StudioBackgroundPanel
            state={state}
            bgVideoUrl={bgVideoUrl}
            bgVideoFile={bgVideoFile}
            bgVideoName={bgVideoName}
            bgVideoReady={bgVideoReady}
            bgVideoPlaying={bgVideoPlaying}
            bgFileInputRef={bgFileInputRef}
            bgVideoFileInputRef={bgVideoFileInputRef}
            onPatchState={onPatchState}
            onBgFileUpload={onBgFileUpload}
            onBgVideoUpload={onBgVideoUpload}
            onToggleBgVideoPlaying={onToggleBgVideoPlaying}
            onRemoveBgVideo={onRemoveBgVideo}
            onSelectBgLibrary={onSelectBgLibrary}
          />

          {/* TAB 4: Typography & Elements */}
          <StudioTextPanel state={state} onPatchState={onPatchState} />

          {/* TAB 5: Audio Engineering & Transitions */}
          <StudioAudioPanel
            state={state}
            exportSettings={exportSettings}
            activeQualityPresetId={activeQualityPresetId}
            previewTargetDims={previewTargetDims}
            previewEstimatedSizeMb={previewEstimatedSizeMb}
            onPatchState={onPatchState}
            onUpdateExportSettings={onUpdateExportSettings}
            onSelectQualityPreset={onSelectQualityPreset}
            onAspectSelect={onAspectSelect}
            onOpenExportModal={onOpenExportModal}
          />
        </div>
      </StudioTabsRoot>
      </InspectorSectionsProvider>
    </aside>
  );
}
