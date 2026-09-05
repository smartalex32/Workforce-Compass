import { env } from 'cloudflare:workers';
import { listWorkspaceContexts } from '@/lib/workspace-repository';

export async function GET(request: Request) {
  const organizationId =
    new URL(request.url).searchParams.get('organizationId')?.trim() || undefined;
  const contexts = await listWorkspaceContexts(env.DB, organizationId);
  return Response.json({ contexts });
}
