/*
 * A raised surface one rank below Panel: no sunken title band, just a dim
 * uppercase header over a 1px rule. Interactive cards behave like one big
 * button — hover shifts the face a step, pressing flips the bevel — because
 * the flip is the only affordance the system owns.
 */

import type { HTMLAttributes, JSX, KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** The whole card becomes a single button-like target. */
  interactive?: boolean;
}

export function Card({
  interactive = false,
  className,
  onKeyDown,
  children,
  ...rest
}: CardProps): JSX.Element {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    onKeyDown?.(event);
    if (!interactive || event.defaultPrevented) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  return (
    <div
      className={cx('sc-card', interactive && 'sc-card--interactive', className)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}

export type CardSectionProps = HTMLAttributes<HTMLDivElement>;

/** Dim uppercase title over a 1px rule — deliberately lighter than Panel's band. */
export function CardHeader({ className, children, ...rest }: CardSectionProps): JSX.Element {
  return (
    <div className={cx('sc-card__header', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: CardSectionProps): JSX.Element {
  return (
    <div className={cx('sc-card__body', className)} {...rest}>
      {children}
    </div>
  );
}

/** Right-aligned actions above nothing: the card just ends. */
export function CardFooter({ className, children, ...rest }: CardSectionProps): JSX.Element {
  return (
    <div className={cx('sc-card__footer', className)} {...rest}>
      {children}
    </div>
  );
}
