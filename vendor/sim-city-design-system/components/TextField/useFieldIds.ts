/*
 * The id and state wiring every field shares. Kept apart from the markup so a
 * control that draws its own middle — an OTP row, a future colour well — can
 * take the wiring without taking the shell.
 */

import { useId, type ReactNode } from 'react';

/** The props every field in the system accepts, whatever it collects. */
export interface FieldBaseProps {
  label?: ReactNode;
  description?: ReactNode;
  /** Present error text; also marks the control invalid. */
  errorMessage?: ReactNode;
  /** Mark invalid without printing a line of text. */
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
}

export interface FieldIds {
  controlId: string;
  labelId: string;
  descriptionId?: string;
  errorId?: string;
  /** Ready-made `aria-describedby`: description then error, in reading order. */
  describedBy?: string;
  /** True when an error line is shown or `invalid` was set by hand. */
  invalid: boolean;
}

export interface UseFieldIdsOptions {
  id?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
}

/** Whether a slot holds something worth drawing a line for. */
export function isPresent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

/** Mints the ids a field needs and derives its described-by / invalid state. */
export function useFieldIds({
  id,
  description,
  errorMessage,
  invalid,
}: UseFieldIdsOptions): FieldIds {
  const uid = useId();
  const controlId = id ?? `sc-field-${uid}`;
  const descriptionId = isPresent(description) ? `${controlId}-desc` : undefined;
  const errorId = isPresent(errorMessage) ? `${controlId}-err` : undefined;
  return {
    controlId,
    labelId: `${controlId}-label`,
    descriptionId,
    errorId,
    describedBy: [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
    invalid: Boolean(invalid) || errorId !== undefined,
  };
}
