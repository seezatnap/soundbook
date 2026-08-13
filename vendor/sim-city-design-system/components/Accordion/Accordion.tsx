/*
 * A stack of disclosure rows. A closed section is a raised bar you can press;
 * an open one is pressed — the trigger sinks and merges with the well of
 * content beneath it into a single sunken tray. The chevron swaps glyphs
 * (down/up); nothing rotates, nothing eases, sections snap.
 */

import {
  createContext,
  useContext,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { PixelIcon } from '../../icons/PixelIcon';
import './Accordion.css';

interface AccordionContextValue {
  openValues: string[];
  toggle: (itemValue: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

interface AccordionItemContextValue {
  value: string;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionContext(part: string): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <Accordion>`);
  return ctx;
}

function useAccordionItemContext(part: string): AccordionItemContextValue {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <AccordionItem>`);
  return ctx;
}

type AccordionBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'>;

export interface AccordionSingleProps extends AccordionBaseProps {
  type?: 'single';
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Allow pressing the open section shut, leaving nothing open. */
  collapsible?: boolean;
}

export interface AccordionMultipleProps extends AccordionBaseProps {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  collapsible?: never;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

export function Accordion(props: AccordionProps): JSX.Element {
  const { type = 'single' } = props;
  return type === 'multiple' ? (
    <AccordionMultiple {...(props as AccordionMultipleProps)} />
  ) : (
    <AccordionSingle {...(props as AccordionSingleProps)} />
  );
}

/* Arrow keys walk the triggers, per the APG accordion pattern. */
function useTriggerWalk(rootRef: RefObject<HTMLDivElement | null>) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !rootRef.current) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (!event.target.classList.contains('sc-accordion__trigger')) return;
    const triggers = Array.from(
      rootRef.current.querySelectorAll<HTMLButtonElement>('.sc-accordion__trigger:not(:disabled)'),
    );
    if (triggers.length === 0) return;
    const from = triggers.indexOf(event.target as HTMLButtonElement);
    let to = -1;
    switch (event.key) {
      case 'ArrowDown':
        to = from < 0 ? 0 : (from + 1) % triggers.length;
        break;
      case 'ArrowUp':
        to = from < 0 ? triggers.length - 1 : (from - 1 + triggers.length) % triggers.length;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = triggers.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    triggers[to].focus();
  };
}

function AccordionSingle({
  type: _type,
  value,
  defaultValue = null,
  onValueChange,
  collapsible = false,
  className,
  children,
  onKeyDown,
  ...rest
}: AccordionSingleProps): JSX.Element {
  const [open, setOpen] = useControllableState(value, defaultValue, onValueChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const walk = useTriggerWalk(rootRef);
  const ctx: AccordionContextValue = {
    openValues: open === null ? [] : [open],
    toggle: (itemValue) => {
      if (open === itemValue) {
        if (collapsible) setOpen(null);
      } else {
        setOpen(itemValue);
      }
    },
  };
  return (
    <AccordionContext.Provider value={ctx}>
      <div
        ref={rootRef}
        className={cx('sc-accordion', className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          walk(event);
        }}
        {...rest}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function AccordionMultiple({
  type: _type,
  value,
  defaultValue = [],
  onValueChange,
  className,
  children,
  onKeyDown,
  ...rest
}: AccordionMultipleProps): JSX.Element {
  const [open, setOpen] = useControllableState(value, defaultValue, onValueChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const walk = useTriggerWalk(rootRef);
  const ctx: AccordionContextValue = {
    openValues: open,
    toggle: (itemValue) => {
      setOpen(
        open.includes(itemValue) ? open.filter((v) => v !== itemValue) : [...open, itemValue],
      );
    },
  };
  return (
    <AccordionContext.Provider value={ctx}>
      <div
        ref={rootRef}
        className={cx('sc-accordion', className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          walk(event);
        }}
        {...rest}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Identifies the item in the accordion's value. */
  value: string;
  disabled?: boolean;
}

export function AccordionItem({
  value,
  disabled = false,
  className,
  children,
  ...rest
}: AccordionItemProps): JSX.Element {
  const { openValues } = useAccordionContext('AccordionItem');
  const baseId = useId();
  const open = openValues.includes(value);
  return (
    <AccordionItemContext.Provider
      value={{ value, disabled, triggerId: `${baseId}-trigger`, contentId: `${baseId}-content` }}
    >
      <div
        className={cx('sc-accordion__item', open && 'sc-accordion__item--open', className)}
        {...rest}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export type AccordionTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function AccordionTrigger({
  className,
  children,
  onClick,
  disabled,
  ...rest
}: AccordionTriggerProps): JSX.Element {
  const { openValues, toggle } = useAccordionContext('AccordionTrigger');
  const item = useAccordionItemContext('AccordionTrigger');
  const open = openValues.includes(item.value);
  return (
    <h3 className="sc-accordion__heading">
      <button
        type="button"
        id={item.triggerId}
        className={cx('sc-accordion__trigger', className)}
        aria-expanded={open}
        aria-controls={item.contentId}
        disabled={disabled ?? item.disabled}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle(item.value);
        }}
        {...rest}
      >
        <PixelIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        <span className="sc-accordion__label">{children}</span>
      </button>
    </h3>
  );
}

export type AccordionContentProps = HTMLAttributes<HTMLDivElement>;

export function AccordionContent({
  className,
  children,
  ...rest
}: AccordionContentProps): JSX.Element {
  const { openValues } = useAccordionContext('AccordionContent');
  const item = useAccordionItemContext('AccordionContent');
  const open = openValues.includes(item.value);
  return (
    <div
      role="region"
      id={item.contentId}
      aria-labelledby={item.triggerId}
      hidden={!open}
      className={cx('sc-accordion__content', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
