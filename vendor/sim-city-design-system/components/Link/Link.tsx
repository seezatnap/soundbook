import type { AnchorHTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Link.css';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Appends the "leaves the city network" marker. */
  external?: boolean;
  /** Renders inert dim text instead of an anchor. */
  disabled?: boolean;
}

export function Link({
  external = false,
  disabled = false,
  className,
  children,
  ...rest
}: LinkProps): JSX.Element {
  const marker = external && (
    <>
      <span className="sc-link__external" aria-hidden="true">
        ↗
      </span>
      {/* The arrow carries meaning, so it gets said as well as drawn. */}
      <span className="sr-only"> (external link)</span>
    </>
  );

  if (disabled) {
    /* A dead link is not a link: no href, no handlers, nothing to tab to. Only
       identity and layout props survive the conversion. */
    const { id, style, title } = rest;
    return (
      <span
        id={id}
        style={style}
        title={title}
        className={cx('sc-link', 'sc-link--disabled', className)}
        aria-disabled="true"
      >
        {children}
        {marker}
      </span>
    );
  }

  return (
    <a className={cx('sc-link', className)} {...rest}>
      {children}
      {marker}
    </a>
  );
}
