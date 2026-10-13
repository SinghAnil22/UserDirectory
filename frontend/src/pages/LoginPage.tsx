import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { loadGoogleIdentity } from '../auth/googleIdentity';
import { Spinner } from '../components/Spinner';
import { config } from '../config';

interface LoginLocationState {
  from?: string;
}

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const location = useLocation();
  const returnTo = (location.state as LoginLocationState | null)?.from ?? '/users';

  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (isAuthenticated) return;

    if (!config.googleClientId) {
      setError(
        'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in frontend/.env.local and restart the dev server.',
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: ({ credential }) => {
            try {
              if (!credential) throw new Error('Google did not return a credential.');
              setError(undefined);
              signIn(credential);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unknown error.');
            }
          },
        });
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 300,
        });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load Google Sign-In. Check your internet connection and try again.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, signIn]);

  if (isAuthenticated) return <Navigate to={returnTo} replace />;

  return (
    <section className="card login-card">
      <h1>Sign in</h1>
      <p className="muted">Sign in with your Google (Gmail) account to view and add users.</p>
      {error && (
        <div className="alert alert-error" role="alert">
          Sign-in failed: {error}
        </div>
      )}
      {loading && <Spinner label="Loading Google Sign-In…" />}
      <div ref={buttonRef} className="google-button" data-testid="google-signin-button" />
    </section>
  );
}
