import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ReaderView } from '@/components/ReaderView';

export default async function SurahReaderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const surahId = Number(id);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1040px] px-4 py-12 text-center text-sm text-[var(--ink-muted)]">
          جارٍ تحميل السورة...
        </div>
      }
    >
      <ReaderView surahId={surahId} />
    </Suspense>
  );
}
