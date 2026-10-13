import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchUser, updateUser } from '../api/usersApi';
import { mockAuth } from '../test/mockAuth';
import { ToastProvider } from '../toast/ToastContext';
import { EditUserPage } from './EditUserPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/usersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/usersApi')>()),
  fetchUser: vi.fn(),
  updateUser: vi.fn(),
}));

const existing = { id: 5, name: 'Asha Verma', age: 29, city: 'Pune', state: 'Maharashtra', pincode: '411001' };

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/users/5/edit']}>
      <ToastProvider>
        <Routes>
          <Route path="/users/:id/edit" element={<EditUserPage />} />
          <Route path="/users" element={<h1>User list page</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

describe('EditUserPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());
    vi.mocked(fetchUser).mockReset();
    vi.mocked(updateUser).mockReset();
  });

  it('loads the user and pre-fills the form', async () => {
    vi.mocked(fetchUser).mockResolvedValue(existing);

    renderPage();

    expect(await screen.findByLabelText('Name')).toHaveValue('Asha Verma');
    expect(fetchUser).toHaveBeenCalledWith(5, 'test-token', expect.any(AbortSignal));
    expect(screen.getByLabelText('Age')).toHaveValue(29);
    expect(screen.getByLabelText('City')).toHaveValue('Pune');
    expect(screen.getByLabelText('State')).toHaveValue('Maharashtra');
    expect(screen.getByLabelText('Pincode')).toHaveValue('411001');
  });

  it('saves changes, redirects to the list and shows a success toast', async () => {
    vi.mocked(fetchUser).mockResolvedValue(existing);
    vi.mocked(updateUser).mockResolvedValue({ ...existing, city: 'Mumbai' });
    const user = userEvent.setup();
    renderPage();

    const city = await screen.findByLabelText('City');
    await user.clear(city);
    await user.type(city, 'Mumbai');
    await user.click(screen.getByRole('button', { name: 'Update user' }));

    expect(await screen.findByRole('heading', { name: 'User list page' })).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith(
      5,
      { name: 'Asha Verma', age: 29, city: 'Mumbai', state: 'Maharashtra', pincode: '411001' },
      'test-token',
    );
    expect(screen.getByRole('status')).toHaveTextContent('User "Asha Verma" was updated successfully.');
  });

  it('validates before saving', async () => {
    vi.mocked(fetchUser).mockResolvedValue(existing);
    const user = userEvent.setup();
    renderPage();

    await user.clear(await screen.findByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Update user' }));

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows an error when the user cannot be loaded', async () => {
    vi.mocked(fetchUser).mockRejectedValue(new ApiError('The requested resource was not found.', 404));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('The requested resource was not found.');
    expect(screen.getByRole('link', { name: 'Back to list' })).toHaveAttribute('href', '/users');
    expect(screen.queryByRole('button', { name: 'Update user' })).not.toBeInTheDocument();
  });
});
