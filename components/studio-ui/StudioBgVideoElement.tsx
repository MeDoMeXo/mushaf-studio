'use client';

import type { RefObject } from 'react';

/**
 * عنصر <video> الخلفية المخفي — مقصوص من StudioView (حد 600 سطر/ملف).
 * يضبط سرعة التشغيل والبدء وفق حالة الاستوديو عند اكتمال التحميل.
 */
export function StudioBgVideoElement(props: {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | null;
  playing: boolean;
  speed: number;
  onReady: () => void;
}) {
  const { videoRef, src, playing, speed, onReady } = props;
  return (
    <video
      ref={videoRef}
      src={src ?? undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      onLoadedData={() => {
        const vid = videoRef.current;
        if (vid) {
          vid.playbackRate = speed || 1;
          if (playing) vid.play().catch(() => {});
        }
        onReady();
      }}
      className="hidden"
    />
  );
}
