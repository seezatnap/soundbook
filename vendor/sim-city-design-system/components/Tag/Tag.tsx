import type { HTMLAttributes, JSX, KeyboardEvent, MouseEvent } from 'react';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import './Tag.css';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** Removing the tag. Supplying it makes the tag focusable and adds the ✕. */
  onRemove?: () => void;
  /** Overrides the remove control's accessible name. */
  removeLabel?: string;
}

/**
 * Works out where focus should land after this tag disappears, *before* it
 * does: the sibling nodes have to be read while they are all still mounted.
 * The returned function moves focus once React has committed the removal.
 */
function planFocusAdvance(from: HTMLElement): () => void {
  const scope = from.closest<HTMLElement>('[data-sc-tag-group]') ?? from.parentElement;
  const tags = scope ? Array.from(scope.querySelectorAll<HTMLElement>('[data-sc-tag]')) : [];
  const index = tags.indexOf(from);
  /* Next tag, else the previous one, else the group itself so focus is never
     dropped on the document body. */
  const target = tags[index + 1] ?? tags[index - 1] ?? scope;
  return () => {
    if (!target) return;
    requestAnimationFrame(() => target.focus());
  };
}

export function Tag({
  onRemove,
  removeLabel,
  className,
  children,
  onKeyDown,
  ...rest
}: TagProps): JSX.Element {
  const label =
    removeLabel ?? (typeof children === 'string' ? `Remove ${children}` : 'Remove');

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    onKeyDown?.(event);
    if (!onRemove || event.defaultPrevented) return;
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    /* Only when the chip itself holds focus — the ✕ button answers for itself. */
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const advance = planFocusAdvance(event.currentTarget);
    onRemove();
    advance();
  }

  function handleRemoveClick(event: MouseEvent<HTMLButtonElement>): void {
    /* `detail === 0` means Enter or Space, not a pointer. Keyboard removals owe
       the user somewhere to stand next; pointer removals leave focus alone. */
    const fromKeyboard = event.detail === 0;
    const root = event.currentTarget.closest<HTMLElement>('[data-sc-tag]');
    const advance = fromKeyboard && root ? planFocusAdvance(root) : null;
    onRemove?.();
    advance?.();
  }

  return (
    <span
      className={cx('sc-tag', onRemove && 'sc-tag--removable', className)}
      data-sc-tag=""
      tabIndex={onRemove ? 0 : undefined}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <span className="sc-tag__text">{children}</span>
      {onRemove && (
        <button
          type="button"
          className="sc-tag__remove"
          aria-label={label}
          onClick={handleRemoveClick}
        >
          <PixelIcon name="close" size={16} />
        </button>
      )}
    </span>
  );
}
