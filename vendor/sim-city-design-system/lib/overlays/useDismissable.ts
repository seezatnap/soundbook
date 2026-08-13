import { useEffect } from 'react';
import type { RefObject } from 'react';

export interface DismissableOptions {
  /** Fires on Escape or on pointerdown outside every ref in `inside`. */
  onDismiss: () => void;
  /** Elements that count as "inside" (the overlay itself, its anchor). */
  inside: Array<RefObject<HTMLElement | null>>;
  enabled?: boolean;
}

export function useDismissable({ onDismiss, inside, enabled = true }: DismissableOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      const hit = inside.some((ref) => ref.current?.contains(target));
      if (!hit) onDismiss();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
    // Refs are stable containers; only the flags and callback identity matter.
  }, [enabled, onDismiss, inside]);
}
