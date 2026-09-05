import type { Workspace } from '@/lib/domain';

type D1Row = Record<string, string | number | null>;

export type WorkspaceSelection = {
  organizationId?: string;
  laborMarketId?: string;
  disciplineId?: string;
  ladderId?: string;
  datasetId?: string;
};

export type WorkspaceContexts = {
  organizations: Array<{
    id: string;
    name: string;
    currency: string;
    defaultLaborMarketId: string | null;
  }>;
  laborMarkets: Array<{
    id: string;
    organizationId: string;
    name: string;
    description?: string;
  }>;
  disciplines: Array<{
    id: string;
    organizationId: string;
    name: string;
    description?: string;
  }>;
  ladders: Array<{
    id: string;
    disciplineId: string;
    name: string;
    description?: string;
  }>;
  datasets: Array<{
    id: string;
    laborMarketId: string;
    name: string;
    description?: string;
    effectiveDate?: string;
    source?: string;
    active: boolean;
  }>;
};

export class WorkspaceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceConflictError';
  }
}

function scopedId(parts: string[]) {
  return parts.map((part) => `${part.length}:${part}`).join('|');
}

async function assertParent(
  db: D1Database,
  table: 'labor_markets' | 'disciplines' | 'career_ladders' | 'market_datasets' | 'levels',
  id: string,
  parentColumn:
    | 'organization_id'
    | 'discipline_id'
    | 'labor_market_id'
    | 'career_ladder_id',
  expectedParentId: string,
) {
  const existing = await db
    .prepare(`SELECT ${parentColumn} AS parent_id FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<D1Row>();

  if (existing && String(existing.parent_id) !== expectedParentId) {
    throw new WorkspaceConflictError(
      `${table} record ${id} already belongs to a different parent.`,
    );
  }
}

async function assertEmployeeScope(db: D1Database, workspace: Workspace) {
  if (!workspace.employees.length) return;
  const placeholders = workspace.employees.map(() => '?').join(', ');
  const existing = await db
    .prepare(
      `SELECT id, organization_id, discipline_id, career_ladder_id FROM employees WHERE id IN (${placeholders})`,
    )
    .bind(...workspace.employees.map((employee) => employee.id))
    .all<D1Row>();

  const conflicting = existing.results.find(
    (employee) =>
      String(employee.organization_id) !== workspace.organization.id ||
      String(employee.discipline_id) !== workspace.discipline.id ||
      String(employee.career_ladder_id) !== workspace.ladder.id,
  );
  if (conflicting) {
    throw new WorkspaceConflictError(
      `Employee ${String(conflicting.id)} already belongs to a different analysis scope.`,
    );
  }
}

export async function loadWorkspace(
  db: D1Database,
  selection: WorkspaceSelection = {},
): Promise<Workspace | null> {
  const organization = selection.organizationId
    ? await db
        .prepare(
          'SELECT id, name, currency, default_labor_market_id FROM organizations WHERE id = ? LIMIT 1',
        )
        .bind(selection.organizationId)
        .first<D1Row>()
    : await db
        .prepare(
          'SELECT id, name, currency, default_labor_market_id FROM organizations ORDER BY created_at LIMIT 1',
        )
        .first<D1Row>();
  if (!organization) return null;

  const organizationId = String(organization.id);
  const laborMarket = selection.laborMarketId
    ? await db
        .prepare(
          'SELECT id, name, description FROM labor_markets WHERE id = ? AND organization_id = ? LIMIT 1',
        )
        .bind(selection.laborMarketId, organizationId)
        .first<D1Row>()
    : await db
        .prepare(
          'SELECT id, name, description FROM labor_markets WHERE organization_id = ? ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, name LIMIT 1',
        )
        .bind(
          organizationId,
          organization.default_labor_market_id == null
            ? ''
            : String(organization.default_labor_market_id),
        )
        .first<D1Row>();

  const discipline = selection.disciplineId
    ? await db
        .prepare(
          'SELECT id, name, description FROM disciplines WHERE id = ? AND organization_id = ? LIMIT 1',
        )
        .bind(selection.disciplineId, organizationId)
        .first<D1Row>()
    : await db
        .prepare(
          'SELECT id, name, description FROM disciplines WHERE organization_id = ? ORDER BY name LIMIT 1',
        )
        .bind(organizationId)
        .first<D1Row>();
  if (!laborMarket || !discipline) return null;

  const laborMarketId = String(laborMarket.id);
  const disciplineId = String(discipline.id);
  const ladder = selection.ladderId
    ? await db
        .prepare(
          'SELECT id, name, description FROM career_ladders WHERE id = ? AND discipline_id = ? LIMIT 1',
        )
        .bind(selection.ladderId, disciplineId)
        .first<D1Row>()
    : await db
        .prepare(
          'SELECT id, name, description FROM career_ladders WHERE discipline_id = ? ORDER BY name LIMIT 1',
        )
        .bind(disciplineId)
        .first<D1Row>();
  const dataset = selection.datasetId
    ? await db
        .prepare(
          'SELECT id, name, description, source, effective_date FROM market_datasets WHERE id = ? AND labor_market_id = ? LIMIT 1',
        )
        .bind(selection.datasetId, laborMarketId)
        .first<D1Row>()
    : await db
        .prepare(
          'SELECT id, name, description, source, effective_date FROM market_datasets WHERE labor_market_id = ? AND is_active = 1 ORDER BY effective_date DESC, name LIMIT 1',
        )
        .bind(laborMarketId)
        .first<D1Row>();
  if (!ladder || !dataset) return null;

  const ladderId = String(ladder.id);
  const datasetId = String(dataset.id);
  const [levelRows, marketRows, employeeRows, assumptionRows] = await Promise.all([
    db
      .prepare(
        'SELECT id, name, ordering_value, description FROM levels WHERE career_ladder_id = ? ORDER BY ordering_value',
      )
      .bind(ladderId)
      .all<D1Row>(),
    db
      .prepare(
        'SELECT level_id, p25, p50, p75 FROM market_compensation WHERE dataset_id = ? AND discipline_id = ? AND career_ladder_id = ?',
      )
      .bind(datasetId, disciplineId, ladderId)
      .all<D1Row>(),
    db
      .prepare(
        'SELECT id, name, title, level_id, base_salary, notes FROM employees WHERE organization_id = ? AND discipline_id = ? AND career_ladder_id = ? ORDER BY name',
      )
      .bind(organizationId, disciplineId, ladderId)
      .all<D1Row>(),
    db
      .prepare(
        'SELECT level_id, time_to_hire_days, ramp_days, vacancy_multiplier, ramp_loss_factor, recruiting_cost, interview_cost, signing_cost, other_cost FROM hiring_assumptions WHERE discipline_id = ? AND career_ladder_id = ?',
      )
      .bind(disciplineId, ladderId)
      .all<D1Row>(),
  ]);

  return {
    organization: {
      id: organizationId,
      name: String(organization.name),
      currency: String(organization.currency),
    },
    laborMarket: {
      id: laborMarketId,
      name: String(laborMarket.name),
      description: laborMarket.description
        ? String(laborMarket.description)
        : undefined,
    },
    discipline: {
      id: disciplineId,
      name: String(discipline.name),
      description: discipline.description
        ? String(discipline.description)
        : undefined,
    },
    ladder: {
      id: ladderId,
      name: String(ladder.name),
      description: ladder.description ? String(ladder.description) : undefined,
    },
    dataset: {
      id: datasetId,
      name: String(dataset.name),
      description: dataset.description
        ? String(dataset.description)
        : undefined,
      source: dataset.source ? String(dataset.source) : undefined,
      effectiveDate: dataset.effective_date
        ? String(dataset.effective_date)
        : undefined,
    },
    levels: levelRows.results.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      order: Number(row.ordering_value),
      description: row.description ? String(row.description) : undefined,
    })),
    market: marketRows.results.map((row) => ({
      levelId: String(row.level_id),
      p25: Number(row.p25),
      p50: Number(row.p50),
      p75: Number(row.p75),
    })),
    employees: employeeRows.results.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      title: row.title ? String(row.title) : undefined,
      levelId: String(row.level_id),
      salary: Number(row.base_salary),
      notes: row.notes ? String(row.notes) : undefined,
    })),
    assumptions: assumptionRows.results.map((row) => ({
      levelId: String(row.level_id),
      timeToHireDays:
        row.time_to_hire_days == null ? null : Number(row.time_to_hire_days),
      rampDays: row.ramp_days == null ? null : Number(row.ramp_days),
      vacancyMultiplier:
        row.vacancy_multiplier == null ? null : Number(row.vacancy_multiplier),
      rampLossFactor:
        row.ramp_loss_factor == null ? null : Number(row.ramp_loss_factor),
      recruitingCost:
        row.recruiting_cost == null ? null : Number(row.recruiting_cost),
      interviewCost:
        row.interview_cost == null ? null : Number(row.interview_cost),
      signingCost: row.signing_cost == null ? null : Number(row.signing_cost),
      otherCost: row.other_cost == null ? null : Number(row.other_cost),
    })),
  };
}

export async function listWorkspaceContexts(
  db: D1Database,
  organizationId?: string,
): Promise<WorkspaceContexts> {
  const organizationFilter = organizationId ? ' WHERE id = ?' : '';
  const organizations = organizationId
    ? await db
        .prepare(
          `SELECT id, name, currency, default_labor_market_id FROM organizations${organizationFilter} ORDER BY name`,
        )
        .bind(organizationId)
        .all<D1Row>()
    : await db
        .prepare(
          'SELECT id, name, currency, default_labor_market_id FROM organizations ORDER BY name',
        )
        .all<D1Row>();

  const organizationIds = organizations.results.map((row) => String(row.id));
  if (!organizationIds.length) {
    return {
      organizations: [],
      laborMarkets: [],
      disciplines: [],
      ladders: [],
      datasets: [],
    };
  }

  const placeholders = organizationIds.map(() => '?').join(', ');
  const [laborMarkets, disciplines] = await Promise.all([
    db
      .prepare(
        `SELECT id, organization_id, name, description FROM labor_markets WHERE organization_id IN (${placeholders}) ORDER BY name`,
      )
      .bind(...organizationIds)
      .all<D1Row>(),
    db
      .prepare(
        `SELECT id, organization_id, name, description FROM disciplines WHERE organization_id IN (${placeholders}) ORDER BY name`,
      )
      .bind(...organizationIds)
      .all<D1Row>(),
  ]);

  const disciplineIds = disciplines.results.map((row) => String(row.id));
  const laborMarketIds = laborMarkets.results.map((row) => String(row.id));
  const ladderPlaceholders = disciplineIds.map(() => '?').join(', ');
  const datasetPlaceholders = laborMarketIds.map(() => '?').join(', ');
  const ladders = disciplineIds.length
    ? await db
        .prepare(
          `SELECT id, discipline_id, name, description FROM career_ladders WHERE discipline_id IN (${ladderPlaceholders}) ORDER BY name`,
        )
        .bind(...disciplineIds)
        .all<D1Row>()
    : { results: [] as D1Row[] };
  const datasets = laborMarketIds.length
    ? await db
        .prepare(
          `SELECT id, labor_market_id, name, description, effective_date, source, is_active FROM market_datasets WHERE labor_market_id IN (${datasetPlaceholders}) ORDER BY effective_date DESC, name`,
        )
        .bind(...laborMarketIds)
        .all<D1Row>()
    : { results: [] as D1Row[] };

  return {
    organizations: organizations.results.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      currency: String(row.currency),
      defaultLaborMarketId:
        row.default_labor_market_id == null
          ? null
          : String(row.default_labor_market_id),
    })),
    laborMarkets: laborMarkets.results.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
    })),
    disciplines: disciplines.results.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
    })),
    ladders: ladders.results.map((row) => ({
      id: String(row.id),
      disciplineId: String(row.discipline_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
    })),
    datasets: datasets.results.map((row) => ({
      id: String(row.id),
      laborMarketId: String(row.labor_market_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      effectiveDate: row.effective_date
        ? String(row.effective_date)
        : undefined,
      source: row.source ? String(row.source) : undefined,
      active: Boolean(row.is_active),
    })),
  };
}

export async function saveWorkspace(
  db: D1Database,
  workspace: Workspace,
  now = new Date().toISOString(),
) {
  await Promise.all([
    assertParent(
      db,
      'labor_markets',
      workspace.laborMarket.id,
      'organization_id',
      workspace.organization.id,
    ),
    assertParent(
      db,
      'disciplines',
      workspace.discipline.id,
      'organization_id',
      workspace.organization.id,
    ),
    assertParent(
      db,
      'career_ladders',
      workspace.ladder.id,
      'discipline_id',
      workspace.discipline.id,
    ),
    assertParent(
      db,
      'market_datasets',
      workspace.dataset.id,
      'labor_market_id',
      workspace.laborMarket.id,
    ),
    ...workspace.levels.map((level) =>
      assertParent(
        db,
        'levels',
        level.id,
        'career_ladder_id',
        workspace.ladder.id,
      ),
    ),
    assertEmployeeScope(db, workspace),
  ]);

  const existingLevels = await db
    .prepare(
      'SELECT id, ordering_value FROM levels WHERE career_ladder_id = ? ORDER BY id',
    )
    .bind(workspace.ladder.id)
    .all<D1Row>();
  const reservedOrders = new Set([
    ...existingLevels.results.map((level) => Number(level.ordering_value)),
    ...workspace.levels.map((level) => level.order),
  ]);
  let temporaryOrder = -1;
  const temporaryLevelStatements = existingLevels.results.map((level) => {
    while (reservedOrders.has(temporaryOrder)) temporaryOrder -= 1;
    const order = temporaryOrder;
    reservedOrders.add(order);
    temporaryOrder -= 1;
    return db
      .prepare(
        'UPDATE levels SET ordering_value = ? WHERE id = ? AND career_ladder_id = ?',
      )
      .bind(order, level.id, workspace.ladder.id);
  });

  const keepLevelPlaceholders = workspace.levels.map(() => '?').join(', ');
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO organizations (id, name, default_labor_market_id, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, default_labor_market_id = excluded.default_labor_market_id, currency = excluded.currency, updated_at = excluded.updated_at`,
      )
      .bind(
        workspace.organization.id,
        workspace.organization.name,
        workspace.laborMarket.id,
        workspace.organization.currency,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO labor_markets (id, organization_id, name, description) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET organization_id = CASE WHEN labor_markets.organization_id = excluded.organization_id THEN labor_markets.organization_id ELSE NULL END, name = excluded.name, description = excluded.description`,
      )
      .bind(
        workspace.laborMarket.id,
        workspace.organization.id,
        workspace.laborMarket.name,
        workspace.laborMarket.description ?? null,
      ),
    db
      .prepare(
        `INSERT INTO disciplines (id, organization_id, name, description) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET organization_id = CASE WHEN disciplines.organization_id = excluded.organization_id THEN disciplines.organization_id ELSE NULL END, name = excluded.name, description = excluded.description`,
      )
      .bind(
        workspace.discipline.id,
        workspace.organization.id,
        workspace.discipline.name,
        workspace.discipline.description ?? null,
      ),
    db
      .prepare(
        `INSERT INTO career_ladders (id, discipline_id, name, description) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET discipline_id = CASE WHEN career_ladders.discipline_id = excluded.discipline_id THEN career_ladders.discipline_id ELSE NULL END, name = excluded.name, description = excluded.description`,
      )
      .bind(
        workspace.ladder.id,
        workspace.discipline.id,
        workspace.ladder.name,
        workspace.ladder.description ?? null,
      ),
    db
      .prepare(
        `INSERT INTO market_datasets (id, labor_market_id, name, description, effective_date, source, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET labor_market_id = CASE WHEN market_datasets.labor_market_id = excluded.labor_market_id THEN market_datasets.labor_market_id ELSE NULL END, name = excluded.name, description = excluded.description, effective_date = excluded.effective_date, source = excluded.source, is_active = 1`,
      )
      .bind(
        workspace.dataset.id,
        workspace.laborMarket.id,
        workspace.dataset.name,
        workspace.dataset.description ?? null,
        workspace.dataset.effectiveDate ?? null,
        workspace.dataset.source ?? null,
      ),
    db
      .prepare(
        'DELETE FROM employees WHERE organization_id = ? AND discipline_id = ? AND career_ladder_id = ?',
      )
      .bind(
        workspace.organization.id,
        workspace.discipline.id,
        workspace.ladder.id,
      ),
    db
      .prepare(
        'DELETE FROM market_compensation WHERE dataset_id = ? AND discipline_id = ? AND career_ladder_id = ?',
      )
      .bind(
        workspace.dataset.id,
        workspace.discipline.id,
        workspace.ladder.id,
      ),
    db
      .prepare(
        'DELETE FROM hiring_assumptions WHERE discipline_id = ? AND career_ladder_id = ?',
      )
      .bind(workspace.discipline.id, workspace.ladder.id),
    ...temporaryLevelStatements,
    db
      .prepare(
        `DELETE FROM levels WHERE career_ladder_id = ? AND id NOT IN (${keepLevelPlaceholders})`,
      )
      .bind(
        workspace.ladder.id,
        ...workspace.levels.map((level) => level.id),
      ),
    ...workspace.levels.map((level) =>
      db
        .prepare(
          `INSERT INTO levels (id, career_ladder_id, name, ordering_value, description) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET career_ladder_id = CASE WHEN levels.career_ladder_id = excluded.career_ladder_id THEN levels.career_ladder_id ELSE NULL END, name = excluded.name, ordering_value = excluded.ordering_value, description = excluded.description`,
        )
        .bind(
          level.id,
          workspace.ladder.id,
          level.name,
          level.order,
          level.description ?? null,
        ),
    ),
    ...workspace.market.map((point) =>
      db
        .prepare(
          'INSERT INTO market_compensation (id, dataset_id, discipline_id, career_ladder_id, level_id, p25, p50, p75) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          scopedId([
            workspace.dataset.id,
            workspace.discipline.id,
            workspace.ladder.id,
            point.levelId,
          ]),
          workspace.dataset.id,
          workspace.discipline.id,
          workspace.ladder.id,
          point.levelId,
          point.p25,
          point.p50,
          point.p75,
        ),
    ),
    ...workspace.employees.map((employee) =>
      db
        .prepare(
          'INSERT INTO employees (id, organization_id, discipline_id, career_ladder_id, level_id, name, title, base_salary, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          employee.id,
          workspace.organization.id,
          workspace.discipline.id,
          workspace.ladder.id,
          employee.levelId,
          employee.name,
          employee.title ?? null,
          employee.salary,
          employee.notes ?? null,
        ),
    ),
    ...workspace.assumptions.map((assumption) =>
      db
        .prepare(
          'INSERT INTO hiring_assumptions (id, discipline_id, career_ladder_id, level_id, time_to_hire_days, ramp_days, vacancy_multiplier, ramp_loss_factor, recruiting_cost, interview_cost, signing_cost, other_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          scopedId([
            workspace.discipline.id,
            workspace.ladder.id,
            assumption.levelId,
          ]),
          workspace.discipline.id,
          workspace.ladder.id,
          assumption.levelId,
          assumption.timeToHireDays,
          assumption.rampDays,
          assumption.vacancyMultiplier,
          assumption.rampLossFactor,
          assumption.recruitingCost,
          assumption.interviewCost,
          assumption.signingCost,
          assumption.otherCost,
        ),
    ),
  ];

  await db.batch(statements);
}
