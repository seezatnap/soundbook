/*
 * The segment engine: a sunken well holding a row of role="spinbutton" spans,
 * one per unit of a date or time. One machine serves DateField and TimeField
 * because the keyboard contract is identical — arrows spin with wrap, digits
 * type ahead and auto-advance the moment they are unambiguous, Backspace
 * clears, Left/Right walk the row. Only the segment tables differ.
 */

import { useRef, useState } from 'react';
import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './DateField.css';

export interface SegmentSpec {
  key: string;
  /** "number" spins digits; "period" is the two-state AM/PM stamp (0/1). */
  kind: 'number' | 'period';
  /** Screen-reader name: "Month", "Hour". */
  label: string;
  /** Dim scaffold shown while the segment is empty. */
  placeholder: string;
  min: number;
  max: number;
  /** Committed pad width; an entry this long always advances. */
  digits: number;
  /** Where the first ArrowUp on an empty segment lands — today, not 1. */
  seed: number;
}

export interface SegmentLiteral {
  kind: 'literal';
  text: string;
}

export type SegmentItem = SegmentSpec | SegmentLiteral;

/** One nullable number per segment key; null is an unfilled blank on the form. */
export type SegmentParts = Record<string, number | null>;

export function isSegmentSpec(item: SegmentItem): item is SegmentSpec {
  return item.kind !== 'literal';
}

export interface SegmentedFieldProps {
  items: SegmentItem[];
  parts: SegmentParts;
  onPartsChange: (next: SegmentParts) => void;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** id for the group — a FieldShell's controlId. */
  id?: string;
  labelledBy?: string;
  'aria-label'?: string;
  describedBy?: string;
  /** Dim glyph or mark ahead of the segments, inside the well. */
  prefix?: ReactNode;
  /** Content after the segments, inside the well — a picker button. */
  suffix?: ReactNode;
  className?: string;
}

export function SegmentedField({
  items,
  parts,
  onPartsChange,
  disabled,
  invalid,
  required,
  id,
  labelledBy,
  'aria-label': ariaLabel,
  describedBy,
  prefix,
  suffix,
  className,
}: SegmentedFieldProps): JSX.Element {
  /** The digits typed into the focused segment so far; gone on any exit. */
  const [entry, setEntry] = useState<{ key: string; text: string } | null>(null);
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  const specs = items.filter(isSegmentSpec);

  const focusAt = (index: number): void => {
    const clamped = Math.max(0, Math.min(index, specs.length - 1));
    refs.current[clamped]?.focus();
  };

  const commit = (key: string, next: number | null): void => {
    onPartsChange({ ...parts, [key]: next });
  };

  const wrap = (n: number, min: number, max: number): number =>
    n > max ? min : n < min ? max : n;

  const step = (spec: SegmentSpec, direction: 1 | -1): void => {
    setEntry(null);
    const current = parts[spec.key];
    const next =
      current == null
        ? Math.max(spec.min, Math.min(spec.seed, spec.max))
        : wrap(current + direction, spec.min, spec.max);
    commit(spec.key, next);
  };

  const typeDigit = (spec: SegmentSpec, index: number, digit: string): void => {
    const previous = entry && entry.key === spec.key ? entry.text : '';
    let text = previous + digit;
    // A digit that would overshoot starts a fresh entry instead.
    if (parseInt(text, 10) > spec.max) text = digit;
    const num = parseInt(text, 10);
    // Unambiguous the moment no further digit could fit: advance.
    if (text.length >= spec.digits || num * 10 > spec.max) {
      commit(spec.key, Math.max(num, spec.min));
      setEntry(null);
      focusAt(index + 1);
    } else {
      commit(spec.key, num);
      setEntry({ key: spec.key, text });
    }
  };

  const handleKeyDown =
    (spec: SegmentSpec, index: number) =>
    (event: KeyboardEvent<HTMLSpanElement>): void => {
      if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key;
      let handled = true;
      if (key === 'ArrowUp') step(spec, 1);
      else if (key === 'ArrowDown') step(spec, -1);
      else if (key === 'ArrowLeft') {
        setEntry(null);
        focusAt(index - 1);
      } else if (key === 'ArrowRight') {
        setEntry(null);
        focusAt(index + 1);
      } else if (key === 'Home') {
        setEntry(null);
        focusAt(0);
      } else if (key === 'End') {
        setEntry(null);
        focusAt(specs.length - 1);
      } else if (key === 'Backspace' || key === 'Delete') {
        setEntry(null);
        commit(spec.key, null);
      } else if (spec.kind === 'number' && /^[0-9]$/.test(key)) {
        typeDigit(spec, index, key);
      } else if (spec.kind === 'number' && (key === '/' || key === ':' || key === '-' || key === '.')) {
        // Typing the separator is how a typist says "next box".
        setEntry(null);
        focusAt(index + 1);
      } else if (spec.kind === 'period' && (key === 'a' || key === 'A')) {
        commit(spec.key, 0);
      } else if (spec.kind === 'period' && (key === 'p' || key === 'P')) {
        commit(spec.key, 1);
      } else if (spec.kind === 'period' && key === ' ') {
        step(spec, 1);
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
        // Keys the segment consumes must not bubble on: the Storybook manager
        // (and any host app) binds bare letters and digits as global hotkeys,
        // and a span is not an <input>, so nothing shields us but this.
        event.stopPropagation();
      }
    };

  const handleBlur = (spec: SegmentSpec) => (): void => {
    setEntry(null);
    const current = parts[spec.key];
    // A half-typed "0" meant a leading zero was coming; file it as the minimum.
    if (current != null && current < spec.min) commit(spec.key, spec.min);
  };

  const displayOf = (
    spec: SegmentSpec,
  ): { text: string; empty: boolean; entering: boolean } => {
    if (entry && entry.key === spec.key) return { text: entry.text, empty: false, entering: true };
    const current = parts[spec.key];
    if (current == null) return { text: spec.placeholder, empty: true, entering: false };
    if (spec.kind === 'period') {
      return { text: current === 0 ? 'AM' : 'PM', empty: false, entering: false };
    }
    return { text: String(current).padStart(spec.digits, '0'), empty: false, entering: false };
  };

  const handleWellMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    if (disabled || event.target !== event.currentTarget) return;
    event.preventDefault();
    // A click on bare well hands the caret to the first unfilled segment.
    const firstEmpty = specs.findIndex((spec) => parts[spec.key] == null);
    focusAt(firstEmpty === -1 ? 0 : firstEmpty);
  };

  let position = -1;
  return (
    <div
      className={cx(
        'sc-segfield',
        disabled && 'sc-segfield--disabled',
        invalid && 'sc-segfield--invalid',
        className,
      )}
      role="group"
      id={id}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      onMouseDown={handleWellMouseDown}
    >
      {prefix != null && <span className="sc-segfield__prefix">{prefix}</span>}
      {items.map((item, i) => {
        if (!isSegmentSpec(item)) {
          return (
            <span key={`literal-${i}`} className="sc-segfield__literal" aria-hidden="true">
              {item.text}
            </span>
          );
        }
        position += 1;
        const index = position;
        const { text, empty, entering } = displayOf(item);
        const current = parts[item.key];
        return (
          <span
            key={item.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={cx('sc-segfield__segment', empty && 'sc-segfield__segment--empty')}
            role="spinbutton"
            tabIndex={disabled ? -1 : 0}
            aria-label={item.label}
            aria-valuemin={item.min}
            aria-valuemax={item.max}
            aria-valuenow={current ?? undefined}
            aria-valuetext={current == null && !entering ? 'Empty' : text}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            aria-disabled={disabled || undefined}
            onKeyDown={handleKeyDown(item, index)}
            onBlur={handleBlur(item)}
          >
            {text}
          </span>
        );
      })}
      {suffix != null && <span className="sc-segfield__suffix">{suffix}</span>}
    </div>
  );
}
