'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Header } from './Header';
import { Footer } from './Footer';

/**
 * Fixed-frame application viewport shell.
 *
 * Locks the outer viewport to `100dvh` (`overflow-hidden`) so the page behaves
 * like a fixed frame and ONLY the inner scrollable areas move:
 * - On `/studio` and `/audio-producer` (xl+): Header, Command Bar, workspace
 *   frame, and compact Footer remain completely stationary while only the
 *   inner side panels scroll.
 * - On all other routes: Header stays locked at the top of the frame while only
 *   the interior of `#main-content` scrolls smoothly.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = pathname === '/studio' || pathname === '/audio-producer';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--surface-canvas)]">
      <Header />
      <motion.div
        layoutScroll
        id="main-content"
        className={
          isWorkspace
            ? 'studio-scroll flex min-h-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden'
            : 'studio-scroll flex min-h-0 flex-1 flex-col overflow-y-auto'
        }
      >
        {children}
        {!isWorkspace && <Footer />}
      </motion.div>
      {isWorkspace && <Footer compact />}
    </div>
  );
}
