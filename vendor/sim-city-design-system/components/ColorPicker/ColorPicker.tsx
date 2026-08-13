/*
 * ColorPicker: the whole paint shop on one panel. ColorArea mixes the shade,
 * a hue ColorSlider turns the wheel, ColorField takes the code by hand, and
 * a SwatchGroup keeps the standing paints — all reconciled to one hex value
 * in and out.
 *
 * Internally the mix is held as HSL, not hex: hex forgets hue at zero
 * saturation and forgets everything at black and white, and a picker that
 * loses its hue when the clerk sweeps through grey is a broken picker. The
 * hex prop is reconciled against that state during render, adopting outside
 * values only when they genuinely disagree with the current mix.
 */

import { useState, type JSX, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { Panel } from '../Panel';
import { ColorArea } from '../ColorArea';
import { ColorField } from '../ColorField';
import { ColorSlider } from '../ColorSlider';
import { Swatch, SwatchGroup } from '../Swatch';
import { hexToHsl, hslToHex, normalizeHex, type Hsl } from '../Swatch/colorMath';
import './ColorPicker.css';

/** The standing municipal paints, as payload hex. */
const STANDARD_ISSUE = [
  '#8C4A2F',
  '#D8CBA8',
  '#4A6C8C',
  '#3F7A1F',
  '#F0A830',
  '#9AA3AB',
  '#20262B',
  '#EDE8DA',
];

export interface ColorPickerProps {
  /** Panel title band. */
  title?: ReactNode;
  /** Committed paint, always normalized "#RRGGBB". */
  value?: string;
  defaultValue?: string;
  onValueChange?: (hex: string) => void;
  /** The swatch row of standing paints. */
  presets?: string[];
  /** Band above the swatch row. */
  presetsLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function ColorPicker({
  title = 'MUNICIPAL PAINT SHOP',
  value: valueProp,
  defaultValue,
  onValueChange,
  presets = STANDARD_ISSUE,
  presetsLabel = 'Standard issue',
  disabled = false,
  className,
}: ColorPickerProps): JSX.Element {
  const [value, setValue] = useControllableState(
    valueProp,
    normalizeHex(defaultValue ?? '') ?? '#3F7A1F',
    onValueChange,
  );
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(value) ?? { h: 100, s: 60, l: 30 });
  const [prevValue, setPrevValue] = useState(value);

  /* Adopt outside hex only when it disagrees with the current mix, so a
     round-trip through our own onValueChange never resets the hue. */
  if (value !== prevValue) {
    setPrevValue(value);
    const incoming = normalizeHex(value) ?? value;
    if (hslToHex(hsl) !== incoming) {
      setHsl(hexToHsl(incoming) ?? hsl);
    }
  }

  function commitHsl(next: Hsl): void {
    setHsl(next);
    const hex = hslToHex(next);
    setPrevValue(hex);
    setValue(hex);
  }

  function commitHex(hex: string): void {
    setValue(hex);
  }

  const paints = presets.map((p) => normalizeHex(p) ?? p.toUpperCase());
  const specimen = hslToHex(hsl);

  return (
    <Panel title={title} striped className={cx('sc-colorpicker', className)}>
      <div className="sc-colorpicker__stack">
        <ColorArea
          hue={hsl.h}
          label="Shade"
          value={{ s: hsl.s, l: hsl.l }}
          onValueChange={({ s, l }) => commitHsl({ h: hsl.h, s, l })}
          disabled={disabled}
        />
        <ColorSlider
          channel="hue"
          color={{ h: hsl.h, s: 100, l: 50 }}
          value={hsl.h}
          onValueChange={(h) => commitHsl({ ...hsl, h })}
          disabled={disabled}
        />
        {/* The wet sample: the mix at full width, code stamped on top in
            whichever ink survives it. Payload on payload. */}
        <div className="sc-colorpicker__specimen" aria-hidden="true" style={{ background: specimen }}>
          <span
            className="sc-colorpicker__specimen-hex"
            style={{ color: hsl.l > 55 ? '#10140F' : '#F2F5EC' }}
          >
            {specimen}
          </span>
        </div>
        <ColorField label="Paint code" value={value} onValueChange={commitHex} disabled={disabled} />
        <SwatchGroup
          label={presetsLabel}
          columns={8}
          size={20}
          value={value}
          onValueChange={commitHex}
          disabled={disabled}
        >
          {paints.map((hex) => (
            <Swatch key={hex} color={hex} />
          ))}
        </SwatchGroup>
      </div>
    </Panel>
  );
}
