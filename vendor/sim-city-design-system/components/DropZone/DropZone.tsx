/*
 * A sunken, dithered well that receives files. Drag-over floods the inside
 * with a 2px accent keyline — drawn as an inset frame, never a glow — and a
 * refused deposit flashes the danger hatch twice and is gone. A depth counter
 * tracks dragenter/dragleave so the state holds steady while the payload
 * crosses the glyph and caption inside the well.
 *
 * Keyboard access is the embedded FileTrigger: the well itself is scenery,
 * the button is the door.
 */

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type HTMLAttributes,
  type JSX,
} from 'react';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { FileTrigger } from './FileTrigger';
import './DropZone.css';

/* Two flashes of the hatch at 320ms each; the timer clears the state after. */
const REJECT_FLASH_MS = 640;

export interface DropZoneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrop'> {
  onDrop: (files: File[]) => void;
  /** Native-style accept list: ".csv", "image/*", "application/pdf", … */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  caption?: string;
  /** Caption shown while a refused drop flashes the hatch. */
  rejectCaption?: string;
  /** Label of the embedded FileTrigger button. */
  browseLabel?: string;
}

function fileMatches(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function DropZone({
  onDrop,
  accept,
  multiple = true,
  disabled = false,
  caption = 'Deposit survey plates here',
  rejectCaption = 'Plate refused — wrong form',
  browseLabel = 'Or browse the archive',
  className,
  ...rest
}: DropZoneProps): JSX.Element {
  const depth = useRef(0);
  const rejectTimer = useRef<number | undefined>(undefined);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => () => window.clearTimeout(rejectTimer.current), []);

  const flashReject = (): void => {
    window.clearTimeout(rejectTimer.current);
    setRejected(true);
    rejectTimer.current = window.setTimeout(() => setRejected(false), REJECT_FLASH_MS);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setOver(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (!disabled) event.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (disabled) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    if (disabled) return;

    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    const accepted = accept ? files.filter((file) => fileMatches(file, accept)) : files;
    if (accepted.length < files.length || accepted.length === 0) flashReject();
    if (accepted.length > 0) onDrop(multiple ? accepted : accepted.slice(0, 1));
  };

  return (
    <div
      {...rest}
      className={cx(
        'sc-dropzone',
        'dither',
        over && 'sc-dropzone--over',
        rejected && 'sc-dropzone--rejected',
        disabled && 'sc-dropzone--disabled',
        className,
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      <PixelIcon name="upload" size={32} className="sc-dropzone__glyph" />
      <div className="sc-dropzone__caption">{rejected ? rejectCaption : caption}</div>
      <FileTrigger
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        size="sm"
        onSelect={onDrop}
      >
        {browseLabel}
      </FileTrigger>

      {over && <div className="sc-dropzone__keyline" aria-hidden="true" />}
      {rejected && <div className="sc-dropzone__hatch" aria-hidden="true" />}

      {/* The flash is visual; the refusal still has to be said. */}
      <div className="sr-only" aria-live="polite">
        {rejected ? rejectCaption : ''}
      </div>
    </div>
  );
}
