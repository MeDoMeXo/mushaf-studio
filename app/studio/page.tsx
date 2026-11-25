import React, { Suspense } from 'react';
import { StudioView } from '@/components/StudioView';

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1420px] px-4 py-12 text-center text-sm text-[var(--ink-muted)]">
          جارٍ تهيئة الاستوديو...
        </div>
      }
    >
      <StudioView />
    </Suspense>
  );
}
