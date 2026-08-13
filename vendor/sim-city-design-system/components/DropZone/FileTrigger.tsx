/*
 * A Button fronting a hidden file input. The input never draws — the picker
 * is the OS's business — so the visible control keeps the system's bevel and
 * voice. Selecting the same file twice must fire twice, hence the value reset.
 */

import { useRef, type ChangeEvent, type JSX, type ReactNode } from 'react';
import { Button, type ButtonProps } from '../Button';

export interface FileTriggerProps {
  onSelect: (files: File[]) => void;
  /** Native accept list: ".csv", "image/*", "application/pdf", … */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icon?: ButtonProps['icon'];
  /** The button label. */
  children: ReactNode;
}

export function FileTrigger({
  onSelect,
  accept,
  multiple = false,
  disabled = false,
  variant,
  size,
  icon,
  children,
}: FileTriggerProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onSelect(files);
    event.target.value = '';
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
      />
    </>
  );
}
