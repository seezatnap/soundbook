import { Fragment, useLayoutEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, JSX, KeyboardEvent, FocusEvent } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import './Toolbox.css';

export interface ToolDef {
  id: string;
  icon: PixelIconName;
  /** The rail is glyphs only, so this is the tool's accessible name. */
  label: string;
  /** Longer tooltip text, usually the label plus its shortcut. */
  hint?: string;
  disabled?: boolean;
  /**
   * Independent toggle, for view switches that are not part of the rail's one
   * armed tool. Overrides the `activeId` comparison.
   */
  active?: boolean;
  /** Fires and forgets — zoom, recentre — so it reports no pressed state. */
  action?: boolean;
}

/**
 * What a tool reports to assistive technology. An action has no state at all,
 * an independent toggle carries its own, and everything else is the rail's one
 * armed tool — which is nothing until a caller says otherwise.
 */
function pressedState(tool: ToolDef, activeId: string | undefined): boolean | undefined {
  if (tool.action) return undefined;
  if (tool.active !== undefined) return tool.active;
  if (activeId === undefined) return undefined;
  return tool.id === activeId;
}

export interface ToolboxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Tools in display order, grouped; groups are separated by a groove. */
  groups?: ToolDef[][];
  /** The one armed tool. Tools marked `action` ignore it. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Accessible name for the toolbar. */
  label?: string;
}

/**
 * The tool rail: a vertical `toolbar` with a roving tabindex.
 *
 * The rail reaches Tab once and then arrow keys walk it, per the APG toolbar
 * pattern. Because the same rail can be built from the `groups` data or from
 * hand-composed children, the roving tabindex is resolved from the DOM — every
 * `Tool` marks itself, and the toolbar decides which of them is reachable.
 */
export function Toolbox({
  groups,
  activeId,
  onSelect,
  label = 'Tools',
  className,
  children,
  onKeyDown,
  onFocus,
  ...rest
}: ToolboxProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  const items = (): HTMLButtonElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[data-sc-tool]')).filter(
      (el) => !el.disabled,
    );
  };

  const setTabbable = (next: HTMLButtonElement, list: HTMLButtonElement[]): void => {
    currentRef.current = next;
    for (const el of list) el.tabIndex = el === next ? 0 : -1;
  };

  // Runs after every render because the set of tools can change without any
  // prop this component can watch (children are opaque). Assigning tabindex is
  // cheap and idempotent, and a layout effect lands it before the frame.
  useLayoutEffect(() => {
    const list = items();
    if (list.length === 0) return;
    let current = currentRef.current;
    if (!current || !list.includes(current)) {
      current =
        (activeId ? list.find((el) => el.dataset.toolId === activeId) : undefined) ??
        list.find((el) => el.getAttribute('aria-pressed') === 'true') ??
        list[0];
    }
    setTabbable(current, list);
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const { key } = event;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    const list = items();
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement;
    if (key === 'Home') next = list[0];
    else if (key === 'End') next = list[list.length - 1];
    else if (index < 0) next = list[0];
    else next = list[(index + (key === 'ArrowDown' ? 1 : list.length - 1)) % list.length];
    event.preventDefault();
    setTabbable(next, list);
    next.focus();
  };

  // A tool reached by pointer becomes the rail's Tab stop, so leaving and
  // returning puts you back where you were.
  const handleFocus = (event: FocusEvent<HTMLDivElement>): void => {
    onFocus?.(event);
    const target = event.target as HTMLElement;
    if (!target.hasAttribute?.('data-sc-tool')) return;
    const list = items();
    const tool = target as HTMLButtonElement;
    if (list.includes(tool)) setTabbable(tool, list);
  };

  return (
    <div
      ref={rootRef}
      className={cx('sc-toolbox', className)}
      role="toolbar"
      aria-orientation="vertical"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      {...rest}
    >
      {groups?.map((tools, index) => (
        <Fragment key={tools[0]?.id ?? index}>
          {index > 0 && <ToolboxRule />}
          <ToolboxGroup>
            {tools.map((tool) => (
              <Tool
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                hint={tool.hint}
                disabled={tool.disabled}
                active={pressedState(tool, activeId)}
                data-tool-id={tool.id}
                onClick={() => onSelect?.(tool.id)}
              />
            ))}
          </ToolboxGroup>
        </Fragment>
      ))}
      {children}
    </div>
  );
}

export type ToolboxGroupProps = HTMLAttributes<HTMLDivElement>;

/** A run of tools that belong together; grooves go between groups, not inside. */
export function ToolboxGroup({ className, children, ...rest }: ToolboxGroupProps): JSX.Element {
  return (
    <div className={cx('sc-toolbox__group', className)} {...rest}>
      {children}
    </div>
  );
}

/** The groove between groups. Explicit, because a hand-composed rail decides
 *  for itself where one group of tools stops being the same idea. */
export function ToolboxRule(): JSX.Element {
  return <div className="sc-toolbox__rule" aria-hidden="true" />;
}

export interface ToolProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: PixelIconName;
  /** Required: becomes the accessible name and the native tooltip. */
  label: string;
  /** Replaces the label in the tooltip when there is more to say (shortcuts). */
  hint?: string;
  /** Toggle state. Omit entirely for actions, which are never "pressed". */
  active?: boolean;
}

/** One 42px square of the rail. */
export function Tool({
  icon,
  label,
  hint,
  active,
  className,
  type = 'button',
  ...rest
}: ToolProps): JSX.Element {
  return (
    <button
      type={type}
      data-sc-tool=""
      className={cx('sc-tool', className)}
      aria-label={label}
      aria-pressed={active}
      title={hint ?? label}
      {...rest}
    >
      <PixelIcon name={icon} size={16} className="sc-tool__glyph" />
    </button>
  );
}
