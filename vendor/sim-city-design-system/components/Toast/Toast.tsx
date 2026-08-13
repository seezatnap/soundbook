/*
 * Municipal notices: small striped-title Panels stacked at the bottom right.
 *
 * The stack is a polite live region that exists before the first notice so
 * screen readers know where announcements come from. Each toast holds the
 * floor for five seconds; hovering pauses its clock, since a hand on a
 * notice means it is being read. Four fit — an older one is evicted for a
 * fifth. Nothing slides: a toast appears, and when one below it goes, the
 * rest snap upward.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { JSX, ReactNode } from 'react';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { PixelIcon } from '../../icons/PixelIcon';
import type { PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { Portal } from '../../lib/overlays';
import './Toast.css';

export type ToastVariant = 'info' | 'ok' | 'warn' | 'danger';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
  /** ms on screen before auto-dismissal. Hovering pauses the clock. */
  duration?: number;
}

export interface ToastApi {
  /** Post a notice; returns an id usable with `dismiss`. */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a <ToastProvider>.');
  return api;
}

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 5000;

const VARIANT_GLYPH: Record<ToastVariant, PixelIconName> = {
  info: 'info',
  ok: 'check',
  warn: 'warning',
  danger: 'warning',
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number): void => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions): number => {
    const id = nextId.current++;
    // Newest always posts; the oldest yields when the board is full.
    setToasts((prev) => [...prev, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <div className="sc-toast__stack" role="region" aria-live="polite" aria-label="Notices">
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }): JSX.Element {
  const variant = item.variant ?? 'info';
  const remaining = useRef(item.duration ?? DEFAULT_DURATION);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const pause = useCallback((): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (startedAt.current !== null) {
      remaining.current -= Date.now() - startedAt.current;
      startedAt.current = null;
    }
  }, []);

  const resume = useCallback((): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => dismissRef.current(), Math.max(0, remaining.current));
  }, []);

  useEffect(() => {
    resume();
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [resume]);

  const hasBody = item.description !== undefined || item.action !== undefined;

  return (
    <div
      className={cx('sc-toast', `sc-toast--${variant}`)}
      onPointerEnter={pause}
      onPointerLeave={resume}
    >
      <Panel
        striped
        flush={!hasBody}
        onClose={onDismiss}
        title={
          <span className="sc-toast__title">
            <PixelIcon name={VARIANT_GLYPH[variant]} size={16} className="sc-toast__glyph" />
            {item.title}
          </span>
        }
      >
        {hasBody && (
          <>
            {item.description !== undefined && (
              <div className="sc-toast__desc">{item.description}</div>
            )}
            {item.action && (
              <div className="sc-toast__actions">
                <Button
                  size="sm"
                  onClick={() => {
                    item.action?.onClick();
                    onDismiss();
                  }}
                >
                  {item.action.label}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
