import { config } from '../config';
import type { CurrentUser, NewUser, User } from '../types/user';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Field-level validation errors from the API, keyed by camelCase field name. */
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ValidationProblem {
  title?: string;
  errors?: Record<string, string[]>;
}

const camelCase = (key: string) => key.charAt(0).toLowerCase() + key.slice(1);

function messageForStatus(status: number): string {
  if (status === 400) return 'Some of the values you entered are invalid.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You are not allowed to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  return `The server returned an unexpected error (${status}). Please try again.`;
}

async function request<T>(path: string, token: string | null | undefined, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
  }

  if (!response.ok) {
    let fieldErrors: Record<string, string> = {};
    if (response.status === 400) {
      const problem = (await response.json().catch(() => ({}))) as ValidationProblem;
      fieldErrors = Object.fromEntries(
        Object.entries(problem.errors ?? {}).map(([key, messages]) => [camelCase(key), messages[0]]),
      );
    }
    throw new ApiError(messageForStatus(response.status), response.status, fieldErrors);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchUsers(token: string | null | undefined, signal?: AbortSignal): Promise<User[]> {
  return request<User[]>('/api/users', token, { signal });
}

export function createUser(user: NewUser, token: string | null | undefined): Promise<User> {
  return request<User>('/api/users', token, { method: 'POST', body: JSON.stringify(user) });
}

/** The signed-in user's roles, as assigned by the API. */
export function fetchCurrentUser(token: string | null | undefined, signal?: AbortSignal): Promise<CurrentUser> {
  return request<CurrentUser>('/api/me', token, { signal });
}

export function fetchUser(id: number, token: string | null | undefined, signal?: AbortSignal): Promise<User> {
  return request<User>(`/api/users/${id}`, token, { signal });
}

export function updateUser(id: number, user: NewUser, token: string | null | undefined): Promise<User> {
  return request<User>(`/api/users/${id}`, token, { method: 'PUT', body: JSON.stringify(user) });
}

export function deleteUser(id: number, token: string | null | undefined): Promise<void> {
  return request<void>(`/api/users/${id}`, token, { method: 'DELETE' });
}
