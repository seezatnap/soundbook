/**
 * Icons, backed by the vendored @gravity-ui/icons set (see ./gravity/).
 *
 * The component keeps its historical name and contract — `PixelIcon`, a
 * `name` from a fixed vocabulary, a square `size`, monochrome via
 * `currentColor` — but the glyphs are no longer hand-drawn pixel grids:
 * each name maps onto one Gravity SVG, inlined at build time through a
 * `?raw` import so the set stays fully vendored with no runtime fetches.
 *
 * Icons remain strictly monochrome: every path in the set carries
 * `fill="currentColor"`, so glyphs follow pressed and disabled states and
 * never fight the chrome, exactly as the pixel grids did.
 */

import type { JSX } from 'react';

import arrowDown from './gravity/svgs/arrow-down.svg?raw';
import arrowLeft from './gravity/svgs/arrow-left.svg?raw';
import arrowRight from './gravity/svgs/arrow-right.svg?raw';
import arrowUp from './gravity/svgs/arrow-up.svg?raw';
import arrowDownToLine from './gravity/svgs/arrow-down-to-line.svg?raw';
import arrowUpFromLine from './gravity/svgs/arrow-up-from-line.svg?raw';
import arrowUpRightFromSquare from './gravity/svgs/arrow-up-right-from-square.svg?raw';
import arrowUturnCcwLeft from './gravity/svgs/arrow-uturn-ccw-left.svg?raw';
import arrowUturnCwRight from './gravity/svgs/arrow-uturn-cw-right.svg?raw';
import arrowsRotateRight from './gravity/svgs/arrows-rotate-right.svg?raw';
import bars from './gravity/svgs/bars.svg?raw';
import barsAscendingAlignLeft from './gravity/svgs/bars-ascending-align-left.svg?raw';
import barsDescendingAlignLeft from './gravity/svgs/bars-descending-align-left.svg?raw';
import bell from './gravity/svgs/bell.svg?raw';
import bookmark from './gravity/svgs/bookmark.svg?raw';
import chartBar from './gravity/svgs/chart-bar.svg?raw';
import check from './gravity/svgs/check.svg?raw';
import chevronDown from './gravity/svgs/chevron-down.svg?raw';
import chevronLeft from './gravity/svgs/chevron-left.svg?raw';
import chevronRight from './gravity/svgs/chevron-right.svg?raw';
import chevronUp from './gravity/svgs/chevron-up.svg?raw';
import chevronsLeft from './gravity/svgs/chevrons-left.svg?raw';
import chevronsRight from './gravity/svgs/chevrons-right.svg?raw';
import calendar from './gravity/svgs/calendar.svg?raw';
import circleDollar from './gravity/svgs/circle-dollar.svg?raw';
import circleInfo from './gravity/svgs/circle-info.svg?raw';
import circleQuestion from './gravity/svgs/circle-question.svg?raw';
import clock from './gravity/svgs/clock.svg?raw';
import compass from './gravity/svgs/compass.svg?raw';
import copy from './gravity/svgs/copy.svg?raw';
import cubes3Overlap from './gravity/svgs/cubes-3-overlap.svg?raw';
import dice5 from './gravity/svgs/dice-5.svg?raw';
import droplet from './gravity/svgs/droplet.svg?raw';
import ellipsis from './gravity/svgs/ellipsis.svg?raw';
import ellipsisVertical from './gravity/svgs/ellipsis-vertical.svg?raw';
import envelope from './gravity/svgs/envelope.svg?raw';
import eraser from './gravity/svgs/eraser.svg?raw';
import eye from './gravity/svgs/eye.svg?raw';
import eyeSlash from './gravity/svgs/eye-slash.svg?raw';
import factory from './gravity/svgs/factory.svg?raw';
import file from './gravity/svgs/file.svg?raw';
import flag from './gravity/svgs/flag.svg?raw';
import floppyDisk from './gravity/svgs/floppy-disk.svg?raw';
import folder from './gravity/svgs/folder.svg?raw';
import folderTree from './gravity/svgs/folder-tree.svg?raw';
import funnel from './gravity/svgs/funnel.svg?raw';
import gear from './gravity/svgs/gear.svg?raw';
import grip from './gravity/svgs/grip.svg?raw';
import hammer from './gravity/svgs/hammer.svg?raw';
import house from './gravity/svgs/house.svg?raw';
import layoutCells from './gravity/svgs/layout-cells.svg?raw';
import layoutHeaderCells from './gravity/svgs/layout-header-cells.svg?raw';
import link from './gravity/svgs/link.svg?raw';
import listUl from './gravity/svgs/list-ul.svg?raw';
import lock from './gravity/svgs/lock.svg?raw';
import lockOpen from './gravity/svgs/lock-open.svg?raw';
import magnifier from './gravity/svgs/magnifier.svg?raw';
import magnifierMinus from './gravity/svgs/magnifier-minus.svg?raw';
import magnifierPlus from './gravity/svgs/magnifier-plus.svg?raw';
import megaphone from './gravity/svgs/megaphone.svg?raw';
import minus from './gravity/svgs/minus.svg?raw';
import pause from './gravity/svgs/pause.svg?raw';
import pencil from './gravity/svgs/pencil.svg?raw';
import percent from './gravity/svgs/percent.svg?raw';
import person from './gravity/svgs/person.svg?raw';
import picture from './gravity/svgs/picture.svg?raw';
import pin from './gravity/svgs/pin.svg?raw';
import play from './gravity/svgs/play.svg?raw';
import plus from './gravity/svgs/plus.svg?raw';
import power from './gravity/svgs/power.svg?raw';
import route from './gravity/svgs/route.svg?raw';
import shuffle from './gravity/svgs/shuffle.svg?raw';
import squareFill from './gravity/svgs/square-fill.svg?raw';
import star from './gravity/svgs/star.svg?raw';
import stop from './gravity/svgs/stop.svg?raw';
import target from './gravity/svgs/target.svg?raw';
import trashBin from './gravity/svgs/trash-bin.svg?raw';
import triangleExclamation from './gravity/svgs/triangle-exclamation.svg?raw';
import wrench from './gravity/svgs/wrench.svg?raw';
import xmark from './gravity/svgs/xmark.svg?raw';

/*
 * The design system's icon vocabulary → Gravity SVG. Names are the stable
 * API; the right-hand side is presentation. Where Gravity has no literal
 * counterpart the nearest semantic neighbour is used (bulldoze → eraser,
 * crane → stacked cubes, minimap → compass).
 */
const ICONS = {
  'arrow-down': arrowDown,
  'arrow-left': arrowLeft,
  'arrow-right': arrowRight,
  'arrow-up': arrowUp,
  bell,
  bookmark,
  build: hammer,
  bulldoze: eraser,
  calendar,
  'chart-bar': chartBar,
  check,
  'chevron-down': chevronDown,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  'chevron-up': chevronUp,
  'chevrons-left': chevronsLeft,
  'chevrons-right': chevronsRight,
  clock,
  close: xmark,
  copy,
  crane: cubes3Overlap,
  dice: dice5,
  dollar: circleDollar,
  'dots-h': ellipsis,
  'dots-v': ellipsisVertical,
  download: arrowDownToLine,
  edit: pencil,
  external: arrowUpRightFromSquare,
  eye,
  'eye-off': eyeSlash,
  factory,
  file,
  filter: funnel,
  flag,
  folder,
  gear,
  grid: layoutCells,
  grip,
  home: house,
  house,
  image: picture,
  info: circleInfo,
  inspect: target,
  link,
  list: listUl,
  lock,
  mail: envelope,
  menu: bars,
  minimap: compass,
  minus,
  pause,
  percent,
  pin,
  play,
  plus,
  power,
  question: circleQuestion,
  redo: arrowUturnCwRight,
  refresh: arrowsRotateRight,
  road: route,
  save: floppyDisk,
  search: magnifier,
  shuffle,
  siren: megaphone,
  'sort-asc': barsAscendingAlignLeft,
  'sort-desc': barsDescendingAlignLeft,
  'square-fill': squareFill,
  star,
  stop,
  table: layoutHeaderCells,
  trash: trashBin,
  tree: folderTree,
  undo: arrowUturnCcwLeft,
  unlock: lockOpen,
  upload: arrowUpFromLine,
  user: person,
  warning: triangleExclamation,
  water: droplet,
  wrench,
  'zoom-in': magnifierPlus,
  'zoom-out': magnifierMinus,
} as const;

export type PixelIconName = keyof typeof ICONS;

export function pixelIconNames(): PixelIconName[] {
  return Object.keys(ICONS) as PixelIconName[];
}

/* Inner markup of each SVG (outer <svg> stripped), extracted lazily so the
   16×16 viewBox and sizing stay under this component's control. */
const innerCache = new Map<string, string>();
function innerOf(raw: string): string {
  let inner = innerCache.get(raw);
  if (inner === undefined) {
    inner = raw.slice(raw.indexOf('>') + 1, raw.lastIndexOf('</svg>'));
    innerCache.set(raw, inner);
  }
  return inner;
}

export interface PixelIconProps {
  name: PixelIconName;
  /** Rendered edge in CSS pixels. */
  size?: number;
  className?: string;
}

export function PixelIcon({ name, size = 16, className }: PixelIconProps): JSX.Element {
  const raw = ICONS[name] ?? ICONS.warning;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
      dangerouslySetInnerHTML={{ __html: innerOf(raw) }}
    />
  );
}
