// توليد تقرير الفحص الشامل لمشروع «مصحف الاستوديو» — وفق مهارة docx (R1 + DS-1)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  TableLayoutType, BorderStyle, ShadingType, AlignmentType, HeadingLevel,
  TableOfContents, PageBreak, Header, Footer, PageNumber, NumberFormat,
  convertInchesToTwip, VerticalAlign, TabStopType,
} = require("docx");
const fs = require("fs");

// ---------- palette DS-1 (Deep Sea) ----------
const P = {
  bg: "0B1C2C", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", accentLine: "529286", innerLine: "BECFCC", surface: "E8ECEB" },
};
const BODY = "1A1A1A";

const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };
const allNoBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };

// ---------- helpers (from design-system.md) ----------
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\u060C\u061B\u061F\u0020\u002D", ..."\u0648\u0648"]);
  const words = title.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length > charsPerLine && cur) { lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  // orphan prevention: merge tiny last line
  if (lines.length > 1 && lines[lines.length - 1].length <= 4) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charsPerLine = (pt) => Math.max(2, Math.floor(maxWidthTwips / (pt * 11))); // Arabic glyphs ~0.55em avg
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    lines = splitTitleLines(title, charsPerLine(titlePt));
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}

// Arabic-aware body paragraph (RTL)
function p(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    indent: opts.noIndent ? undefined : { firstLine: 360 },
    children: [new TextRun({ text, size: 24, color: opts.color || BODY, bold: opts.bold,
      font: { ascii: "Times New Roman", eastAsia: "Times New Roman", cs: "Traditional Arabic" } })],
  });
}
// bullet line
function li(text) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    indent: { left: 360 },
    children: [new TextRun({ text: "\u2022  " + text, size: 24, color: BODY,
      font: { ascii: "Times New Roman", eastAsia: "Times New Roman", cs: "Traditional Arabic" } })],
  });
}
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: true,
    spacing: { before: 300, after: 200, line: 312 },
    children: [new TextRun({ text, size: 32, bold: true, color: P.accent, font: { ascii: "Arial", eastAsia: "Arial", cs: "Arial" } })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, bidirectional: true,
    spacing: { before: 240, after: 140, line: 312 },
    children: [new TextRun({ text, size: 28, bold: true, color: BODY, font: { ascii: "Arial", eastAsia: "Arial", cs: "Arial" } })] });
}

// table builder — three-line style with DS-1 table colors
function makeTable(header, rows, widths) {
  const border = (c) => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  const cell = (text, opts = {}) => new TableCell({
    shading: { type: ShadingType.CLEAR, fill: opts.fill || "FFFFFF" },
    borders: { top: border(P.table.accentLine), bottom: border(P.table.innerLine), left: border(P.table.innerLine), right: border(P.table.innerLine) },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      bidirectional: true, alignment: AlignmentType.RIGHT,
      spacing: { line: 276, after: 0 },
      children: [new TextRun({ text, size: opts.size || 21, bold: opts.bold || false,
        color: opts.color || BODY, font: { ascii: "Arial", eastAsia: "Arial", cs: "Arial" } })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { top: border(P.table.accentLine), bottom: border(P.table.accentLine), left: border(P.table.innerLine), right: border(P.table.innerLine), insideHorizontal: border(P.table.innerLine), insideVertical: border(P.table.innerLine) },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: header.map((t, i) => cell(t, { fill: P.table.headerBg, color: P.table.headerText, bold: true })) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: r.map(t => cell(t)) })),
    ],
  });
}

module.exports = { P, noBorders, allNoBorders, splitTitleLines, calcTitleLayout, calcCoverSpacing, p, li, h1, h2, makeTable,
  docx: { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType, AlignmentType, HeadingLevel, TableOfContents, PageBreak, Header, Footer, PageNumber, NumberFormat, VerticalAlign } };
