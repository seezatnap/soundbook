/*
 * Form: the filing routine every municipal window shares. A native <form>
 * wrapper — the values are whatever FormData reads off the paper, no schema
 * machinery — plus a light context through which each FormField contributes
 * two things: an error the server already stamped on it, and a validate rule
 * run at submit time.
 *
 * Validation is "reward early, punish late": nothing is said until the first
 * attempt to file, and from then on every change re-runs the whole book so a
 * corrected field falls silent immediately. A failed submit focuses the first
 * offending field and posts a danger Callout up top listing every message as
 * a link that walks back to its field.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button, type ButtonProps } from '../Button';
import { Callout } from '../Callout';
import { Link } from '../Link';
import { cx } from '../../lib/cx';
import './Form.css';

/** A field-level rule: the field's entry plus the whole form, for cross-checks. */
export type FormFieldValidator = (
  value: FormDataEntryValue | null,
  allValues: FormData,
) => string | null;

/*
 * Registration hands the Form refs, not values: validate rules and server
 * errors are read fresh at the moment of judgment, so a field never has to
 * re-register just because a prop changed.
 */
interface FieldRecord {
  ref: RefObject<HTMLDivElement | null>;
  validateRef: RefObject<FormFieldValidator | undefined>;
  serverErrorRef: RefObject<string | null>;
}

interface FormContextValue {
  register: (name: string, record: FieldRecord) => () => void;
  errors: ReadonlyMap<string, string>;
  submitted: boolean;
  /** A field changed; after the first submit this re-runs the whole book. */
  notifyChanged: () => void;
}

const FormContext = createContext<FormContextValue | null>(null);

interface FieldFailure {
  name: string;
  message: string;
}

/** The first thing inside a field wrapper that can take the blame in person. */
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** Called only when every registered field passes. Default is prevented. */
  onSubmit?: (data: FormData, event: FormEvent<HTMLFormElement>) => void;
  /** Title band on the failure summary. */
  summaryTitle?: ReactNode;
}

export function Form({
  onSubmit,
  onReset,
  summaryTitle = 'Cannot file — correct the following',
  className,
  children,
  ...rest
}: FormProps): JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const fieldsRef = useRef(new Map<string, FieldRecord>());
  const [failures, setFailures] = useState<FieldFailure[]>([]);
  const [submitted, setSubmitted] = useState(false);
  /* Bumped on reset: the fields keep their own drafts, so a true "clear form"
     remounts them back onto their defaultValues rather than asking nicely. */
  const [generation, setGeneration] = useState(0);
  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;

  const register = useCallback((name: string, record: FieldRecord): (() => void) => {
    fieldsRef.current.set(name, record);
    return () => {
      if (fieldsRef.current.get(name) === record) fieldsRef.current.delete(name);
    };
  }, []);

  /** Every field, judged in document order — the order the summary reads in. */
  const collectFailures = useCallback((data: FormData): FieldFailure[] => {
    const entries = [...fieldsRef.current.entries()].sort(([, a], [, b]) => {
      const ae = a.ref.current;
      const be = b.ref.current;
      if (!ae || !be || ae === be) return 0;
      return ae.compareDocumentPosition(be) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const out: FieldFailure[] = [];
    for (const [name, record] of entries) {
      const message =
        record.validateRef.current?.(data.get(name), data) ?? record.serverErrorRef.current;
      if (message !== null && message !== undefined) out.push({ name, message });
    }
    return out;
  }, []);

  const focusField = useCallback((name: string): void => {
    fieldsRef.current.get(name)?.ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  const notifyChanged = useCallback((): void => {
    if (!submittedRef.current || !formRef.current) return;
    setFailures(collectFailures(new FormData(formRef.current)));
  }, [collectFailures]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const found = collectFailures(data);
    setFailures(found);
    setSubmitted(true);
    if (found.length === 0) onSubmit?.(data, event);
    else focusField(found[0].name);
  };

  const handleReset = (event: FormEvent<HTMLFormElement>): void => {
    onReset?.(event);
    if (event.defaultPrevented) return;
    setFailures([]);
    setSubmitted(false);
    setGeneration((count) => count + 1);
  };

  const errors = useMemo(
    () => new Map(failures.map((failure) => [failure.name, failure.message])),
    [failures],
  );
  const context = useMemo<FormContextValue>(
    () => ({ register, errors, submitted, notifyChanged }),
    [register, errors, submitted, notifyChanged],
  );

  return (
    <form
      ref={formRef}
      noValidate
      className={cx('sc-form', className)}
      onSubmit={handleSubmit}
      onReset={handleReset}
      {...rest}
    >
      {failures.length > 0 && (
        <Callout variant="danger" title={summaryTitle} className="sc-form__summary">
          <ul className="sc-form__summary-list">
            {failures.map((failure) => (
              <li key={failure.name}>
                <Link
                  href={`#${failure.name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    focusField(failure.name);
                  }}
                >
                  {failure.message}
                </Link>
              </li>
            ))}
          </ul>
        </Callout>
      )}
      <FormContext.Provider key={generation} value={context}>
        {children}
      </FormContext.Provider>
    </form>
  );
}

/** What a FormField's render prop is told about its standing. */
export interface FormFieldState {
  /** The message to print — the validator's verdict, else the server's. */
  error: string | null;
  invalid: boolean;
  /**
   * For widgets with no native input (Select, Slider): report a change so the
   * post-submit re-check runs. Native inputs are heard automatically.
   */
  notifyChanged: () => void;
}

export interface FormFieldProps {
  /** The FormData key this field answers for. */
  name: string;
  /** An error the server sent back. Shown until the field is edited. */
  error?: string | null;
  /** Run on submit, and on every change after the first failed submit. */
  validate?: FormFieldValidator;
  className?: string;
  /** A render prop receives the field's standing; plain children just render. */
  children: ReactNode | ((state: FormFieldState) => ReactNode);
}

export function FormField({
  name,
  error = null,
  validate,
  className,
  children,
}: FormFieldProps): JSX.Element {
  const context = useContext(FormContext);
  if (context === null) throw new Error('FormField must be rendered inside a <Form>.');

  /* Editing the field withdraws the server's objection until it objects again. */
  const [dismissed, setDismissed] = useState(false);
  const [prevServerError, setPrevServerError] = useState(error);
  if (prevServerError !== error) {
    setPrevServerError(error);
    setDismissed(false);
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const validateRef = useRef<FormFieldValidator | undefined>(validate);
  validateRef.current = validate;
  const serverErrorRef = useRef<string | null>(null);
  serverErrorRef.current = dismissed ? null : error;

  const recordRef = useRef<FieldRecord | null>(null);
  recordRef.current ??= { ref: wrapperRef, validateRef, serverErrorRef };

  const { register, errors, notifyChanged } = context;
  useEffect(() => {
    const record = recordRef.current;
    return record ? register(name, record) : undefined;
  }, [register, name]);

  const handleChanged = (): void => {
    serverErrorRef.current = null;
    setDismissed(true);
    /* After the microtask, React has committed the change the event announced,
       so the re-check reads the new value out of the DOM, not the old one. */
    queueMicrotask(notifyChanged);
  };

  const displayed = errors.get(name) ?? (dismissed ? null : error);
  const state: FormFieldState = {
    error: displayed,
    invalid: displayed !== null,
    notifyChanged: handleChanged,
  };

  return (
    <div
      ref={wrapperRef}
      className={cx('sc-form-field', className)}
      data-field={name}
      onInputCapture={handleChanged}
      onChangeCapture={handleChanged}
    >
      {typeof children === 'function' ? children(state) : children}
    </div>
  );
}

export type FormSubmitProps = Omit<ButtonProps, 'type'>;

/** The one action the form exists for, so it defaults to the accent face. */
export function FormSubmit({ variant = 'accent', ...rest }: FormSubmitProps): JSX.Element {
  return <Button type="submit" variant={variant} {...rest} />;
}

export type FormResetProps = Omit<ButtonProps, 'type'>;

/** Native reset; the Form hears it and withdraws every error it has posted. */
export function FormReset(props: FormResetProps): JSX.Element {
  return <Button type="reset" {...props} />;
}
