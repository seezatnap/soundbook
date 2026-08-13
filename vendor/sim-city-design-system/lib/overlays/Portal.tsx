import type { JSX, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Overlays render at the end of <body> so no ancestor clips or restacks them. */
export function Portal({ children }: { children: ReactNode }): JSX.Element {
  return createPortal(children, document.body);
}
