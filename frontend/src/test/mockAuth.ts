import { vi } from 'vitest';
import type { AuthContextValue } from '../auth/AuthContext';

/** Builds a fake auth state; defaults to a signed-in Google user. */
export function mockAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    isAuthenticated: true,
    user: { name: 'Demo User', email: 'demo@gmail.com' },
    token: 'test-token',
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

/** Builds an unsigned JWT with Google-like ID token claims (valid for an hour unless overridden). */
export function fakeIdToken(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

  return [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      iss: 'https://accounts.google.com',
      name: 'Demo User',
      email: 'demo@gmail.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    }),
    'signature',
  ].join('.');
}
