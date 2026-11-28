import React, { Suspense } from 'react';
import { AudioProducerView } from '@/components/audio-producer-ui/AudioProducerView';

export const metadata = {
  title: 'منتج الصوت — تحرير تلاوات القرآن',
  description:
    'محطة تحرير صوتي كاملة للتلاوات: تحميل التلاوة أو رفع ملف، قصّ وتقسيم واقتطاع، قصّ السكوت، المكسب والتطبيع والتلاشي، وتصدير WAV أو الإرسال المباشر إلى الاستوديو.',
};

export default function AudioProducerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1420px] px-4 py-12 text-center text-sm text-[var(--ink-muted)]">
          جارٍ تهيئة منتج الصوت...
        </div>
      }
    >
      <AudioProducerView />
    </Suspense>
  );
}
