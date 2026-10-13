import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Renders children only for signed-in users; otherwise sends them to /login and remembers where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
