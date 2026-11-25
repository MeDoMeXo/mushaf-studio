# خطة تنفيذ: مكتبة الخلفيات المتحركة + توسيع حركة الخلفية

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الهدف:** مكتبة ١٠ خلفيات متحركة جاهزة تحت تبويب الخلفيات (٥ إسلامية إجرائية + ٥ طبيعية مرخّصة) مع اختيار بالمعرّف في المعاينة والتصدير، وتوسيع حركة الخلفية من ٣ تأثيرات إلى ٨ تعمل فوق أي خلفية بما فيها الفيديو.

**المعمارية:** سجل موحّد `lib/background-library.ts` يعرّف المقاطع العشرة ويقدّمها من `public/assets/bg-library/`؛ التصدير الخادمي ينسخ المقطع بالمعرّف من القائمة البيضاء إلى `bg_video.bin` بدل الرفع من العميل. تأثيرات الحركة تُرسم إجرائياً على canvas (معاينة) وتُصدَّر كإطارات PNG متكررة (٩٦ إطاراً @ 12fps) — نفس البروتوكول القائم. منطق الحركة يُنقل من `video-export.ts` (عند سقف 600 سطر) إلى `lib/video-export-ambient.ts`.

**التقنيات:** Next.js 15 + React 19 + TypeScript · FFmpeg (موجود) · Python 3 + numpy + PIL (توليد المقاطع الإجرائية مرة واحدة) · bun test.

**التصميم:** `docs/superpowers/specs/2026-11-25-builtin-bg-library-and-ambient-expansion-design.md`

## Global Constraints

- سقف 600 سطر/ملف (`bun run scripts/check-file-size.ts` في CI).
- `lib/video-export.ts` حالياً 597 سطراً — لا إضافات صافية فيه: النقل صافٍ سالب.
- المعاينة = التصدير (ثابت مشروع): أي تأثير يظهر في المعاينة يجب أن يُصدَّر حياً.
- الرفع الخادمي يجب أن يمر بقائمة بيضاء صارمة — لا مسارات مستخدم.
- ترخيص المقاطع الطبيعية: Mixkit License (حر للاستخدام التجاري بلا نسب) — يوثَّق في `manifest.json` لكل مقطع.
- أخطاء وواجهة بالعربية (نمط المشروع).
- رسائل الالتزام بنمط المشروع: `✨ feat: ...` / `🧹 ...` إلخ.

## Review Focus

1. **معرّف مكتبة غير صالح/محقون من العميل** (`bgLibraryId: '../../etc/passwd'`) — يجب رفضه لا تحميله؛ اختبار في Task 5.
2. **مقطع مكتبة مفقود على القرص الخادمي** (نشر بدون `public/assets/`) — فشل واضح برسالة عربية لا تعليق صامت؛ اختبار في Task 5.
3. **حركة فوق فيديو خلفية في التصدير** — كانت تُسكَت قسراً؛ اختبار في Task 6 يثبت عدم الإسكات وترتيب الطبقات.
4. **تأثير غير معروف في meta قديم** (جلسة تصدير قديمة بحالة `ambient` جديد أو العكس) — يجب ألا ينهار المسار؛ اختبار في Task 4.
5. **تسريب الرفع المزدوج**: اختيار مكتبة ثم تصدير يجب ألا يرفع `bg_video.bin` من العميل أصلاً (الاختبار: منطق `hasBgVideo` العميلي في Task 6).

---

### Task 1: نقل منطق الحركة إلى `lib/video-export-ambient.ts`

**Files:**
- Create: `lib/video-export-ambient.ts`
- Modify: `lib/video-export.ts:435-530` (حذف المقاطع المنقولة)
- Test: `lib/video-export-ambient.test.ts` (جديد — نقل أساسيات القائمة من `video-export.test.ts`)

**Interfaces:**
- Produces: `AmbientVisualEffect` (نوع موسّع لاحقاً في Task 4)، `shouldRenderAnimatedAmbient(effect): boolean`، `resolveAmbientFrameSpecs(effect, w, h, fps): AmbientFrameSpecs | null`، `buildAmbientOverlayFilters(params): string | null`، `AMBIENT_MAX_FRAMES = 96`. كلها pure functions بلا اعتماد خادمي.
- يعيد استخدام `toEven` من `video-export.ts` (تصديرها إن لم تكن مصدَّرة — فحص أولاً).

- [ ] **Step 1: انقل الاختبارات القائمة الخاصة بالحركة إلى ملف الاختبار الجديد وتحقق من فشلها**

انقل من `lib/video-export.test.ts` أية اختبارات تخص `shouldRenderAnimatedAmbient`/`resolveAmbientFrameSpecs`/`buildAmbientOverlayFilters` إلى `lib/video-export-ambient.test.ts` مع تحديث الاستيراد إلى الوحدة الجديدة. شغّل: `bun test lib/video-export-ambient.test.ts` — متوقع فشل الاستيراد (الوحدة غير موجودة).

- [ ] **Step 2: انقل الكود وأنشئ الملف الجديد**

انقل من `video-export.ts`: `AmbientVisualEffect`، `shouldRenderAnimatedAmbient`، `AmbientFrameSpecs`، `resolveAmbientFrameSpecs`، `buildAmbientOverlayFilters` إلى `video-export-ambient.ts`. في `video-export.ts` أضف re-export للحفاظ على التوافق: `export { ... } from './video-export-ambient'`. تأكد أن `toEven` متاحة (صدّرها من `video-export.ts` إن كانت خاصة).

- [ ] **Step 3: شغّل الاختبارات كاملة**

`bun test` — كل الاختبارات تمر. ثم `bun run scripts/check-file-size.ts` — `video-export.ts` انخفض تحت السقف.

- [ ] **Step 4: التزم**

```bash
git add lib/video-export-ambient.ts lib/video-export-ambient.test.ts lib/video-export.ts lib/video-export.test.ts
git commit -m "🧹 إعادة هيكلة: نقل منطق طبقة الحركة إلى video-export-ambient.ts (قاعدة 600 سطر)"
```

---

### Task 2: توليد الخلفيات الإسلامية الخمس إجرائياً

**Files:**
- Create: `scripts/generate-islamic-backgrounds.py`
- Create: `public/assets/bg-library/*.mp4` (5 مقاطع) + `manifest.json`
- Test: لا اختبار وحدة — التحقق بـ ffprobe لكل مقطع (خطوة تحقق داخل المهمة)

**Interfaces:**
- Produces: ملفات `public/assets/bg-library/islamic-{1..5}-*.mp4` — H.264/yuv420p، حلقة سلسة ~8 ث، بدون صوت، 1080×1920 (عمودي) — و`manifest.json` بمدخلات `{id, name, category, file, license, sourceUrl, posterColors}`.

- [ ] **Step 1: اكتب مولّد Python (numpy+PIL → إطارات → ffmpeg)**

لكل مقطع: 96 إطاراً @ 12fps = 8 ث، حلقة سلسة (طور متعدد 2π في نهاية المدة). المقاطع: (1) نجمة ثمانية دوّارة + غبار ذهبي على تدرج كحلي، (2) أرابيسك يتنفس (جيوب نصف قطرها تتذبذب)، (3) شبكة ثمانيات متلألئة (تخافت طور عشوائي ثابت)، (4) قناديل تتمايل (بندول + لهب يومض)، (5) أشعة نور تنساب من فتحة علوية. كل إطار: numpy canvas → PIL → PNG → دفق إلى `ffmpeg -framerate 12 -i - -c:v libx264 -pix_fmt yuv420p -crf 26 -preset veryfast -movflags +faststart`. تلميح: نجمة ثمانية = مربعان متراكبان بزاوية 45°، تدرج الخلفية linear-gradient عمودي بين لونين من لوحة المشروع (كحلي #1a2440 → أزرق ليلي #0d1220، ذهبي #c9a227، زمردي #44b298).

- [ ] **Step 2: شغّل المولّد وتحقق بـ ffprobe**

شغّل السكربت. لكل مقطع تحقق: `ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt -show_entries format=duration -of json <file>` — h264، 1080×1920، yuv420p، مدة 8.0±0.2ث، وحجم ≤ 3MB. تحقق بصرياً من إطار منتصف كل مقطع (استخرج PNG وانظر إليه بـ Read — ضمن حد الصور البالغ 20).

- [ ] **Step 3: التزم**

```bash
git add scripts/generate-islamic-backgrounds.py public/assets/bg-library/
git commit -m "✨ feat: خلفيات إسلامية متحركة إجرائية (5 مقاطع حلقة سلسة 8 ث)"
```

---

### Task 3: الخلفيات الطبيعية الخمس من Mixkit + الضغط

**Files:**
- Create: `scripts/fetch-nature-backgrounds.sh`
- Create: `public/assets/bg-library/nature-{1..5}-*.mp4` (إضافات إلى manifest نفسه)

**Interfaces:**
- Produces: `public/assets/bg-library/nature-{1..5}-*.mp4` بنفس مواصفات الترميز، + أسطر manifest بـ `sourceUrl` لرابط Mixkit و`license: "Mixkit License"`.

- [ ] **Step 1: اكتب السكربت: تحميل 5 مقاطع طبيعية من روابط assets.mixkit.co المباشرة (غيوم/أمواج/غروب/أوراق/نهر) ثم إعادة ترميز كل منها**

`curl -L` لكل رابط → `ffmpeg -i in -t <دورة مشابهة ≈8-10ث> -an -vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=24 -c:v libx264 -crf 28 -preset veryfast -pix_fmt yuv420p -movflags +faststart out.mp4`. اختر نقطة بتر عند أقرب تطابق أول/أخير إطار إن أمكن (وإلا اعتمد التكرار `-stream_loop -1` الخادمي القائم الذي يجعل أي مدة تعمل). حد 3MB/مقطع؛ إن تجاوز ارفع crf.

- [ ] **Step 2: شغّل، تحقق بـ ffprobe + بيان الترخيص**

نفس فحوصات Task 2 + تحقق أن `manifest.json` يتضمن sourceUrl وMixkit License لكل مقطع طبيعي. نظّف الملفات الخام المؤقتة.

- [ ] **Step 3: التزم**

```bash
git add scripts/fetch-nature-backgrounds.sh public/assets/bg-library/
git commit -m "✨ feat: خلفيات طبيعية مرخّصة من Mixkit (5 مقاطع مضغوطة) + بيان الترخيص"
```

---

### Task 4: سجل المكتبة + توسيع الحركة (8 تأثيرات)

**Files:**
- Create: `lib/background-library.ts`
- Create: `lib/background-library.test.ts`
- Modify: `lib/video-export-ambient.ts` (توسيع النوع والوظائف للتأثيرات الجديدة)
- Modify: `lib/quran-data-types.ts:75` (توسيع `AmbientEffect`)
- Test: `lib/video-export-ambient.test.ts` (توسيع)

**Interfaces:**
- Produces (المكتبة): `BUILTIN_BG_LIBRARY: readonly BuiltinBackground[]` حيث `interface BuiltinBackground { id: string; name: string; category: 'islamic' | 'nature'; file: string; posterColors: [string, string]; license: string; sourceUrl: string }`؛ `BUILTIN_BG_IDS: readonly string[]`؛ `isBuiltinBackgroundId(id: string): boolean`؛ `getBuiltinBackground(id: string): BuiltinBackground | null`.
- Produces (الحركة): `AmbientVisualEffect = 'none' | 'stars' | 'gold-dust' | 'aurora' | 'fireflies' | 'petals' | 'bokeh' | 'rain' | 'snow'`؛ `AmbientEffect` في `quran-data-types.ts` يتسق معه (أو يستورده).
- الحركة الجديدة تتبع البروتوكول الإطاراتي القائم: 96 إطاراً @ 12fps (كلها) — لا حاجة لأوضاع جديدة.

- [ ] **Step 1: اكتب الاختبارات الفاشلة للمكتبة**

`lib/background-library.test.ts`: 10 عناصر، معرفات فريدة، 5 إسلامية + 5 طبيعية، `isBuiltinBackgroundId('islamic-1-star-rotate') === true` و`(('../../etc/passwd')) === false` و`getBuiltinBackground` يرجع null للمجهول، وكل `file` ينتهي بـ `.mp4` ويبدأ بـ `islamic-` أو `nature-`، وكل عنصر طبيعي له `license` و`sourceUrl` غير فارغين.

- [ ] **Step 2: شغّل — فشل متوقع (الوحدة غير موجودة)**

`bun test lib/background-library.test.ts` — FAIL.

- [ ] **Step 3: نفّذ السجل**

بيانات manifest المولّدة في Task 2/3 تُنسخ يدوياً إلى `lib/background-library.ts` كمصفوفة ثابتة (مطابقة للقرص). شغّل الاختبار — PASS.

- [ ] Step 4: اختبارات الحركة الجديدة — `shouldRenderAnimatedAmbient('fireflies'|'petals'|'bokeh'|'rain'|'snow') === true`، و`resolveAmbientFrameSpecs` لكل منها يرجع 96 إطاراً @ 12fps mode='frames'، و`buildAmbientOverlayFilters` يرجع فلتر overlay لكل منها، والتأثير المجهول يرجع false/null بأمان.

- [ ] Step 5: نفّذ التوسيع في `video-export-ambient.ts` + حدّث `AmbientEffect` في `quran-data-types.ts` (أو استورد النوع الموسع). شغّل `bun test` — PASS كامل.

- [ ] **Step 6: التزم**

```bash
git add lib/background-library.ts lib/background-library.test.ts lib/video-export-ambient.ts lib/video-export-ambient.test.ts lib/quran-data-types.ts
git commit -m "✨ feat: سجل مكتبة الخلفيات العشر + توسيع حركة الخلفية إلى 8 تأثيرات"
```

---

### Task 5: مسار التصدير الخادمي بالمعرّف

**Files:**
- Modify: `lib/export-job-manager.ts` (حقل ميتا `bgLibraryId` + تطبيع)
- Modify: `lib/export-render-pipeline.ts` (نسخ من public/ إلى bg_video.bin)
- Modify: `lib/export-pipeline.ts` (العميل: يرسل المعرّف بدل الملف)
- Test: `lib/export-job-manager.test.ts` (إن وجد) أو اختبار جديد `lib/bg-library-export.test.ts`

**Interfaces:**
- Consumes: `isBuiltinBackgroundId`, `getBuiltinBackground` من Task 4.
- Produces: `ExportJobMeta.bgLibraryId?: string`؛ في العميل `bgVideoFile` يبقى null عند اختيار مكتبة و`meta.bgLibraryId` يُضبط.
- مسار النسخ الخادمي: عند `meta.bgLibraryId` صالح → `fs.copyFile(path.join(process.cwd(), 'public', 'assets', 'bg-library', bg.file), path.join(dir, 'bg_video.bin'))`؛ غير صالح → خطأ عربي واضح «الخلفية المختارة غير متوفرة».

- [ ] Step 1: اختبار فاشل — تطبيع الميتا يقبل `bgLibraryId` الصالح ويرفض/تصفير غير الصالح مع رسالة خطأ.

- [ ] Step 2: نفّذ في `export-job-manager.ts` (تطبيع: سلسلة ≤64 حرفاً إن كانت ضمن `isBuiltinBackgroundId` وإلا undefined + خطأ عند التشغيل إن أُرسل صراحةً غير صالح). شغّل — PASS.

- [ ] Step 3: نفّذ النسخ الخادمي في `export-render-pipeline.ts` قبل فحص `bg_video.bin` الحالي (تحقق من الوجود بالفعل `hasValidFile` — انسخ فقط إن لم يوجد الملف المرفوع). شغّل `bun test` كاملاً — PASS.

- [ ] Step 4: عمّل العميل في `export-pipeline.ts` — عند `bgLibraryId`: لا رفع chunks إطلاقاً، `hasBgVideo` منطقياً true (للمسار الخادمي). تحقق بالفحص أن مسار الرفع لا ينفّذ.

- [ ] Step 5: التزم

```bash
git add lib/export-job-manager.ts lib/export-render-pipeline.ts lib/export-pipeline.ts lib/bg-library-export.test.ts
git commit -m "✨ feat: تصدير خلفيات المكتبة بالمعرّف — نسخ خادمي من قائمة بيضاء بدل رفع العميل"
```

---

### Task 6: الواجهة + تمكين الحركة فوق الفيديو

**Files:**
- Modify: `components/studio-ui/StudioBackgroundPanel.tsx` (قسم المكتبة + شبكة الحركة 3×3)
- Modify: `hooks/use-studio-media.ts` (معالج اختيار المكتبة `handleSelectBgLibrary`)
- Modify: `components/studio-ui/StudioDesignInspector.tsx` (تمرير المعالج)
- Modify: `lib/studio-initial-state.ts` (قيمة افتراضية `bgLibraryId: null`)
- Modify: `lib/template-share.ts` (إضافة `bgLibraryId` للمفاتيح المتشاركة)
- Modify: `lib/export-pipeline.ts:161` (إزالة إسكات ambient مع الفيديو)
- Modify: `lib/export-render-pipeline.ts` (تركيب الحركة فوق فيديو الخلفية)
- Modify: `lib/studio-renderer.ts` (رسم التأثيرات الجديدة في `drawAmbientEffect`)
- Test: `lib/video-export-ambient.test.ts` (توسيع — ترتيب الطبقات)

- [ ] Step 1: اختبار فاشل — `buildAmbientOverlayFilters` مع فيديو خلفية: يجب أن يبني مسار `[bg]` + ambient → `[bgamb]` → slides (عبر الفحص أن المرسل للاختبار الحالي في Task 6 من export-render-pipeline يمرر الطبقات بالترتيب الصحيح — اختبار تكاملي خفيف على نص الفلتر).

- [ ] Step 2: نفّذ إزالة الإسكات في `export-pipeline.ts` (أزل `ambient: hasBgVideo ? 'none' :`)، وفي `export-render-pipeline.ts` فعّل تركيب ambient فوق فيديو الخلفية في فرعي hasBgVideoFile (xfade وconcat): أضف مدخلات ambient بعد مدخل الفيديو الخلفي وطبّق `buildAmbientOverlayFilters` بين `bg` والشرائح. انتبه لفهرسة المدخلات (`inputOffset`). شغّل — PASS.

- [ ] Step 3: نفّذ الرسم الجديد في `studio-renderer.ts::drawAmbientEffect` — يراعِات (وميض أخضر-ذهبي يطفو)، بتلات (هبوط بدوران)، بوكيه (دوائر ناعمة تنبض وتصعد)، مطر (خطوط مائلة)، ثلج (رقاقات بتمايل). استخدم نمط `STAR_SEED` (بذور حتمية بنفس أسلوب hash). أبقِ الملف ≤600. شغّل `bun test` — PASS.

- [ ] Step 4: الواجهة — قسم «مكتبة الخلفيات» في `StudioBackgroundPanel.tsx`: شبكة بطاقات من `BUILTIN_BG_LIBRARY` (اسم + شارة فئة + تدرّج `posterColors`)، اختيار يعيّن `bgType='video'` و`bgLibraryId`؛ معرض الرفع الحالي يبقى. شبكة الحركة تصبح `grid-cols-3` مع التأثيرات الـ9 (بما فيها none). `use-studio-media.ts` يضيف `handleSelectBgLibrary(id)` (يضبط `bgVideoUrl` إلى `/assets/bg-library/<file>` مع `bgVideoFile=null`). مرّر المعالج عبر `StudioDesignInspector`. شغّل `bun run lint` + `bun test`.

- [ ] Step 5: شغّل البناء الكامل: `bun run build` — نجاح بدون أخطاء TypeScript.

- [ ] Step 6: التزم

```bash
git add components/ hooks/ lib/
git commit -m "✨ feat: واجهة مكتبة الخلفيات العشر + 8 تأثيرات حركة فوق أي خلفية (معاينة=تصدير)"
```

---

### Task 7: توثيق + تحقق نهائي + مزامنة

**Files:**
- Modify: `doc/10-project-notes-and-roadmap.md` (نقل بند المكتبة من Backlog إلى منجز)
- Modify: `docs/superpowers/specs/2026-11-25-...design.md` (قسم «ما تم بناؤه»)

- [ ] Step 1: حدّث `doc/10` — انقل «مكتبة خلفيات فيديو إسلامية جاهزة مدمجة» من Backlog إلى منجز مع وصف موجز، وأضف للـ Backlog بند «توسيع المكتبة بمقاطع إضافية».

- [ ] Step 2: شغّل سلسلة التحقق الكاملة: `bun run scripts/check-file-size.ts && bun run lint && bun test && bun run build`. كلها يجب أن تنجح — أصلح أي فشل قبل المتابعة.

- [ ] Step 3: التزم + مزامن مباشرة

```bash
git add doc/ docs/
git commit -m "📚 docs: تحديث خارطة الطريق — مكتبة الخلفيات منجزة"
git push origin main
```

---

## ملاحظة تنفيذية

صاحب المشروع طلب صراحة: «طبق التعديل وفق للمعمارية المتبعة ثم قم بالمزامنة مباشرة على قت هب» — طريقة التنفيذ محددة سلفاً (Native/بنفسي في هذه الجلسة عبر executing-plans)، والبوابة المعتادة لمراجعة الخطة مُستوفاة بطلب التنفيذ الصريح. المزامنة على `origin main` مباشرة هي جزء من المطلوب.
