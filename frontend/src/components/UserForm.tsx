import { useState, type ChangeEvent, type FocusEvent, type FormEvent, type InputHTMLAttributes } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/usersApi';
import type { NewUser } from '../types/user';
import {
  emptyUserForm,
  toNewUser,
  validateUser,
  validateUserField,
  type UserFormErrors,
  type UserFormValues,
} from '../validation/userValidation';
import { Spinner } from './Spinner';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: keyof UserFormValues;
  label: string;
  error?: string;
}

function Field({ name, label, error, ...inputProps }: FieldProps) {
  const id = `user-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} {...inputProps} />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

interface UserFormProps {
  initialValues?: UserFormValues;
  submitLabel: string;
  /** Persists the user; a thrown error is shown on the form and keeps the user on the page. */
  onSubmit: (user: NewUser) => Promise<void>;
}

export function UserForm({ initialValues = emptyUserForm, submitLabel, onSubmit }: UserFormProps) {
  const navigate = useNavigate();

  const [values, setValues] = useState<UserFormValues>(initialValues);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string>();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof UserFormValues;
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    // Once a field shows an error, re-validate as the user types so the message clears promptly.
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validateUserField(field, value) }));
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof UserFormValues;
    setErrors((current) => ({ ...current, [field]: validateUserField(field, event.target.value) }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(undefined);

    const validationErrors = validateUser(values);
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      document.getElementById(`user-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(toNewUser(values));
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors as UserFormErrors);
      }
      setServerError(error instanceof Error ? error.message : 'Failed to save user.');
      setSubmitting(false);
    }
  };

  const fieldProps = (name: keyof UserFormValues) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: handleChange,
    onBlur: handleBlur,
    disabled: submitting,
  });

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert alert-error" role="alert">
          {serverError}
        </div>
      )}

      <Field label="Name" maxLength={100} autoComplete="name" {...fieldProps('name')} />
      <Field label="Age" type="number" inputMode="numeric" min={0} max={100} step={1} {...fieldProps('age')} />
      <div className="field-row">
        <Field label="City" maxLength={100} {...fieldProps('city')} />
        <Field label="State" maxLength={100} {...fieldProps('state')} />
      </div>
      <Field label="Pincode" maxLength={10} autoComplete="postal-code" {...fieldProps('pincode')} />

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/users')} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <Spinner inline label="Saving…" /> : null}
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
