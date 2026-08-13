/*
 * The single-disclosure primitive: one trigger, one region, no siblings to
 * coordinate. The chevron points right at the closed thing and down into the
 * open one — a glyph swap, never a rotation. Open state snaps.
 */

import {
  createContext,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type JSX,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { PixelIcon } from '../../icons/PixelIcon';
import './Collapsible.css';

interface CollapsibleContextValue {
  open: boolean;
  toggle: () => void;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(part: string): CollapsibleContextValue {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <Collapsible>`);
  return ctx;
}

export interface CollapsibleProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
  ...rest
}: CollapsibleProps): JSX.Element {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const baseId = useId();
  return (
    <CollapsibleContext.Provider
      value={{
        open: isOpen,
        toggle: () => setOpen(!isOpen),
        disabled,
        triggerId: `${baseId}-trigger`,
        contentId: `${baseId}-content`,
      }}
    >
      <div
        className={cx('sc-collapsible', isOpen && 'sc-collapsible--open', className)}
        {...rest}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export type CollapsibleTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function CollapsibleTrigger({
  className,
  children,
  onClick,
  disabled,
  ...rest
}: CollapsibleTriggerProps): JSX.Element {
  const ctx = useCollapsibleContext('CollapsibleTrigger');
  return (
    <button
      type="button"
      id={ctx.triggerId}
      className={cx('sc-collapsible__trigger', className)}
      aria-expanded={ctx.open}
      aria-controls={ctx.contentId}
      disabled={disabled ?? ctx.disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.toggle();
      }}
      {...rest}
    >
      <PixelIcon name={ctx.open ? 'chevron-down' : 'chevron-right'} size={16} />
      <span className="sc-collapsible__label">{children}</span>
    </button>
  );
}

export type CollapsibleContentProps = HTMLAttributes<HTMLDivElement>;

export function CollapsibleContent({
  className,
  children,
  ...rest
}: CollapsibleContentProps): JSX.Element {
  const ctx = useCollapsibleContext('CollapsibleContent');
  return (
    <div
      id={ctx.contentId}
      aria-labelledby={ctx.triggerId}
      hidden={!ctx.open}
      className={cx('sc-collapsible__content', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
