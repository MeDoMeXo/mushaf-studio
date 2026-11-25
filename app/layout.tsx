import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import {
  Amiri,
  Amiri_Quran,
  Cairo,
  Noto_Naskh_Arabic,
  Reem_Kufi,
  Scheherazade_New,
} from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';
import { AudioPlayerBar } from '@/components/AudioPlayerBar';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
});

const amiriQuran = Amiri_Quran({
  subsets: ['arabic', 'latin'],
  weight: '400',
  variable: '--font-amiri-quran',
  display: 'swap',
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-naskh',
  display: 'swap',
});

const reemKufi = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-reem-kufi',
  display: 'swap',
});

const scheherazade = Scheherazade_New({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-scheherazade',
  display: 'swap',
});

const uthmanicHafs = localFont({
  src: '../public/fonts/KFGQPC-Uthmanic-Hafs.woff2',
  variable: '--font-kfgqpc-hafs',
  display: 'swap',
});

const uthmanTaha = localFont({
  src: '../public/fonts/KFGQPC-Uthman-Taha-Naskh.woff2',
  variable: '--font-kfgqpc-uthman-taha',
  display: 'swap',
});

const FONT_VARIABLES = [
  cairo.variable,
  amiri.variable,
  amiriQuran.variable,
  notoNaskh.variable,
  reemKufi.variable,
  scheherazade.variable,
  uthmanicHafs.variable,
  uthmanTaha.variable,
].join(' ');

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F4EC' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1513' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  applicationName: 'مصحف الاستوديو',
  title: 'مصحف الاستوديو · قارئ القرآن واستوديو تصميم التلاوات',
  description:
    'منصة قرآنية متكاملة تعتمد على مكتبة QUL مفتوحة المصدر لقراءة القرآن الكريم بالرسم العثماني وتصميم صور وفيديوهات التلاوات بقوالب وزخارف إسلامية أصيلة.',
  keywords: [
    'القرآن الكريم',
    'الرسم العثماني',
    'استوديو تلاوات',
    'تصميم فيديوهات قرآنية',
    'زخارف إسلامية',
    'قوالب مصحفية',
    'مصحف الاستوديو',
  ],
  openGraph: {
    title: 'مصحف الاستوديو · قارئ القرآن واستوديو تصميم التلاوات',
    description:
      'منصة قرآنية متكاملة لقراءة القرآن الكريم بالرسم العثماني وتصميم صور وفيديوهات التلاوات بزخارف وقوالب إسلامية أصيلة.',
    type: 'website',
    locale: 'ar_SA',
    siteName: 'مصحف الاستوديو',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مصحف الاستوديو · قارئ القرآن واستوديو تصميم التلاوات',
    description:
      'قارئ القرآن الكريم بالرسم العثماني واستوديو تصميم صور وفيديوهات التلاوات بزخارف إسلامية أصيلة.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const JSON_LD_WEB_APP = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'مصحف الاستوديو',
  alternateName: 'Mushaf Studio',
  description:
    'منصة قرآنية متكاملة لقراءة القرآن الكريم بالرسم العثماني والاستماع لقراء عالميين وتصميم وتصدير فيديوهات التلاوات بقوالب وزخارف إسلامية أصيلة.',
  inLanguage: 'ar',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'All',
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'قارئ القرآن الكريم بالرسم العثماني الموثّق',
    'أكثر من ٣٨ قارئاً عالمياً بمختلف الروايات',
    'استوديو تصميم وتصدير فيديوهات وصور التلاوات بدقة عالية',
    'نظام قوالب وزخارف إسلامية هندسية ومصحفية أصيلة',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={FONT_VARIABLES}
    >
      <body
        suppressHydrationWarning
        className="h-dvh overflow-hidden bg-[var(--surface-canvas)] text-[var(--ink-primary)] transition-colors duration-200"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEB_APP) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:rounded-lg focus:bg-[var(--brand-emerald)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#FAF7F0] focus:shadow-lg"
        >
          تخطّ إلى المحتوى الرئيسي
        </a>
        <AppProvider>
          <AppShell>{children}</AppShell>
          <AudioPlayerBar />
        </AppProvider>
      </body>
    </html>
  );
}
