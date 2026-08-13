import { Children, type HTMLAttributes, type JSX } from 'react';
import { cx } from '../../lib/cx';
import './Tag.css';

export interface TagGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Required: a row of chips means nothing without the name of the list. */
  'aria-label': string;
}

/**
 * A wrapping row of tags exposed as a list. The group is programmatically
 * focusable so that removing the last tag has somewhere to leave focus.
 */
export function TagGroup({ className, children, ...rest }: TagGroupProps): JSX.Element {
  return (
    <div
      className={cx('sc-tag-group', className)}
      role="list"
      data-sc-tag-group=""
      tabIndex={-1}
      {...rest}
    >
      {Children.map(children, (child) =>
        child == null ? null : (
          <span className="sc-tag-group__item" role="listitem">
            {child}
          </span>
        ),
      )}
    </div>
  );
}
