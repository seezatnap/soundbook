import type { JSX } from 'react';
import { useControllableState } from '../../lib/useControllableState';
import { TextField, type TextFieldProps } from '../TextField';
import './PasswordField.css';

/*
 * Private glyphs. The shared registry has no eye, and a component may not edit
 * it, so the two states of the visibility toggle are drawn here on the same
 * 16x16 grid and rendered by the same rect technique as PixelIcon. Both sit
 * inside columns 2-13 so they survive being clipped into a 16px button.
 *
 * `#` and `o` both render currentColor (icons are monochrome), `.` transparent.
 */

const EYE = [
  '................',
  '................',
  '................',
  '................',
  '......####......',
  '....##....##....',
  '..##..oooo..##..',
  '..#...oooo...#..',
  '..#...oooo...#..',
  '..##..oooo..##..',
  '....##....##....',
  '......####......',
  '................',
  '................',
  '................',
  '................',
];

const EYE_OFF = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..##........##..',
  '....##....##....',
  '......####......',
  '................',
  '...#...##...#...',
  '..#....##....#..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** The PixelIcon renderer, kept private until these glyphs are promoted. */
function LocalGlyph({ rows }: { rows: string[] }): JSX.Element {
  const rects: JSX.Element[] = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      rects.push(
        <rect
          key={`${y}-${x}`}
          x={x}
          y={y}
          width={run}
          height={1}
          fill="currentColor"
        />,
      );
      x += run;
    }
  }
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      {rects}
    </svg>
  );
}

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'suffix'> {
  /** Controlled reveal state. */
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

export function PasswordField({
  visible: visibleProp,
  defaultVisible = false,
  onVisibleChange,
  disabled,
  ...rest
}: PasswordFieldProps): JSX.Element {
  const [visible, setVisible] = useControllableState(
    visibleProp,
    defaultVisible,
    onVisibleChange,
  );
  return (
    <TextField
      autoComplete="current-password"
      {...rest}
      disabled={disabled}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className="sc-passwordfield__toggle"
          aria-label="Show password"
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible(!visible)}
        >
          <LocalGlyph rows={visible ? EYE_OFF : EYE} />
        </button>
      }
    />
  );
}
