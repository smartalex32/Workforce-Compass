type AuthEnvironment = {
  WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL?: string;
  WORKFORCE_COMPASS_AUTH_TOKEN?: string;
  WORKFORCE_COMPASS_TRUST_SITES_IDENTITY?: string;
  WORKFORCE_COMPASS_TRUSTED_USER_HEADER?: string;
};

function tokensMatch(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Protects compensation APIs without coupling the domain layer to one identity
 * provider. Private Sites requests carry an OpenAI identity header. Self-hosted
 * deployments can require a bearer token or a user header injected by a trusted
 * authentication proxy. Unauthenticated access must be opted into explicitly
 * for local development and automated tests.
 */
export function authorizeApiRequest(
  request: Request,
  runtimeEnv: AuthEnvironment,
): Response | null {
  if (runtimeEnv.WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL === 'true') return null;

  if (
    runtimeEnv.WORKFORCE_COMPASS_TRUST_SITES_IDENTITY === 'true' &&
    request.headers.get('oai-authenticated-user-id')?.trim()
  ) {
    return null;
  }

  const trustedHeader = runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER?.trim();
  if (trustedHeader && request.headers.get(trustedHeader)?.trim()) return null;

  const expectedToken = runtimeEnv.WORKFORCE_COMPASS_AUTH_TOKEN;
  const authorization = request.headers.get('authorization');
  if (
    expectedToken &&
    authorization?.startsWith('Bearer ') &&
    tokensMatch(authorization.slice('Bearer '.length), expectedToken)
  ) {
    return null;
  }

  return Response.json(
    { error: 'Authentication is required.' },
    {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
