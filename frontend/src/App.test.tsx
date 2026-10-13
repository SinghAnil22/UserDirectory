import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { fetchCurrentUser, fetchUsers } from './api/usersApi';
import { mockAuth } from './test/mockAuth';
import { ToastProvider } from './toast/ToastContext';

vi.mock('./auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./api/usersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/usersApi')>()),
  fetchUsers: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('App routing & navigation', () => {
  beforeEach(() => {
    vi.mocked(fetchUsers).mockResolvedValue([]);
    vi.mocked(fetchCurrentUser).mockResolvedValue({ email: 'demo@gmail.com', roles: ['Guest'] });
  });

  it('redirects anonymous users from protected pages to the login page', () => {
    vi.mocked(useAuth).mockReturnValue(mockAuth({ isAuthenticated: false, user: null, token: null }));

    renderApp('/users/new');

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows the top bar with Add and List links and navigates between pages', async () => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());

    renderApp('/users');
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Demo User')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Add' }));
    expect(screen.getByRole('heading', { name: 'Add user' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'List' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });

  it('logs out through the identity provider', async () => {
    const auth = mockAuth();
    vi.mocked(useAuth).mockReturnValue(auth);

    renderApp('/users');
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(auth.signOut).toHaveBeenCalled();
  });

  it('sends unknown routes to the list', async () => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());

    renderApp('/does-not-exist');

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });
});
