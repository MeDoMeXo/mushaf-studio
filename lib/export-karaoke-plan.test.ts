/**
 * اختبارات خطة تصدير الكاريوكي (buildKaraokeExportPlan): مستوى الكلمة،
 * الخفض المتدرج إلى مستوى العبارة عند تجاوز سقف الشرائح، والتراجع
 * النهائي إلى شرائح الآية الكاملة. بيئة وهمية بسيطة للـ canvas لقياس
 * النص (المحرّك نفسه نقي — الفحص هنا عن بنية الخطة فقط).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { MAX_WORD_SLIDES } from '@/lib/video-export';
import { buildKaraokeExportPlan } from '@/lib/export-karaoke-plan';

// ── بيئة DOM دنيا: canvas وهمي بقياس تقريبي (طول النص × 12 بكسل) ──
type AnyRecord = Record<string, unknown>;
const fakeCtx = {
  font: '',
  measureText: (s: string) => ({ width: s.length * 12 }),
};
const fakeCanvas = {
  width: 8,
  height: 8,
  getContext: () => fakeCtx,
};
const fakeDocument = {
  createElement: () => fakeCanvas,
};
(globalThis as unknown as AnyRecord).document = fakeDocument;

const BASE_STATE = {
  width: 1080,
  height: 1920,
  hideVerses: false,
  coverMode: false,
  textSource: 'uthmani',
  verseLineMode: 'wrap',
  wordHighlight: true,
  fontSize: 86,
  fontWeight: 400,
  fontFamily: 'Amiri Quran',
} as unknown as StudioState;

const DIMS = { width: 1080, height: 1920 };

function makeVerse(i: number, text: string): QulVerse {
  return { id: i + 1, verse_key: `1:${i + 1}`, text_uthmani: text };
}

const SHORT_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

test('word tracking keeps word granularity for short selections', () => {
  const verses = [makeVerse(0, SHORT_TEXT)];
  const plan = buildKaraokeExportPlan(BASE_STATE, verses, DIMS, true);
  assert.ok(plan, 'plan must exist');
  assert.equal(plan.granularity, 'word');
  // بسم الله الرحمن الرحيم = 4 كلمات + غلاف
  assert.equal(plan.totalSlides, 5);
  assert.equal(plan.entries.length, 4);
  assert.ok(plan.entries.every((e) => e.wordTo === undefined));
  // نص الآية يسكن الشريحة الأولى للآية فقط
  assert.equal(plan.alignedVerseTexts[0], '');
  assert.equal(plan.alignedVerseTexts[1], SHORT_TEXT);
  assert.equal(plan.alignedVerseTexts[2], '');
});

test('long selections degrade to segment granularity instead of vanishing', () => {
  // 70 آية × 12 كلمة = 840 كلمة > 600: الخفض إلى عبارة-بعبارة إلزامي
  // (كانت الخطة تسقط بصمت فتختفي ميزة التتبّع من التصدير كلياً).
  const word12 = 'كلمة كلمة كلمة كلمة كلمة كلمة كلمة كلمة كلمة كلمة كلمة كلمة';
  const verses = Array.from({ length: 70 }, (_, i) => makeVerse(i, word12));
  const plan = buildKaraokeExportPlan(BASE_STATE, verses, DIMS, false);
  assert.ok(plan, 'degraded plan must exist');
  assert.equal(plan.granularity, 'segment');
  assert.ok(plan.totalSlides <= MAX_WORD_SLIDES, `slides ${plan.totalSlides} ≤ ${MAX_WORD_SLIDES}`);
  assert.ok(plan.entries.length > 0);
  assert.ok(
    plan.entries.every((e) => e.wordTo !== undefined && e.wordTo >= e.wordIdx),
    'segment entries must carry an inclusive [wordIdx..wordTo] highlight range'
  );
  // كل مدة العبارة موجودة وأوزانها مجموع أوزان كلماتها (إيجابية)
  assert.ok(plan.entries.every((e) => e.weight > 0));
});

test('even segment granularity falls back to null beyond the slide ceiling', () => {
  // آيات بكلمة واحدة أعرض من العمود: كل آية مقطع مستقل → 650 مقطعاً > 600
  const longWord = 'ك'.repeat(120);
  const verses = Array.from({ length: 650 }, (_, i) => makeVerse(i, longWord));
  const plan = buildKaraokeExportPlan(BASE_STATE, verses, DIMS, false);
  assert.equal(plan, null);
});

test('wrap mode without word tracking stays null (per-verse slides)', () => {
  const verses = [makeVerse(0, SHORT_TEXT)];
  const state = { ...BASE_STATE, wordHighlight: false } as StudioState;
  const plan = buildKaraokeExportPlan(state, verses, DIMS, true);
  assert.equal(plan, null);
});

test('single-line mode without tracking keeps segment slides (legacy behavior)', () => {
  const verses = [makeVerse(0, SHORT_TEXT)];
  const state = {
    ...BASE_STATE,
    verseLineMode: 'single',
    wordHighlight: false,
  } as StudioState;
  const plan = buildKaraokeExportPlan(state, verses, DIMS, true);
  assert.ok(plan);
  assert.equal(plan.granularity, 'segment');
  assert.ok(plan.totalSlides <= MAX_WORD_SLIDES);
});
