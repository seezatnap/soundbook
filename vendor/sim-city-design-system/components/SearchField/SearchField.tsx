import { useRef, type JSX, type KeyboardEvent } from 'react';
import { PixelIcon } from '../../icons/PixelIcon';
import { useControllableState } from '../../lib/useControllableState';
import { TextField, type TextFieldProps } from '../TextField';
import './SearchField.css';

export interface SearchFieldProps
  extends Omit<TextFieldProps, 'type' | 'icon' | 'suffix' | 'ref'> {
  /** Fires on Enter with the current text. */
  onSearch?: (value: string) => void;
}

export function SearchField({
  onSearch,
  onKeyDown,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  disabled,
  ...rest
}: SearchFieldProps): JSX.Element {
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = (): void => {
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && value !== '') {
      // Escape empties the query before anything above it hears about it.
      event.preventDefault();
      clear();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onSearch?.(value);
    }
  };

  return (
    <TextField
      {...rest}
      ref={inputRef}
      type="search"
      icon="search"
      disabled={disabled}
      value={value}
      onValueChange={setValue}
      onKeyDown={handleKeyDown}
      suffix={
        value !== '' ? (
          <button
            type="button"
            className="sc-searchfield__clear"
            aria-label="Clear search"
            disabled={disabled}
            onClick={clear}
          >
            <PixelIcon name="close" size={16} />
          </button>
        ) : undefined
      }
    />
  );
}
