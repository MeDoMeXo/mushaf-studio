/**
 * Verse text + label painters for the studio canvas renderer.
 * Split from lib/studio-renderer.ts per the 600-line file rule.
 */
import type { StudioState, WordHighlightStyle } from './quran-data-types';
import { hexToRgba, resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import {
  drawIslamicAyahMedallionV2,
} from './ornaments/ornaments-paint-surface';
import {
  buildAyahSegments,
  buildAyahWordTimings,
  buildDisplayUnits,
  joinTimingTexts,
  segmentIndexForWord,
  type AyahDisplayUnit,
  type AyahSegment,
  type AyahWordTiming,
  type DisjointGroupMeta,
} from './verse-words';
import { toArabicDigits, wrapWordsToLines } from './quran-utils';
import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';
import { createVerseHighlightPainters } from './studio-text-highlight';
import {
  computeSafeTextColumn,
  computeVerticalBudget,
  drawTranslationBlock,
  estimateBlockHeight,
  fillRoundedRect,
  splitTranslationForSegment,
  wrapTimingsToLines,
} from './studio-text-karaoke';

export interface MainTextExtras {
  /** Index of the word currently being recited (karaoke audio tracking). */
  activeWordIndex?: number;
  /** Inclusive [from, to] phrase range currently being recited (segment-granular
   * karaoke slides). Overrides activeWordIndex when present. */
  activeWordRange?: [number, number];
}

export { computeSafeTextColumn } from './studio-text-karaoke';

export function drawMainText(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  arabicText: string,
  translationText: string,
  ayahNumStr: string,
  extras?: MainTextExtras
): void {
  const w = state.width;
  const h = state.height;
  const { safeLeft, safeRight, maxW } = computeSafeTextColumn(state);
  const scaleFactor = Math.min(w, h) / 1080;
  const primaryFontSize = Math.round(state.fontSize * scaleFactor);
  const primaryFontStack = resolveCanvasFontFamily(state.fontFamily);
  // خط الترجمة أصبح من الحالة (كان القاهرة مُثبّتاً) — نفس آلية الحل، مصدرها المستخدم
  const translationFontStack = resolveCanvasFontFamily(state.translationFontFamily || 'Cairo');
  const amiriFontStack = resolveCanvasFontFamily('Amiri');
  const ornaments = resolveOrnamentConfig(state);
  const weight = state.fontWeight || 400;
  const x =
    state.align === 'center'
      ? w / 2
      : state.align === 'right'
        ? safeRight
        : safeLeft;

  const showArabic = state.textSource === 'uthmani' || state.textSource === 'both';
  const showTrans = state.textSource === 'translation' || state.textSource === 'both';
  const showMedallion = state.showAyahNumber !== false && Boolean(ayahNumStr);

  const singleMode = (state.verseLineMode || 'wrap') === 'single';
  const timings = showArabic && arabicText ? buildAyahWordTimings(arabicText) : [];
  const activeWordIndex = extras?.activeWordIndex ?? -1;
  // نطاق العبارة المتلوة (شرائح مستوى العبارة): يعلو على المؤشر المفرد —
  // كل كلمات النطاق تتظلّل معاً كشريط يتحرك عبارة بعبارة.
  const rawRange = extras?.activeWordRange;
  const activeRange: [number, number] | null =
    Array.isArray(rawRange) &&
    rawRange.length === 2 &&
    Number.isFinite(rawRange[0]) &&
    Number.isFinite(rawRange[1])
      ? [Math.max(0, Math.floor(rawRange[0])), Math.max(0, Math.floor(rawRange[1]))]
      : null;
  const normalizedRange =
    activeRange && activeRange[0] <= activeRange[1]
      ? [activeRange[0], Math.max(activeRange[0], activeRange[1])]
      : null;
  const rangeLo = normalizedRange ? normalizedRange[0] : -1;
  const rangeHi = normalizedRange ? normalizedRange[1] : -1;
  const hasRange = normalizedRange !== null;
  const rangeInBounds = hasRange && rangeLo < timings.length;
  const highlightOn =
    state.wordHighlight === true &&
    (hasRange
      ? rangeInBounds
      : activeWordIndex >= 0 && activeWordIndex < timings.length);
  const highlightStyle: WordHighlightStyle = state.wordHighlightStyle || 'block';
  const highlightColor = state.wordHighlightColor || '#C9A227';
  const highlightOpacity = Math.max(0.15, Math.min(0.85, state.wordHighlightOpacity ?? 0.35));

  const setArFont = (size: number) => {
    ctx.font = `${weight} ${Math.max(12, size)}px ${primaryFontStack}`;
    applyArabicLetterSpacing(letterSpacingPx);
  };
  const measure = (s: string) => ctx.measureText(s).width;
  const clearArabicLetterSpacing = () => applyArabicLetterSpacing(0);

  // مسافة الحروف للرسم العثماني فقط (ميزة Canvas حديثة): تُطبّق مع كل تعيين
  // لخط الآية فتبقى القياسات (measureText) والرسم متسقين في المتصفحات الداعمة،
  // وتُصفَّر قبل أي نص آخر (الترجمة/الفاصلة) كي لا يرثها — والدعم المفقود يتجاهلها.
  const letterSpacingPx = Math.max(-2, Math.min(8, state.letterSpacing ?? 0));
  const supportsLetterSpacing = 'letterSpacing' in ctx;
  const applyArabicLetterSpacing = (px: number) => {
    if (!supportsLetterSpacing) return;
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
    } catch {
      // بيئة لا تقبل التعيين (jsdom/اختبارات) — تجاهل بأمان
    }
  };

  let arLines: AyahWordTiming[][] = [];
  let arFontSize = primaryFontSize;
  let trLines: string[] = [];
  let transFontSize = Math.max(
    24,
    Math.round(
      state.textSource === 'translation' ? primaryFontSize * 0.58 : primaryFontSize * 0.44
    )
  );
  const baseTransFontSize = transFontSize;

  // Vertical budget — auto-fit keeps the wrapped block clear of the top
  // banner, bottom reciter label, progress dots and the frame itself.
  const { reservedTop, availH } = computeVerticalBudget(state);

  // The translation text actually displayed: in single-line mode the chunk
  // matching the visible pronunciation segment (same line treatment as the
  // Arabic); otherwise the whole verse translation.
  let translationForDisplay = translationText;

  // Translation wrapping is font-size dependent: re-wrap at every candidate
  // size so shrinking also merges lines (containment for the translation —
  // نفس معاملة احتواء النص العربي).
  const wrapTransAt = (tfs: number): string[] => {
    if (!showTrans || !translationForDisplay) return [];
    // الترجمة لا ترث مسافة حروف الآية العربية — تصفيرها قبل القياس بخط الترجمة
    clearArabicLetterSpacing();
    ctx.font = `500 ${Math.max(14, tfs)}px ${translationFontStack}`;
    return wrapWordsToLines(translationForDisplay, maxW * 0.88, (ln) => ctx.measureText(ln).width);
  };

  if (timings.length > 0) {
    setArFont(primaryFontSize);
    if (singleMode) {
      // ── Pronunciation-segmented single line ──
      // No whole-ayah shrinking: the ayah splits into recitation phrases that
      // each fit one line at full size; the visible segment follows the audio.
      const segments = buildAyahSegments(timings, maxW, measure);
      const visibleSegIdx = Math.max(0, Math.min(segments.length - 1, segmentIndexForWord(segments, activeWordIndex)));
      const seg = segments[visibleSegIdx];
      const segWidth = measure(seg.text);
      if (segWidth > maxW && segWidth > 0) {
        // Only when a single token alone overflows (extremely long words).
        arFontSize = Math.max(
          Math.round(primaryFontSize * 0.34),
          Math.floor(primaryFontSize * (maxW / segWidth))
        );
        setArFont(arFontSize);
      }
      arLines = [timings.slice(seg.fromWord, seg.toWord + 1)];
      // Apply the line treatment to the translation too: only the chunk that
      // matches this recitation segment shows (contained, follows the audio).
      if (showTrans && translationText) {
        translationForDisplay = splitTranslationForSegment(translationText, seg);
      }
      if (translationForDisplay) {
        transFontSize = baseTransFontSize;
        trLines = wrapTransAt(transFontSize);
      }
    } else {
      // ── Wrapped multi-line with auto-fit ──
      // Shrinks (floor 42%) when a single word overflows the column or the
      // whole block grows past the vertical budget — fixes oversized text
      // escaping the frame. The translation scales with the Arabic (floor
      // 45% of its own base) and re-wraps at every candidate size.
      const arLineH = (fs: number) => fs * state.lineHeight;
      const gapBetween = Math.round(primaryFontSize * 0.72);
      let scale = 1;
      for (let iter = 0; iter < 14; iter++) {
        const fs = Math.round(primaryFontSize * scale);
        const tfs = Math.max(
          16,
          Math.round(baseTransFontSize * Math.max(0.45, scale))
        );
        setArFont(fs);
        arLines = wrapTimingsToLines(timings, maxW, measure);
        trLines = wrapTransAt(tfs);
        const widestWord = buildDisplayUnits(timings).reduce(
          (m, u) =>
            Math.max(
              m,
              measure(joinTimingTexts(timings.slice(u.fromToken, u.toToken + 1)))
            ),
          0
        );
        const medallionR = Math.max(16, Math.round(fs * 0.43));
        const standaloneH =
          showMedallion && arLines.length > 0 ? Math.round(medallionR * 2.55) : 0;
        const blockH = estimateBlockHeight(
          arLines.length,
          arLineH(fs),
          standaloneH,
          trLines.length,
          tfs * 1.55,
          trLines.length ? gapBetween : 0
        );
        const overflowX = widestWord > maxW && widestWord > 0;
        const overflowY = blockH > availH;
        transFontSize = tfs;
        if ((!overflowX && !overflowY) || scale <= 0.42) break;
        scale = overflowX
          ? Math.max(0.42, (scale * (maxW / widestWord)) * 0.98)
          : Math.max(0.42, scale * 0.9);
      }
      arFontSize = Math.round(primaryFontSize * scale);
      setArFont(arFontSize);
      arLines = wrapTimingsToLines(timings, maxW, measure);
      trLines = wrapTransAt(transFontSize);
    }
  } else if (showTrans && translationText) {
    // ── Translation-only mode ──
    transFontSize = baseTransFontSize;
    trLines = wrapTransAt(transFontSize);
  }

  // ── Stage 2 — translation containment ──
  // Independent of the verse font: when the block (Arabic + medallion + gap +
  // translation) still exceeds the vertical budget, shrink the translation
  // alone (floor ≈ 30% of its base / 15px) re-wrapping at each size until the
  // whole composition fits inside the frame.
  if (trLines.length) {
    const arLineH = arFontSize * state.lineHeight;
    const gap = trLines.length ? Math.round(primaryFontSize * 0.72) : 0;
    const medallionR = Math.max(16, Math.round(arFontSize * 0.43));
    const standaloneH =
      showMedallion && arLines.length > 0 ? Math.round(medallionR * 2.55) : 0;
    const fixedH = arLines.length * arLineH + standaloneH + gap;
    // Start from the translation scale the joint pass already reached (never
    // grow it back), then keep shrinking translation-only until it all fits.
    let tScale = Math.max(0.05, transFontSize / Math.max(1, baseTransFontSize));
    for (let i = 0; i < 14; i++) {
      const tfs = Math.max(15, Math.round(baseTransFontSize * tScale));
      const lines = wrapTransAt(tfs);
      const blockH = fixedH + lines.length * (tfs * 1.55);
      transFontSize = tfs;
      trLines = lines;
      if (blockH <= availH || tScale <= 0.3) break;
      tScale *= 0.9;
    }
  }

  const arLineHeight = arFontSize * state.lineHeight;
  const trLineHeight = transFontSize * 1.55;
  const medallionRadius = Math.max(16, Math.round(arFontSize * 0.43));
  const medallionPad = Math.round(medallionRadius * 0.55);

  // Inline medallion fits at the RTL end of the last Arabic line — the strict
  // bound (no 1.04 slack + shift only when it truly fits) keeps the final
  // line inside the safe column instead of spilling over the frame.
  let medallionInline = false;
  let lastArLineWidth = 0;
  let lastArLineTokens: AyahWordTiming[] = [];
  if (showMedallion && arLines.length > 0) {
    setArFont(arFontSize);
    lastArLineTokens = arLines[arLines.length - 1];
    lastArLineWidth = measure(joinTimingTexts(lastArLineTokens));
    const neededExtra = medallionRadius * 2 + medallionPad;
    medallionInline = lastArLineWidth + neededExtra <= maxW;
  }

  const standaloneMedallionHeight =
    showMedallion && !medallionInline ? Math.round(medallionRadius * 2.55) : 0;

  const gapBetween = arLines.length && trLines.length ? Math.round(primaryFontSize * 0.72) : 0;

  const totalHeight =
    arLines.length * arLineHeight +
    standaloneMedallionHeight +
    trLines.length * trLineHeight +
    gapBetween;

  const verticalShiftPx = Math.round(h * ((state.verticalOffset || 0) / 100));
  let y = reservedTop + Math.max(0, (availH - totalHeight) / 2) + verticalShiftPx;

  // Apply text shadow / glow
  if (state.glow) {
    ctx.shadowColor = state.textColor;
    ctx.shadowBlur = primaryFontSize * 0.38;
    ctx.shadowOffsetY = 0;
  } else if (state.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = primaryFontSize * 0.18;
    ctx.shadowOffsetY = Math.max(2, primaryFontSize * 0.045);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.textAlign = state.align;
  ctx.textBaseline = 'middle';

  let lastArLineY = y;
  let lastDrawnLineRight = 0;

  if (arLines.length > 0) {
    setArFont(arFontSize);
    ctx.fillStyle = state.textColor;
    ctx.direction = 'rtl';
    y += arLineHeight / 2;

    // Amiri Quran ships a single regular weight; emulate crisp bold/extra-bold with subtle stroke thickening
    const needsSyntheticBold = state.fontFamily === 'Amiri Quran' && weight >= 600;
    const strokeWidth =
      weight >= 800
        ? arFontSize * 0.036
        : weight >= 700
          ? arFontSize * 0.025
          : arFontSize * 0.015;

    const spaceW = Math.max(measure(' '), arFontSize * 0.22);

    // The token currently being recited — for disjointed-letter groups the
    // ACTIVE LETTER (not the whole group) drives the highlight zone, so the
    // tracing (التتبع) still advances letter-by-letter across the JOINED
    // writing (الرسم متصل) exactly as the mushaf draws it. A phrase RANGE
    // (segment slides) highlights whole units instead — its disjointed
    // group is fully inside the recited phrase.
    const activeTok =
      !hasRange && activeWordIndex >= 0 && activeWordIndex < timings.length
        ? timings[activeWordIndex]
        : null;

    // وحدات الرسم والتظليل مستخرجة حرفياً إلى lib/studio-text-highlight.ts
    // (قاعدة ٦٠٠ سطر) — نفس الدلالات: المجموعة المتصلة ترسم وحدة واحدة
    // والتظليل يتقدّم حرفاً بحرف داخل الرسم المتصل.
    const { letterZones, paintUnit } = createVerseHighlightPainters({
      ctx,
      measure,
      arFontSize,
      spaceW,
      highlightStyle,
      highlightColor,
      highlightOpacity,
      textColor: state.textColor,
      fontFamily: state.fontFamily,
      weight,
      needsSyntheticBold,
      strokeWidth,
    });

    for (let idx = 0; idx < arLines.length; idx++) {
      const lineTokens = arLines[idx];
      const isLastLine = idx === arLines.length - 1;
      // Line text/width in DRAWING terms: disjointed groups count as their
      // joined token (الرسم متصل), so the measured width matches what is
      // actually painted below.
      const lineText = joinTimingTexts(lineTokens);
      const lineWidth = measure(lineText);

      // RTL word run: right edge anchored per alignment, words flow right → left.
      const lineRight =
        state.align === 'center'
          ? x + lineWidth / 2
          : state.align === 'right'
            ? x
            : x + lineWidth;
      // When centered + inline medallion the (text + medallion) group is
      // centered as a unit: shift the line right by half the medallion span,
      // clamped to the safe column edge so nothing ever spills over.
      const shiftedRight =
        isLastLine && medallionInline && state.align === 'center'
          ? Math.min(
              lineRight + (medallionRadius + medallionPad * 0.5),
              safeRight
            )
          : lineRight;
      if (isLastLine) lastDrawnLineRight = shiftedRight;

      ctx.textAlign = 'right';
      let cursorRight = shiftedRight;

      // Drawing units: plain words paint alone; disjointed-letter groups
      // paint as ONE joined fillText (الرسم متصل) with the highlight zone
      // following the active letter (التتبع حرفاً بحرفاً).
      const units: AyahDisplayUnit[] = buildDisplayUnits(lineTokens);
      for (const unit of units) {
        const slice = lineTokens.slice(unit.fromToken, unit.toToken + 1);
        const group = unit.toToken > unit.fromToken ? slice[0].disjointGroup! : null;
        const text = group ? group.text : slice[0].text;
        const textW = measure(text);
        let zones: { left: number; width: number }[] | null = null;
        let activeZone = -1;
        if (hasRange) {
          // عبارة مستوى الشريحة: أي وحدة يتقاطع نطاقها مع [lo..hi] تتظلّل
          // كاملة — المجموعة المقطعة وحدة واحدة داخل العبارة فتتظلّل
          // برمّتها (الرسم متصل، والتلوين كتلة واحدة متناغمة).
          const unitFrom = slice[0].index;
          const unitTo = slice[slice.length - 1].index;
          if (highlightOn && unitFrom <= rangeHi && unitTo >= rangeLo) {
            activeZone = 0;
            zones = null;
          }
        } else if (group) {
          zones = letterZones(group, textW, cursorRight);
          if (
            highlightOn &&
            activeTok?.disjointGroup &&
            activeTok.disjointGroup.id === group.id
          ) {
            activeZone = activeTok.disjointGroup.letterIndex;
          }
        } else if (highlightOn && slice[0].index === activeWordIndex) {
          activeZone = 0;
        }
        cursorRight = paintUnit({ text, textW, right: cursorRight, y, zones, activeZone });
      }

      if (isLastLine) {
        lastArLineY = y;
      }
      y += arLineHeight;
    }
    y -= arLineHeight / 2;
  }

  // Draw Islamic Ayah Number Medallion (inline at RTL end of verse, or centered cleanly below)
  if (showMedallion) {
    // أرقام الفاصلة بخط الأميري — لا ترث مسافة حروف الآية
    clearArabicLetterSpacing();
    let mx = w / 2;
    let my = y + standaloneMedallionHeight * 0.52;

    if (medallionInline && arLines.length > 0) {
      my = lastArLineY + Math.round(primaryFontSize * 0.03);
      if (state.align === 'center') {
        // The medallion hugs the ACTUAL drawn left edge of the shifted line.
        const drawnLineLeft = lastDrawnLineRight - lastArLineWidth;
        mx = drawnLineLeft - medallionPad - medallionRadius;
      } else if (state.align === 'right') {
        mx = x - lastArLineWidth - medallionPad - medallionRadius;
      } else {
        mx = x + lastArLineWidth + medallionPad + medallionRadius;
      }
    } else {
      y += standaloneMedallionHeight;
    }

    const digitColor = isLightColor(state.textColor) ? '#FAF7F0' : '#0B3D2E';
    drawIslamicAyahMedallionV2(
      ctx,
      mx,
      my,
      medallionRadius,
      toArabicDigits(ayahNumStr),
      ornaments.ayahNumberStyle,
      ornaments.ornamentColor,
      digitColor,
      amiriFontStack,
      ctx.globalAlpha
    );
  }

  if (trLines.length > 0) {
    // خط الترجمة من الحالة — لا مسافة حروف الآية العربية هنا
    clearArabicLetterSpacing();
    y = drawTranslationBlock(ctx, {
      state,
      trLines,
      transFontSize,
      trLineHeight,
      gapBetween,
      maxW,
      x,
      y,
      hasArabic: arLines.length > 0,
      scaleFactor,
      ornamentColor: ornaments.ornamentColor,
      translationFontStack,
    });
  }

  // تصفير نهائي احتياطي: أي نص لاحق على نفس السياق لا يرث المسافة
  clearArabicLetterSpacing();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
