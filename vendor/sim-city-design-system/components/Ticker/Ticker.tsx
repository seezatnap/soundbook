import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { Panel } from '../Panel';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { Pulse } from './Pulse';
import './Ticker.css';

export type TickerStatus = 'queued' | 'active' | 'done' | 'failed';

export interface TickerItem {
  id: string;
  title: ReactNode;
  status: TickerStatus;
  /** Second line: crew, estimate, attempt count. */
  meta?: ReactNode;
}

export interface TickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Panel title. This is the department, not the job. */
  title?: ReactNode;
  items: TickerItem[];
  /** Rows drawn before the list collapses into a "+ N more" tail. */
  maxVisible?: number;
  /** Given, each row grows a dismiss control. */
  onDismiss?: (id: string) => void;
  /** Given, the panel grows a close control. */
  onClose?: () => void;
  /** Shown in place of the list when there is nothing to report. */
  emptyLabel?: ReactNode;
}

const STATUS_LABEL: Record<TickerStatus, string> = {
  queued: 'Queued',
  active: 'Active',
  done: 'Done',
  failed: 'Failed',
};

/**
 * The activity feed.
 *
 * A queue of work with no meaningful percentage attached to it, so running rows
 * get the marching pulse rather than a bar that would have to invent a number.
 * The list is a polite live region: rows appear and change status on their own,
 * and that is worth hearing about, but only once the reader is between
 * sentences.
 */
export function Ticker({
  title = 'City crews',
  items,
  maxVisible,
  onDismiss,
  onClose,
  emptyLabel = 'No crews dispatched',
  className,
  ...rest
}: TickerProps): JSX.Element {
  const visible = maxVisible === undefined ? items : items.slice(0, Math.max(0, maxVisible));
  const hidden = items.length - visible.length;

  return (
    <Panel className={cx('sc-ticker', className)} title={title} striped onClose={onClose} {...rest}>
      {items.length === 0 ? (
        <p className="sc-ticker__empty">{emptyLabel}</p>
      ) : (
        <>
          <ul
            className={cx('sc-ticker__list', onDismiss && 'sc-ticker__list--dismissable')}
            role="list"
            aria-live="polite"
          >
            {visible.map((item) => (
              <TickerRow key={item.id} item={item} onDismiss={onDismiss} />
            ))}
          </ul>
          {hidden > 0 && <p className="sc-ticker__more">+ {hidden} more</p>}
        </>
      )}
    </Panel>
  );
}

function TickerRow({
  item,
  onDismiss,
}: {
  item: TickerItem;
  onDismiss?: (id: string) => void;
}): JSX.Element {
  const running = item.status === 'queued' || item.status === 'active';
  return (
    <li
      className={cx('sc-ticker__item', item.status === 'failed' && 'sc-ticker__item--failed')}
    >
      <span className="sc-ticker__marker">
        {item.status === 'done' && <PixelIcon name="check" size={16} />}
        {item.status === 'failed' && <PixelIcon name="warning" size={16} />}
      </span>
      <span className="sc-ticker__title">{item.title}</span>
      <span className="sc-ticker__status">{STATUS_LABEL[item.status]}</span>
      {onDismiss && (
        <button
          type="button"
          className="sc-ticker__dismiss"
          aria-label={
            typeof item.title === 'string' ? `Dismiss ${item.title}` : 'Dismiss this entry'
          }
          onClick={() => onDismiss(item.id)}
        >
          ×
        </button>
      )}
      {running && (
        <Pulse
          className="sc-ticker__pulse"
          variant={item.status === 'queued' ? 'queued' : 'active'}
          aria-hidden
        />
      )}
      {item.meta !== undefined && <span className="sc-ticker__meta">{item.meta}</span>}
    </li>
  );
}
