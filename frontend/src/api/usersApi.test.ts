import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createUser, deleteUser, fetchCurrentUser, fetchUser, fetchUsers, updateUser } from './usersApi';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('usersApi', () => {
  const fetchMock = vi.fn<typeof fetch>();

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const stubFetch = () => vi.stubGlobal('fetch', fetchMock);

  it('fetchUsers sends the bearer token and returns users', async () => {
    stubFetch();
    const users = [{ id: 1, name: 'Jane', age: 30, city: 'Pune', state: 'MH', pincode: '411001' }];
    fetchMock.mockResolvedValue(jsonResponse(users));

    await expect(fetchUsers('abc')).resolves.toEqual(users);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer abc');
  });

  it('createUser POSTs JSON', async () => {
    stubFetch();
    const newUser = { name: 'Jane', age: 30, city: 'Pune', state: 'MH', pincode: '411001' };
    fetchMock.mockResolvedValue(jsonResponse({ id: 7, ...newUser }, 201));

    await expect(createUser(newUser, 'abc')).resolves.toEqual({ id: 7, ...newUser });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(newUser));
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('fetchCurrentUser GETs the signed-in user and roles', async () => {
    stubFetch();
    const me = { email: 'demo@gmail.com', roles: ['Admin'] };
    fetchMock.mockResolvedValue(jsonResponse(me));

    await expect(fetchCurrentUser('abc')).resolves.toEqual(me);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me');
  });

  it('fetchUser GETs a single user by id', async () => {
    stubFetch();
    const user = { id: 3, name: 'Jane', age: 30, city: 'Pune', state: 'MH', pincode: '411001' };
    fetchMock.mockResolvedValue(jsonResponse(user));

    await expect(fetchUser(3, 'abc')).resolves.toEqual(user);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/users/3');
  });

  it('updateUser PUTs JSON to the user url', async () => {
    stubFetch();
    const changes = { name: 'Jane', age: 31, city: 'Pune', state: 'MH', pincode: '411001' };
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, ...changes }));

    await expect(updateUser(3, changes, 'abc')).resolves.toEqual({ id: 3, ...changes });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/3');
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(JSON.stringify(changes));
  });

  it('deleteUser sends DELETE and handles 204 No Content', async () => {
    stubFetch();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteUser(3, 'abc')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/3');
    expect(init?.method).toBe('DELETE');
  });

  it('maps ASP.NET validation problems to camelCase field errors', async () => {
    stubFetch();
    fetchMock.mockResolvedValue(
      jsonResponse({ title: 'One or more validation errors occurred.', errors: { Name: ['Too short'], Pincode: ['Bad'] } }, 400),
    );

    const error = await createUser({ name: 'J', age: 1, city: 'c', state: 's', pincode: 'x' }, 't').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual({ name: 'Too short', pincode: 'Bad' });
  });

  it.each([
    [401, 'Your session has expired. Please sign in again.'],
    [403, 'You are not allowed to perform this action.'],
    [500, 'The server returned an unexpected error (500). Please try again.'],
  ])('throws a friendly message for HTTP %i', async (status, message) => {
    stubFetch();
    fetchMock.mockResolvedValue(new Response(null, { status }));

    await expect(fetchUsers('t')).rejects.toMatchObject({ status, message });
  });

  it('throws a friendly message when the network fails', async () => {
    stubFetch();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchUsers('t')).rejects.toMatchObject({
      status: 0,
      message: 'Unable to reach the server. Check your connection and try again.',
    });
  });
});
