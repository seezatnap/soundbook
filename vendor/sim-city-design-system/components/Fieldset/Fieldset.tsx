import type { ComponentPropsWithRef, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './Fieldset.css';

export interface FieldsetProps extends ComponentPropsWithRef<'fieldset'> {
  /** The band cut into the top edge of the groove. */
  legend?: ReactNode;
}

export function Fieldset({
  legend,
  disabled,
  className,
  children,
  ...rest
}: FieldsetProps): JSX.Element {
  return (
    <fieldset className={cx('sc-fieldset', className)} disabled={disabled} {...rest}>
      {legend !== undefined && legend !== null && legend !== '' && (
        <legend className="sc-fieldset__legend">{legend}</legend>
      )}
      <div className="sc-fieldset__body">{children}</div>
    </fieldset>
  );
}
