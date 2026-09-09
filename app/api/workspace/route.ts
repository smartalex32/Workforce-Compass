import { env } from 'cloudflare:workers';
import type { Workspace } from '@/lib/domain';
import { validateMarketPoint } from '@/lib/domain';
import { authorizeApiRequest } from '@/lib/api-auth';
import { canEditPlanning, loadPlanningState, planningActor, planningRoleFor } from '@/lib/planning-repository';
import {
  loadWorkspace,
  saveWorkspace,
  WorkspaceConflictError,
  type WorkspaceSelection,
} from '@/lib/workspace-repository';

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isOptionalNumber(value: unknown) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasManagerCycle(employees: Workspace['employees']) {
  const managerByEmployee = new Map(employees.map((employee) => [employee.id, employee.managerId]));
  return employees.some((employee) => {
    const visited = new Set<string>();
    let current: string | undefined = employee.id;
    while (current && managerByEmployee.has(current)) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = managerByEmployee.get(current);
    }
    return false;
  });
}

function hasWorkspaceShape(value: unknown): value is Workspace {
  if (!isRecord(value)) return false;
  const { organization, laborMarket, discipline, ladder, dataset } = value;
  const levels = value.levels;
  const market = value.market;
  const employees = value.employees;
  const assumptions = value.assumptions;

  const namedEntity = (
    entity: unknown,
  ): entity is Record<string, unknown> & { id: string; name: string } =>
    isRecord(entity) &&
    typeof entity.id === 'string' &&
    typeof entity.name === 'string' &&
    isOptionalString(entity.description);

  return Boolean(
    namedEntity(organization) &&
      typeof organization.currency === 'string' &&
      namedEntity(laborMarket) &&
      namedEntity(discipline) &&
      namedEntity(ladder) &&
      namedEntity(dataset) &&
      isOptionalString(dataset.source) &&
      isOptionalString(dataset.effectiveDate) &&
      typeof dataset.active === 'boolean' &&
      Array.isArray(levels) &&
      levels.every(
        (level) =>
          isRecord(level) &&
          typeof level.id === 'string' &&
          typeof level.name === 'string' &&
          typeof level.order === 'number' &&
          Number.isFinite(level.order) &&
          isOptionalString(level.description),
      ) &&
      Array.isArray(market) &&
      market.every(
        (point) =>
          isRecord(point) &&
          typeof point.levelId === 'string' &&
          typeof point.p25 === 'number' &&
          typeof point.p50 === 'number' &&
          typeof point.p75 === 'number' &&
          Number.isFinite(point.p25) &&
          Number.isFinite(point.p50) &&
          Number.isFinite(point.p75),
      ) &&
      Array.isArray(employees) &&
      employees.every(
        (employee) =>
          isRecord(employee) &&
          typeof employee.id === 'string' &&
          typeof employee.name === 'string' &&
          typeof employee.disciplineId === 'string' &&
          typeof employee.careerLadderId === 'string' &&
          typeof employee.levelId === 'string' &&
          typeof employee.salary === 'number' &&
          Number.isFinite(employee.salary) &&
          isOptionalString(employee.employeeNumber) &&
          isOptionalString(employee.title) &&
          isOptionalNumber(employee.annualBonus) &&
          isOptionalNumber(employee.annualEquity) &&
          isOptionalNumber(employee.annualBenefits) &&
          isOptionalString(employee.location) &&
          isOptionalString(employee.startDate) &&
          isOptionalString(employee.team) &&
          isOptionalString(employee.managerId) &&
          isOptionalNumber(employee.performanceRating) &&
          isOptionalString(employee.notes),
      ) &&
      Array.isArray(assumptions) &&
      assumptions.every(
        (assumption) =>
          isRecord(assumption) &&
          typeof assumption.levelId === 'string' &&
          isNullableNumber(assumption.timeToHireDays) &&
          isNullableNumber(assumption.rampDays) &&
          isNullableNumber(assumption.vacancyMultiplier) &&
          isNullableNumber(assumption.rampLossFactor) &&
          isNullableNumber(assumption.recruitingCost) &&
          isNullableNumber(assumption.interviewCost) &&
          isNullableNumber(assumption.signingCost) &&
          isNullableNumber(assumption.otherCost),
      ),
  );
}

export async function GET(request: Request) {
  const unauthorized = authorizeApiRequest(request, env);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const selection: WorkspaceSelection = {};
  const parameterMap: Array<[keyof WorkspaceSelection, string]> = [
    ['organizationId', 'organizationId'],
    ['laborMarketId', 'laborMarketId'],
    ['disciplineId', 'disciplineId'],
    ['ladderId', 'ladderId'],
    ['datasetId', 'datasetId'],
  ];
  for (const [key, parameter] of parameterMap) {
    const value = url.searchParams.get(parameter)?.trim();
    if (value) selection[key] = value;
  }

  const workspace = await loadWorkspace(env.DB, selection);
  if (!workspace && Object.keys(selection).length) {
    return Response.json(
      { error: 'The requested workspace context was not found.' },
      { status: 404 },
    );
  }
  if (workspace) {
    const planning = await loadPlanningState(env.DB, workspace.organization.id);
    if (!planningRoleFor(planning, planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER))) {
      return Response.json({ error: 'This identity is not a workspace member.' }, { status: 403 });
    }
  }
  return Response.json({ workspace });
}

export async function PUT(request: Request) {
  const unauthorized = authorizeApiRequest(request, env);
  if (unauthorized) return unauthorized;
  let input: { workspace?: Workspace };
  try {
    input = (await request.json()) as { workspace?: Workspace };
  } catch {
    return badRequest('The request body must be valid JSON.');
  }
  const workspace = input.workspace;
  if (!hasWorkspaceShape(workspace)) return badRequest('A complete workspace is required.');
  const planning = await loadPlanningState(env.DB, workspace.organization.id);
  if (!canEditPlanning(planningRoleFor(planning, planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER)))) {
    return Response.json({ error: 'Analyst or admin access is required.' }, { status: 403 });
  }
  const requiredEntities = [
    workspace.organization,
    workspace.laborMarket,
    workspace.discipline,
    workspace.ladder,
    workspace.dataset,
  ];
  if (requiredEntities.some((entity) => !entity.id.trim() || !entity.name.trim())) {
    return badRequest('Organization, market, discipline, ladder, and dataset IDs and names are required.');
  }
  if (!/^[A-Z]{3}$/.test(workspace.organization.currency)) return badRequest('Currency must be a three-letter code.');
  if (!workspace.levels.length) return badRequest('At least one level is required.');
  const levelIds = new Set(workspace.levels.map((level) => level.id));
  const levelOrders = new Set(workspace.levels.map((level) => level.order));
  if (
    levelIds.size !== workspace.levels.length ||
    levelOrders.size !== workspace.levels.length ||
    workspace.levels.some(
      (level) =>
        !level.id ||
        !level.name.trim() ||
        !Number.isFinite(level.order),
    )
  ) {
    return badRequest('Levels must have unique IDs and ordering values.');
  }
  const marketLevelIds = new Set(workspace.market.map((point) => point.levelId));
  if (
    marketLevelIds.size !== workspace.market.length ||
    workspace.market.some(
      (point) => !levelIds.has(point.levelId) || !validateMarketPoint(point),
    )
  ) {
    return badRequest('Each market row must satisfy P25 ≤ P50 ≤ P75.');
  }
  if (workspace.employees.some((employee) => !employee.id.trim() || !employee.name.trim() || employee.disciplineId !== workspace.discipline.id || employee.careerLadderId !== workspace.ladder.id || !Number.isFinite(employee.salary) || employee.salary <= 0 || !workspace.levels.some((level) => level.id === employee.levelId))) {
    return badRequest('Each employee needs a name, positive salary, and valid level.');
  }
  if (workspace.employees.some((employee) =>
    [employee.annualBonus, employee.annualEquity, employee.annualBenefits].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0)) ||
    (employee.performanceRating !== undefined && (!Number.isFinite(employee.performanceRating) || employee.performanceRating < 0 || employee.performanceRating > 5)) ||
    (employee.startDate !== undefined && !isIsoDate(employee.startDate)) ||
    employee.managerId === employee.id
  )) {
    return badRequest('Employee planning fields must use non-negative compensation, a 0–5 performance rating, a valid start date, and a different manager.');
  }
  if (new Set(workspace.employees.map((employee) => employee.id)).size !== workspace.employees.length) {
    return badRequest('Employee IDs must be unique.');
  }
  if (hasManagerCycle(workspace.employees)) return badRequest('Employee manager relationships cannot contain a cycle.');
  const employeeNumbers = workspace.employees.flatMap((employee) => employee.employeeNumber ? [employee.employeeNumber] : []);
  if (new Set(employeeNumbers).size !== employeeNumbers.length) return badRequest('Employee numbers must be unique when provided.');
  const assumptionValues = workspace.assumptions.flatMap((assumption) => [
    assumption.timeToHireDays, assumption.rampDays, assumption.vacancyMultiplier,
    assumption.rampLossFactor, assumption.recruitingCost, assumption.interviewCost,
    assumption.signingCost, assumption.otherCost,
  ]);
  const assumptionLevelIds = new Set(
    workspace.assumptions.map((assumption) => assumption.levelId),
  );
  if (
    assumptionLevelIds.size !== workspace.assumptions.length ||
    workspace.assumptions.some(
      (assumption) => !levelIds.has(assumption.levelId),
    ) ||
    assumptionValues.some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0),
    )
  ) {
    return badRequest('Planning assumptions must be blank or non-negative numbers.');
  }

  const now = new Date().toISOString();
  try {
    await saveWorkspace(env.DB, workspace, now, planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER));
  } catch (error) {
    if (error instanceof WorkspaceConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  return Response.json({ workspace, savedAt: now });
}
