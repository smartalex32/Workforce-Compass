import { env } from 'cloudflare:workers';
import type { Workspace } from '@/lib/domain';
import { validateMarketPoint } from '@/lib/domain';

type D1Row = Record<string, string | number | null>;

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
          typeof employee.levelId === 'string' &&
          typeof employee.salary === 'number' &&
          Number.isFinite(employee.salary) &&
          isOptionalString(employee.title) &&
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

export async function GET() {
  const db = env.DB;
  const organization = await db
    .prepare('SELECT id, name, currency FROM organizations ORDER BY created_at LIMIT 1')
    .first<D1Row>();
  if (!organization) return Response.json({ workspace: null });

  const laborMarket = await db
    .prepare('SELECT id, name, description FROM labor_markets WHERE organization_id = ? ORDER BY name LIMIT 1')
    .bind(organization.id)
    .first<D1Row>();
  const discipline = await db
    .prepare('SELECT id, name, description FROM disciplines WHERE organization_id = ? ORDER BY name LIMIT 1')
    .bind(organization.id)
    .first<D1Row>();
  if (!laborMarket || !discipline) return Response.json({ workspace: null });

  const ladder = await db
    .prepare('SELECT id, name, description FROM career_ladders WHERE discipline_id = ? ORDER BY name LIMIT 1')
    .bind(discipline.id)
    .first<D1Row>();
  const dataset = await db
    .prepare('SELECT id, name, description, source, effective_date FROM market_datasets WHERE labor_market_id = ? AND is_active = 1 ORDER BY effective_date DESC LIMIT 1')
    .bind(laborMarket.id)
    .first<D1Row>();
  if (!ladder || !dataset) return Response.json({ workspace: null });

  const [levelRows, marketRows, employeeRows, assumptionRows] = await Promise.all([
    db.prepare('SELECT id, name, ordering_value, description FROM levels WHERE career_ladder_id = ? ORDER BY ordering_value').bind(ladder.id).all<D1Row>(),
    db.prepare('SELECT level_id, p25, p50, p75 FROM market_compensation WHERE dataset_id = ? AND discipline_id = ? AND career_ladder_id = ?').bind(dataset.id, discipline.id, ladder.id).all<D1Row>(),
    db.prepare('SELECT id, name, title, level_id, base_salary, notes FROM employees WHERE organization_id = ? AND discipline_id = ? AND career_ladder_id = ? ORDER BY name').bind(organization.id, discipline.id, ladder.id).all<D1Row>(),
    db.prepare('SELECT level_id, time_to_hire_days, ramp_days, vacancy_multiplier, ramp_loss_factor, recruiting_cost, interview_cost, signing_cost, other_cost FROM hiring_assumptions WHERE discipline_id = ? AND career_ladder_id = ?').bind(discipline.id, ladder.id).all<D1Row>(),
  ]);

  const workspace: Workspace = {
    organization: { id: String(organization.id), name: String(organization.name), currency: String(organization.currency) },
    laborMarket: { id: String(laborMarket.id), name: String(laborMarket.name), description: laborMarket.description ? String(laborMarket.description) : undefined },
    discipline: { id: String(discipline.id), name: String(discipline.name), description: discipline.description ? String(discipline.description) : undefined },
    ladder: { id: String(ladder.id), name: String(ladder.name), description: ladder.description ? String(ladder.description) : undefined },
    dataset: {
      id: String(dataset.id),
      name: String(dataset.name),
      description: dataset.description ? String(dataset.description) : undefined,
      source: dataset.source ? String(dataset.source) : undefined,
      effectiveDate: dataset.effective_date ? String(dataset.effective_date) : undefined,
    },
    levels: levelRows.results.map((row) => ({ id: String(row.id), name: String(row.name), order: Number(row.ordering_value), description: row.description ? String(row.description) : undefined })),
    market: marketRows.results.map((row) => ({ levelId: String(row.level_id), p25: Number(row.p25), p50: Number(row.p50), p75: Number(row.p75) })),
    employees: employeeRows.results.map((row) => ({ id: String(row.id), name: String(row.name), title: row.title ? String(row.title) : undefined, levelId: String(row.level_id), salary: Number(row.base_salary), notes: row.notes ? String(row.notes) : undefined })),
    assumptions: assumptionRows.results.map((row) => ({
      levelId: String(row.level_id),
      timeToHireDays: row.time_to_hire_days == null ? null : Number(row.time_to_hire_days),
      rampDays: row.ramp_days == null ? null : Number(row.ramp_days),
      vacancyMultiplier: row.vacancy_multiplier == null ? null : Number(row.vacancy_multiplier),
      rampLossFactor: row.ramp_loss_factor == null ? null : Number(row.ramp_loss_factor),
      recruitingCost: row.recruiting_cost == null ? null : Number(row.recruiting_cost),
      interviewCost: row.interview_cost == null ? null : Number(row.interview_cost),
      signingCost: row.signing_cost == null ? null : Number(row.signing_cost),
      otherCost: row.other_cost == null ? null : Number(row.other_cost),
    })),
  };

  return Response.json({ workspace });
}

export async function PUT(request: Request) {
  let input: { workspace?: Workspace };
  try {
    input = (await request.json()) as { workspace?: Workspace };
  } catch {
    return badRequest('The request body must be valid JSON.');
  }
  const workspace = input.workspace;
  if (!hasWorkspaceShape(workspace)) return badRequest('A complete workspace is required.');
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
  if (workspace.employees.some((employee) => !employee.id.trim() || !employee.name.trim() || !Number.isFinite(employee.salary) || employee.salary <= 0 || !workspace.levels.some((level) => level.id === employee.levelId))) {
    return badRequest('Each employee needs a name, positive salary, and valid level.');
  }
  if (new Set(workspace.employees.map((employee) => employee.id)).size !== workspace.employees.length) {
    return badRequest('Employee IDs must be unique.');
  }
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

  const db = env.DB;
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM organizations WHERE id = ?').bind(workspace.organization.id),
    db.prepare('INSERT INTO organizations (id, name, default_labor_market_id, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(workspace.organization.id, workspace.organization.name, workspace.laborMarket.id, workspace.organization.currency, now, now),
    db.prepare('INSERT INTO labor_markets (id, organization_id, name, description) VALUES (?, ?, ?, ?)').bind(workspace.laborMarket.id, workspace.organization.id, workspace.laborMarket.name, workspace.laborMarket.description ?? null),
    db.prepare('INSERT INTO disciplines (id, organization_id, name, description) VALUES (?, ?, ?, ?)').bind(workspace.discipline.id, workspace.organization.id, workspace.discipline.name, workspace.discipline.description ?? null),
    db.prepare('INSERT INTO career_ladders (id, discipline_id, name, description) VALUES (?, ?, ?, ?)').bind(workspace.ladder.id, workspace.discipline.id, workspace.ladder.name, workspace.ladder.description ?? null),
    db.prepare('INSERT INTO market_datasets (id, labor_market_id, name, description, effective_date, source, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').bind(workspace.dataset.id, workspace.laborMarket.id, workspace.dataset.name, workspace.dataset.description ?? null, workspace.dataset.effectiveDate ?? null, workspace.dataset.source ?? null),
    ...workspace.levels.map((level) => db.prepare('INSERT INTO levels (id, career_ladder_id, name, ordering_value, description) VALUES (?, ?, ?, ?, ?)').bind(level.id, workspace.ladder.id, level.name, level.order, level.description ?? null)),
    ...workspace.market.map((point) => db.prepare('INSERT INTO market_compensation (id, dataset_id, discipline_id, career_ladder_id, level_id, p25, p50, p75) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(`${workspace.dataset.id}-${point.levelId}`, workspace.dataset.id, workspace.discipline.id, workspace.ladder.id, point.levelId, point.p25, point.p50, point.p75)),
    ...workspace.employees.map((employee) => db.prepare('INSERT INTO employees (id, organization_id, discipline_id, career_ladder_id, level_id, name, title, base_salary, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(employee.id, workspace.organization.id, workspace.discipline.id, workspace.ladder.id, employee.levelId, employee.name, employee.title ?? null, employee.salary, employee.notes ?? null)),
    ...workspace.assumptions.map((assumption) => db.prepare('INSERT INTO hiring_assumptions (id, discipline_id, career_ladder_id, level_id, time_to_hire_days, ramp_days, vacancy_multiplier, ramp_loss_factor, recruiting_cost, interview_cost, signing_cost, other_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(`${workspace.ladder.id}-${assumption.levelId}`, workspace.discipline.id, workspace.ladder.id, assumption.levelId, assumption.timeToHireDays, assumption.rampDays, assumption.vacancyMultiplier, assumption.rampLossFactor, assumption.recruitingCost, assumption.interviewCost, assumption.signingCost, assumption.otherCost)),
  ];

  await db.batch(statements);
  return Response.json({ workspace, savedAt: now });
}
