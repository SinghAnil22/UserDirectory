import type { NewUser } from '../types/user';

/** Raw form values – everything is a string until validated. */
export interface UserFormValues {
  name: string;
  age: string;
  city: string;
  state: string;
  pincode: string;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export const emptyUserForm: UserFormValues = { name: '', age: '', city: '', state: '', pincode: '' };

const PINCODE_PATTERN = /^[A-Za-z0-9 -]+$/;
const INTEGER_PATTERN = /^\d+$/;

/** Mirrors the API's validation rules so users get instant feedback. */
export function validateUserField(field: keyof UserFormValues, raw: string): string | undefined {
  const value = raw.trim();

  switch (field) {
    case 'name':
      if (!value) return 'Name is required.';
      if (value.length < 2 || value.length > 100) return 'Name must be between 2 and 100 characters.';
      return undefined;
    case 'age': {
      if (!value) return 'Age is required.';
      if (!INTEGER_PATTERN.test(value)) return 'Age must be a whole number.';
      const age = Number(value);
      if (age < 0 || age > 100) return 'Age must be between 0 and 100.';
      return undefined;
    }
    case 'city':
      if (!value) return 'City is required.';
      if (value.length > 100) return 'City must be at most 100 characters.';
      return undefined;
    case 'state':
      if (!value) return 'State is required.';
      if (value.length > 100) return 'State must be at most 100 characters.';
      return undefined;
    case 'pincode':
      if (!value) return 'Pincode is required.';
      if (value.length < 4 || value.length > 10) return 'Pincode must be between 4 and 10 characters.';
      if (!PINCODE_PATTERN.test(value)) return 'Pincode may only contain letters, digits, spaces and hyphens.';
      return undefined;
  }
}

export function validateUser(values: UserFormValues): UserFormErrors {
  const errors: UserFormErrors = {};
  for (const field of Object.keys(values) as (keyof UserFormValues)[]) {
    const error = validateUserField(field, values[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export function toNewUser(values: UserFormValues): NewUser {
  return {
    name: values.name.trim(),
    age: Number(values.age.trim()),
    city: values.city.trim(),
    state: values.state.trim(),
    pincode: values.pincode.trim(),
  };
}
