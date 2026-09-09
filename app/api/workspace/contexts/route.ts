import { env } from 'cloudflare:workers';
import { listWorkspaceContexts } from '@/lib/workspace-repository';
import { authorizeApiRequest } from '@/lib/api-auth';
import { loadPlanningState, planningActor, planningRoleFor } from '@/lib/planning-repository';

export async function GET(request: Request) {
  const unauthorized = authorizeApiRequest(request, env);
  if (unauthorized) return unauthorized;
  const organizationId =
    new URL(request.url).searchParams.get('organizationId')?.trim() || undefined;
  const contexts = await listWorkspaceContexts(env.DB, organizationId);
  const actor = planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER);
  const allowedOrganizationIds = new Set((await Promise.all(contexts.organizations.map(async (organization) => ({
    id: organization.id,
    role: planningRoleFor(await loadPlanningState(env.DB, organization.id), actor),
  })))).filter((entry) => entry.role).map((entry) => entry.id));
  const disciplines = contexts.disciplines.filter((discipline) => allowedOrganizationIds.has(discipline.organizationId));
  const disciplineIds = new Set(disciplines.map((discipline) => discipline.id));
  const ladders = contexts.ladders.filter((ladder) => disciplineIds.has(ladder.disciplineId));
  const ladderIds = new Set(ladders.map((ladder) => ladder.id));
  const laborMarkets = contexts.laborMarkets.filter((market) => allowedOrganizationIds.has(market.organizationId));
  const laborMarketIds = new Set(laborMarkets.map((market) => market.id));
  return Response.json({ contexts: {
    organizations: contexts.organizations.filter((organization) => allowedOrganizationIds.has(organization.id)),
    laborMarkets,
    disciplines,
    ladders,
    levels: contexts.levels.filter((level) => ladderIds.has(level.careerLadderId)),
    datasets: contexts.datasets.filter((dataset) => laborMarketIds.has(dataset.laborMarketId)),
  } });
}
