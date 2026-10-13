import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, deleteUser, fetchCurrentUser, fetchUsers } from '../api/usersApi';
import { mockAuth } from '../test/mockAuth';
import { ToastProvider } from '../toast/ToastContext';
import { UserListPage } from './UserListPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/usersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/usersApi')>()),
  fetchUsers: vi.fn(),
  fetchCurrentUser: vi.fn(),
  deleteUser: vi.fn(),
}));

const users = [
  { id: 1, name: 'Asha Verma', age: 29, city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  { id: 2, name: 'Rahul Mehta', age: 41, city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <UserListPage />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('UserListPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());
    vi.mocked(fetchUsers).mockReset();
    vi.mocked(deleteUser).mockReset();
    vi.mocked(fetchCurrentUser).mockResolvedValue({ email: 'demo@gmail.com', roles: ['Admin'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a spinner, then loads users from the API on mount', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(users);

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
    const table = await screen.findByRole('table');
    expect(fetchUsers).toHaveBeenCalledWith('test-token', expect.any(AbortSignal));
    expect(fetchCurrentUser).toHaveBeenCalledWith('test-token', expect.any(AbortSignal));

    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Name', 'Age', 'City', 'State', 'Pincode', 'Actions']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getAllByRole('cell').map((td) => td.textContent)).toEqual([
      'Asha Verma',
      '29',
      'Pune',
      'Maharashtra',
      '411001',
      'EditDelete',
    ]);
    expect(screen.getByText('2 users')).toBeInTheDocument();
  });

  it('links each user to their edit page', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(users);

    renderPage();

    expect(await screen.findByRole('link', { name: 'Edit Rahul Mehta' })).toHaveAttribute('href', '/users/2/edit');
  });

  it('hides the Delete button from Guests but still lets them edit', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(users);
    vi.mocked(fetchCurrentUser).mockResolvedValue({ email: 'guest@gmail.com', roles: ['Guest'] });

    renderPage();

    expect(await screen.findByRole('link', { name: 'Edit Asha Verma' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('deletes a user after confirmation and removes the row', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(users);
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Asha Verma' }));

    expect(confirm).toHaveBeenCalledWith('Delete user "Asha Verma"? This cannot be undone.');
    expect(deleteUser).toHaveBeenCalledWith(1, 'test-token');
    expect(await screen.findByRole('status')).toHaveTextContent('User "Asha Verma" was deleted.');
    expect(screen.queryByText('Asha Verma')).not.toBeInTheDocument();
    expect(screen.getByText('1 user')).toBeInTheDocument();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(users);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Asha Verma' }));

    expect(deleteUser).not.toHaveBeenCalled();
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
  });

  it('keeps the row and shows an error toast when deleting fails', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(users);
    vi.mocked(deleteUser).mockRejectedValue(new ApiError('The requested resource was not found.', 404));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Asha Verma' }));

    expect(await screen.findByRole('status')).toHaveTextContent('The requested resource was not found.');
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Asha Verma' })).toBeEnabled();
  });

  it('shows an empty state when there are no users', async () => {
    vi.mocked(fetchUsers).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add the first user' })).toHaveAttribute('href', '/users/new');
  });

  it('shows an error when loading fails and can retry', async () => {
    vi.mocked(fetchUsers)
      .mockRejectedValueOnce(new ApiError('The server returned an unexpected error (500). Please try again.', 500))
      .mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected error (500)');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(fetchUsers).toHaveBeenCalledTimes(2);
  });
});
