import type { PlanningRole, PlanningState } from './workforce-planning';

type D1Row = Record<string, string | number | null>;

export type PlanningHistory = {
  snapshots: Array<{ id: string; capturedAt: string; employees: unknown[] }>;
  salaryChanges: Array<{
    employeeId: string;
    previousSalary: number;
    newSalary: number;
    effectiveAt: string;
  }>;
  auditEvents: Array<{
    id: string;
    actor: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
};

export const emptyPlanningState: PlanningState = {
  version: 1,
  members: [],
  scenarios: [],
  hiringHistory: [],
  productivityCurves: [],
  geographicDifferentials: [],
  integrations: [],
};

export function planningRoleFor(
  state: PlanningState,
  email: string | null,
): PlanningRole | null {
  if (!state.members.length) return 'admin';
  if (!email) return null;
  return (
    state.members.find(
      (member) => member.email.toLowerCase() === email.toLowerCase(),
    )?.role ?? null
  );
}

export function planningActor(request: Request, configuredHeader?: string) {
  return (
    request.headers
      .get(configuredHeader?.trim() || 'cf-access-authenticated-user-email')
      ?.trim() ||
    request.headers.get('oai-authenticated-user-id')?.trim() ||
    'authenticated-user'
  );
}

export function canEditPlanning(role: PlanningRole | null) {
  return role === 'admin' || role === 'analyst';
}

export function isPlanningState(value: unknown): value is PlanningState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (
    state.version !== 1 ||
    !Array.isArray(state.members) ||
    !Array.isArray(state.scenarios) ||
    !Array.isArray(state.hiringHistory) ||
    !Array.isArray(state.productivityCurves) ||
    !Array.isArray(state.geographicDifferentials) ||
    !Array.isArray(state.integrations)
  )
    return false;
  const memberEmails = state.members.flatMap((member) =>
    member &&
    typeof member === 'object' &&
    typeof (member as Record<string, unknown>).email === 'string'
      ? [String((member as Record<string, unknown>).email).toLowerCase()]
      : [],
  );
  const scenarioIds = state.scenarios.flatMap((scenario) =>
    scenario &&
    typeof scenario === 'object' &&
    typeof (scenario as Record<string, unknown>).id === 'string'
      ? [String((scenario as Record<string, unknown>).id)]
      : [],
  );
  const integrationIds = state.integrations.flatMap((integration) =>
    integration &&
    typeof integration === 'object' &&
    typeof (integration as Record<string, unknown>).id === 'string'
      ? [String((integration as Record<string, unknown>).id)]
      : [],
  );
  if (
    new Set(memberEmails).size !== state.members.length ||
    (state.members.length > 0 &&
      !state.members.some(
        (member) =>
          member &&
          typeof member === 'object' &&
          (member as Record<string, unknown>).role === 'admin',
      )) ||
    new Set(scenarioIds).size !== state.scenarios.length ||
    new Set(integrationIds).size !== state.integrations.length
  )
    return false;
  return (
    state.members.every((member) => {
      if (!member || typeof member !== 'object') return false;
      const item = member as Record<string, unknown>;
      return (
        typeof item.email === 'string' &&
        item.email.trim().length > 0 &&
        ['viewer', 'analyst', 'admin'].includes(String(item.role))
      );
    }) &&
    state.scenarios.every((scenario) => {
      if (!scenario || typeof scenario !== 'object') return false;
      const item = scenario as Record<string, unknown>;
      return (
        typeof item.id === 'string' &&
        item.id.trim().length > 0 &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        typeof item.budget === 'number' &&
        Number.isFinite(item.budget) &&
        item.budget >= 0 &&
        Array.isArray(item.changes) &&
        item.changes.every((change) => {
          if (!change || typeof change !== 'object') return false;
          const candidate = change as Record<string, unknown>;
          return (
            typeof candidate.employeeId === 'string' &&
            typeof candidate.proposedSalary === 'number' &&
            Number.isFinite(candidate.proposedSalary) &&
            candidate.proposedSalary > 0
          );
        })
      );
    }) &&
    state.hiringHistory.every((observation) => {
      if (!observation || typeof observation !== 'object') return false;
      const item = observation as Record<string, unknown>;
      return (
        typeof item.levelId === 'string' &&
        typeof item.openedAt === 'string' &&
        typeof item.filledAt === 'string'
      );
    }) &&
    state.productivityCurves.every((curve) => {
      if (!curve || typeof curve !== 'object') return false;
      const item = curve as Record<string, unknown>;
      return (
        typeof item.levelId === 'string' &&
        Array.isArray(item.points) &&
        item.points.every((point) => {
          if (!point || typeof point !== 'object') return false;
          const candidate = point as Record<string, unknown>;
          return (
            typeof candidate.day === 'number' &&
            candidate.day >= 0 &&
            typeof candidate.productivity === 'number' &&
            candidate.productivity >= 0 &&
            candidate.productivity <= 1
          );
        })
      );
    }) &&
    state.geographicDifferentials.every((differential) => {
      if (!differential || typeof differential !== 'object') return false;
      const item = differential as Record<string, unknown>;
      return (
        typeof item.location === 'string' &&
        typeof item.factor === 'number' &&
        Number.isFinite(item.factor) &&
        item.factor > 0
      );
    }) &&
    state.integrations.every((integration) => {
      if (!integration || typeof integration !== 'object') return false;
      const item = integration as Record<string, unknown>;
      return (
        typeof item.id === 'string' &&
        item.id.trim().length > 0 &&
        (item.kind === 'hris' || item.kind === 'survey') &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        typeof item.enabled === 'boolean' &&
        (item.lastSyncedAt === undefined ||
          typeof item.lastSyncedAt === 'string')
      );
    })
  );
}

export async function organizationExists(
  db: D1Database,
  organizationId: string,
) {
  return Boolean(
    await db
      .prepare('SELECT id FROM organizations WHERE id = ?')
      .bind(organizationId)
      .first<D1Row>(),
  );
}

export async function loadPlanningState(
  db: D1Database,
  organizationId: string,
): Promise<PlanningState> {
  const row = await db
    .prepare(
      'SELECT state_json FROM planning_profiles WHERE organization_id = ?',
    )
    .bind(organizationId)
    .first<D1Row>();
  if (!row) return structuredClone(emptyPlanningState);
  try {
    const state = JSON.parse(String(row.state_json));
    if (!isPlanningState(state)) throw new Error('Stored planning profile is invalid.');
    return state;
  } catch (error) {
    throw new Error('Stored planning profile is invalid.', { cause: error });
  }
}

export async function savePlanningState(
  db: D1Database,
  organizationId: string,
  state: PlanningState,
  actor: string,
  now = new Date().toISOString(),
) {
  await db.batch([
    db
      .prepare(`INSERT INTO planning_profiles (organization_id, version, state_json, updated_at) VALUES (?, 1, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET version = 1, state_json = excluded.state_json, updated_at = excluded.updated_at`)
      .bind(organizationId, JSON.stringify(state), now),
    db
      .prepare(
        'INSERT INTO audit_events (id, organization_id, actor, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        organizationId,
        actor,
        'planning.updated',
        'organization',
        organizationId,
        JSON.stringify({
          scenarioCount: state.scenarios.length,
          integrationCount: state.integrations.length,
        }),
        now,
      ),
  ]);
}

export async function loadPlanningHistory(
  db: D1Database,
  organizationId: string,
): Promise<PlanningHistory> {
  const [snapshots, salaryChanges, auditEvents] = await Promise.all([
    db
      .prepare(
        'SELECT id, captured_at, data_json FROM compensation_snapshots WHERE organization_id = ? ORDER BY captured_at DESC LIMIT 24',
      )
      .bind(organizationId)
      .all<D1Row>(),
    db
      .prepare(`SELECT h.employee_id, h.previous_salary, h.new_salary, h.effective_at FROM salary_history h
      JOIN employees e ON e.id = h.employee_id WHERE e.organization_id = ? ORDER BY h.effective_at DESC LIMIT 100`)
      .bind(organizationId)
      .all<D1Row>(),
    db
      .prepare(
        'SELECT id, actor, action, entity_type, entity_id, metadata_json, created_at FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100',
      )
      .bind(organizationId)
      .all<D1Row>(),
  ]);
  return {
    snapshots: snapshots.results.map((row) => ({
      id: String(row.id),
      capturedAt: String(row.captured_at),
      employees: JSON.parse(String(row.data_json)) as unknown[],
    })),
    salaryChanges: salaryChanges.results.map((row) => ({
      employeeId: String(row.employee_id),
      previousSalary: Number(row.previous_salary),
      newSalary: Number(row.new_salary),
      effectiveAt: String(row.effective_at),
    })),
    auditEvents: auditEvents.results.map((row) => ({
      id: String(row.id),
      actor: String(row.actor),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: row.entity_id ? String(row.entity_id) : undefined,
      metadata: JSON.parse(String(row.metadata_json)) as Record<
        string,
        unknown
      >,
      createdAt: String(row.created_at),
    })),
  };
}
