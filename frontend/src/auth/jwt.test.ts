import { describe, expect, it } from 'vitest';
import { fakeIdToken } from '../test/mockAuth';
import { decodeJwtPayload } from './jwt';

describe('decodeJwtPayload', () => {
  it('decodes base64url-encoded claims', () => {
    expect(decodeJwtPayload(fakeIdToken({ email: 'a+b/c@gmail.com' }))).toMatchObject({ email: 'a+b/c@gmail.com' });
  });

  it.each(['', 'abc', 'a.b', 'a.!!!.c', `x.${btoa('"just a string"')}.y`])('returns null for "%s"', (token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });
});
