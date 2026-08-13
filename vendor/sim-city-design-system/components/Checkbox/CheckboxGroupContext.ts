/*
 * Wiring for CheckboxGroup composition. The group owns the string[] value;
 * a Checkbox rendered inside it with a `value` reads and toggles membership.
 * Lives beside Checkbox (the consumer); CheckboxGroup provides it.
 */

import { createContext } from 'react';

export interface CheckboxGroupContextValue {
  value: string[];
  toggle: (itemValue: string) => void;
  disabled: boolean;
  name?: string;
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);
