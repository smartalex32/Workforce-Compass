import type { AppDatabase } from '@/db';
import { getDb, runtimeEnv } from '@/db/runtime';
import { authorizeApiRequest } from '@/lib/api-auth';
import type { OfficeWorkspaceCommand } from '@/lib/office-workspace';
import {
  OfficeWorkspaceError,
  OfficeWorkspaceConflict,
  createOfficeOrganization,
  executeOfficeCommand,
  listOfficeOrganizations,
  loadOfficeWorkspace,
} from '@/lib/office-repository';
import {
  canEditPlanning,
  loadPlanningState,
  planningActor,
  planningRoleFor,
} from '@/lib/planning-repository';

function invalid(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
function validText(value: unknown, max = 160) {
  const valueText = text(value);
  return valueText.length > 0 && valueText.length <= max;
}
function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

async function response(
  db: AppDatabase,
  request: Request,
  organizationId?: string,
  entityId?: string,
) {
  const actor = planningActor(
    request,
    runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER,
  );
  const visibleOrganizations = (
    await Promise.all(
      (
        await listOfficeOrganizations(db)
      ).map(async (organization) => ({
        organization,
        role: planningRoleFor(
          await loadPlanningState(db, organization.id),
          actor,
        ),
      })),
    )
  ).flatMap(({ organization, role }) => (role ? [organization] : []));
  const selectedOrganizationId = organizationId || visibleOrganizations[0]?.id;
  if (!selectedOrganizationId)
    return Response.json({
      organizations: visibleOrganizations,
      workspace: null,
      ...(entityId ? { entityId } : {}),
    });
  const state = await loadPlanningState(db, selectedOrganizationId);
  const role = planningRoleFor(state, actor);
  if (!role)
    return Response.json(
      { error: 'This identity is not a workspace member.' },
      { status: 403 },
    );
  const workspace = await loadOfficeWorkspace(
    db,
    selectedOrganizationId,
    role,
  );
  if (!workspace)
    return Response.json(
      { error: 'The requested office workspace was not found.' },
      { status: 404 },
    );
  return Response.json({
    organizations: visibleOrganizations,
    workspace,
    ...(entityId ? { entityId } : {}),
  });
}

export async function GET(request: Request) {
  const unauthorized = authorizeApiRequest(request, runtimeEnv);
  if (unauthorized) return unauthorized;
  const organizationId = new URL(request.url).searchParams
    .get('organizationId')
    ?.trim();
  return response(await getDb(), request, organizationId || undefined);
}

function validate(input: unknown): input is OfficeWorkspaceCommand {
  if (!record(input) || typeof input.action !== 'string') return false;
  if (input.action === 'organization')
    return validText(input.name) && /^[A-Za-z]{3}$/.test(text(input.currency));
  if (!text(input.organizationId)) return false;
  if (
    input.revision !== undefined &&
    (typeof input.revision !== 'number' ||
      !Number.isSafeInteger(input.revision) ||
      input.revision < 0)
  )
    return false;
  if (input.action === 'office')
    return (
      validText(input.name) &&
      (input.id === undefined || validText(input.id)) &&
      (input.laborMarketId === null || validText(input.laborMarketId))
    );
  if (input.action === 'market') return validText(input.name);
  if (input.action === 'person')
    return (
      validText(input.name) &&
      validText(input.officeId) &&
      (input.id === undefined || validText(input.id)) &&
      (input.title === undefined ||
        (typeof input.title === 'string' && input.title.length <= 160)) &&
      (input.levelId === null || validText(input.levelId)) &&
      (input.salary === null ||
        (typeof input.salary === 'number' &&
          Number.isFinite(input.salary) &&
          input.salary > 0))
    );
  if (input.action === 'assign')
    return (
      Array.isArray(input.assignments) &&
      input.assignments.length <= 80 &&
      input.assignments.every(
        (item) =>
          record(item) && validText(item.personId) && validText(item.officeId),
      )
    );
  if (input.action === 'ladder')
    return (
      validText(input.name) &&
      (validText(input.disciplineId) || validText(input.disciplineName)) &&
      (input.template === 'engineering' || input.template === 'blank')
    );
  if (input.action === 'level')
    return Boolean(
      text(input.ladderId) &&
      (input.id === undefined || text(input.id)) &&
      text(input.code) &&
      text(input.name) &&
      typeof input.position === 'number' &&
      Number.isInteger(input.position) &&
      input.position > 0 &&
      (input.description === undefined ||
        typeof input.description === 'string'),
    );
  if (input.action === 'retire-level' || input.action === 'delete-level')
    return Boolean(text(input.id));
  if (input.action === 'publish-bands')
    return Boolean(
      (input.marketId === null || validText(input.marketId)) &&
      date(input.date) &&
      Array.isArray(input.rows) &&
      input.rows.length <= 80 &&
      input.rows.length &&
      input.rows.every(
        (row) =>
          record(row) &&
          validText(row.levelId) &&
          typeof row.min === 'number' &&
          Number.isFinite(row.min) &&
          row.min > 0 &&
          typeof row.max === 'number' &&
          Number.isFinite(row.max) &&
          row.max > 0 &&
          row.min <= row.max &&
          (row.mid === null ||
            (typeof row.mid === 'number' &&
              Number.isFinite(row.mid) &&
              row.mid >= row.min &&
              row.mid <= row.max)),
      ),
    );
  return (
    input.action === 'end-band-override' &&
    Boolean(text(input.marketId) && text(input.levelId) && date(input.date))
  );
}

export async function POST(request: Request) {
  const unauthorized = authorizeApiRequest(request, runtimeEnv);
  if (unauthorized) return unauthorized;
  const db = await getDb();
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return invalid('The request body must be valid JSON.');
  }
  if (!validate(input))
    return invalid('The office workspace command is invalid.');
  const actor = planningActor(
    request,
    runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER,
  );
  try {
    if (input.action === 'organization') {
      const organizationId = await createOfficeOrganization(
        db,
        input.name.trim(),
        input.currency.toUpperCase(),
        actor,
      );
      return response(db, request, organizationId, organizationId);
    }
    const planning = await loadPlanningState(db, input.organizationId);
    if (!canEditPlanning(planningRoleFor(planning, actor)))
      return Response.json(
        { error: 'Analyst or admin access is required.' },
        { status: 403 },
      );
    if (
      !(await loadOfficeWorkspace(
        db,
        input.organizationId,
        planningRoleFor(planning, actor)!,
      ))
    ) {
      return Response.json(
        { error: 'The requested office workspace was not found.' },
        { status: 404 },
      );
    }
    const entityId = await executeOfficeCommand(
      db,
      input.organizationId,
      input,
      actor,
      input.revision,
    );
    return response(db, request, input.organizationId, entityId);
  } catch (error) {
    if (error instanceof OfficeWorkspaceConflict) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OfficeWorkspaceError) return invalid(error.message);
    throw error;
  }
}
