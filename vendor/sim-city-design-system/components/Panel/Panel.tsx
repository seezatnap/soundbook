import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './Panel.css';

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Rendered as the title band; omit for a bare framed surface. */
  title?: ReactNode;
  /** Pinstripes on the title band, for panels that float above the work. */
  striped?: boolean;
  /** Extra controls at the right end of the title band. */
  titleActions?: ReactNode;
  onClose?: () => void;
  /** Remove default body padding for flush contents (lists, tables, maps). */
  flush?: boolean;
}

export function Panel({
  title,
  striped = false,
  titleActions,
  onClose,
  flush = false,
  className,
  children,
  ...rest
}: PanelProps): JSX.Element {
  return (
    <div className={cx('sc-panel', className)} {...rest}>
      {title !== undefined && (
        <div className={cx('sc-panel__title', striped && 'sc-panel__title--striped')}>
          <span className="sc-panel__title-text">{title}</span>
          {(titleActions || onClose) && (
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', flex: 'none' }}>
              {titleActions}
              {onClose && (
                <button
                  type="button"
                  className="sc-panel__close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  ×
                </button>
              )}
            </span>
          )}
        </div>
      )}
      <div className={cx('sc-panel__body', flush && 'sc-panel__body--flush')}>{children}</div>
    </div>
  );
}
