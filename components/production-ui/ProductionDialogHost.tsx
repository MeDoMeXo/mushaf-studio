'use client';

/**
 * ProductionDialogHost — موجّه الحوارات: يعرض الحوار المفتوح حالياً فقط
 * (من ctl.dialog) من مجموعات القرآن/الصوت/البصريات.
 */
import type { ProductionDialogId } from '@/lib/production/production-types';
import type { ProductionStudioController } from '@/hooks/use-production-studio';
import {
  OpenProjectDialog,
  RecitersDialog,
  SaveAsDialog,
  SurahPickerDialog,
  TranslationDialog,
  VerseRangeDialog,
} from './ProductionDialogsQuran';
import {
  AmbientDialog,
  CleanDialog,
  CutDialog,
  CustomTextDialog,
  DenoiseDialog,
  EffectsDialog,
  LevelDialog,
  MusicDialog,
  RecordDialog,
  RecordingsDialog,
  SyncDialog,
} from './ProductionDialogsAudio';
import {
  AnimateDialog,
  BgImagesDialog,
  HelpDialog,
  OrnamentsDialog,
  SettingsDialog,
  TransitionsDialog,
  WatermarkDialog,
} from './ProductionDialogsVisual';

export function ProductionDialogHost({ ctl }: { ctl: ProductionStudioController }) {
  const id: ProductionDialogId = ctl.dialog;
  if (!id) return null;
  switch (id) {
    case 'surah-picker':
      return <SurahPickerDialog ctl={ctl} />;
    case 'verse-range':
      return <VerseRangeDialog ctl={ctl} />;
    case 'reciters':
      return <RecitersDialog ctl={ctl} />;
    case 'translation':
      return <TranslationDialog ctl={ctl} />;
    case 'open-project':
      return <OpenProjectDialog ctl={ctl} />;
    case 'save-as':
      return <SaveAsDialog ctl={ctl} />;
    case 'effects':
      return <EffectsDialog ctl={ctl} />;
    case 'ambient':
      return <AmbientDialog ctl={ctl} />;
    case 'clean':
      return <CleanDialog ctl={ctl} />;
    case 'denoise':
      return <DenoiseDialog ctl={ctl} />;
    case 'level':
      return <LevelDialog ctl={ctl} />;
    case 'cut':
      return <CutDialog ctl={ctl} />;
    case 'record':
      return <RecordDialog ctl={ctl} />;
    case 'music':
      return <MusicDialog ctl={ctl} />;
    case 'recordings':
      return <RecordingsDialog ctl={ctl} />;
    case 'sync':
      return <SyncDialog ctl={ctl} />;
    case 'custom-text':
      return <CustomTextDialog ctl={ctl} />;
    case 'bg-images':
      return <BgImagesDialog ctl={ctl} />;
    case 'ornaments':
      return <OrnamentsDialog ctl={ctl} />;
    case 'watermark':
      return <WatermarkDialog ctl={ctl} />;
    case 'transitions':
      return <TransitionsDialog ctl={ctl} />;
    case 'animate':
      return <AnimateDialog ctl={ctl} />;
    case 'settings':
      return <SettingsDialog ctl={ctl} />;
    case 'help':
      return <HelpDialog ctl={ctl} />;
    default:
      return null;
  }
}
