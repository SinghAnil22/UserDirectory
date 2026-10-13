import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchUser, updateUser } from '../api/usersApi';
import { Spinner } from '../components/Spinner';
import { UserForm } from '../components/UserForm';
import { useToast } from '../toast/ToastContext';
import type { NewUser, User } from '../types/user';
import type { UserFormValues } from '../validation/userValidation';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; user: User };

const toFormValues = (user: User): UserFormValues => ({
  name: user.name,
  age: String(user.age),
  city: user.city,
  state: user.state,
  pincode: user.pincode,
});

export function EditUserPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const id = Number(useParams().id);
  // Keep the latest token in a ref so the user is fetched once on mount, not on every token change.
  const tokenRef = useRef(auth.token);
  tokenRef.current = auth.token;

  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState({ status: 'loading' });
      try {
        const user = await fetchUser(id, tokenRef.current, signal);
        setState({ status: 'success', user });
      } catch (error) {
        if (signal?.aborted) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load user.' });
      }
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleSubmit = async (user: NewUser) => {
    const updated = await updateUser(id, user, auth.token);
    showToast(`User "${updated.name}" was updated successfully.`);
    navigate('/users');
  };

  return (
    <section>
      <div className="page-header">
        <h1>Edit user</h1>
      </div>

      {state.status === 'loading' && <Spinner label="Loading user…" />}

      {state.status === 'error' && (
        <div className="alert alert-error" role="alert">
          <span>{state.message}</span>
          <span className="alert-actions">
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              Retry
            </button>
            <Link to="/users" className="btn btn-ghost">
              Back to list
            </Link>
          </span>
        </div>
      )}

      {state.status === 'success' && (
        <UserForm initialValues={toFormValues(state.user)} submitLabel="Update user" onSubmit={handleSubmit} />
      )}
    </section>
  );
}
