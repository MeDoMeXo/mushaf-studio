// تقرير الفحص الشامل — «مصحف الاستوديو» — الجزء الثاني (المحتوى)
const { P, allNoBorders, calcTitleLayout, calcCoverSpacing, p, li, h1, h2, makeTable,
  docx: { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType, AlignmentType, HeadingLevel, TableOfContents, PageBreak, Header, Footer, PageNumber, NumberFormat } } = require("./report_lib.js");
const fs = require("fs");

// ================= cover (R1 + DS-1) =================
const title = "تقرير الفحص الهندسي الشامل لمشروع مصحف الاستوديو";
const { titlePt, titleLines } = calcTitleLayout(title, 11906 - 1200 - 800 - 300, 38, 24);
const spacing = calcCoverSpacing({ titleLineCount: titleLines.length, titlePt,
  hasSubtitle: true, hasEnglishLabel: true, metaLineCount: 4, fixedHeight: 400 });

const coverChildren = [];
coverChildren.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
coverChildren.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.RIGHT,
  indent: { left: 1200, right: 800 }, spacing: { after: 500 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
  children: [new TextRun({ text: "ENGINEERING AUDIT REPORT", size: 18, color: P.accent,
    font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
}));
titleLines.forEach((line, i) => coverChildren.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.RIGHT,
  indent: { left: 1200, right: 800 },
  spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
  children: [new TextRun({ text: line, size: titlePt * 2, bold: true, color: P.cover.titleColor,
    font: { ascii: "Arial", eastAsia: "Arial", cs: "Arial" } })],
})));
coverChildren.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.RIGHT,
  indent: { left: 1200, right: 800 }, spacing: { after: 800 },
  children: [new TextRun({ text: "فحص المصادر والمصادقة الهندسية بمهارات addyosmani/agent-skills", size: 24, color: P.cover.subtitleColor, font: { ascii: "Arial", eastAsia: "Arial", cs: "Arial" } })],
}));
const metaLines = [
  "المستودع: github.com/MeDoMeXo/Quran — فرع main",
  "التقنيات: Next.js 15 · React 19 · TypeScript 5.9 · Tailwind CSS 4",
  "تاريخ الفحص: ٢٣ نوفمبر ٢٠٢٦",
  "منهجية الفحص: مراجعة خماسية المحاور + أمان + أداء + واجهات + واجهة أمامية",
];
for (const line of metaLines) {
  coverChildren.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.RIGHT,
    indent: { left: 1400, right: 800 }, spacing: { after: 80 },
    border: { left: { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 } },
    children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor, font: { ascii: "Arial", eastAsia: "Arial", cs: "Arial" } })],
  }));
}
coverChildren.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
coverChildren.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.RIGHT,
  indent: { left: 1200, right: 800 },
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
  spacing: { before: 200 },
  children: [new TextRun({ text: "Mushaf Studio — Engineering Audit", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } })],
}));

const coverTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  layout: TableLayoutType.FIXED,
  borders: allNoBorders,
  rows: [new TableRow({
    height: { value: 16838, rule: "exact" },
    children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: allNoBorders, children: coverChildren })],
  })],
});

// ================= body content =================
const body = [];

body.push(h1("الملخص التنفيذي"));
body.push(p("خضع مشروع «مصحف الاستوديو» لفحص هندسي شامل باستخدام مهارات المستودع addyosmani/agent-skills، وفي مقدمتها مهارة المراجعة خماسية المحاور (صحة الكود وقابلية القراءة والمعمارية والأمان والأداء) ومهارة التحصين الأمني ومهارة تحسين الأداء ومهارة تصميم الواجهات البرمجية ومهارة هندسة الواجهة الأمامية. تم التحقق من كل مصدر بيانات في المشروع على مستوى الكود ثم على مستوى التشغيل الفعلي عبر HTTP، مع تشغيل الاختبارات وبناء إنتاجي كامل وتدقيق التبعيات."));
body.push(p("النتيجة العامة: المشروع سليم معيارياً ويعمل كما هو موثّق. الادعاءات الواردة حول مصادر البيانات (الصوت من شبكتين مجانيتين، والقراء ٣٨ معرّفون محلياً، والزخارف مرسومة برمجياً بدون أي صور خارجية، والنصوص من مكتبة QUL مع احتياطي مدمج) كلها صحيحة ومطابقة للكود وللتشغيل الحيّ. عُثر على ثغرة أمنية واحدة متوسطة الخطورة تتعلق بحدود ثقة واجهات التصدير، وعدة ملاحظات تحسين اختيارية، بالإضافة إلى ثغرتين في تبعيات التطوير لا تصلان إلى الإنتاج."));

body.push(h1("أولاً: التحقق من مصادر البيانات"));
body.push(h2("١. ملفات الصوت (MP3)"));
body.push(p("التحقق من الكود يؤكد الادعاء حرفياً: تُجلب التلاوات آية بآية من مصدرين فقط، محددين كثوابت في ملف lib/quran-data.ts (السطران ٢١٣-٢١٤): شبكة Islamic Network CDN عبر القالب https://cdn.islamic.network/quran/audio/{bitrate}/{slug}/{globalVerseId}.mp3 لـ ١٨ قارئاً، وشبكة EveryAyah عبر القالب https://everyayah.com/data/{folder}/{SSSAAA}.mp3 لـ ٢٠ قارئاً. الدالة getUpstreamAudioUrl في lib/quran-utils.ts تبني الرابط النهائي بعد التحقق من هوية القارئ وتقييد رقم الآية بين ١ و ٦٢٣٦."));
body.push(p("كما هو موصوف: التلاوات تُمرّر عبر مسارات الخادم الداخلية /api/audio/[reciter]/[ayah] و /api/audio/batch لتجاوز قيود CORS، وتُخزّن مؤقتاً في المتصفح عبر Cache Storage API بوسم mushaf-studio-audio-v1 (lib/audio-cache.ts). ورفع صوت خاص (MP3/WAV) من الجهاز مدعوم في مسار التصدير عبر حقل customAudio. الاختبار الحي أثبت عمل الوكيل: طلب آية واحدة من العفاسي أعاد ٢٠٠ بحجم ١٤٦٨٣٠ بايت، وطلب النطاق Range: bytes=0-1023 أعاد ٢٠٦ بمقدار ١٠٢٤ بايت، ودفعة ثلاث آيات عبر /api/audio/batch أعادت ٣١١٣٦٥ بايت، وطلب قارئ EveryAyah (ياسر الدوسري ورواية ورش) أعاد ٢٠٠. لوحظ عطل عابر واحد (٥٠٢) عند أول اتصال بـ everyayah.com تحقق لاحقاً على أنه توقيت الاتصال الأول لا عيب كود، إذ نجحت الإعادة فوراً."));

body.push(h2("٢. قائمة القراء (٣٨ قارئاً)"));
body.push(p("الادعاء صحيح: القائمة لا تُجلب من أي واجهة خارجية، بل معرّفة كثابت محلي RECITERS في lib/quran-data.ts بعدد ٣٨ مدخلاً بالتحقيق الآلي (١٨ بمصدر islamic و٢٠ بمصدر everyayah)، يضم لكل قارئ الاسم والدولة والأسلوب (مرتل/مجود/ورش/معلم) والجودة kbps ومعرف المجلد عند المصدر. النتيجة العملية: القائمة تظهر فوراً دون أي طلب شبكة، وهو ما يجعل واجهة اختيار القارئ تعمل حتى دون إنترنت."));

body.push(h2("٣. الزخارف والصور والخلفيات"));
body.push(p("الادعاء صحيح ومثبت بالفحص: محرك الزخارف lib/islamic-ornaments.ts (١٢٤٧ سطراً) لا يستورد أي صورة ولا يحوي أي استدعاء drawImage لمصدر خارجي؛ بل يعتمد كلياً على بدائيات الرسم البرمجي — عدد استدعاءات ctx.arc/lineTo/moveTo/bezierCurveTo وغيرها يبلغ ١٠٩ في محرك الزخارف وحده و٢٠ في محرك التصيير studio-renderer. فحص شامل لكل ملفات TSX/TS لم يعثر على أي رابط صورة خارجي باستثناء picsum.photos المعرّف كنمط مسموح في next.config.ts وغير مستخدم فعلياً في أي مكوّن. صور/فيديو الخلفية تُحمّل حصراً من الجهاز المحلي عبر FileReader.readAsDataURL و URL.createObjectURL (مكوّن StudioView)، وأيقونات الواجهة كلها من lucide-react المتجهية المحلية. وبذلك القوالب الـ ١٤ والتدرجات والإطارات والنقوش الهندسية وشريط اسم السورة وفواصل الآيات وتأثيرات النجوم والغبار الذهبي والشفق كلها مرسومة برمجياً على Canvas محلي."));

body.push(h2("٤. النصوص القرآنية والترجمات"));
body.push(p("الادعاء صحيح: السور والآيات بالرسم العثماني تُجلب من مكتبة QUL المفتوحة (qul.tarteel.ai/api/v1) عبر مسارين داخليين فقط هما /api/qul/chapters و /api/qul/chapters/[id]/verses، مع ترجمات معتمدة بعددها المعلن (٦ ترجمات معرّفة في TRANSLATIONS: خطاب، Saheeh، Soliman، يوسف علي، المودودي، معارف). الاحتياطي المدمج موجود فعلاً: FALLBACK_CHAPTERS وFALLBACK_VERSES معرّفان في lib/quran-data.ts ويُستخدمان تلقائياً عند فشل الاتصال (lib/qul-client.ts) مع تخزين مؤقت في الذاكرة. الاختبار الحي: استجابة السور أعادت source: qul بعدد ١١٤ سورة، وسورة الإخلاص أعادت ٤ آيات بنص عثماني صحيح (قُلْ هُوَ ٱللَّهُ أَحَدٌ) مع الترجمة الإنجليزية. حقل التخزين المؤقت مضبوط على s-maxage=86400 مع stale-while-revalidate بموازنة عقلانية بين حداثة البيانات وحجم الطلبات على واجهة القراءة."));

body.push(h1("ثانياً: نتائج الفحص الأمني (مهارة security-and-hardening)"));
body.push(p("أُجري تحليل نموذج التهديد عبر تحديد حدود الثقة: المدخلات الخارجية هي معاملات المسارات، وأجسام JSON في الدفعات، وملفات الوسائط المرفوعة، واستجابات مزودي CDN الخارجيين. أبرز النتائج:"));
body.push(li("حقن الأوامر في ffmpeg: سالمة بالتصميم — كل الاستدعاءات عبر execFile بمصفوفة معاملات (لا واجهة shell)، ومعرّفات القيم الرقمية مقيدة بالنطاقات، واسم ملف التصدير يُبنى من أرقام مقيدة فقط (buildSafeExportFilename)."));
body.push(li("SSRF: لا يوجد سطح هجوم — كل روابط الخادم تُبنى من قوائم RECITERS الثابتة أو ثابت QUL_API_BASE، ولا يوجد أي مسار يقبل رابطاً من المستخدم ليجلبه الخادم."));
body.push(li("XSS: استخدام صحيح للهروب التلقائي للإطار؛ الحالة الوحيدة لـ dangerouslySetInnerHTML هي ثابت JSON-LD ثابت معرّف في الكود (ليس مدخلاً من مستخدم)، ولا يوجد eval ولا innerHTML في أي مكون."));
body.push(li("السرية: لا مفاتيح ولا أسرار في الكود أو التاريخ؛ ملف .env مستثنى في gitignore وتحققنا من ذلك. رمز GitHub PAT الذي استُخدم للتنزيل حُذف من إعدادات المستودع ولم يُخزن."));
body.push(li("حماية لوحة التحكم: نقطه ضعف موثقة في التصميم — رمز PIN الافتراضي 1234 يُخزن في localStorage دون تشفير (lib/storage.ts)، وهي حماية من العبث المحلي فقط لا حماية خدمة، والمناسب توصيفها بذلك للمستخدم أو نقلها إلى متغير بيئة خدمة عند توسيع الاستخدام."));

body.push(h1("ثالثاً: حدود الثقة في واجهات التصدير (أهم ملاحظات التحسين)"));
body.push(p("وفق مهارة تصميم الواجهات (validate at boundaries)، لاحظنا أن واجهتي التصدير /api/studio/export و/api/studio/export/session تقبلان رفع شرائح صور وصوت وفيديو خلفية من العميل دون سقف حجم لكل ملف ولا تحقق من البايتات السحرية (magic bytes) للمحتوى المرفوع، معتمدتين على أثر أقصى ٢٨٦ شريحة. الملفات تُكتب في مجلد عمل مؤقت عشوائي (UUID) وتمسح بعد الانتهاء، ومعرّف الجلسة يُفحص بتعبير UUID صارم — وهذه ضوابط جيدة قائمة. التوصية: إضافة سقف حجم لكل ملف مرفوع (مثلاً ١٠ ميغابايت) والتحقق من البايتات السحرية لصيغ PNG/JPEG/MP3 قبل الكتابة إلى القرص، وهي ضوابط ترفع تحصين الواجهة من العبث إلى مستوى الإنتاج المفتوح."));
body.push(p("ملاحظة ثانوية: رؤوس الأمان في next.config.ts تغطي X-Content-Type-Options وReferrer-Policy وPermissions-Policy، لكن لا يوجد CSP (Content-Security-Policy) ولا HSTS ولا X-Frame-Options. للتطبيق المحلي الحالي المستوى مقبول، وعند النشر على نطاق عام يوصى بإضافة CSP تبدأ من default-src 'self' مع السماح بالمضيفين الموثوقين للتلاوات والنصوص فقط، ثم Strict-Transport-Security."));

body.push(h1("رابعاً: التحقق الهندسي والتشغيلي"));
body.push(h2("الاختبارات والبناء والتدقيق"));
body.push(li("اختبارات الوحدة: ٥٢ اختباراً ناجحاً بالكامل (بأمر npx tsx --test lib/*.test.ts) — أعلى من الـ ٤٥ الموثقة، بدون أي فشل أو تعليق."));
body.push(li("ESLint: نظيف تماماً بلا أي تحذير أو خطأ."));
body.push(li("البناء الإنتاجي (next build): ناجح مع ١٦ مساراً (٥ صفحات ثابتة، ٤ صفحات ديناميكية، ٧ مسارات API)؛ حزمة أكبر صفحة (الاستوديو) ٢٦٠ كيلوبايت حملاً أولياً — ضمن ميزانية ٣٠٠ كيلوبايت المتعارف عليها في مهارة الأداء."));
body.push(li("npm audit (تبعيات الإنتاج): ثغرة واحدة عالية وواحدة متوسطة فقط، وكلتاهما في سلسلة firebase-tools كتبعية تطوير لا تصل إلى حزمة الإنتاج؛ الإصلاح يتطلب إما ترقية firebase-tools أو إزالتها إن لم تكن مستخدمة في النشر."));
body.push(li("ملاحظة بيئة عمل: نقل المشروع إلى جذر مساحة العمل جعل مجلدات وكيل z.ai (skills/ وأخواتها) داخل مسار TypeScript فكسر البناء؛ عولج بإضافتها إلى exclude في tsconfig.json. وتوجد ملفات قفل متنافسة (bun.lock من المستودع وpackage-lock.json من بيئتنا) — يوصى عند الدفع بتبني npm وحذف bun.lock أو العكس لتفادي ازدواج المصادر (قاعدة lockfile واحد لحدود تثبيت واحدة)."));

body.push(h2("الأداء وقابلية القراءة"));
body.push(p("لا توجد أنماط N+1 في جلب البيانات؛ مسارات QUL تدعم الترقيم عبر ترويسات التخزين المؤقت؛ الواجهات الأمامية تستخدم تخزيناً مؤقتاً ذكياً للصوت على مستوى المتصفح مع دفعات ثنائية موفرة للطلبات (٦ عمال متزامنين بحد أقصى). ملفات كبيرة موثقة كإشارة تفكيك: AdminView.tsx (١٦٧٩ سطراً) وStudioDesignInspector (١٣٩٦) وStudioExportModal (١٣٩٣) وStudioView (١٣١٤) — وفق مهارة المراجعة تُعدّ مطلوب تفكيك اختياري إلى مكونات أصغر، لا مانع دمج."));
body.push(p("الوصولية: المكونات تحمل سمات ARIA وrole بعدد ملحوظ (٢٦ في القارئ، ٢٥ في نوافذ التصدير والزخارف) مع دعم ملاحة لوحة المفاتيح، والاتجاه RTL مضبوط في المستند. يوصى بإكمال تدقيق WCAG 2.2 AA يدوياً بمهارة accessibility-engineering عند إقرار نسخة عامة."));

body.push(h1("خامساً: الخلاصة والتوصيات ذات الأولوية"));
body.push(li("١. (متوسط) أضف سقفاً لحجم الملفات المرفوعة للتصدير وتحققاً من البايتات السحرية في /api/studio/export و/api/studio/export/session."));
body.push(li("٢. (متوسط) عند النشر العام: أضف رؤوس CSP وHSTS وX-Frame-Options إلى next.config.ts."));
body.push(li("٣. (منخفض) عالج أو أزل firebase-tools (سبب ثغرتي التدقيق) إن لم تكن مستخدمة في النشر."));
body.push(li("٤. (منخفض) وحّد ملف القفل على npm وأزل bun.lock لتفادي تثبيتات غير قابلة للإعادة."));
body.push(li("٥. (منخفض) خطط لتفكيك المكونات الأربعة الكبيرة إلى مكونات فرعية عند أي تعديل قادم عليها."));
body.push(li("٦. (توثيق) وضّح للناظرين أن حماية لوحة التحكم بالـ PIN محلية التصميم وليست حماية خدمة مصادقة."));
body.push(p("الحكم النهائي: المشروع مُثبت التشغيل والادعيات، ومستواه الهندسي جيد ويصلح كأساس متين للتعديلات المطلوبة، مع الاعتماد على التوصيات أعلاه قبل أي نشر عام مفتوح."));

// ================= document assembly =================
const header = new Header({
  children: [new Paragraph({
    bidirectional: true, alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent, space: 4 } },
    children: [new TextRun({ text: "تقرير الفحص الشامل — مصحف الاستوديو", size: 18, color: "888888", font: { ascii: "Arial", cs: "Arial" } })],
  })],
});
const footerArabic = new Footer({
  children: [new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: { ascii: "Arial" } })],
  })],
});
const footerRoman = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: { ascii: "Arial" } })],
  })],
});

const doc = new Document({
  styles: { default: { document: { run: { font: { ascii: "Times New Roman", eastAsia: "Times New Roman", cs: "Traditional Arabic" }, size: 24, color: "1A1A1A" } } } },
  features: { updateFields: true },
  sections: [
    // ---- section 1: cover ----
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: [coverTable, new Paragraph({ spacing: { after: 0 }, children: [] })],
    },
    // ---- section 2: TOC (roman numbering) ----
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
      footers: { default: footerRoman },
      children: [
        new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 200 },
          children: [new TextRun({ text: "المحتويات", size: 32, bold: true, color: P.accent, font: { ascii: "Arial", cs: "Arial" } })] }),
        new TableOfContents("المحتويات", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { before: 200 },
          children: [new TextRun({ text: "ملاحظة: انقر بزر الفأرة الأيمن على جدول المحتويات واختر «تحديث الحقل» لتحديث أرقام الصفحات بعد الفتح.", italics: true, size: 18, color: "888888", font: { ascii: "Arial", cs: "Arial" } })] }),
      ],
    },
    // ---- section 3: body (arabic numbering from 1) ----
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: header },
      footers: { default: footerArabic },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  fs.writeFileSync("/home/z/my-project/download/تقرير_الفحص_الشامل_مصحف_الاستوديو.docx", buf);
  console.log("OK — docx written:", buf.length, "bytes");
});
