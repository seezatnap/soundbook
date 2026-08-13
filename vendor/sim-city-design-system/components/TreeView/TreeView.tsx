/*
 * The APG tree, drawn like a 1993 file manager: 16px of indent per level with
 * a hard 1px guide line under each parent's disclosure, chevron glyphs that
 * point where the branch will go, folders for limbs and files for leaves.
 * DOM focus roves across the treeitems themselves; ArrowRight opens then
 * enters, ArrowLeft closes then exits, `*` opens the whole shelf, and typing
 * jumps to the next label that starts that way.
 */

import { useMemo, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './TreeView.css';

export interface TreeNode {
  id: string;
  /** Plain text so typeahead can read it. */
  label: string;
  /** Defaults: folder for nodes with children, file for leaves. */
  icon?: PixelIconName;
  children?: TreeNode[];
}

export interface TreeViewProps {
  /** Required: names the tree for screen readers. */
  'aria-label': string;
  nodes: TreeNode[];
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedChange?: (id: string | null) => void;
  className?: string;
}

interface FlatNode {
  node: TreeNode;
  parent: TreeNode | null;
}

function flattenVisible(
  nodes: TreeNode[],
  expanded: ReadonlySet<string>,
  parent: TreeNode | null,
  out: FlatNode[],
): FlatNode[] {
  for (const node of nodes) {
    out.push({ node, parent });
    if (node.children !== undefined && node.children.length > 0 && expanded.has(node.id)) {
      flattenVisible(node.children, expanded, node, out);
    }
  }
  return out;
}

export function TreeView({
  'aria-label': ariaLabel,
  nodes,
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
  selectedId,
  defaultSelectedId,
  onSelectedChange,
  className,
}: TreeViewProps): JSX.Element {
  const [expanded, setExpanded] = useControllableState<string[]>(
    expandedIds,
    defaultExpandedIds ?? [],
    onExpandedChange,
  );
  const [selected, setSelected] = useControllableState<string | null>(
    selectedId,
    defaultSelectedId ?? null,
    onSelectedChange,
  );
  const [focusId, setFocusId] = useState<string | null>(null);

  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const visible = useMemo(
    () => flattenVisible(nodes, expandedSet, null, []),
    [nodes, expandedSet],
  );

  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const typeahead = useRef({ buffer: '', at: 0 });

  const visibleIds = visible.map((flat) => flat.node.id);
  const effectiveFocusId =
    focusId !== null && visibleIds.includes(focusId)
      ? focusId
      : selected !== null && visibleIds.includes(selected)
        ? selected
        : visibleIds[0];

  function focusNode(id: string): void {
    setFocusId(id);
    itemRefs.current.get(id)?.focus();
  }

  function toggleExpanded(id: string): void {
    setExpanded(
      expandedSet.has(id) ? expanded.filter((e) => e !== id) : [...expanded, id],
    );
  }

  /** `*`: every closed sibling at this level swings open at once. */
  function expandSiblings(flat: FlatNode): void {
    const siblings = flat.parent ? (flat.parent.children ?? []) : nodes;
    const openable = siblings
      .filter((s) => s.children !== undefined && s.children.length > 0)
      .map((s) => s.id)
      .filter((id) => !expandedSet.has(id));
    if (openable.length > 0) setExpanded([...expanded, ...openable]);
  }

  function moveTo(index: number): void {
    const target = visible[index];
    if (target) focusNode(target.node.id);
  }

  function runTypeahead(char: string, fromIndex: number): void {
    const now = Date.now();
    const state = typeahead.current;
    if (now - state.at > 600) state.buffer = '';
    state.buffer += char.toLowerCase();
    state.at = now;
    for (let step = 1; step <= visible.length; step++) {
      const candidate = visible[(fromIndex + step) % visible.length];
      if (candidate.node.label.toLowerCase().startsWith(state.buffer)) {
        focusNode(candidate.node.id);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>, flat: FlatNode): void {
    /* Treeitems nest; only the item that owns the focus answers. */
    if (event.target !== event.currentTarget) return;
    const { node } = flat;
    const hasChildren = node.children !== undefined && node.children.length > 0;
    const isExpanded = hasChildren && expandedSet.has(node.id);
    const index = visibleIds.indexOf(node.id);

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        if (hasChildren && !isExpanded) toggleExpanded(node.id);
        else if (isExpanded) moveTo(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (isExpanded) toggleExpanded(node.id);
        else if (flat.parent) focusNode(flat.parent.id);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveTo(Math.min(index + 1, visible.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(visible.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        setSelected(node.id);
        break;
      case '*':
        event.preventDefault();
        expandSiblings(flat);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          // Typeahead characters must not double as host hotkeys (the
          // Storybook manager binds bare letters to UI toggles).
          event.preventDefault();
          event.stopPropagation();
          runTypeahead(event.key, index);
        }
    }
  }

  function handleDisclosureClick(event: MouseEvent<HTMLSpanElement>, id: string): void {
    event.stopPropagation();
    toggleExpanded(id);
    focusNode(id);
  }

  function renderNodes(list: TreeNode[], parent: TreeNode | null): JSX.Element {
    const isRoot = parent === null;
    return (
      <ul
        role={isRoot ? 'tree' : 'group'}
        aria-label={isRoot ? ariaLabel : undefined}
        className={isRoot ? cx('sc-treeview', className) : 'sc-treeview__group'}
      >
        {list.map((node) => {
          const hasChildren = node.children !== undefined && node.children.length > 0;
          const isExpanded = hasChildren && expandedSet.has(node.id);
          const isSelected = selected === node.id;
          return (
            <li
              key={node.id}
              role="treeitem"
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-selected={isSelected}
              tabIndex={node.id === effectiveFocusId ? 0 : -1}
              ref={(el) => {
                if (el) itemRefs.current.set(node.id, el);
                else itemRefs.current.delete(node.id);
              }}
              className="sc-treeview__item"
              onKeyDown={(event) => handleKeyDown(event, { node, parent })}
              onFocus={(event) => {
                if (event.target === event.currentTarget) setFocusId(node.id);
              }}
            >
              <div
                className={cx('sc-treeview__row', isSelected && 'sc-treeview__row--selected')}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected(node.id);
                  focusNode(node.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (hasChildren) toggleExpanded(node.id);
                }}
              >
                {hasChildren ? (
                  <span
                    className="sc-treeview__disclosure"
                    onClick={(event) => handleDisclosureClick(event, node.id)}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <PixelIcon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={16} />
                  </span>
                ) : (
                  <span className="sc-treeview__spacer" />
                )}
                <PixelIcon
                  className="sc-treeview__glyph"
                  name={node.icon ?? (hasChildren ? 'folder' : 'file')}
                  size={16}
                />
                <span className="sc-treeview__label">{node.label}</span>
              </div>
              {isExpanded && renderNodes(node.children ?? [], node)}
            </li>
          );
        })}
      </ul>
    );
  }

  return renderNodes(nodes, null);
}
