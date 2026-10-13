import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { decodeJwtPayload } from './jwt';

const STORAGE_KEY = 'userdir.idToken';

export interface AuthUser {
  name: string;
  email: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  /** Google ID token (a signed JWT); sent to the API as the bearer token. */
  token: string | null;
  /** Starts a session from a Google ID token. Throws if the token is malformed or expired. */
  signIn: (idToken: string) => void;
  signOut: () => void;
}

interface Session {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export function parseSession(token: string, now = Date.now()): Session | null {
  const claims = decodeJwtPayload(token);
  if (!claims || typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;

  const email = typeof claims.email === 'string' ? claims.email : '';
  const name = typeof claims.name === 'string' ? claims.name : email;
  return { token, expiresAt: claims.exp * 1000, user: { name, email } };
}

function loadStoredSession(): Session | null {
  const token = sessionStorage.getItem(STORAGE_KEY);
  const session = token ? parseSession(token) : null;
  if (token && !session) sessionStorage.removeItem(STORAGE_KEY);
  return session;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadStoredSession);

  const signIn = useCallback((idToken: string) => {
    const next = parseSession(idToken);
    if (!next) throw new Error('The sign-in token is invalid or has expired.');
    sessionStorage.setItem(STORAGE_KEY, idToken);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    // Stops Google from silently re-selecting the same account on the next visit.
    window.google?.accounts.id.disableAutoSelect();
    setSession(null);
  }, []);

  // Google ID tokens are valid for about an hour; end the session when it expires so the user signs in again.
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(signOut, session.expiresAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      user: session?.user ?? null,
      token: session?.token ?? null,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
