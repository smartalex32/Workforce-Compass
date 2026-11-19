import { getDb, runtimeEnv } from '@/db/runtime';
import { authorizeApiRequest } from '@/lib/api-auth';
import {
  canEditPlanning,
  isPlanningState,
  loadPlanningHistory,
  loadPlanningState,
  organizationExists,
  planningActor,
  planningRoleFor,
  savePlanningState,
} from '@/lib/planning-repository';

const actor = (request: Request) =>
  planningActor(request, runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER);

export async function GET(request: Request) {
  const unauthorized = authorizeApiRequest(request, runtimeEnv);
  if (unauthorized) return unauthorized;
  const db = await getDb();
  const organizationId = new URL(request.url).searchParams
    .get('organizationId')
    ?.trim();
  if (!organizationId)
    return Response.json(
      { error: 'organizationId is required.' },
      { status: 400 },
    );
  if (!(await organizationExists(db, organizationId)))
    return Response.json(
      { error: 'The organization was not found.' },
      { status: 404 },
    );
  const state = await loadPlanningState(db, organizationId);
  const role = planningRoleFor(state, actor(request));
  if (!role)
    return Response.json(
      { error: 'This identity is not a planning workspace member.' },
      { status: 403 },
    );
  return Response.json({
    state,
    role,
    history: await loadPlanningHistory(db, organizationId),
  });
}

export async function PUT(request: Request) {
  const unauthorized = authorizeApiRequest(request, runtimeEnv);
  if (unauthorized) return unauthorized;
  const db = await getDb();
  let input: { organizationId?: string; state?: unknown };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    return Response.json(
      { error: 'The request body must be valid JSON.' },
      { status: 400 },
    );
  }
  if (!input.organizationId?.trim() || !isPlanningState(input.state))
    return Response.json(
      { error: 'A valid organizationId and planning state are required.' },
      { status: 400 },
    );
  if (!(await organizationExists(db, input.organizationId)))
    return Response.json(
      { error: 'The organization was not found.' },
      { status: 404 },
    );
  const current = await loadPlanningState(db, input.organizationId);
  const role = planningRoleFor(current, actor(request));
  if (!canEditPlanning(role))
    return Response.json(
      { error: 'Analyst or admin access is required.' },
      { status: 403 },
    );
  if (
    role !== 'admin' &&
    JSON.stringify(current.members) !== JSON.stringify(input.state.members)
  )
    return Response.json(
      { error: 'Only admins can change workspace roles.' },
      { status: 403 },
    );
  const now = new Date().toISOString();
  await savePlanningState(
    db,
    input.organizationId,
    input.state,
    actor(request),
    now,
  );
  return Response.json({ state: input.state, savedAt: now });
}
