import { env } from 'cloudflare:workers';
import { listWorkspaceContexts } from '@/lib/workspace-repository';
import { authorizeApiRequest } from '@/lib/api-auth';

export async function GET(request: Request) {
  const unauthorized = authorizeApiRequest(request, env);
  if (unauthorized) return unauthorized;
  const organizationId =
    new URL(request.url).searchParams.get('organizationId')?.trim() || undefined;
  const contexts = await listWorkspaceContexts(env.DB, organizationId);
  return Response.json({ contexts });
}
