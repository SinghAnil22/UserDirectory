import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeIdToken } from '../test/mockAuth';
import { AuthProvider, parseSession, useAuth } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('parseSession', () => {
  it('extracts the user and expiry from a Google ID token', () => {
    const token = fakeIdToken({ name: 'Jane Doe', email: 'jane@gmail.com', exp: nowSeconds() + 60 });

    expect(parseSession(token)).toMatchObject({ token, user: { name: 'Jane Doe', email: 'jane@gmail.com' } });
  });

  it('rejects expired or malformed tokens', () => {
    expect(parseSession(fakeIdToken({ exp: nowSeconds() - 1 }))).toBeNull();
    expect(parseSession('not-a-jwt')).toBeNull();
  });
});

describe('AuthProvider', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    delete window.google;
  });

  it('starts signed out', () => {
    const { result } = renderHook(useAuth, { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
  });

  it('signs in with a valid token and persists it for the browser session', () => {
    const token = fakeIdToken();
    const { result } = renderHook(useAuth, { wrapper });

    act(() => result.current.signIn(token));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(token);
    expect(result.current.user).toEqual({ name: 'Demo User', email: 'demo@gmail.com' });

    // A fresh provider (e.g. after a page reload) restores the session.
    const { result: reloaded } = renderHook(useAuth, { wrapper });
    expect(reloaded.current.token).toBe(token);
  });

  it('refuses an expired token', () => {
    const { result } = renderHook(useAuth, { wrapper });

    expect(() => result.current.signIn(fakeIdToken({ exp: nowSeconds() - 10 }))).toThrow(/invalid or has expired/);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('signs out, clears storage and disables Google auto-select', () => {
    const disableAutoSelect = vi.fn();
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn(), disableAutoSelect } } };
    const { result } = renderHook(useAuth, { wrapper });
    act(() => result.current.signIn(fakeIdToken()));

    act(() => result.current.signOut());

    expect(result.current.isAuthenticated).toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(disableAutoSelect).toHaveBeenCalled();
  });

  it('signs out automatically when the token expires', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAuth, { wrapper });
    act(() => result.current.signIn(fakeIdToken({ exp: nowSeconds() + 60 })));

    act(() => vi.advanceTimersByTime(61_000));

    expect(result.current.isAuthenticated).toBe(false);
  });
});
