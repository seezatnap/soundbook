/*
 * The clerk's marginal note: a small "?" plate beside a label that opens a
 * Popover Panel with the explanation the form itself has no room for. The
 * 'info' variant swaps the glyph for the times the note is a fact, not an
 * answer. Everything hard — anchoring, dismissal, focus — is the Popover's
 * job; this component only chooses the glyph and sets the type.
 */

import type { JSX, ReactNode } from 'react';
import { IconButton } from '../IconButton';
import { Popover } from '../Popover';
import type { Placement } from '../../lib/overlays';
import './ContextualHelp.css';

export interface ContextualHelpProps {
  /** Title band of the note. Uppercased by the Panel; write it plainly. */
  title: ReactNode;
  /** Body copy. */
  children: ReactNode;
  /** 'help' answers a question; 'info' states a fact. */
  variant?: 'help' | 'info';
  /** Optional footer, typically a Link to the full ordinance. */
  footer?: ReactNode;
  placement?: Placement;
  /** Accessible name of the trigger. Defaults to "Help" / "Information". */
  label?: string;
}

export function ContextualHelp({
  title,
  children,
  variant = 'help',
  footer,
  placement = 'bottom-start',
  label,
}: ContextualHelpProps): JSX.Element {
  const info = variant === 'info';
  return (
    <Popover
      title={title}
      placement={placement}
      trigger={
        <IconButton
          size="sm"
          icon={info ? 'info' : 'question'}
          label={label ?? (info ? 'Information' : 'Help')}
        />
      }
    >
      <div className="sc-contextual-help__body">{children}</div>
      {footer !== undefined && footer !== null && (
        <>
          <div className="rule" aria-hidden="true" />
          <div className="sc-contextual-help__footer">{footer}</div>
        </>
      )}
    </Popover>
  );
}
