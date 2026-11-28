import React, { Suspense } from 'react';
import { ProductionStudioView } from '@/components/production-ui/ProductionStudioView';

export const metadata = {
  title: 'استوديو تحرير القرآن الكريم — إنتاج صوتي ومرئي',
  description:
    'استوديو متكامل لإنتاج المصحف المرئي والصوتي: مكتبة القرآن والقراء، تحرير غير مدمّر للتلاوة مع صدى ومحيطات وموسيقى، مسارات زمنية متعددة، معاينة حية بالكاليوكي، وتصدير MP3 وWAV وMP4.',
};

export default function AudioProducerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1420px] px-4 py-12 text-center text-sm text-[var(--ink-muted)]">
          جارٍ تهيئة استوديو تحرير القرآن الكريم...
        </div>
      }
    >
      <ProductionStudioView />
    </Suspense>
  );
}
