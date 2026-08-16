/*
 * The window splitter: two panes and a 6px bar of chrome between them.
 *
 * The divider is real furniture — a raised bevel strip with a grip of three
 * dashes — and dragging it sinks it, the same flip every pressed control in
 * the system performs. Behaviour follows the APG window-splitter pattern:
 * the divider is a focusable `role="separator"` reporting its position as
 * aria-valuenow in pixels of the first pane; arrows nudge by 8px (32 with
 * Shift), Home/End slam to the ends, and Enter toggles a collapse when the
 * caller has named a `collapsedSize` to collapse to.
 *
 * One pane is sized; the other takes whatever is left, which is what lets
 * splits nest — a pane is just a box, and a box can hold another split. By
 * default the FIRST child is the sized pane; `primary="second"` sizes the
 * second child instead (a right/bottom panel that grows toward the start),
 * with drag, arrows and Home/End all following the divider's motion.
 */

import { Children, useEffect, useId, useRef, useState } from 'react';
import type {
  HTMLAttributes,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './SplitPane.css';

const DIVIDER = 6;
const STEP = 8;
const STEP_COARSE = 32;

export interface SplitPaneProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  /** "horizontal" sets the panes side by side; "vertical" stacks them. */
  orientation?: 'horizontal' | 'vertical';
  /** Which child the size applies to; the other takes the rest. */
  primary?: 'first' | 'second';
  /** Size of the primary pane, in px. */
  size?: number;
  defaultSize?: number;
  onSizeChange?: (size: number) => void;
  /** The primary pane never drags or keys below this. */
  minSize?: number;
  /** …nor above this. Unset, the limit is the container minus the divider. */
  maxSize?: number;
  /**
   * Given, Enter (or a double-click) on the divider snaps the primary pane
   * to this size and back — a docked drawer rather than a resized one. The
   * collapse deliberately ignores `minSize`; 0 is a legal parking spot.
   */
  collapsedSize?: number;
  /** Accessible name of the divider. */
  label?: string;
  /** Exactly two children, in layout order; `primary` names the sized one. */
  children: ReactNode;
}

export function SplitPane({
  orientation = 'horizontal',
  primary = 'first',
  size: sizeProp,
  defaultSize = 240,
  onSizeChange,
  minSize = 48,
  maxSize,
  collapsedSize,
  label = 'Resize panes',
  className,
  children,
  ...rest
}: SplitPaneProps): JSX.Element {
  const horizontal = orientation === 'horizontal';
  /* With the second child primary, the divider's motion and the sized
     pane's growth point in opposite directions along the axis. */
  const sizedSecond = primary === 'second';
  const [size, setSize] = useControllableState(sizeProp, defaultSize, onSizeChange);
  const [dragging, setDragging] = useState(false);
  /** Container extent along the split axis, for the reported aria-valuemax. */
  const [extent, setExtent] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; origin: number; start: number } | null>(null);
  /** Where Enter restores to after a collapse. */
  const restoreRef = useRef(defaultSize);
  const paneId = useId();

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = (): void =>
      setExtent(horizontal ? node.clientWidth : node.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [horizontal]);

  /** The largest size the first pane may take right now, measured live. */
  const upperBound = (): number => {
    const node = containerRef.current;
    const room =
      node === null
        ? Number.POSITIVE_INFINITY
        : (horizontal ? node.clientWidth : node.clientHeight) - DIVIDER;
    return Math.max(minSize, Math.min(maxSize ?? Number.POSITIVE_INFINITY, room));
  };

  const clamp = (next: number): number =>
    Math.round(Math.min(Math.max(next, minSize), upperBound()));

  const collapsed = collapsedSize !== undefined && size <= collapsedSize;

  const toggleCollapse = (): void => {
    if (collapsedSize === undefined) return;
    if (collapsed) {
      setSize(clamp(restoreRef.current));
    } else {
      restoreRef.current = size;
      setSize(collapsedSize);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      origin: horizontal ? event.clientX : event.clientY,
      start: size,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const position = horizontal ? event.clientX : event.clientY;
    const delta = position - drag.origin;
    setSize(clamp(drag.start + (sizedSecond ? -delta : delta)));
  };

  const endDrag = (): void => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? STEP_COARSE : STEP;
    /* Arrows and Home/End follow the divider: toward the end of the axis
       grows a first-primary pane and shrinks a second-primary one. */
    const towardEnd = horizontal ? 'ArrowRight' : 'ArrowDown';
    const towardStart = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const grow = sizedSecond ? towardStart : towardEnd;
    const shrink = sizedSecond ? towardEnd : towardStart;
    if (event.key === grow) setSize(clamp(size + step));
    else if (event.key === shrink) setSize(clamp(size - step));
    else if (event.key === 'Home')
      setSize(sizedSecond ? clamp(Number.MAX_SAFE_INTEGER) : clamp(minSize));
    else if (event.key === 'End')
      setSize(sizedSecond ? clamp(minSize) : clamp(Number.MAX_SAFE_INTEGER));
    else if (event.key === 'Enter') toggleCollapse();
    else return;
    event.preventDefault();
  };

  const room = extent === null ? null : Math.max(minSize, extent - DIVIDER);
  const ariaMax = Math.round(
    room === null
      ? (maxSize ?? Math.max(minSize, size))
      : Math.min(maxSize ?? Number.POSITIVE_INFINITY, room),
  );
  /* A collapsed pane legally parks below minSize; the reported range says so. */
  const ariaMin = Math.round(
    collapsedSize !== undefined ? Math.min(collapsedSize, minSize) : minSize,
  );

  const [first, second] = Children.toArray(children);
  const sizeStyle = horizontal ? { width: size } : { height: size };

  return (
    <div
      ref={containerRef}
      className={cx('sc-splitpane', `sc-splitpane--${orientation}`, className)}
      {...rest}
    >
      <div
        id={sizedSecond ? undefined : paneId}
        className={cx(
          'sc-splitpane__pane',
          sizedSecond ? 'sc-splitpane__pane--rest' : 'sc-splitpane__pane--first',
        )}
        style={sizedSecond ? undefined : sizeStyle}
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-label={label}
        aria-controls={paneId}
        aria-valuemin={ariaMin}
        aria-valuemax={ariaMax}
        aria-valuenow={Math.round(size)}
        tabIndex={0}
        className={cx('sc-splitpane__divider', dragging && 'sc-splitpane__divider--dragging')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onDoubleClick={toggleCollapse}
        onKeyDown={handleKeyDown}
      >
        <span className="sc-splitpane__grip" aria-hidden="true" />
      </div>
      <div
        id={sizedSecond ? paneId : undefined}
        className={cx(
          'sc-splitpane__pane',
          sizedSecond ? 'sc-splitpane__pane--first' : 'sc-splitpane__pane--rest',
        )}
        style={sizedSecond ? sizeStyle : undefined}
      >
        {second}
      </div>
    </div>
  );
}
