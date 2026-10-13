import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { deleteUser, fetchCurrentUser, fetchUsers } from '../api/usersApi';
import { Spinner } from '../components/Spinner';
import { useToast } from '../toast/ToastContext';
import type { User } from '../types/user';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; users: User[]; isAdmin: boolean };

export function UserListPage() {
  const auth = useAuth();
  const { showToast } = useToast();
  // Keep the latest token in a ref so users are fetched once on mount, not on every token change.
  const tokenRef = useRef(auth.token);
  tokenRef.current = auth.token;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [deletingId, setDeletingId] = useState<number>();

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: 'loading' });
    try {
      const [users, me] = await Promise.all([
        fetchUsers(tokenRef.current, signal),
        fetchCurrentUser(tokenRef.current, signal),
      ]);
      // Only Admins may delete; the API enforces this, the UI just hides the button from Guests.
      setState({ status: 'success', users, isAdmin: me.roles.includes('Admin') });
    } catch (error) {
      if (signal?.aborted) return;
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load users.' });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;

    setDeletingId(user.id);
    try {
      await deleteUser(user.id, auth.token);
      setState((current) =>
        current.status === 'success' ? { ...current, users: current.users.filter((u) => u.id !== user.id) } : current,
      );
      showToast(`User "${user.name}" was deleted.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete user.', 'error');
    } finally {
      setDeletingId(undefined);
    }
  };

  return (
    <section>
      <div className="page-header">
        <h1>Users</h1>
        <Link to="/users/new" className="btn btn-primary">
          Add user
        </Link>
      </div>

      {state.status === 'loading' && <Spinner label="Loading users…" />}

      {state.status === 'error' && (
        <div className="alert alert-error" role="alert">
          <span>{state.message}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state.status === 'success' && state.users.length === 0 && (
        <div className="card empty-state">
          <p>No users found.</p>
          <Link to="/users/new">Add the first user</Link>
        </div>
      )}

      {state.status === 'success' && state.users.length > 0 && (
        <div className="card table-wrapper">
          <table className="table">
            <caption className="visually-hidden">All users</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="num">
                  Age
                </th>
                <th scope="col">City</th>
                <th scope="col">State</th>
                <th scope="col">Pincode</th>
                <th scope="col" className="actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td className="num">{user.age}</td>
                  <td>{user.city}</td>
                  <td>{user.state}</td>
                  <td>{user.pincode}</td>
                  <td className="actions">
                    <Link
                      to={`/users/${user.id}/edit`}
                      className="btn btn-ghost btn-sm"
                      aria-label={`Edit ${user.name}`}
                    >
                      Edit
                    </Link>
                    {state.isAdmin && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        aria-label={`Delete ${user.name}`}
                        onClick={() => void handleDelete(user)}
                        disabled={deletingId !== undefined}
                      >
                        {deletingId === user.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="table-footer muted">
            {state.users.length} {state.users.length === 1 ? 'user' : 'users'}
          </p>
        </div>
      )}
    </section>
  );
}
