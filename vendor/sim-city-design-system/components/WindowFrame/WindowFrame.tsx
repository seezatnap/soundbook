import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from 'react';
import { Panel } from '../Panel';
import { StatusBar } from '../StatusBar';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import './WindowFrame.css';

export interface WindowFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  /** Status strip along the bottom. Readouts belong here. */
  footer?: ReactNode;
  width?: CSSProperties['width'];
}

/**
 * The frame everything else gets hung in: pinstriped title, window controls,
 * a sunken well and an optional status strip.
 *
 * It is a window in appearance only — there is no drag, no stacking order and
 * no minimise behaviour beyond the callback. What it provides is the sense of
 * an application looking at something, which is what a demo of a form or a
 * table needs around it before it reads as software.
 */
export function WindowFrame({
  title,
  onClose,
  onMinimize,
  footer,
  width,
  className,
  style,
  children,
  ...rest
}: WindowFrameProps): JSX.Element {
  const controls = (onMinimize || onClose) && (
    <>
      {onMinimize && (
        <button
          type="button"
          className="sc-window__control"
          aria-label="Minimize"
          onClick={onMinimize}
        >
          <PixelIcon name="minus" size={16} />
        </button>
      )}
      {onClose && (
        <button type="button" className="sc-window__control" aria-label="Close" onClick={onClose}>
          <PixelIcon name="close" size={16} />
        </button>
      )}
    </>
  );

  return (
    <Panel
      className={cx('sc-window', className)}
      style={{ width, ...style }}
      title={title}
      striped
      flush
      titleActions={controls}
      {...rest}
    >
      <div className="sc-window__well">{children}</div>
      {footer !== undefined && <StatusBar className="sc-window__footer">{footer}</StatusBar>}
    </Panel>
  );
}
