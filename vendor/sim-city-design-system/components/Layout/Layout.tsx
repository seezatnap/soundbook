/*
 * Layout primitives: Flex, Grid, View, Spacer. Thin wrappers that keep every
 * gap and pad on the whole-pixel scale so forms and toolbars line up without
 * anyone reaching for ad-hoc styles.
 *
 * Deviation, noted on purpose: these emit inline styles computed from props.
 * Layout is geometry, not decoration — a `gap` is data the caller owns, and
 * minting a class per number would be the same inline style with extra steps.
 * Anything that involves colour (View's faces and bevels) still goes through
 * classes and tokens like everything else.
 */

import type { CSSProperties, HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Layout.css';

/** Whole pixels only; fractional layout is how bevels stop meeting. */
function px(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}

export interface FlexProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  /** Gap in px. */
  gap?: number;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
  /** The container's own flex, for nesting. */
  flex?: CSSProperties['flex'];
}

export function Flex({
  direction = 'row',
  gap,
  align,
  justify,
  wrap = false,
  flex,
  className,
  style,
  children,
  ...rest
}: FlexProps): JSX.Element {
  return (
    <div
      className={cx('sc-flex', className)}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: px(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        flex,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** A column count (equal tracks) or a raw grid-template-columns string. */
  columns?: number | string;
  /** Gap in px; rowGap/columnGap override per axis. */
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  /** Named areas: one string per row, or a preformatted template string. */
  areas?: string | string[];
}

export function Grid({
  columns,
  gap,
  rowGap,
  columnGap,
  areas,
  className,
  style,
  children,
  ...rest
}: GridProps): JSX.Element {
  return (
    <div
      className={cx('sc-grid', className)}
      style={{
        display: 'grid',
        gridTemplateColumns:
          typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns,
        gap: px(gap),
        rowGap: px(rowGap),
        columnGap: px(columnGap),
        gridTemplateAreas: Array.isArray(areas)
          ? areas.map((row) => `"${row}"`).join(' ')
          : areas,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface ViewProps extends HTMLAttributes<HTMLDivElement> {
  /** Padding in px. */
  padding?: number;
  background?: 'face' | 'raised' | 'sunken' | 'deep';
  bevel?: 'none' | 'raised' | 'sunken';
}

export function View({
  padding,
  background,
  bevel = 'none',
  className,
  style,
  children,
  ...rest
}: ViewProps): JSX.Element {
  /* A bevel without a face is a wire frame; default the face the recipe pairs
     with, unless the caller chose their own. */
  const face =
    background ?? (bevel === 'raised' ? 'face' : bevel === 'sunken' ? 'sunken' : undefined);
  return (
    <div
      className={cx(
        'sc-view',
        face && `sc-view--bg-${face}`,
        bevel !== 'none' && `sc-view--bevel-${bevel}`,
        className,
      )}
      style={{ padding: px(padding), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export type SpacerProps = HTMLAttributes<HTMLDivElement>;

/** A flex-grow filler: the silence between a toolbar's two ends. */
export function Spacer({ className, style, ...rest }: SpacerProps): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cx('sc-spacer', className)}
      style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, ...style }}
      {...rest}
    />
  );
}
