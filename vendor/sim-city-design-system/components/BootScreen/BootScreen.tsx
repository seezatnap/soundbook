import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { Panel } from '../Panel';
import { Pulse } from '../Ticker';
import { cx } from '../../lib/cx';
import './BootScreen.css';

export interface BootScreenProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  /** What the machine is doing this second. */
  message: ReactNode;
  /** Dim line under the bar, for what the operator may do about it. */
  hint?: ReactNode;
  /** 0–1. Given, the bar counts instead of marching. */
  progress?: number;
}

/**
 * The boot composition: a panel, a line of progress copy and the activity bar.
 *
 * The message is a polite live region because it is the only thing on screen
 * that changes, and a boot sequence that says nothing to a screen reader is a
 * boot sequence that appears to have hung.
 */
export function BootScreen({
  title = 'Micropolis OS v2.0',
  message,
  hint,
  progress,
  className,
  ...rest
}: BootScreenProps): JSX.Element {
  return (
    <div className={cx('sc-boot', className)} {...rest}>
      <Panel className="sc-boot__panel" title={title} striped>
        <p className="sc-boot__message" aria-live="polite">
          {message}
        </p>
        <Pulse className="sc-boot__pulse" value={progress} aria-label="Startup progress" />
        {hint !== undefined && <p className="sc-boot__hint">{hint}</p>}
      </Panel>
    </div>
  );
}
