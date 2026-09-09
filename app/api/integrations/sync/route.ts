import { env } from 'cloudflare:workers';
import { authorizeApiRequest } from '@/lib/api-auth';
import {
  importEmployeesCsv,
  importMarketCsv,
  mergeHrisEmployees,
} from '@/lib/workforce-planning';
import {
  loadWorkspace,
  saveWorkspace,
  type WorkspaceSelection,
} from '@/lib/workspace-repository';
import {
  canEditPlanning,
  loadPlanningState,
  planningActor,
  planningRoleFor,
  savePlanningState,
} from '@/lib/planning-repository';

export async function POST(request: Request) {
  const unauthorized = authorizeApiRequest(request, env);
  if (unauthorized) return unauthorized;
  let input: {
    kind?: 'hris' | 'survey';
    csv?: string;
    selection?: WorkspaceSelection;
  };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    return Response.json(
      { error: 'The request body must be valid JSON.' },
      { status: 400 },
    );
  }
  if (
    (input.kind !== 'hris' && input.kind !== 'survey') ||
    typeof input.csv !== 'string'
  )
    return Response.json(
      { error: 'kind and csv are required.' },
      { status: 400 },
    );
  const workspace = await loadWorkspace(env.DB, input.selection ?? {});
  if (!workspace)
    return Response.json(
      { error: 'The workspace was not found.' },
      { status: 404 },
    );
  const planning = await loadPlanningState(env.DB, workspace.organization.id);
  const role = planningRoleFor(
    planning,
    planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER),
  );
  if (!canEditPlanning(role))
    return Response.json(
      { error: 'Analyst or admin access is required.' },
      { status: 403 },
    );
  const result =
    input.kind === 'hris'
      ? importEmployeesCsv(input.csv, workspace)
      : importMarketCsv(input.csv, workspace);
  if (result.errors.length)
    return Response.json(
      { error: 'Import validation failed.', details: result.errors },
      { status: 422 },
    );
  const updated =
    input.kind === 'hris'
      ? {
          ...workspace,
          employees: mergeHrisEmployees(
            workspace,
            result.records as typeof workspace.employees,
          ),
        }
      : { ...workspace, market: result.records as typeof workspace.market };
  const now = new Date().toISOString();
  const actor = planningActor(
    request,
    env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER,
  );
  await saveWorkspace(env.DB, updated, now, actor);
  const integrationId = `${input.kind}-csv-sync`;
  await savePlanningState(
    env.DB,
    workspace.organization.id,
    {
      ...planning,
      integrations: [
        ...planning.integrations.filter(
          (integration) => integration.id !== integrationId,
        ),
        {
          id: integrationId,
          kind: input.kind,
          name:
            input.kind === 'hris'
              ? 'HRIS CSV/API sync'
              : 'Compensation survey CSV/API sync',
          enabled: true,
          lastSyncedAt: now,
        },
      ],
    },
    actor,
    now,
  );
  return Response.json({
    workspace: updated,
    imported: result.records.length,
    syncedAt: now,
  });
}
