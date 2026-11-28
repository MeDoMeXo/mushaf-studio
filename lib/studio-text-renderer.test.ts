/**
 * اختبار تكاملي لمنطق تظليل الكلمات في drawMainText عبر سياق canvas
 * وهمي يسجّل نداءات الرسم (بلا نقطية — الفحص عن منطق التظليل نفسه):
 *   - المؤشر المفرد (activeWordIndex) → كلمة واحدة متظللة.
 *   - نطاق العبارة (activeWordRange) → كل كلمات النطاق متظللة (شرائح
 *     مستوى العبارة للمُدد الطويلة — إصلاح اختفاء التتبّع من التصدير).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { StudioState } from '@/lib/quran-data';
import { drawMainText } from '@/lib/studio-text-renderer';

type AnyRecord = Record<string, unknown>;

interface GradientStub {
  addColorStop: (pos: number, color: string) => void;
}

interface DrawCall {
  op: string;
  fillStyle?: unknown;
}

/** سياق وهمي يسجّل التعبئات بألوانها — لا يرسم شيئاً فعلياً. */
function createRecordingCtx() {
  const calls: DrawCall[] = [];
  const state: AnyRecord = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    direction: 'ltr',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
  const gradient: GradientStub = {
    addColorStop: () => {},
  };
  const ctx: AnyRecord = {
    ...state,
    measureText: (s: string) => ({ width: s.length * 12 }),
    fillText: () => {
      calls.push({ op: 'fillText', fillStyle: state.fillStyle });
    },
    fillRect: () => {
      calls.push({ op: 'fillRect', fillStyle: state.fillStyle });
    },
    fill: () => {
      calls.push({ op: 'fill', fillStyle: state.fillStyle });
    },
    strokeText: () => {},
    stroke: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    roundRect: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  // fillStyle كخاصية حقيقية تُحدَّث عبر التعيين (الوكلاء غير ضرورية)
  const proxied = new Proxy(ctx, {
    get(target, prop) {
      if (prop in target) {
        const v = target[prop as keyof typeof target];
        return typeof v === 'function' ? (v as () => void).bind(target) : v;
      }
      return undefined;
    },
    set(target, prop, value) {
      (target as AnyRecord)[prop as string] = value;
      if (prop === 'fillStyle') state.fillStyle = value;
      return true;
    },
  });
  return { ctx: proxied as unknown as CanvasRenderingContext2D, calls };
}

function makeState(): StudioState {
  return {
    width: 1080,
    height: 1920,
    textSource: 'uthmani',
    translationId: 20,
    align: 'center',
    textColor: '#FAF7F0',
    fontFamily: 'Amiri Quran',
    fontSize: 86,
    fontWeight: 400,
    lineHeight: 1.75,
    verticalOffset: 0,
    shadow: false,
    glow: false,
    letterSpacing: 0,
    verseLineMode: 'wrap',
    wordHighlight: true,
    wordHighlightStyle: 'block',
    wordHighlightColor: '#C9A227',
    wordHighlightOpacity: 0.35,
    showAyahNumber: false,
    showFooter: false,
    showReciterFooter: false,
    surahPosition: 'hidden',
    reciterPosition: 'hidden',
    showProgressDots: false,
    frameStyle: 'none',
    cornerStyle: 'none',
    patternStyle: 'none',
    patternOpacity: 0,
    ornamentColor: '#D4AF37',
  } as unknown as StudioState;
}

const AYAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
/** لون كتلة التظليل الذهبية بشفافية 35% (المحول hexToRgba). */
const GOLD_BLOCK = 'rgba(201, 162, 39, 0.35)';

test('single active word paints exactly one gold block', () => {
  const { ctx, calls } = createRecordingCtx();
  drawMainText(ctx, makeState(), AYAH, '', '1', { activeWordIndex: 2 });
  const goldFills = calls.filter(
    (c) => c.op === 'fill' && String(c.fillStyle) === GOLD_BLOCK
  );
  assert.equal(goldFills.length, 1, 'one highlighted word → one gold block');
  // باقي الكلمات مرسومة بلون النص الأساسي — لم يتغيّر لونها
  const plainTexts = calls.filter(
    (c) => c.op === 'fillText' && String(c.fillStyle) === '#FAF7F0'
  );
  assert.equal(plainTexts.length, 4, 'all four words keep the base text color');
});

test('phrase range paints a block for every word in the range', () => {
  const { ctx, calls } = createRecordingCtx();
  // نطاق [١..٣]: ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ — ثلاث كلمات متظللة معاً
  drawMainText(ctx, makeState(), AYAH, '', '1', { activeWordRange: [1, 3] });
  const goldFills = calls.filter(
    (c) => c.op === 'fill' && String(c.fillStyle) === GOLD_BLOCK
  );
  assert.equal(goldFills.length, 3, 'range [1..3] → three gold blocks');
  assert.equal(
    calls.filter((c) => c.op === 'fillText' && String(c.fillStyle) === '#FAF7F0').length,
    4,
    'base color unchanged for every word (no whole-text recolor)'
  );
});

test('full-verse range highlights all words, tint style recolors only the range', () => {
  const tintState = { ...makeState(), wordHighlightStyle: 'tint' } as StudioState;
  const { ctx, calls } = createRecordingCtx();
  drawMainText(ctx, tintState, AYAH, '', '1', { activeWordRange: [0, 3] });
  // أسلوب التلوين: كلمات النطاق تُرسم بلون التظليل (بلا كتل خلفية)
  const goldTexts = calls.filter(
    (c) => c.op === 'fillText' && String(c.fillStyle) === '#C9A227'
  );
  assert.equal(goldTexts.length, 4, 'tint range [0..3] → all four words colored');
  const goldBlocks = calls.filter(
    (c) => c.op === 'fill' && String(c.fillStyle) === GOLD_BLOCK
  );
  assert.equal(goldBlocks.length, 0, 'tint style draws no background blocks');
});

test('out-of-range indices never highlight', () => {
  const { ctx, calls } = createRecordingCtx();
  drawMainText(ctx, makeState(), AYAH, '', '1', { activeWordIndex: 99 });
  assert.equal(
    calls.filter((c) => c.op === 'fill' && String(c.fillStyle) === GOLD_BLOCK).length,
    0
  );
  const { ctx: ctx2, calls: calls2 } = createRecordingCtx();
  drawMainText(ctx2, makeState(), AYAH, '', '1', { activeWordRange: [40, 50] });
  assert.equal(
    calls2.filter((c) => c.op === 'fill' && String(c.fillStyle) === GOLD_BLOCK).length,
    0,
    'invalid range highlights nothing'
  );
});
