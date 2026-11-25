'use client';

/**
 * useStudioShortcuts — global keyboard shortcuts + fullscreen canvas mirror.
 * Extracted from StudioView per the 600-line file rule.
 */
import { useEffect } from 'react';

export interface UseStudioShortcutsInput {
  commandOpen: boolean;
  exportModalOpen: boolean;
  fullscreenOpen: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fullscreenCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  setCommandOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleTogglePlay: () => void;
  onPrevSlide?: () => void;
  onNextSlide?: () => void;
}

/**
 * Ctrl/Cmd+K (Command Palette), Ctrl/Cmd+Z (Undo), Ctrl/Cmd+Y / Shift+Z
 * (Redo), Space (Play/Pause), and ArrowRight/Left (Slide Prev/Next in fullscreen).
 */
export function useStudioShortcuts({
  commandOpen,
  exportModalOpen,
  fullscreenOpen,
  canvasRef,
  fullscreenCanvasRef,
  setCommandOpen,
  handleUndo,
  handleRedo,
  handleTogglePlay,
  onPrevSlide,
  onNextSlide,
}: UseStudioShortcutsInput): void {
  // Global Studio Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }

      if (isInputFocused || commandOpen || exportModalOpen) return;

      if (e.code === 'Space' && !target?.closest('button, a, [role="slider"], [role="switch"]')) {
        e.preventDefault();
        handleTogglePlay();
        return;
      }

      if (fullscreenOpen) {
        if (e.key === 'ArrowRight' && onPrevSlide) {
          e.preventDefault();
          onPrevSlide();
          return;
        }
        if (e.key === 'ArrowLeft' && onNextSlide) {
          e.preventDefault();
          onNextSlide();
          return;
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    commandOpen,
    exportModalOpen,
    fullscreenOpen,
    handleUndo,
    handleRedo,
    handleTogglePlay,
    onPrevSlide,
    onNextSlide,
    setCommandOpen,
  ]);

  // Paint initial frame immediately upon opening fullscreen before the next RAF tick
  useEffect(() => {
    if (!fullscreenOpen) return;
    const rafId = requestAnimationFrame(() => {
      const src = canvasRef.current;
      const dst = fullscreenCanvasRef.current;
      if (src && dst && src.width > 0 && src.height > 0) {
        if (dst.width !== src.width || dst.height !== src.height) {
          dst.width = src.width;
          dst.height = src.height;
        }
        const ctx = dst.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, dst.width, dst.height);
          ctx.drawImage(src, 0, 0);
        }
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [fullscreenOpen, canvasRef, fullscreenCanvasRef]);
}
