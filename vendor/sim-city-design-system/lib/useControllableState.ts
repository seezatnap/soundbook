import { useCallback, useRef, useState } from 'react';

/**
 * The standard controlled/uncontrolled dance: if `value` is provided the
 * caller owns the state and we only report changes; otherwise we keep it
 * ourselves, seeded from `defaultValue`.
 */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const controlledRef = useRef(controlled);
  controlledRef.current = controlled;

  const set = useCallback((next: T) => {
    if (!controlledRef.current) setInner(next);
    onChangeRef.current?.(next);
  }, []);

  return [current, set];
}
