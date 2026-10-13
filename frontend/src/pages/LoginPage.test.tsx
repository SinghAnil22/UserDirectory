import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { loadGoogleIdentity, type GoogleIdConfiguration } from '../auth/googleIdentity';
import { config } from '../config';
import { mockAuth } from '../test/mockAuth';
import { LoginPage } from './LoginPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../auth/googleIdentity', () => ({ loadGoogleIdentity: vi.fn() }));
vi.mock('../config', () => ({ config: { apiBaseUrl: '', googleClientId: 'test-client-id' } }));

const renderLogin = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/users" element={<h1>List</h1>} />
        <Route path="/users/new" element={<h1>Add</h1>} />
      </Routes>
    </MemoryRouter>,
  );

/** A fake `google` global that records how the page set up Google Identity Services. */
function fakeGoogle() {
  const google = {
    initConfig: undefined as GoogleIdConfiguration | undefined,
    accounts: {
      id: {
        initialize: vi.fn((cfg: GoogleIdConfiguration) => {
          google.initConfig = cfg;
        }),
        renderButton: vi.fn(),
        disableAutoSelect: vi.fn(),
      },
    },
  };
  vi.mocked(loadGoogleIdentity).mockResolvedValue(google);
  return google;
}

describe('LoginPage', () => {
  beforeEach(() => {
    config.googleClientId = 'test-client-id';
    vi.mocked(useAuth).mockReturnValue(mockAuth({ isAuthenticated: false, user: null, token: null }));
  });

  afterEach(() => vi.mocked(loadGoogleIdentity).mockReset());

  it('renders the Google sign-in button with the configured client id', async () => {
    const google = fakeGoogle();

    renderLogin();

    await waitFor(() => expect(google.accounts.id.renderButton).toHaveBeenCalled());
    expect(google.initConfig?.client_id).toBe('test-client-id');
    expect(google.accounts.id.renderButton.mock.calls[0][0]).toBe(screen.getByTestId('google-signin-button'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('signs in with the credential returned by Google', async () => {
    const auth = mockAuth({ isAuthenticated: false, user: null, token: null });
    vi.mocked(useAuth).mockReturnValue(auth);
    const google = fakeGoogle();

    renderLogin();
    await waitFor(() => expect(google.initConfig).toBeDefined());
    google.initConfig!.callback({ credential: 'google-id-token' });

    expect(auth.signIn).toHaveBeenCalledWith('google-id-token');
  });

  it('shows an error when the Google credential is rejected', async () => {
    const auth = mockAuth({
      isAuthenticated: false,
      user: null,
      token: null,
      signIn: vi.fn(() => {
        throw new Error('The sign-in token is invalid or has expired.');
      }),
    });
    vi.mocked(useAuth).mockReturnValue(auth);
    const google = fakeGoogle();

    renderLogin();
    await waitFor(() => expect(google.initConfig).toBeDefined());
    google.initConfig!.callback({ credential: 'bad' });

    expect(await screen.findByRole('alert')).toHaveTextContent('The sign-in token is invalid or has expired.');
  });

  it('shows an error when the Google script cannot be loaded', async () => {
    vi.mocked(loadGoogleIdentity).mockRejectedValue(new Error('offline'));

    renderLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load Google Sign-In');
  });

  it('explains how to configure the client id when it is missing', async () => {
    config.googleClientId = '';

    renderLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent('VITE_GOOGLE_CLIENT_ID');
    expect(loadGoogleIdentity).not.toHaveBeenCalled();
  });

  it('redirects signed-in users to the page they originally requested', () => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());

    renderLogin({ from: '/users/new' });

    expect(screen.getByRole('heading', { name: 'Add' })).toBeInTheDocument();
  });
});
