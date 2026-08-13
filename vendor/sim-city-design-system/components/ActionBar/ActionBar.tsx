/*
 * The floating selection bar: a raised strip pinned above the bottom edge
 * that exists only while something is selected. It appears and vanishes
 * instantly — selection is a fact, not a transition — and announces its
 * count politely so a screen reader hears the tally change.
 */

import type { JSX } from 'react';
import { Button } from '../Button';
import { Portal } from '../../lib/overlays';
import type { PixelIconName } from '../../icons/PixelIcon';
import './ActionBar.css';

export interface ActionBarAction {
  label: string;
  icon?: PixelIconName;
  onAction: () => void;
}

export interface ActionBarProps {
  selectionCount: number;
  actions: ActionBarAction[];
  onClear: () => void;
  /** What is being counted. */
  noun?: string;
}

export function ActionBar({
  selectionCount,
  actions,
  onClear,
  noun = 'parcels',
}: ActionBarProps): JSX.Element | null {
  if (selectionCount <= 0) return null;
  return (
    <Portal>
      <div className="sc-actionbar" aria-label="Selection actions">
        <span className="sc-actionbar__count" aria-live="polite">
          {selectionCount} {noun} selected
        </span>
        <span className="sc-actionbar__rule" aria-hidden="true" />
        {actions.map((action) => (
          <Button key={action.label} size="sm" icon={action.icon} onClick={action.onAction}>
            {action.label}
          </Button>
        ))}
        <Button size="sm" icon="close" aria-label="Clear selection" onClick={onClear} />
      </div>
    </Portal>
  );
}
