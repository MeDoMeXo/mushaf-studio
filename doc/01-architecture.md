# ٠١ · المعمارية التقنية وهيكلة الملفات وتدفق البيانات

## ١. النمط المعماري العام (Architecture Overview)

يعتمد المشروع على معمارية **Next.js 15 App Router** الهجينة بين:
1. **مكونات الخادم وملفات التعريف (Server Layer)**:
   - الجذر `app/layout.tsx` (تخطيط RTL عربي، تحميل خطوط `next/font/google`، بيانات Schema.org، رابط التخطي `skip-to-content`).
   - مسارات الصفحات الخفيفة (`app/page.tsx`, `app/quran/page.tsx`, `app/quran/[id]/page.tsx`, `app/studio/page.tsx`, `app/search/page.tsx`, `app/admin/page.tsx`).
   - مسارات البيانات الوصفية القياسية (`app/manifest.ts`, `app/robots.ts`).
   - مسارات API الخلفية (`app/api/*`) تعمل ببيئة `nodejs` كوسيط آمن للبيانات القرآنية والصوتية ومحرك FFmpeg لتصدير الفيديو.
2. **مكونات العميل التفاعلية (Client Layer)**:
   - سياق عام واحد `components/AppProvider.tsx` يدير إعدادات الموقع (`SiteConfig`)، المظهر (فاتح/ليلي)، مشغل التلاوة المستمر عبر الصفحات، القراء المفضلين، نافذة اختيار القارئ، والإشعارات الفورية (Toasts).
   - منطق رياضي ووظيفي نقي مفصول بالكامل داخل `/lib/*.ts` (بدون اعتماد على DOM حيثما أمكن) مما يسمح باختباره مباشرة عبر `node:test`.

---

## ٢. خريطة الملفات الكاملة للمشروع

```text
/
├── app/
│   ├── layout.tsx                              # الجذر، next/font/google، JSON-LD، Viewport، Skip Link
│   ├── globals.css                             # متغيرات الألوان (فاتح/داكن)، الخطوط، color-scheme، focus-visible
│   ├── page.tsx                                # الصفحة الرئيسية (تعرض HomeView)
│   ├── manifest.ts                             # Web App Manifest عربي RTL
│   ├── robots.ts                               # ملف robots.txt القياسي
│   ├── quran/
│   │   ├── page.tsx                            # فهرس السور ١١٤ (QuranIndexView)
│   │   └── [id]/page.tsx                       # قارئ السورة (ReaderView)
│   ├── studio/page.tsx                         # استوديو تصميم وتصدير التلاوات (StudioView)
│   ├── search/page.tsx                         # البحث في القرآن والسور (SearchView)
│   ├── admin/page.tsx                          # لوحة التحكم والإحصائيات (AdminView)
│   └── api/
│       ├── qul/chapters/route.ts               # جلب قائمة السور من QUL مع كاش
│       ├── qul/chapters/[id]/verses/route.ts   # جلب آيات السورة بالرسم العثماني والترجمة
│       ├── audio/[reciter]/[ayah]/route.ts     # وكيل بث صوت آية مفردة
│       ├── audio/batch/route.ts                # وكيل تحميل دفعة حتى ٢٠ آية ببروتوكول ثنائي
│       └── studio/export/
│           ├── route.ts                        # تصدير مباشر بسيط (Legacy/Small)
│           ├── session/route.ts                # دورة حياة جلسات التصدير المجزّأة (POST/PUT/PATCH/GET/DELETE)
│           └── download/route.ts               # تنزيل وبث الفيديو النهائي مع دعم HTTP 206 Range
├── components/
│   ├── AppProvider.tsx                         # السياق العام (التكوين، الثيم، مشغل التلاوة العالمي، القراء المفضلون)
│   ├── Header.tsx                              # شريط التنقل العلوي المتجاوب + aria-current + مبدّل المظهر
│   ├── Footer.tsx                              # تذييل الموقع البسيط والمرتبط مباشرة بلوحة التحكم (`config.footer`)
│   ├── AudioPlayerBar.tsx                      # شريط التلاوة السفلي المستمر عبر الصفحات
│   ├── ReciterPickerModal.tsx                  # نافذة اختيار القارئ العالمي (بحث، تصنيفات، عينة، مفضلة)
│   ├── HomeView.tsx                            # الصفحة الرئيسية + آية اليوم + آخر قراءة + وصول سريع
│   ├── QuranIndexView.tsx                      # فهرس ١١٤ سورة + تصفية مكية/مدنية + بحث
│   ├── ReaderView.tsx                          # قارئ السورة بالرسم العثماني + ترجمات + إشارات مرجعية + تتبع تلقائي
│   ├── SearchView.tsx                          # البحث الموحّد في السور والآيات مع تجاهل التشكيل
│   ├── StudioView.tsx                          # واجهة الاستوديو الموحدة + إدارة الحالة والترجمات وسجل التراجع/الإعادة
│   ├── studio-ui/                              # مكتبة مكونات الاستوديو المعيارية (Radix UI + Motion + cmdk)
│   │   ├── StudioCommandBar.tsx                # شريط أوامر الاستوديو العلوي (تراجع/إعادة، بحث Ctrl+K، تصدير سريع)
│   │   ├── StudioCommandPalette.tsx            # لوحة الأوامر السريعة cmdk (السور، القراء، القوالب، والترجمات الـ ٦)
│   │   ├── StudioControls.tsx                  # عناصر التحكم الموحّدة (StudioSlider, StudioSwitch, StudioTooltip)
│   │   ├── StudioDesignInspector.tsx           # مفتش التصميم ذو التبويبات الـ ٥ (Radix Tabs + Accordion)
│   │   ├── StudioRecitationPanel.tsx           # عمود التلاوة، اختيار السورة/الآيات، والترجمة المعتمدة من QUL
│   │   └── StudioStagePanel.tsx                # مسرح المعاينة الداكن (.studio-stage-grid) ونافذة التكبير Radix Dialog
│   ├── StudioOrnamentsPanel.tsx                # لوحة تبويب «الزخارف» (إطارات، نقوش، زوايا، خراطيش، فواصل، ألوان)
│   ├── StudioExportModal.tsx                   # نافذة تصدير الفيديو (Radix Dialog + StudioSlider/Switch + تصغير عائم)
│   └── AdminView.tsx                           # لوحة التحكم الكاملة الموحّدة (٧ أقسام + رسوم بيانية + معاينة حية)
├── hooks/
│   └── use-mobile.ts                           # Hook للتحقق من شاشات الجوال
├── lib/
│   ├── quran-data.ts                           # جميع الأنواع والثوابت: القراء (٣٨)، التدرجات (٢٠)، القوالب (١٤)، الترجمات (٦)
│   ├── quran-utils.ts                          # أدوات النصوص العربية، تحويل الأرقام، خريطة ٦٢٣٦ آية، وحلّ اتجاه وبيانات الترجمات
│   ├── qul-client.ts                           # عميل QUL بذاكرة مؤقتة + fallback عند انقطاع الشبكة
│   ├── reciter-filter.ts                       # منطق تصفية القراء، الفرز، المفضلة، وتوجيه روابط التشغيل
│   ├── islamic-ornaments.ts                    # برميل إعادة تصدير الزخارف (الأنواع/الهندسة/الرسم في lib/ornaments/)
│   ├── studio-history.ts                       # مكدّس التراجع والإعادة النقي لحالة الاستوديو (Undo/Redo حتى ٤٠ خطوة)
│   ├── studio-renderer.ts                      # محرك رسم إطارات الاستوديو (خلفيات، LUTs، زخارف) + studio-text-renderer.ts (نصوص وترجمات) وstudio-renderer-shared.ts (مشترك)
│   ├── studio-audio-dsp.ts                     # معالج Web Audio API المباشر للمؤثرات الصوتية والخلفيات الطبيعية
│   ├── audio-batch-codec.ts                    # بروتوكول التشفير/فك التشفير الثنائي لدفعات الصوت + Backoff لـ HTTP 429
│   ├── audio-cache.ts                          # نظام الكاش المزدوج (RAM LRU + Cache Storage API) والتحميل المسبق
│   ├── video-export.ts                         # حساب الأبعاد، CRF، فلاتر FFmpeg، المانيفست، والتحقق من ترويسة الفيديو
│   ├── export-job-manager.ts                   # مدير مهام التصدير على الخادم وتنفيذ محركات FFmpeg الأربعة
│   ├── storage.ts                              # طبقة التخزين المحلي (`localStorage`) وبث أحداث التحديث
│   ├── utils.ts                                # دالة `cn()` لدمج أصناف Tailwind
│   └── *.test.ts                               # ٧ ملفات اختبارات وحدة (45 اختباراً)
└── doc/                                        # هذا المجلد (التوثيق الكامل — ١١ ملفاً)
```

---

## ٣. نظام الهوية البصرية والألوان (Design Tokens)

تُعرّف الألوان مركزياً في `app/globals.css` مع دعم صريح للوضعين الفاتح والداكن (`color-scheme: light` و `color-scheme: dark`) واستلهام من جماليات المخطوطات والمصاحف المتحفية:

| المتغير CSS | الوضع الفاتح (ورق مخطوطي) | الوضع الداكن (زمرد ليلي) | الاستخدام |
|---|---|---|---|
| `--brand-emerald` | `#0B3D2E` | `#13533E` | اللون الرئيسي للهوية والأزرار الأساسية |
| `--brand-emerald-deep` | `#07291f` | `#0A2E23` | التباين الداكن للعناصر الزمردية |
| `--brand-gold` | `#B88A1E` | `#D4AF37` | التذهيب والحدود النشطة ومؤشر التركيز |
| `--brand-gold-soft` | `#E6C75A` | `#EED178` | الإبراز الذهبي الفاتح والنصوص فوق الخلفيات الداكنة |
| `--surface-canvas` | `#F7F4EC` | `#0A1513` | خلفية الصفحة الأساسية |
| `--surface-card` | `#FFFDF8` | `#10201C` | خلفية البطاقات والألواح |
| `--surface-subtle` | `#EFEAE0` | `#162B26` | حقول الإدخال والعناصر الثانوية |
| `--border-hairline` | `#E3DAC6` | `#213A33` | الفواصل الدقيقة |
| `--ink-primary` | `#1F1B16` | `#EFECE4` | النص الأساسي |
| `--ink-muted` | `#6A6155` | `#98A9A1` | النصوص المساعدة والبيانات الوصفية |

كما يمكن للمشرف تخصيص `--brand-emerald` و `--brand-gold` ديناميكياً من لوحة التحكم، ويطبّقها `AppProvider` تلقائياً على `document.documentElement`.

---

## ٤. إدارة الخطوط العربية وجسر الـ Canvas

يتم تحميل الخطوط عبر `next/font/google` و `next/font/local` في `app/layout.tsx` وتُربط بمتغيرات CSS على عنصر `<html>`:

- `--font-amiri-quran` (`Amiri Quran`: 400) — الرسم العثماني القرآني الرئيسي.
- `--font-kfgqpc-hafs` (`KFGQPC Uthmanic Hafs`) — خط مصحف المدينة النبوية الرسمي (مجمع الملك فهد لطباعة المصحف الشريف).
- `--font-kfgqpc-uthman-taha` (`KFGQPC Uthman Taha Naskh`) — خط الأستاذ عثمان طه (مجمع الملك فهد).
- `--font-scheherazade` (`Scheherazade New`: 400–700) — الخط المصحفي الموسع من SIL.
- `--font-noto-naskh` (`Noto Naskh Arabic`: 400–700) — خط النسخ العربي المعاصر.
- `--font-reem-kufi` (`Reem Kufi`: 400–700) — خط العناوين الكوفية التراثية وأسماء السور.
- `--font-amiri` (`Amiri`: 400, 700) — النسخ الأميري الكلاسيكي.
- `--font-cairo` (`Cairo`: 300–800) — خط الواجهة العام والترجمات.

**جسر خطوط Canvas (`resolveCanvasFontFamily`)**:
نظراً لأن `next/font/google` يولّد أسماء خطوط داخلية مجزّأة (Hashed Font Names)، يقوم `lib/studio-renderer.ts` بقراءة قيمة متغير CSS المحسوبة من `getComputedStyle(document.documentElement)` وتخزينها في `Map` مؤقتة، مما يضمن أن محرك HTML5 Canvas يرسم الآيات والزخارف بنفس الخطوط المحمّلة محلياً بدقة ١٠٠٪ دون رجوع إلى خط النظام.

---

## ٥. تدفق البيانات والأحداث (Data & Event Flow)

1. **تحميل الصفحة**: `AppProvider` يقرأ التكوين من `localStorage` (`quran_config_v1`)، يطبّق الثيم والألوان، يسجّل زيارة في الإحصائيات (`bumpStat('visits')`)، ويهيئ قائمة القراء المفضلين.
2. **تزامن الإعدادات**: أي حفظ في `AdminView` يطلق حدث المتصفح `quran-config-updated`، وأي إحصائية تطلق `quran-stats-updated` لتحديث الواجهات فورياً دون إعادة تحميل الصفحة.
3. **قراءة القرآن**: `qul-client.ts` يجلب السور والآيات من `/api/qul/*` مع تخزين مؤقت داخل الذاكرة للجلسة، وفي حال انقطاع الشبكة يعود تلقائياً إلى `FALLBACK_CHAPTERS` و `FALLBACK_VERSES`.
4. **ربط القارئ بالاستوديو**: يمكن للمستخدم الانتقال من أي آية في القارئ مباشرة إلى الاستوديو عبر رابط `/studio?surah=X&from=Y&to=Y&reciter=SLUG&translation=ID` مع نقل السورة والآية والقارئ والترجمة المعتمدة المختارة تلقائياً.
