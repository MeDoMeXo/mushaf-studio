# ٠٧ · مرجع واجهات البرمجة الخلفية (API Reference)

تعمل جميع مسارات الـ API ضمن `app/api/*` كمسارات Next.js Route Handlers ببيئة الخادم (`nodejs`) لتأمين الاتصال بالمصادر الخارجية وتجنب قيود CORS وإدارة تصدير الفيديو عبر FFmpeg.

---

## ١. بيانات القرآن الكريم (QUL Proxy API)

### `GET /api/qul/chapters`
- **الملف**: `app/api/qul/chapters/route.ts`
- **الوظيفة**: جلب قائمة السور الكاملة (١١٤ سورة) من `https://qul.tarteel.ai/api/v1/chapters?language=ar` مع دعم التراجع الآمن لـ `FALLBACK_CHAPTERS` عند تعذّر الاتصال.
- **الاستجابة (`200 OK`)**:
  ```json
  {
    "chapters": [
      {
        "id": 1,
        "revelation_place": "makkah",
        "revelation_order": 5,
        "bismillah_pre": false,
        "name_simple": "Al-Fatihah",
        "name_arabic": "الفاتحة",
        "verses_count": 7,
        "pages": [1, 1],
        "translated_name": { "name": "The Opener" }
      }
    ]
  }
  ```

### `GET /api/qul/chapters/[id]/verses?translation=<resourceId>`
- **الملف**: `app/api/qul/chapters/[id]/verses/route.ts`
- **المعاملات**:
  - `id`: رقم السورة (`1..114`).
  - `translation`: معرّف الترجمة (افتراضي `131` — The Clear Quran).
- **الوظيفة**: جلب جميع آيات السورة بالرسم العثماني (`text_uthmani`) مع الترجمة المختارة (يدعم السور الطويلة مثل البقرة ٢٨٦ آية).
- **الاستجابة (`200 OK`)**: `{ "verses": QulVerse[] }`
- **الأخطاء**: `400` عند رقم سورة غير صالح.

---

## ٢. وكيل التلاوات الصوتية (Audio Proxy & Batching)

### `GET /api/audio/[reciter]/[ayah]`
- **الملف**: `app/api/audio/[reciter]/[ayah]/route.ts`
- **المعاملات**:
  - `reciter`: معرّف القارئ (`slug`) من القائمة المعتمدة `RECITERS`.
  - `ayah`: الرقم العالمي للآية (`1..6236`).
- **الوظيفة**: بث ملف MP3 للآية من المصدر المناسب (`cdn.islamic.network` أو `everyayah.com`) مع تمرير ترويسات `Content-Type: audio/mpeg` و `Cache-Control` المناسبة.
- **ملاحظة تقنية مهمة**: يستخدم `cache: 'no-store'` في طلب `fetch` الخادمي لمنع خطأ Next.js Data Cache المعروف مع الآيات الطويلة التي يتجاوز حجمها `2 MB` (مثل آية الدَّين ٢٨٢ من سورة البقرة ~3.1 MB).

### `POST /api/audio/batch`
- **الملف**: `app/api/audio/batch/route.ts`
- **الوظيفة**: تحميل ما يصل إلى **٢٠ آية** (`AUDIO_BATCH_MAX_VERSES`) في طلب HTTP واحد لتقليص عدد الطلبات على الخادم بـ ١٦–٢٠ ضعفاً ومنع أخطاء `HTTP 429`.
- **المدخلات (`application/json`)**:
  ```json
  {
    "reciter": "ar.alafasy",
    "verseIds": [1, 2, 3, 4, 5]
  }
  ```
- **آلية التنفيذ**:
  - ٦ عمال متزامنين (Worker Pool) مع محاولتي جلب لكل آية (`cache: 'no-store'`, مهلة `15s`).
  - سقف حجم آمن للاستجابة: `18 MB` (`AUDIO_BATCH_MAX_RESPONSE_BYTES`) تحت حد Cloud Run البالغ `32 MB`.
- **الاستجابة (`200 OK`)**:
  - `Content-Type: application/octet-stream`
  - `X-Audio-Batch-Count: <N>`
  - جسم ثنائي مشفر عبر `encodeAudioBatchFrames()` (`[uint32 verseId][uint32 byteLength][MP3 bytes]...`).

---

## ٣. منظومة تصدير الفيديو (Studio Export APIs)

### `POST /api/studio/export/session`
- **الملف**: `app/api/studio/export/session/route.ts`
- **الوظيفة**: إنشاء جلسة تصدير جديدة على الخادم (`jobId` بصيغة UUID).
- **المدخلات**: إما `application/json` (بيانات `ExportJobMeta`) أو `multipart/form-data` يحتوي حقل `meta` + ملف `customAudio` الاختياري.
- **الاستجابة (`201 Created`)**: `{ "jobId": "<uuid>", "status": ExportJobStatus }`.

### `PUT /api/studio/export/session?id=<jobId>[&kind=bgvideo&chunk=N]`
- **الوظيفة**:
  1. **بدون `kind`**: رفع دفعة شرائح (`slide_0`, `slide_1`... بصيغة PNG أو JPG) ومقاطع صوتية من كاش المتصفح (`audio_0`, `audio_1`...) عبر `multipart/form-data`.
  2. **مع `kind=bgvideo&chunk=N`**: رفع أجزاء ملف الفيديو الخلفي المتحرك كجسم ثنائي (`application/octet-stream`) ولحقها بملف `bg_video` على القرص.
- **الاستجابة (`200 OK`)**: ملخص عدد الشرائح/الأجزاء المستلمة.

### `PATCH /api/studio/export/session?id=<jobId>`
- **الوظيفة**: إطلاق عملية المعالجة والتوليد بـ FFmpeg في الخلفية فوراً دون حجب الطلب.
- **الاستجابة (`202 Accepted`)**: حالة الجلسة الحالية.

### `GET /api/studio/export/session?id=<jobId>`
- **الوظيفة**: الاستعلام عن حالة التصدير (`stage`, `progress`, `message`, `result`, `error`).
- **الاستجابة (`200 OK`)**: `ExportJobStatus` (أو `404` إذا انتهت صلاحية الجلسة).

### `DELETE /api/studio/export/session?id=<jobId>`
- **الوظيفة**: إلغاء مهمة تصدير جارية، إيقاف عملية `ffmpeg` الفرعية، وتنظيف الملفات المؤقتة.

### `GET / HEAD /api/studio/export/download?id=<jobId>[&download=1]`
- **الملف**: `app/api/studio/export/download/route.ts`
- **الوظيفة**:
  - `HEAD`: يعيد حجم الملف (`Content-Length`) ونوعه (`video/mp4` أو `video/webm`) وترويسة `Accept-Ranges: bytes`.
  - `GET`: يبث الفيديو مباشرة من القرص عبر Node Stream (`Readable.toWeb`) مع دعم كامل لـ **`HTTP 206 Partial Content`** عند وجود ترويسة `Range` (للتحريك الفوري داخل مشغل `<video>` وتنزيل الملفات الكبيرة).
  - المعامل `download=1` يضبط `Content-Disposition: attachment` للتحميل المباشر بدلاً من `inline`.

### `POST /api/studio/export`
- **الملف**: `app/api/studio/export/route.ts`
- **الوظيفة**: مسار التصدير المباشر المبسط للمقاطع القصيرة جداً، بينما يعتمد الاستوديو افتراضياً على مسار الجلسات المجزّأة `/api/studio/export/session` لثباته العالي.
