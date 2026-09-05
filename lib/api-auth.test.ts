import { describe, expect, it } from 'vitest';
import { authorizeApiRequest } from './api-auth';

describe('API authentication boundary', () => {
  const request = (headers?: HeadersInit) => new Request('https://workforce.test/api/workspace', { headers });

  it('accepts Sites identity, trusted proxy identity, and matching bearer credentials', () => {
    expect(authorizeApiRequest(request({ 'oai-authenticated-user-id': 'user-1' }), {
      WORKFORCE_COMPASS_TRUST_SITES_IDENTITY: 'true',
    })).toBeNull();
    expect(authorizeApiRequest(request({ 'x-forwarded-user': 'manager@example.com' }), {
      WORKFORCE_COMPASS_TRUSTED_USER_HEADER: 'x-forwarded-user',
    })).toBeNull();
    expect(authorizeApiRequest(request({ authorization: 'Bearer secret-value' }), {
      WORKFORCE_COMPASS_AUTH_TOKEN: 'secret-value',
    })).toBeNull();
  });

  it('rejects missing and incorrect credentials unless local access is explicitly enabled', () => {
    expect(authorizeApiRequest(request(), {})?.status).toBe(401);
    expect(authorizeApiRequest(request({ 'oai-authenticated-user-id': 'spoofed-user' }), {})?.status).toBe(401);
    expect(authorizeApiRequest(request({ authorization: 'Bearer wrong-value' }), {
      WORKFORCE_COMPASS_AUTH_TOKEN: 'secret-value',
    })?.status).toBe(401);
    expect(authorizeApiRequest(request(), {
      WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL: 'true',
    })).toBeNull();
  });
});
