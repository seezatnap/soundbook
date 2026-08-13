/*
 * The wizard rail: numbered plates joined by hard 2px lines. A finished step
 * is stamped in accent with a check; the step you are on stands raised with
 * accent ink; the rest wait, sunken and dim. With onStepSelect, finished
 * plates become buttons — you may reopen the past, never the future.
 */

import { useId, type HTMLAttributes, type JSX } from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon } from '../../icons/PixelIcon';
import './Stepper.css';

export interface StepperStep {
  label: string;
  /** Shown under the label in vertical orientation only. */
  description?: string;
}

export interface StepperProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  steps: StepperStep[];
  /** 0-based index of the step in progress. */
  activeStep: number;
  orientation?: 'horizontal' | 'vertical';
  /** When provided, DONE steps become buttons that jump back. */
  onStepSelect?: (index: number) => void;
}

export function Stepper({
  steps,
  activeStep,
  orientation = 'horizontal',
  onStepSelect,
  className,
  'aria-label': ariaLabel = 'Progress',
  ...rest
}: StepperProps): JSX.Element {
  const baseId = useId();
  return (
    <nav
      aria-label={ariaLabel}
      className={cx('sc-stepper', `sc-stepper--${orientation}`, className)}
      {...rest}
    >
      <ol className="sc-stepper__list">
        {steps.map((step, index) => {
          const state = index < activeStep ? 'done' : index === activeStep ? 'current' : 'todo';
          const labelId = `${baseId}-label-${index}`;
          const clickable = state === 'done' && onStepSelect !== undefined;
          const plateContent =
            state === 'done' ? (
              <PixelIcon name="check" size={16} />
            ) : (
              <span className="sc-stepper__number">{index + 1}</span>
            );
          return (
            <li
              key={index}
              className={cx('sc-stepper__step', `sc-stepper__step--${state}`)}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {clickable ? (
                <button
                  type="button"
                  className="sc-stepper__plate"
                  aria-labelledby={labelId}
                  onClick={() => onStepSelect(index)}
                >
                  {plateContent}
                </button>
              ) : (
                <span className="sc-stepper__plate">{plateContent}</span>
              )}
              <span className="sc-stepper__text">
                <span id={labelId} className="sc-stepper__label">
                  {step.label}
                </span>
                {orientation === 'vertical' && step.description !== undefined && (
                  <span className="sc-stepper__description">{step.description}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
