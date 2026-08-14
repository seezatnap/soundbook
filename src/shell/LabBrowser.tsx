/*
 * The catalogue sidebar: labs grouped by family in a TreeView, plus the
 * locally-published snapshot shelf. Publishing is local-only in the MVP —
 * a snapshot is just a named, immutable URL.
 */

import { useMemo, type JSX } from 'react';
import { TreeView, type TreeNode } from '@simcity/components/TreeView';
import { IconButton } from '@simcity/components/IconButton';
import { Panel } from '@simcity/components/Panel';
import type { LabFamily } from '@/sdk/lab';
import { FAMILY_LABELS, LABS } from '@/labs/registry';

export interface PublishedSnapshot {
  name: string;
  payload: string;
  at: string;
}

interface LabBrowserProps {
  selectedId: string;
  onSelect(id: string): void;
  published: PublishedSnapshot[];
  onOpenSnapshot(snapshot: PublishedSnapshot): void;
  onDeleteSnapshot(snapshot: PublishedSnapshot): void;
}

/* DroneLab leads; compositions sit at the bottom of the catalogue. */
const FAMILY_ORDER: LabFamily[] = [
  'dronelab',
  'instrumentation',
  'pattern',
  'space',
  'quixotic',
  'composition',
];

export function LabBrowser({
  selectedId,
  onSelect,
  published,
  onOpenSnapshot,
  onDeleteSnapshot,
}: LabBrowserProps): JSX.Element {
  const nodes = useMemo<TreeNode[]>(
    () =>
      FAMILY_ORDER.map(
        (family): TreeNode => ({
          id: `family:${family}`,
          label: FAMILY_LABELS[family],
          icon: 'folder',
          children: LABS.filter((lab) => lab.family === family).map(
            (lab): TreeNode => ({ id: lab.id, label: lab.title, icon: 'file' }),
          ),
        }),
      ).filter((node) => (node.children?.length ?? 0) > 0),
    [],
  );

  return (
    <div className="sb-browser">
      <TreeView
        aria-label="Labs"
        nodes={nodes}
        defaultExpandedIds={nodes.map((n) => n.id)}
        selectedId={selectedId}
        onSelectedChange={(id) => {
          if (id && !id.startsWith('family:')) onSelect(id);
        }}
      />
      <div className="sb-browser__published">
        <Panel title="PUBLISHED" flush>
          {published.length === 0 ? (
            <div className="sb-browser__empty">No snapshots yet. Publish freezes the current URL.</div>
          ) : (
            <ul className="sb-browser__snaplist">
              {published.map((snap) => (
                <li key={snap.payload}>
                  <button
                    type="button"
                    className="sb-browser__snap"
                    onClick={() => onOpenSnapshot(snap)}
                    title={`Published ${snap.at}`}
                  >
                    {snap.name}
                  </button>
                  <IconButton
                    icon="trash"
                    label={`Delete ${snap.name}`}
                    size="sm"
                    onClick={() => onDeleteSnapshot(snap)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
