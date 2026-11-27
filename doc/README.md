# التوثيق الشامل لمشروع «مصحف الاستوديو» (Mushaf Studio)

> **مصحف الاستوديو** هو منصة قرآنية متكاملة باللغة العربية (`RTL`) مبنية على **Next.js 15 (App Router)** و **React 19** و **TypeScript**، تجمع بين قارئ قرآن كريم موثّد بالرسم العثماني (عبر مكتبة QUL مفتوحة المصدر)، ومكتبة صوتية تضم **٤٩ قارئاً عالمياً**، واستوديو متكامل لتصميم وتصدير بطاقات وفيديوهات التلاوات بزخارف وقوالب إسلامية أصيلة حتى **سورة كاملة (٢٨٦ آية)**، مع لوحة تحكم وإحصائيات شاملة.

---

## حدود الأمان والنموذج الموثّق (Security Model)

- **رؤوس الأمان**: يضبط `next.config.ts` ترويسات `Content-Security-Policy` (ذاتية المصدر بالكامل: النصوص والصوت تصل عبر الوكيل الداخلي `/api` ووسائط المستخدم تُعرض كـ `blob:`/`data:`)، و`Strict-Transport-Security`، و`X-Frame-Options: SAMEORIGIN`، و`X-Content-Type-Options`، و`Referrer-Policy`، و`Permissions-Policy` على كل المسارات.
- **حدود الثقة في التصدير**: مسارات `/api/studio/export*` ترفض أي رفع يتجاوز السقوف (١٢ ميغابايت للشريحة، ٨٠ ميغابايت للصوت المخصص، ٥١٢ ميغابايت للطلب الكامل، ١٦ ميغابايت لجزء فيديو الخلفية) وتتحقق من **البايتات السحرية** (PNG/JPEG للشرائح، MP3/WAV للصوت، MP4/WebM لفيديو الخلفية) قبل أي كتابة على القرص — فلا يمكن تمرير ملف مسمّى زوراً إلى FFmpeg.
- **استدعاء FFmpeg**: يتم حصراً عبر `execFile` بمصفوفة معاملات (لا واجهة shell) وكل المعاملات الرقمية مقيدة بالنطاقات قبل البناء، فلا يوجد سطح لحقن الأوامر.
- **SSRF**: لا يوجد — كل روابط الخادم تُبنى من قوائم القراء الثابتة أو ثابت `QUL_API_BASE`، ولا يقبل أي مسار رابطاً من المستخدم.
- **حماية لوحة التحكم بـ PIN — حدودها بوضوح**: هي **حماية عرض محلية بالتصميم** لا مصادقة خدمة: الرمز الافتراضي `1234` يُخزن في `localStorage` على جهاز المستخدم نفسه، وهي مناسبة لمنع العبث العرضي من مستخدمي الجهاز الواحد فقط. عند نشر عام متعدد المستخدمين يجب نقل المصادقة إلى الخادم (متغير بيئة + جلسات) قبل الاعتماد عليها كحماية فعلية.
- **التبعيات**: `npm audit` نظيف تماماً (صفر ثغرات) بعد إزالة تبعيات غير مستخدمة (`firebase-tools` كان مصدر ثغرتين) وتثبيت رقع `postcss` عبر `overrides`.

---

## فهرس أركان التوثيق (`/doc`)

| # | الملف | النطاق والمحتوى |
|---|---|---|
| 01 | [`01-architecture.md`](./01-architecture.md) | المعمارية التقنية، هيكل المجلدات الكامل، إدارة الحالة، الخطوط المحلية، والهوية البصرية |
| 02 | [`02-quran-reader-and-search.md`](./02-quran-reader-and-search.md) | الصفحة الرئيسية، فهرس السور، قارئ القرآن، المفضلة، البحث العثماني، وشريط التلاوة العام |
| 03 | [`03-studio-and-rendering.md`](./03-studio-and-rendering.md) | استوديو تصميم التلاوات، محرك Canvas، الخلفيات المتحركة، الفلاتر السينمائية، والتخطيط |
| 04 | [`04-islamic-templates-and-ornaments.md`](./04-islamic-templates-and-ornaments.md) | المحرك الرياضي للزخارف الإسلامية، الإطارات، النقوش الهندسية، و١٤ قالباً تراثياً أصيلاً |
| 05 | [`05-audio-caching-and-dsp.md`](./05-audio-caching-and-dsp.md) | القراء العالميون (٣٨ قارئاً)، الكاش الذكي بالمتصفح، الدفعات الثنائية، ومعالج الصوت DSP |
| 06 | [`06-video-export-pipeline.md`](./06-video-export-pipeline.md) | منظومة تصدير الفيديو (MP4/WebM) عبر FFmpeg، الجلسات المجزّأة، ودعم حتى ٢٨٦ آية |
| 07 | [`07-api-reference.md`](./07-api-reference.md) | مرجع واجهات البرمجة الخلفية (`/api/*`) بالتفصيل (المدخلات، المخرجات، الترويسات، والأكواد) |
| 08 | [`08-admin-panel-and-storage.md`](./08-admin-panel-and-storage.md) | لوحة التحكم (٧ أقسام)، نظام الحماية بـ PIN، الإحصائيات، ومفاتيح التخزين المحلي |
| 09 | [`09-standards-testing-and-deployment.md`](./09-standards-testing-and-deployment.md) | المطابقة للمعايير العالمية (WCAG/SEO/Security)، الاختبارات (٨١ اختباراً عبر ١٢ ملفاً)، CI، والتشغيل والنشر |
| 10 | [`10-project-notes-and-roadmap.md`](./10-project-notes-and-roadmap.md) | **ملاحظات المشروع (بما فيها ميزة غلاف الذكاء الاصطناعي المؤجّلة)**، سجل المشكلات وحلولها، وخارطة الطريق |
| 11 | [`11-unified-ui-ux-design-system.md`](./11-unified-ui-ux-design-system.md) | **نظام التصميم والواجهة الموحّد**: توحيد كامل أركان المشروع بمكتبات Radix UI و Motion و cmdk و Sonner |
| 12 | [`12-superpowers-agentic-architecture.md`](./12-superpowers-agentic-architecture.md) | **معمارية هندسة البرمجيات المتكاملة (Superpowers + Graphify)**: المهارات الـ 15، تحليل الأثر المعماري، والقواعد الصارمة لمنع العمل بدون المنهجية |
| 13 | [`13-unified-verse-audio-architecture.md`](./13-unified-verse-audio-architecture.md) | **المعمارية الموحدة للصوتيات القرآنية المجزأة**: توحيد الـ ٣٨ قارئاً على EveryAyah، التزامن التام بين الشرائح والآيات، استبعاد التلاوات المتصلة، وخيار رفع التلاوات الخاصة |
| 14 | [`14-disjointed-letters-and-export-fixes.md`](./14-disjointed-letters-and-export-fixes.md) | **إصلاحات الحروف المقطعة والتصدير + تطوير لوحة التحكم**: الرسم متصل مع النطق والتلوين حرفاً بحرف (فواتح السور الـ٢٩)، إصلاح عطل «الفيديو الأسود»، وميزات اللوحة الأربع (الأقسام/الروابط/الخطوط/التوقيت/آية بآية) |

---

## التقنيات الأساسية (Tech Stack)

- **إطار العمل**: Next.js `15.4.9` (App Router · Standalone Output)
- **واجهة المستخدم**: React `19.2.1` + TypeScript `5.9.3`
- **التنسيق ونظام المكونات المفتوح المصدر**: Tailwind CSS `4.1.11` (`@tailwindcss/postcss`) + **Radix UI Primitives** (`dialog`, `slider`, `switch`, `tooltip`, `accordion`) + `motion` `12.23.24` + `cmdk` `1.1.1` + `sonner` `2.0.8` + `lucide-react` `0.553.0`
- **الخطوط العربية**: `next/font/google` (تحميل محلي ذاتي Zero-CLS) لـ ٦ خطوط عربية (`Amiri Quran`, `Amiri`, `Cairo`, `Noto Naskh Arabic`, `Reem Kufi`, `Scheherazade New`)
- **المعالجة الصوتية والمرئية**:
  - واجهة المتصفح: HTML5 Canvas 2D API + Web Audio API (`StudioAudioDsp`) + Cache Storage API (`mushaf-studio-audio-v1`)
  - الخادم: `ffmpeg` و `ffprobe` عبر `node:child_process` لتوليد ملفات `MP4 (H.264/AAC)` و `WebM (VP9/Opus)` متوافقة مع جميع الأجهزة
- **مصادر البيانات القرآنية**:
  - النصوص العثمانية والسور والترجمات (٦ ترجمات معتمدة متاحة في القارئ والاستوديو): مكتبة [QUL / Tarteel](https://qul.tarteel.ai/api/v1) مع بيانات احتياطية مدمجة (Fallback)
  - التلاوات الصوتية: شبكة `cdn.islamic.network` ومكتبة `everyayah.com`
- **الفحص والاختبار**: ESLint `9.39.1` + `node:test` عبر `tsx` (١٢ ملف اختبار تضم ٨١ اختباراً ناجحاً) + **CI على GitHub Actions** (lint + اختبارات + بناء + audit على كل push/PR، مع فحص صحة الـ ٣٨ قارئ أسبوعياً)

---

## الميزات المضافة في دورة التطوير الأخيرة (Roadmap 2026-11)

| # | الميزة | أبرز الملفات |
|---|---|---|
| ٢ | **تضييق CSP**: الإنتاج بلا `'unsafe-eval'` إطلاقاً (dev فقط يبقيها لأدوات Next.js) | `next.config.ts` |
| ٣ | **تفكيك AdminView**: الأقسام المستقلة (نظرة عامة/النسخ/الأمان) إلى `components/admin-ui/` — من ١٦٧٩ سطراً إلى ١٢٦٤ + ٣ مكونات | `components/admin-ui/*` |
| ٤ | **كاش خادمي دائم للصوت**: طبقة قرص ٢٥٦MB/٤٠٩٦ ملفاً بإزاحة الأقدم؛ الآية تُخزَّن خلف الطلب و`X-Quran-Audio-Cache: hit/miss` للتشخيص | `lib/server-audio-cache.ts` |
| ٥ | **ترجمة SRT متزامنة**: تُولَّد من نفس مدد قوائم concat (استحالة الانحراف)، تنزّل بـ `&kind=srt`، والعميل يرسل نصوص الآيات مع الجلسة | `lib/srt-subtitles.ts` · `download/route.ts` |
| ٦ | **وضع المصحف المعلم**: تكرار الآية ١–١٠ مرات بتوقف تلميذي (زر وشارات في شريط المشغل، محفوظ عبر الجلسات) | `lib/teacher-mode.ts` · `AudioPlayerBar` |
| ٧ | **قوالب قابلة للمشاركة**: تصدير/استيراد JSON مُتحقَّق منه بقائمة بيضاء من ٣٨ حقلاً وحدود ٥٠ قالباً — مشاركة بلا خادم | `lib/template-share.ts` |
| ٨ | **CI أساسي**: خط GitHub Actions يمنع أي تراجع (lint → tests → build → audit) | `.github/workflows/ci.yml` |
| ٩ | **فحص صحة القرّاء الدوري**: `HEAD` لكل قارئ على CDN أسبوعياً من CI + تقرير عربي | `lib/reciter-health.ts` · `scripts/check-reciters.ts` |

---

## أوامر التشغيل السريعة

```bash
# تثبيت الاعتماديات
npm install

# تشغيل بيئة التطوير (منفذ 3000)
npm run dev

# فحص جودة الكود والـ TypeScript
npm run lint
npm run build

# تشغيل جميع اختبارات الوحدة (81 اختباراً)
npx --yes tsx --test lib/*.test.ts

# فحص صحة القرّاء الـ 38 على شبكات CDN (تقرير عربي + خروج 1 عند أي قارئ مكسور)
npx --yes tsx scripts/check-reciters.ts

# تشغيل نسخة الإنتاج
npm run start
```
- [15 — إصلاحات تصدير الفيديو: الجمود وOOM](15-video-export-oom-and-freeze-fixes.md)
