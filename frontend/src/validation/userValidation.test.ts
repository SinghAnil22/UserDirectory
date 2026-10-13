import { describe, expect, it } from 'vitest';
import { toNewUser, validateUser, validateUserField, type UserFormValues } from './userValidation';

const valid: UserFormValues = { name: 'Jane Doe', age: '30', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' };

describe('validateUser', () => {
  it('returns no errors for a valid form', () => {
    expect(validateUser(valid)).toEqual({});
  });

  it('flags every empty required field', () => {
    const errors = validateUser({ name: '', age: '', city: '', state: '', pincode: '' });
    expect(errors).toEqual({
      name: 'Name is required.',
      age: 'Age is required.',
      city: 'City is required.',
      state: 'State is required.',
      pincode: 'Pincode is required.',
    });
  });

  it('treats whitespace-only values as empty', () => {
    expect(validateUser({ ...valid, city: '   ' }).city).toBe('City is required.');
  });
});

describe('validateUserField', () => {
  it.each([
    ['A', 'Name must be between 2 and 100 characters.'],
    ['a'.repeat(101), 'Name must be between 2 and 100 characters.'],
    ['Al', undefined],
    ['a'.repeat(100), undefined],
  ])('name %#', (value, expected) => {
    expect(validateUserField('name', value)).toBe(expected);
  });

  it.each([
    ['0', undefined],
    ['100', undefined],
    ['101', 'Age must be between 0 and 100.'],
    ['-1', 'Age must be a whole number.'],
    ['12.5', 'Age must be a whole number.'],
    ['abc', 'Age must be a whole number.'],
  ])('age "%s"', (value, expected) => {
    expect(validateUserField('age', value)).toBe(expected);
  });

  it.each([
    ['123', 'Pincode must be between 4 and 10 characters.'],
    ['12345678901', 'Pincode must be between 4 and 10 characters.'],
    ['12$45', 'Pincode may only contain letters, digits, spaces and hyphens.'],
    ['1234', undefined],
    ['SW1A 1AA', undefined],
  ])('pincode "%s"', (value, expected) => {
    expect(validateUserField('pincode', value)).toBe(expected);
  });
});

describe('toNewUser', () => {
  it('trims strings and converts age to a number', () => {
    expect(toNewUser({ ...valid, name: '  Jane  ', age: ' 42 ' })).toEqual({
      name: 'Jane',
      age: 42,
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    });
  });
});
