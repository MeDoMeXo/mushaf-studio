/**
 * Quran domain data + studio catalogs + site config defaults.
 * Types moved to lib/quran-data-types.ts and templates to
 * lib/studio-templates.ts (600-line file rule); both are re-exported below
 * so every existing import path keeps working unchanged.
 */
import type {
  AspectPresetId,
  ColorLutId,
  GradientPreset,
  QulChapter,
  QulVerse,
  ReciterOption,
  SiteConfig,
  SiteStats,
  StudioTemplate,
  TranslationOption,
} from './quran-data-types';

export * from './quran-data-types';
export * from './studio-templates';

// re-export ornament types that this module's API surface has always carried
export type {
  IslamicAyahMedallionStyle,
  IslamicCornerStyle,
  IslamicFrameStyle,
  IslamicPatternStyle,
  SurahBannerStyle,
} from './islamic-ornaments';

export const QUL_API_BASE = 'https://qul.tarteel.ai/api/v1';
export const AUDIO_CDN_BASE = 'https://cdn.islamic.network/quran/audio';
export const EVERYAYAH_CDN_BASE = 'https://everyayah.com/data';

export const COLOR_LUT_PRESETS: {
  id: ColorLutId;
  label: string;
  preview: string;
}[] = [
  { id: 'none', label: 'بدون فلتر (أصلي)', preview: 'linear-gradient(135deg, #1b2430, #2b3a4a)' },
  { id: 'golden', label: 'ساعة ذهبية', preview: 'linear-gradient(135deg, #5c3a12, #c98a2c)' },
  { id: 'cinema', label: 'سينما هوليوود', preview: 'linear-gradient(135deg, #0d3b46, #b86f34)' },
  { id: 'emerald', label: 'روحانية الزمرد', preview: 'linear-gradient(135deg, #062c22, #1b6b53)' },
  { id: 'sepia', label: 'تراث المخطوط', preview: 'linear-gradient(135deg, #3e2e1e, #9c815c)' },
  { id: 'midnight', label: 'ليل بارد', preview: 'linear-gradient(135deg, #09132b, #233c6e)' },
];

export const RECITERS: ReciterOption[] = [
  // Popular & Murattal (Unified Verse-by-Verse CDN on EveryAyah — 100% CORS & Ayah Sync)
  { slug: 'ar.alafasy', name: 'مشاري راشد العفاسي', style: 'murattal', styleLabel: 'مرتل', country: 'الكويت', bitrate: 128, source: 'everyayah', everyayahFolder: 'Alafasy_128kbps', popular: true },
  { slug: 'ea.nasseralqatami', name: 'ناصر القطامي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Nasser_Alqatami_128kbps', popular: true },
  { slug: 'ea.yasseraldossari', name: 'ياسر الدوسري', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Yasser_Ad-Dussary_128kbps', popular: true },
  { slug: 'ar.mahermuaiqly', name: 'ماهر المعيقلي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'MaherAlMuaiqly128kbps', popular: true },
  { slug: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 192, source: 'everyayah', everyayahFolder: 'Abdurrahmaan_As-Sudais_192kbps', popular: true },
  { slug: 'ar.saoodshuraym', name: 'سعود الشريم', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 64, source: 'everyayah', everyayahFolder: 'Saood_ash-Shuraym_64kbps', popular: true },
  { slug: 'ea.saadalghamdi', name: 'سعد الغامدي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 40, source: 'everyayah', everyayahFolder: 'Ghamadi_40kbps', popular: true },
  { slug: 'ea.faresabbad', name: 'فارس عباد', style: 'murattal', styleLabel: 'مرتل', country: 'اليمن', bitrate: 64, source: 'everyayah', everyayahFolder: 'Fares_Abbad_64kbps', popular: true },
  { slug: 'ar.husary', name: 'محمود خليل الحصري', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Husary_128kbps', popular: true },
  { slug: 'ar.minshawi', name: 'محمد صديق المنشاوي', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Minshawy_Murattal_128kbps', popular: true },
  { slug: 'ar.abdulbasitmurattal', name: 'عبد الباسط عبد الصمد', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 192, source: 'everyayah', everyayahFolder: 'Abdul_Basit_Murattal_192kbps', popular: true },
  { slug: 'ea.alijaber', name: 'علي جابر', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 64, source: 'everyayah', everyayahFolder: 'Ali_Jaber_64kbps', popular: true },
  { slug: 'ar.shaatree', name: 'أبو بكر الشاطري', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Abu_Bakr_Ash-Shaatree_128kbps' },
  { slug: 'ar.ahmedajamy', name: 'أحمد بن علي العجمي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'ahmed_ibn_ali_al_ajamy_128kbps' },
  { slug: 'ar.hudhaify', name: 'علي الحذيفي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Hudhaify_128kbps' },
  { slug: 'ar.muhammadayyoub', name: 'محمد أيوب', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Muhammad_Ayyoub_128kbps', popular: true },
  { slug: 'ar.muhammadjibreel', name: 'محمد جبريل', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Muhammad_Jibreel_128kbps' },
  { slug: 'ar.hanirifai', name: 'هاني الرفاعي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 192, source: 'everyayah', everyayahFolder: 'Hani_Rifai_192kbps' },
  { slug: 'ar.abdullahbasfar', name: 'عبد الله بصفر', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 192, source: 'everyayah', everyayahFolder: 'Abdullah_Basfar_192kbps' },
  { slug: 'ea.muhsinalqasim', name: 'عبد المحسن القاسم', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 192, source: 'everyayah', everyayahFolder: 'Muhsin_Al_Qasim_192kbps' },
  { slug: 'ea.salahalbudair', name: 'صلاح البدير', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Salah_Al_Budair_128kbps' },
  { slug: 'ea.salahbukhatir', name: 'صلاح بو خاطر', style: 'murattal', styleLabel: 'مرتل', country: 'الإمارات', bitrate: 128, source: 'everyayah', everyayahFolder: 'Salaah_AbdulRahman_Bukhatir_128kbps' },
  { slug: 'ea.abdullahmatroud', name: 'عبد الله مطرود', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Abdullah_Matroud_128kbps' },
  { slug: 'ea.khalifaaltunaiji', name: 'خليفة الطنيجي', style: 'murattal', styleLabel: 'مرتل', country: 'الإمارات', bitrate: 64, source: 'everyayah', everyayahFolder: 'khalefa_al_tunaiji_64kbps' },
  { slug: 'ar.aymanswoaid', name: 'أيمن رشدي سويد', style: 'murattal', styleLabel: 'مرتل', country: 'سوريا', bitrate: 64, source: 'everyayah', everyayahFolder: 'Ayman_Sowaid_64kbps' },
  { slug: 'ar.ibrahimakhbar', name: 'إبراهيم الأخضر', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 32, source: 'everyayah', everyayahFolder: 'Ibrahim_Akhdar_32kbps' },
  { slug: 'ea.albanna', name: 'محمود علي البنا', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 32, source: 'everyayah', everyayahFolder: 'Mahmoud_Ali_Al_Banna_32kbps' },
  { slug: 'ea.ahmedneana', name: 'أحمد نعينع', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Ahmed_Neana_128kbps' },
  { slug: 'ea.khalidalqahtani', name: 'خالد عبد الله القحطاني', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 192, source: 'everyayah', everyayahFolder: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps', popular: true },
  { slug: 'ea.nabilrifai', name: 'نبيل الرفاعي', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 48, source: 'everyayah', everyayahFolder: 'Nabil_Rifa3i_48kbps' },
  { slug: 'ea.sahlyassin', name: 'سهل ياسين', style: 'murattal', styleLabel: 'مرتل', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'Sahl_Yassin_128kbps' },
  { slug: 'ea.yasersalama', name: 'ياسر سلامة', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Yaser_Salamah_128kbps' },
  { slug: 'ea.akramalalaqimy', name: 'أكرم العلاقمي', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Akram_AlAlaqimy_128kbps' },
  { slug: 'ea.alihajjajalsuesy', name: 'علي حجاج السويسي', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Ali_Hajjaj_AlSuesy_128kbps' },
  { slug: 'ea.minshawi_radio', name: 'محمد صديق المنشاوي (إذاعة مصر)', style: 'murattal', styleLabel: 'مرتل', country: 'مصر', bitrate: 32, source: 'everyayah', everyayahFolder: 'Menshawi_32kbps' },
  { slug: 'ea.muhammadabdulkareem', name: 'محمد عبد الكريم', style: 'murattal', styleLabel: 'مرتل', country: 'السودان', bitrate: 128, source: 'everyayah', everyayahFolder: 'Muhammad_AbdulKareem_128kbps' },
  { slug: 'ea.azizalili', name: 'عزيز عليلي', style: 'murattal', styleLabel: 'مرتل', country: 'البوسنة', bitrate: 128, source: 'everyayah', everyayahFolder: 'aziz_alili_128kbps' },
  { slug: 'ea.karimmansoori', name: 'كريم منصوري', style: 'murattal', styleLabel: 'مرتل', country: 'إيران', bitrate: 40, source: 'everyayah', everyayahFolder: 'Karim_Mansoori_40kbps' },
  { slug: 'ea.parhizgar', name: 'شهريار برهيزكار', style: 'murattal', styleLabel: 'مرتل', country: 'إيران', bitrate: 48, source: 'everyayah', everyayahFolder: 'Parhizgar_48kbps' },

  // Mujawwad (Classic Master Reciters)
  { slug: 'ar.abdulsamad', name: 'عبد الباسط عبد الصمد', style: 'mujawwad', styleLabel: 'مجود', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Abdul_Basit_Mujawwad_128kbps', popular: true },
  { slug: 'ea.minshawimujawwad', name: 'محمد صديق المنشاوي', style: 'mujawwad', styleLabel: 'مجود', country: 'مصر', bitrate: 192, source: 'everyayah', everyayahFolder: 'Minshawy_Mujawwad_192kbps', popular: true },
  { slug: 'ar.husarymujawwad', name: 'محمود خليل الحصري', style: 'mujawwad', styleLabel: 'مجود', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Husary_128kbps_Mujawwad' },
  { slug: 'ea.tablawi', name: 'محمد محمود الطبلاوي', style: 'mujawwad', styleLabel: 'مجود', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Mohammad_al_Tablaway_128kbps' },
  { slug: 'ea.mustafaismail', name: 'مصطفى إسماعيل', style: 'mujawwad', styleLabel: 'مجود', country: 'مصر', bitrate: 48, source: 'everyayah', everyayahFolder: 'Mustafa_Ismail_48kbps' },

  // Warsh 'an Nafi' Reciters
  { slug: 'ea.warsh_ibrahim_dosary', name: 'إبراهيم الدوسري (رواية ورش عن نافع)', style: 'warsh', styleLabel: 'ورش', country: 'السعودية', bitrate: 128, source: 'everyayah', everyayahFolder: 'warsh/warsh_ibrahim_aldosary_128kbps', popular: true },
  { slug: 'ea.warsh_yassin_jazairi', name: 'ياسين الجزائري (رواية ورش عن نافع)', style: 'warsh', styleLabel: 'ورش', country: 'الجزائر', bitrate: 64, source: 'everyayah', everyayahFolder: 'warsh/warsh_yassin_al_jazaery_64kbps' },
  { slug: 'ea.warsh_abdulbasit', name: 'عبد الباسط عبد الصمد (رواية ورش عن نافع)', style: 'warsh', styleLabel: 'ورش', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'warsh/warsh_Abdul_Basit_128kbps' },

  // Muallim (Teacher Mushaf)
  { slug: 'ea.husary_muallim', name: 'محمود خليل الحصري (المصحف المعلم)', style: 'muallim', styleLabel: 'معلم', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Husary_Muallim_128kbps' },
  { slug: 'ea.minshawi_muallim', name: 'محمد صديق المنشاوي (المصحف المعلم)', style: 'muallim', styleLabel: 'معلم', country: 'مصر', bitrate: 128, source: 'everyayah', everyayahFolder: 'Minshawy_Teacher_128kbps' },
];

export const TRANSLATIONS: TranslationOption[] = [
  { id: 131, name: 'د. مصطفى خطاب — The Clear Quran', lang: 'en' },
  { id: 20, name: 'Saheeh International', lang: 'en' },
  { id: 149, name: 'Fadel Soliman — Bridges’ Translation', lang: 'en' },
  { id: 85, name: 'عبد الله يوسف علي', lang: 'en' },
  { id: 95, name: 'تفهيم القرآن — المودودي', lang: 'en' },
  { id: 167, name: 'معارف القرآن (تفسيري)', lang: 'en' },
];

export const DEFAULT_TRANSLATION_ID = 131;

export const VERSE_OF_DAY_CURATED: {
  surah: number;
  ayah: number;
  label: string;
  surahName: string;
  text: string;
}[] = [
  { surah: 2, ayah: 255, label: 'آية الكرسي — البقرة ٢٥٥', surahName: 'البقرة', text: 'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ' },
  { surah: 2, ayah: 286, label: 'البقرة ٢٨٦', surahName: 'البقرة', text: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ' },
  { surah: 3, ayah: 8, label: 'آل عمران ٨', surahName: 'آل عمران', text: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ ٱلْوَهَّابُ' },
  { surah: 13, ayah: 28, label: 'الرعد ٢٨', surahName: 'الرعد', text: 'ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ' },
  { surah: 94, ayah: 5, label: 'الشرح ٥', surahName: 'الشرح', text: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا' },
  { surah: 2, ayah: 153, label: 'البقرة ١٥٣', surahName: 'البقرة', text: 'يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّـٰبِرِينَ' },
  { surah: 65, ayah: 3, label: 'الطلاق ٣', surahName: 'الطلاق', text: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۚ إِنَّ ٱللَّهَ بَـٰلِغُ أَمْرِهِۦ' },
  { surah: 39, ayah: 53, label: 'الزمر ٥٣', surahName: 'الزمر', text: 'قُلْ يَـٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ' },
  { surah: 40, ayah: 60, label: 'غافر ٦٠', surahName: 'غافر', text: 'وَقَالَ رَبُّكُمُ ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ' },
  { surah: 55, ayah: 13, label: 'الرحمن ١٣', surahName: 'الرحمن', text: 'فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ' },
  { surah: 24, ayah: 35, label: 'النور ٣٥', surahName: 'النور', text: 'ٱللَّهُ نُورُ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضِ' },
  { surah: 3, ayah: 185, label: 'آل عمران ١٨٥', surahName: 'آل عمران', text: 'كُلُّ نَفْسٍ ذَآئِقَةُ ٱلْمَوْتِ ۗ وَإِنَّمَا تُوَفَّوْنَ أُجُورَكُمْ يَوْمَ ٱلْقِيَـٰمَةِ' },
  { surah: 10, ayah: 57, label: 'يونس ٥٧', surahName: 'يونس', text: 'يَـٰٓأَيُّهَا ٱلنَّاسُ قَدْ جَآءَتْكُم مَّوْعِظَةٌ مِّن رَّبِّكُمْ وَشِفَآءٌ لِّمَا فِى ٱلصُّدُورِ' },
  { surah: 17, ayah: 80, label: 'الإسراء ٨٠', surahName: 'الإسراء', text: 'وَقُل رَّبِّ أَدْخِلْنِى مُدْخَلَ صِدْقٍ وَأَخْرِجْنِى مُخْرَجَ صِدْقٍ' },
  { surah: 16, ayah: 97, label: 'النحل ٩٧', surahName: 'النحل', text: 'مَنْ عَمِلَ صَـٰلِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُۥ حَيَوٰةً طَيِّبَةً' },
  { surah: 41, ayah: 46, label: 'فصلت ٤٦', surahName: 'فصلت', text: 'مَّنْ عَمِلَ صَـٰلِحًا فَلِنَفْسِهِۦ ۖ وَمَنْ أَسَآءَ فَعَلَيْهَا ۗ وَمَا رَبُّكَ بِظَلَّـٰمٍ لِّلْعَبِيدِ' },
  { surah: 42, ayah: 13, label: 'الشورى ١٣', surahName: 'الشورى', text: 'شَرَعَ لَكُم مِّنَ ٱلدِّينِ مَا وَصَّىٰ بِهِۦ نُوحًا وَٱلَّذِىٓ أَوْحَيْنَآ إِلَيْكَ' },
  { surah: 7, ayah: 156, label: 'الأعراف ١٥٦', surahName: 'الأعراف', text: 'وَرَحْمَتِى وَسِعَتْ كُلَّ شَىْءٍ ۚ فَسَأَكْتُبُهَا لِلَّذِينَ يَتَّقُونَ' },
];

export const STUDIO_FONTS = [
  { value: 'Amiri Quran', label: 'أميري قرآن (رسم عثماني أصيل)' },
  { value: 'KFGQPC Uthmanic Hafs', label: 'مصحف المدينة (مجمع الملك فهد - حفص)' },
  { value: 'KFGQPC Uthman Taha Naskh', label: 'عثمان طه (مجمع الملك فهد - نسخ)' },
  { value: 'Scheherazade New', label: 'شهرزاد (مصحفي موسع)' },
  { value: 'Noto Naskh Arabic', label: 'نسخ عربي معاصر' },
  { value: 'Reem Kufi', label: 'ريم كوفي (تراثي)' },
  { value: 'Amiri', label: 'أميري كلاسيكي' },
  { value: 'Cairo', label: 'القاهرة الحديث' },
];

/** عينة معاينة الخطوط القرآنية — آية قصيرة تُرسم بخط كل خيار قبل الاختيار. */
export const STUDIO_FONT_PREVIEW_SAMPLE = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ';

/**
 * خطوط الترجمة: محدودة بالخطوط التي تدعم النص اللاتيني فعلياً في layout.tsx
 * (subsets تشمل latin) — لا ندرج خطوطاً قرآنية بلا حروف لاتينية.
 */
export const STUDIO_TRANSLATION_FONTS = [
  { value: 'Cairo', label: 'القاهرة (حديث ومقروء)' },
  { value: 'Noto Naskh Arabic', label: 'نسخ عربي معاصر' },
  { value: 'Amiri', label: 'أميري كلاسيكي' },
] as const;

export const STUDIO_TEXT_COLORS = [
  '#FAF7F0',
  '#EED178',
  '#FFFFFF',
  '#0B3D2E',
  '#C9A227',
  '#1F1B16',
  '#D9B87A',
  '#DCE8E2',
];

export const STUDIO_SOLIDS = [
  '#0B3D2E',
  '#0A1513',
  '#061F18',
  '#19191B',
  '#132135',
  '#2C1E14',
  '#FAF7F0',
  '#EFE8D8',
  '#1C2A1A',
  '#2A1524',
  '#7A5D12',
  '#23272B',
];

export const STUDIO_GRADIENTS: GradientPreset[] = [
  { id: 0, name: 'أخضر زمردي عميق', angle: 145, stops: [[0, '#051E17'], [55, '#0B3D2E'], [100, '#14533E']] },
  { id: 1, name: 'ليل ذهبي هادئ', angle: 160, stops: [[0, '#081715'], [55, '#102622'], [100, '#1F1810']] },
  { id: 2, name: 'سحر المجرة والنجوم', angle: 165, stops: [[0, '#040814'], [50, '#0C1838'], [100, '#1A244D']] },
  { id: 3, name: 'غابات الصنوبر الليلية', angle: 150, stops: [[0, '#071412'], [50, '#102E28'], [100, '#1D4940']] },
  { id: 4, name: 'فجر الجبال الدافئ', angle: 145, stops: [[0, '#1F1A24'], [50, '#5A363D'], [100, '#B9784E']] },
  { id: 5, name: 'مخطوط عاجي فاخر', angle: 135, stops: [[0, '#FAF6EC'], [55, '#F0E6D0'], [100, '#E2D2B2']] },
  { id: 6, name: 'ذهبي ملكي', angle: 135, stops: [[0, '#5E440C'], [48, '#B88A1E'], [100, '#E2C05C']] },
  { id: 7, name: 'نافذة المطر الهادئ', angle: 155, stops: [[0, '#0E1C21'], [55, '#1E3840'], [100, '#2F4D52']] },
  { id: 8, name: 'غروب السماء الذهبي', angle: 150, stops: [[0, '#1D1829'], [50, '#523A4C'], [100, '#C78A52']] },
  { id: 9, name: 'كهرمان دافئ', angle: 140, stops: [[0, '#2A1D09'], [60, '#5C4012'], [100, '#9E7422']] },
  { id: 10, name: 'بحر ساكن', angle: 150, stops: [[0, '#051E2B'], [55, '#0F4359'], [100, '#1E6E7D']] },
  { id: 11, name: 'فحمي مخملي', angle: 145, stops: [[0, '#0C0D0E'], [55, '#1B1D20'], [100, '#2A2B2E']] },
  { id: 12, name: 'شفق الصحراء', angle: 145, stops: [[0, '#26140D'], [55, '#6B3920'], [100, '#B5743E']] },
  { id: 13, name: 'أخضر زيتوني عتيق', angle: 140, stops: [[0, '#172112'], [55, '#2E4022'], [100, '#4E633A']] },
  { id: 14, name: 'ياقوت ليلي', angle: 150, stops: [[0, '#1C0D18'], [55, '#4A1D36'], [100, '#78344F']] },
  { id: 15, name: 'ورق البردي الهادئ', angle: 135, stops: [[0, '#EAE5D5'], [100, '#D4CEB8']] },
  { id: 16, name: 'كسوة الكعبة المشرّفة', angle: 155, stops: [[0, '#070708'], [55, '#121113'], [100, '#1D1810']] },
  { id: 17, name: 'تذهيب عثماني سلطاني', angle: 150, stops: [[0, '#1A0B10'], [55, '#3A121D'], [100, '#591D29']] },
  { id: 18, name: 'لازورد الحمراء الأندلسي', angle: 150, stops: [[0, '#081226'], [52, '#132A52'], [100, '#1F3F6B']] },
  { id: 19, name: 'فيروز قبة الصخرة', angle: 145, stops: [[0, '#062026'], [55, '#0D3F4A'], [100, '#185E67']] },
];

export const ASPECT_PRESETS: { id: AspectPresetId; label: string; ratio: string; width: number; height: number }[] = [
  { id: '9:16', label: 'Reels / Shorts', ratio: '9:16', width: 1080, height: 1920 },
  { id: '1:1', label: 'Instagram', ratio: '1:1', width: 1080, height: 1080 },
  { id: '16:9', label: 'YouTube', ratio: '16:9', width: 1920, height: 1080 },
];


export const CONFIG_DEFAULTS: SiteConfig = {
  siteName: 'مصحف الاستوديو',
  tagline: 'قارئ القرآن واستوديو تصميم التلاوات',
  heroTitle: 'اقرأ القرآن بالرسم العثماني وصمّم تلاواتٍ ملهمة للنشر',
  badge: 'آية اليوم',
  verseOfDay: null,
  primaryColor: '',
  accentColor: '',
  defaultTheme: 'light',
  defaultTranslation: DEFAULT_TRANSLATION_ID,
  defaultReciter: RECITERS[0].slug,
  defaultVsize: 1.75,
  defaultShowTrans: true,
  studio: {
    fontFamily: 'Amiri Quran',
    bgIdx: 2,
    fontSize: 82,
    color: '#FAF7F0',
    watermark: 'مصحف الاستوديو',
    footer: true,
  },
  footer: {
    enabled: true,
    description: 'منصة قرآنية مفتوحة للقراءة بالرسم العثماني وتصميم ونشر التلاوات القرآنية.',
    copyright: '© مصحف الاستوديو · جميع الحقوق محفوظة',
    showQuickLinks: true,
    showCredits: true,
    customLinks: [],
  },
  customReciters: [],
  disabledReciters: [],
  updatedAt: 0,
};

export const EMPTY_STATS: SiteStats = {
  visits: 0,
  reads: 0,
  plays: 0,
  exports: 0,
  searches: 0,
  firstVisit: 0,
  lastVisit: 0,
  daily: {},
  log: [],
};

// Deterministic fallback chapters & verses used ONLY if QUL API is unreachable
export const FALLBACK_CHAPTERS: QulChapter[] = [
  { id: 1, revelation_place: 'makkah', revelation_order: 5, bismillah_pre: false, name_simple: 'Al-Fatihah', name_arabic: 'الفاتحة', verses_count: 7, pages: [1, 1], translated_name: { name: 'The Opener' } },
  { id: 2, revelation_place: 'madinah', revelation_order: 87, bismillah_pre: true, name_simple: 'Al-Baqarah', name_arabic: 'البقرة', verses_count: 286, pages: [2, 49], translated_name: { name: 'The Cow' } },
  { id: 18, revelation_place: 'makkah', revelation_order: 69, bismillah_pre: true, name_simple: 'Al-Kahf', name_arabic: 'الكهف', verses_count: 110, pages: [293, 304], translated_name: { name: 'The Cave' } },
  { id: 36, revelation_place: 'makkah', revelation_order: 41, bismillah_pre: true, name_simple: 'Ya-Sin', name_arabic: 'يس', verses_count: 83, pages: [440, 445], translated_name: { name: 'Ya Sin' } },
  { id: 55, revelation_place: 'madinah', revelation_order: 97, bismillah_pre: true, name_simple: 'Ar-Rahman', name_arabic: 'الرحمن', verses_count: 78, pages: [531, 534], translated_name: { name: 'The Beneficent' } },
  { id: 112, revelation_place: 'makkah', revelation_order: 22, bismillah_pre: true, name_simple: 'Al-Ikhlas', name_arabic: 'الإخلاص', verses_count: 4, pages: [604, 604], translated_name: { name: 'The Sincerity' } },
];

export const FALLBACK_VERSES: Record<number, QulVerse[]> = {
  1: [
    { id: 1, verse_key: '1:1', page_number: 1, text_uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', translations: [{ id: 1, text: 'In the Name of Allah—the Most Compassionate, Most Merciful.', name: 'The Clear Quran' }] },
    { id: 2, verse_key: '1:2', page_number: 1, text_uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ', translations: [{ id: 2, text: 'All praise is for Allah—Lord of all worlds,', name: 'The Clear Quran' }] },
    { id: 3, verse_key: '1:3', page_number: 1, text_uthmani: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', translations: [{ id: 3, text: 'the Most Compassionate, Most Merciful,', name: 'The Clear Quran' }] },
    { id: 4, verse_key: '1:4', page_number: 1, text_uthmani: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ', translations: [{ id: 4, text: 'Master of the Day of Judgment.', name: 'The Clear Quran' }] },
    { id: 5, verse_key: '1:5', page_number: 1, text_uthmani: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', translations: [{ id: 5, text: 'You alone we worship and You alone we ask for help.', name: 'The Clear Quran' }] },
    { id: 6, verse_key: '1:6', page_number: 1, text_uthmani: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', translations: [{ id: 6, text: 'Guide us along the Straight Path,', name: 'The Clear Quran' }] },
    { id: 7, verse_key: '1:7', page_number: 1, text_uthmani: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ', translations: [{ id: 7, text: 'the Path of those You have blessed—not those You are displeased with, or those who are astray.', name: 'The Clear Quran' }] },
  ],
  2: [
    { id: 262, verse_key: '2:255', page_number: 42, text_uthmani: 'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ', translations: [{ id: 262, text: 'Allah! There is no god worthy of worship except Him, the Ever-Living, All-Sustaining.', name: 'The Clear Quran' }] },
  ],
  112: [
    { id: 6222, verse_key: '112:1', page_number: 604, text_uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', translations: [{ id: 6222, text: 'Say, O Prophet, “He is Allah—One and Indivisible;', name: 'The Clear Quran' }] },
    { id: 6223, verse_key: '112:2', page_number: 604, text_uthmani: 'ٱللَّهُ ٱلصَّمَدُ', translations: [{ id: 6223, text: 'Allah—the Sustainer needed by all.', name: 'The Clear Quran' }] },
    { id: 6224, verse_key: '112:3', page_number: 604, text_uthmani: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', translations: [{ id: 6224, text: 'He has never had offspring, nor was He born.', name: 'The Clear Quran' }] },
    { id: 6225, verse_key: '112:4', page_number: 604, text_uthmani: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', translations: [{ id: 6225, text: 'And there is none comparable to Him.”', name: 'The Clear Quran' }] },
  ],
};
