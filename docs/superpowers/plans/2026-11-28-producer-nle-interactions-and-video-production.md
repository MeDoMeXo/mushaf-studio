# خطة تنفيذ: منتج الصوت — تفاعلات المحرر الاحترافي وإنتاج الفيديو الكامل

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الحالة:** ✅ منفَّذة بالكامل ومُتحقَّق منها E2E (٢٠٢٦-١١-٢٨) — التوثيق المرجعي في `doc/16-audio-producer-interactions-and-video-production.md`.

**الهدف:** وفق مرجع مستخدم (محرر فيديو من نوع كابوينغ + لقطات تعليم على الواجهة الحالية): تحرير موضع الآيات بالسحب والتحكم الدقيق، شريط جانبي قابل للتوسيع، وضع «الآية في سطر واحد» يتحرك مع الصوت، صدى الصوت، وخلفيات الفيديو في مسار إنتاج كامل يُسلَّم للاستوديو.

**المعمارية:** كل الحسابات نقية في `lib/audio-producer/*` قابلة للاختبار (‏`verse-markers.ts` و`producer-echo.ts` جديدان‎)؛ سجل التراجع في `use-audio-producer` يصير لقطات مركّبة `{edit, verseMarkers}`؛ الصدى يُبنى داخل `renderEdited` (‏OfflineAudioContext‎) فيمرّ تلقائياً في الرندر المشترك — فالمعاينة تسمع الصدى نفسه الذي يُصدَّر (ثابت «المعاينة = التصدير»‎)؛ التسليم إلى الاستوديو يمدّ `ProducerHandoff` بـ`bgLibraryId` من القائمة البيضاء وحدها. قاعدة ٦٠٠ سطر تُحترم باستخراج `use-producer-view` و`use-producer-export`.

## Global Constraints

- سقف ٦٠٠ سطر/ملف (‏`bun run scripts/check-file-size.ts` في CI‎) — تحقّق.
- المعاينة = التصدير: الصدى في المعاينة هو الصدى في WAV/التسليم — تحقّق.
- قائمة بيضاء صارمة للخلفيات (‏`isBuiltinBackgroundId`‎) — لا مسارات مستخدم إلى الخادم.
- بلا `setState` داخل أجسام الآثار (‏`react-hooks/set-state-in-effect`‎) — الحركة بالمراجع وكتابة DOM مباشرة.
- أخطاء وواجهة بالعربية (‏نمط المشروع‎).
- تراجع السحب = نقطة واحدة (‏لقطة عند `pointerdown` ثم معاينة بلا لقطات‎).

## المراجع (Tasks)

- [x] 1 — `lib/audio-producer/verse-markers.ts` نقية: `MIN_VERSE_GAP_SEC=0.4` + `clampVerseMarkerSec/moveVerseMarker/nudgeVerseMarker` + ‏٦ اختبارات.
- [x] 2 — `lib/audio-producer/producer-echo.ts` نقية: `ProducerEchoSettings` + قيود + ‏٤ إعدادات مسبقة + `echoTailSec` بسقف ٤ث + `describeEcho` + ‏٦ اختبارات.
- [x] 3 — `renderEdited(source, state, echo?)`: ناقل جاف/رطب بتأخير وتغذية راجعة + مدّ المدة بذيل الصدى؛ بلا صدى المسار مستقيم (ناتج بتّيّ مطابق).
- [x] 4 — `use-audio-producer`: لقطات مركّبة للتراجع (‏تعديل + حدود معاً‎) + `setVerseMarker/nudgeVerse/beginVerseMarkerDrag/previewVerseMarker` + حالة `echo` و`setEcho` (‏قيود + إبطال الرندر‎)؛ استخراج `use-producer-view` و`use-producer-export`؛ `use-audio-producer-playback` يقبل `echoRef`.
- [x] 5 — `ProducerTimeline`: مقابض حدّ لكل آية (‏`role=separator` قابلة للتركيز بالأسهم‎) سحب حي بلقطة واحدة + مجموعة «موضع الآية» (‏‎±٠٫٢٥ + حقل رقمي ms‎) في شريط الأدوات.
- [x] 6 — `ProducerPreviewPanel`: وضع «سطر واحد» (‏شارة + تلاشي حواف‎) + تحريك `translate(overflow×progress)` بالمراجع بلا setState في الآثار؛ التفضيل محفوظ.
- [x] 7 — `ProducerLibraryPane`: مقبض سحب ‎٢٤٠–٥٦٠px + طيّ/بسط + `localStorage`.
- [x] 8 — `ProducerVideoStudioDialog` + زر «إنتاج الفيديو» في شريط المصدر؛ `ProducerHandoff.bgLibraryId` + استهلاكه في `use-studio-media` (‏تطبيق فوري لنمط الفيديو والبثّ‎).
- [x] 9 — بوابات الجودة: tsc صفر · ‏`bun test` ١٨٨/١٨٨ · lint نظيف · سقف ٦٠٠ سليم · ‏E2E متصفح بسبعة سيناريوهات (انظر doc/16 §٧).

## Review Focus (مُتحقَّق منها)

1. **تجاور الآيات**: سحب ضخم قيَّد الحدّ عند سابقه ‎+٠٫٤ث‎ — لا ابتلاع آية (‏شوهد في المتصفح: `آية ٦ — 0:00` ثم التراجع أعادها `0:05`‎).
2. **تراجع عبر النوعين**: إزاحة + قيمة رقمية + سحب ثم Ctrl+Z يعيد القيم والأمداد حرفياً (‏٢٧٫٦٤←٢٧٫٣٩←٣٢٫٩٣‎).
3. **الصدى في الرندر المشترك**: تشغيل المعاينة بعد ضبط المسجد يسمعه؛ تصدير/تسليم WAV يحمل الذيل نفسه.
4. **معرّف خلفية غير صالح**: `isBuiltinBackgroundId` وحده يعتمد القيمة — تسليم خلفية `null` لا يغيّر نمط الاستوديو.
5. **الأداء**: الحركة الأفقية للسطر الواحد بلا إعادة رندر إضافية فوق rAF الأصلية (‏كتابة transform مباشرة‎).
