import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createUser } from '../api/usersApi';
import { mockAuth } from '../test/mockAuth';
import { ToastProvider } from '../toast/ToastContext';
import { AddUserPage } from './AddUserPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/usersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/usersApi')>()),
  createUser: vi.fn(),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/users/new']}>
      <ToastProvider>
        <Routes>
          <Route path="/users/new" element={<AddUserPage />} />
          <Route path="/users" element={<h1>User list page</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

async function fillValidForm(user = userEvent.setup()) {
  await user.type(screen.getByLabelText('Name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Age'), '30');
  await user.type(screen.getByLabelText('City'), 'Mumbai');
  await user.type(screen.getByLabelText('State'), 'Maharashtra');
  await user.type(screen.getByLabelText('Pincode'), '400001');
  return user;
}

describe('AddUserPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());
    vi.mocked(createUser).mockReset();
  });

  it('shows inline validation messages and does not call the API when the form is invalid', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Save user' }));

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Age is required.')).toBeInTheDocument();
    expect(screen.getByText('City is required.')).toBeInTheDocument();
    expect(screen.getByText('State is required.')).toBeInTheDocument();
    expect(screen.getByText('Pincode is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('validates a field when it loses focus and clears the message once fixed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Pincode'), '12');
    await user.tab();
    expect(screen.getByText('Pincode must be between 4 and 10 characters.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Pincode'), '34');
    expect(screen.queryByText('Pincode must be between 4 and 10 characters.')).not.toBeInTheDocument();
  });

  it('rejects an out-of-range age', async () => {
    renderPage();
    const user = await fillValidForm();
    await user.clear(screen.getByLabelText('Age'));
    await user.type(screen.getByLabelText('Age'), '101');

    await user.click(screen.getByRole('button', { name: 'Save user' }));

    expect(screen.getByText('Age must be between 0 and 100.')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the user, redirects to the list and shows a success toast', async () => {
    vi.mocked(createUser).mockResolvedValue({
      id: 1,
      name: 'Jane Doe',
      age: 30,
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    });
    renderPage();

    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Save user' }));

    expect(await screen.findByRole('heading', { name: 'User list page' })).toBeInTheDocument();
    expect(createUser).toHaveBeenCalledWith(
      { name: 'Jane Doe', age: 30, city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      'test-token',
    );
    expect(screen.getByRole('status')).toHaveTextContent('User "Jane Doe" was added successfully.');
  });

  it('shows server-side validation errors inline and stays on the page', async () => {
    vi.mocked(createUser).mockRejectedValue(
      new ApiError('Some of the values you entered are invalid.', 400, { pincode: 'Pincode is already taken.' }),
    );
    renderPage();

    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Save user' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the values you entered are invalid.');
    expect(screen.getByText('Pincode is already taken.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save user' })).toBeEnabled();
  });
});
