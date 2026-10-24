import { useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';

export function useKeyboardShortcuts() {
  const { togglePlay, next, previous, seek, currentTime, duration, toggleMute } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never interfere with typing inside inputs, textareas, contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration || Infinity, currentTime + 5));
          break;
        case 'KeyN':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            next();
          }
          break;
        case 'KeyP':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            previous();
          }
          break;
        case 'KeyM':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            toggleMute();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, next, previous, seek, currentTime, duration, toggleMute]);
}
