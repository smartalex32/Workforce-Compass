import type {
  OfficeWorkspaceData,
  OfficeWorkspaceScopedCommand,
  PayBandVersion,
  RosterPerson,
} from './office-workspace';
import {
  type AppDatabase,
  type DatabaseStatement,
  isNotNullViolation,
} from '@/db';
import { emptyPlanningState } from './planning-repository';
import type { PlanningRole } from './workforce-planning';

type Row = Record<string, string | number | null>;
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const optional = (value: string | number | null) =>
  value == null ? undefined : String(value);

export class OfficeWorkspaceError extends Error {}
export class OfficeWorkspaceConflict extends OfficeWorkspaceError {}

async function belongs(
  db: AppDatabase,
  table: string,
  id: string,
  organizationId: string,
  join = '',
) {
  const row = await db
    .prepare(
      `SELECT 1 FROM ${table} ${join} WHERE ${table}.id = ? AND ${table}.organization_id = ?`,
    )
    .bind(id, organizationId)
    .first<Row>();
  return Boolean(row);
}

async function levelScope(
  db: AppDatabase,
  levelId: string,
  organizationId: string,
) {
  const row = await db
    .prepare(
      `SELECT l.id, l.career_ladder_id, l.is_retired, d.id AS discipline_id FROM levels l JOIN career_ladders c ON c.id = l.career_ladder_id JOIN disciplines d ON d.id = c.discipline_id WHERE l.id = ? AND d.organization_id = ?`,
    )
    .bind(levelId, organizationId)
    .first<Row>();
  return row
    ? {
        ladderId: String(row.career_ladder_id),
        disciplineId: String(row.discipline_id),
        retired: Boolean(row.is_retired),
      }
    : null;
}

export async function listOfficeOrganizations(db: AppDatabase) {
  const rows = await db
    .prepare('SELECT id, name FROM organizations ORDER BY name, id')
    .all<Row>();
  return rows.results.map((row) => ({
    id: String(row.id),
    name: String(row.name),
  }));
}

export async function loadOfficeWorkspace(
  db: AppDatabase,
  organizationId: string,
  role: PlanningRole,
): Promise<OfficeWorkspaceData | null> {
  const organization = await db
    .prepare(
      'SELECT id, name, currency, workspace_revision FROM organizations WHERE id = ?',
    )
    .bind(organizationId)
    .first<Row>();
  if (!organization) return null;
  const [
    offices,
    markets,
    disciplines,
    ladders,
    levels,
    datasets,
    people,
    bands,
  ] = await Promise.all([
    db
      .prepare(
        'SELECT id, name, labor_market_id FROM offices WHERE organization_id = ? ORDER BY name',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT id, name, description FROM labor_markets WHERE organization_id = ? ORDER BY name',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT id, name, description FROM disciplines WHERE organization_id = ? ORDER BY name',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT c.id, c.name, c.discipline_id FROM career_ladders c JOIN disciplines d ON d.id = c.discipline_id WHERE d.organization_id = ? ORDER BY c.name',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT l.id, l.career_ladder_id, l.code, l.name, l.ordering_value, l.description, l.is_retired FROM levels l JOIN career_ladders c ON c.id = l.career_ladder_id JOIN disciplines d ON d.id = c.discipline_id WHERE d.organization_id = ? ORDER BY l.ordering_value',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT md.id, md.labor_market_id, md.name, md.description, md.effective_date, md.source, md.is_active FROM market_datasets md JOIN labor_markets lm ON lm.id = md.labor_market_id WHERE lm.organization_id = ? ORDER BY md.name',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT id, employee_number, office_id, discipline_id, career_ladder_id, level_id, name, title, base_salary, annual_bonus, annual_equity, annual_benefits, location, start_date, team, manager_id, performance_rating, notes FROM employees WHERE organization_id = ? ORDER BY name',
      )
      .bind(organizationId)
      .all<Row>(),
    db
      .prepare(
        'SELECT level_id, labor_market_id, effective_date, minimum, midpoint, maximum FROM pay_band_versions WHERE organization_id = ? ORDER BY effective_date',
      )
      .bind(organizationId)
      .all<Row>(),
  ]);
  return {
    revision: Number(organization.workspace_revision),
    organization: {
      id: String(organization.id),
      name: String(organization.name),
      currency: String(organization.currency),
    },
    role,
    offices: offices.results.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      laborMarketId:
        r.labor_market_id == null ? null : String(r.labor_market_id),
    })),
    markets: markets.results.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: optional(r.description),
    })),
    disciplines: disciplines.results.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: optional(r.description),
    })),
    ladders: ladders.results.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      disciplineId: String(r.discipline_id),
    })),
    levels: levels.results.map((r) => ({
      id: String(r.id),
      ladderId: String(r.career_ladder_id),
      code: r.code == null ? String(r.name) : String(r.code),
      name: String(r.name),
      order: Number(r.ordering_value),
      description: optional(r.description),
      retired: Boolean(r.is_retired),
    })),
    datasets: datasets.results.map((r) => ({
      id: String(r.id),
      laborMarketId: String(r.labor_market_id),
      name: String(r.name),
      description: optional(r.description),
      effectiveDate: optional(r.effective_date),
      source: optional(r.source),
      active: Boolean(r.is_active),
    })),
    people: people.results.map(
      (r): RosterPerson => ({
        id: String(r.id),
        employeeNumber: optional(r.employee_number),
        officeId: r.office_id == null ? null : String(r.office_id),
        disciplineId: r.discipline_id == null ? null : String(r.discipline_id),
        careerLadderId:
          r.career_ladder_id == null ? null : String(r.career_ladder_id),
        levelId: r.level_id == null ? null : String(r.level_id),
        name: String(r.name),
        title: optional(r.title),
        salary: r.base_salary == null ? null : Number(r.base_salary),
        annualBonus:
          r.annual_bonus == null ? undefined : Number(r.annual_bonus),
        annualEquity:
          r.annual_equity == null ? undefined : Number(r.annual_equity),
        annualBenefits:
          r.annual_benefits == null ? undefined : Number(r.annual_benefits),
        location: optional(r.location),
        startDate: optional(r.start_date),
        team: optional(r.team),
        managerId: optional(r.manager_id),
        performanceRating:
          r.performance_rating == null
            ? undefined
            : Number(r.performance_rating),
        notes: optional(r.notes),
      }),
    ),
    bands: bands.results.map(
      (r): PayBandVersion => ({
        levelId: String(r.level_id),
        marketId: r.labor_market_id == null ? null : String(r.labor_market_id),
        date: String(r.effective_date),
        values:
          r.minimum == null || r.maximum == null
            ? null
            : {
                levelId: String(r.level_id),
                min: Number(r.minimum),
                mid: r.midpoint == null ? null : Number(r.midpoint),
                max: Number(r.maximum),
              },
      }),
    ),
  };
}

export async function createOfficeOrganization(
  db: AppDatabase,
  name: string,
  currency: string,
  actor: string,
) {
  const organizationId = id();
  const timestamp = now();
  const state = {
    ...structuredClone(emptyPlanningState),
    members: [{ email: actor, role: 'admin' as const }],
  };
  await db.batch([
    db
      .prepare(
        'INSERT INTO organizations (id, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(organizationId, name, currency, timestamp, timestamp),
    db
      .prepare(
        'INSERT INTO planning_profiles (organization_id, version, state_json, updated_at) VALUES (?, 1, ?, ?)',
      )
      .bind(organizationId, JSON.stringify(state), timestamp),
    db
      .prepare(
        'INSERT INTO audit_events (id, organization_id, actor, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id(),
        organizationId,
        actor,
        'organization.created',
        'organization',
        organizationId,
        '{}',
        timestamp,
      ),
  ]);
  return organizationId;
}

export async function executeOfficeCommand(
  db: AppDatabase,
  organizationId: string,
  command: OfficeWorkspaceScopedCommand,
  actor: string,
  revision?: number,
): Promise<string | undefined> {
  const timestamp = now();
  async function write(statements: DatabaseStatement[]) {
    try {
      await db.batch(
        revision === undefined
          ? statements
          : [
              db
                .prepare(
                  'UPDATE organizations SET workspace_revision = CASE WHEN workspace_revision = ? THEN workspace_revision ELSE NULL END WHERE id = ?',
                )
                .bind(revision, organizationId),
              ...statements,
            ],
      );
    } catch (error) {
      if (
        revision !== undefined &&
        isNotNullViolation(error, 'organizations', 'workspace_revision')
      ) {
        throw new OfficeWorkspaceConflict(
          'This workspace changed since you opened it. Refresh before saving.',
        );
      }
      throw error;
    }
  }
  const audit = (action: string, type: string, entityId?: string) =>
    db
      .prepare(
        'INSERT INTO audit_events (id, organization_id, actor, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id(),
        organizationId,
        actor,
        action,
        type,
        entityId ?? null,
        '{}',
        timestamp,
      );
  if (command.action === 'office') {
    if (
      command.laborMarketId &&
      !(await belongs(
        db,
        'labor_markets',
        command.laborMarketId,
        organizationId,
      ))
    )
      throw new OfficeWorkspaceError('Labor market was not found.');
    const officeId = command.id || id();
    if (command.id && !(await belongs(db, 'offices', officeId, organizationId)))
      throw new OfficeWorkspaceError('Office was not found.');
    await write([
      db
        .prepare(
          'INSERT INTO offices (id, organization_id, name, labor_market_id) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, labor_market_id = excluded.labor_market_id WHERE offices.organization_id = excluded.organization_id',
        )
        .bind(officeId, organizationId, command.name, command.laborMarketId),
      audit('office.saved', 'office', officeId),
    ]);
    return officeId;
  }
  if (command.action === 'market') {
    const marketId = id();
    await write([
      db
        .prepare(
          'INSERT INTO labor_markets (id, organization_id, name) VALUES (?, ?, ?)',
        )
        .bind(marketId, organizationId, command.name),
      audit('market.created', 'labor_market', marketId),
    ]);
    return marketId;
  }
  if (command.action === 'person') {
    if (!(await belongs(db, 'offices', command.officeId, organizationId)))
      throw new OfficeWorkspaceError('Office was not found.');
    const scope = command.levelId
      ? await levelScope(db, command.levelId, organizationId)
      : null;
    if (command.levelId && !scope)
      throw new OfficeWorkspaceError('Job level was not found.');
    const personId = command.id || id();
    const existing = await db
      .prepare(
        'SELECT id, level_id, base_salary FROM employees WHERE id = ? AND organization_id = ?',
      )
      .bind(personId, organizationId)
      .first<Row>();
    if (command.id && !existing)
      throw new OfficeWorkspaceError('Person was not found.');
    if (scope?.retired && String(existing?.level_id ?? '') !== command.levelId)
      throw new OfficeWorkspaceError(
        'Retired levels cannot be assigned to a new person.',
      );
    const statements: DatabaseStatement[] = [
      db
        .prepare(`INSERT INTO employees (id, organization_id, office_id, discipline_id, career_ladder_id, level_id, name, title, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET office_id = excluded.office_id, discipline_id = excluded.discipline_id, career_ladder_id = excluded.career_ladder_id, level_id = excluded.level_id, name = excluded.name, title = excluded.title, base_salary = excluded.base_salary WHERE employees.organization_id = excluded.organization_id`)
        .bind(
          personId,
          organizationId,
          command.officeId,
          scope?.disciplineId ?? null,
          scope?.ladderId ?? null,
          command.levelId,
          command.name,
          command.title ?? null,
          command.salary,
        ),
    ];
    if (
      existing?.base_salary != null &&
      command.salary != null &&
      Number(existing.base_salary) !== command.salary
    )
      statements.push(
        db
          .prepare(
            'INSERT INTO salary_history (id, employee_id, previous_salary, new_salary, effective_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(
            id(),
            personId,
            existing.base_salary,
            command.salary,
            timestamp,
          ),
      );
    statements.push(audit('person.saved', 'employee', personId));
    await write(statements);
    return personId;
  }
  if (command.action === 'assign') {
    if (command.assignments.length > 80)
      throw new OfficeWorkspaceError(
        'Assign people in batches of 80 or fewer.',
      );
    const statements: DatabaseStatement[] = [];
    for (const assignment of command.assignments) {
      if (!(await belongs(db, 'offices', assignment.officeId, organizationId)))
        throw new OfficeWorkspaceError('Office was not found.');
      statements.push(
        db
          .prepare(
            'UPDATE employees SET office_id = ? WHERE id = ? AND organization_id = ? AND office_id IS NULL',
          )
          .bind(assignment.officeId, assignment.personId, organizationId),
      );
    }
    statements.push(audit('people.assigned', 'employee'));
    await write(statements);
    return undefined;
  }
  if (command.action === 'ladder') {
    let disciplineId = command.disciplineId;
    const statements: DatabaseStatement[] = [];
    if (disciplineId) {
      if (!(await belongs(db, 'disciplines', disciplineId, organizationId)))
        throw new OfficeWorkspaceError('Discipline was not found.');
    } else {
      if (!command.disciplineName)
        throw new OfficeWorkspaceError('A discipline is required.');
      disciplineId = id();
      statements.push(
        db
          .prepare(
            'INSERT INTO disciplines (id, organization_id, name) VALUES (?, ?, ?)',
          )
          .bind(disciplineId, organizationId, command.disciplineName),
      );
    }
    const ladderId = id();
    statements.push(
      db
        .prepare(
          'INSERT INTO career_ladders (id, discipline_id, name) VALUES (?, ?, ?)',
        )
        .bind(ladderId, disciplineId, command.name),
    );
    if (command.template === 'engineering')
      [
        'Associate',
        'Engineer',
        'Senior Engineer',
        'Senior',
        'Staff',
        'Principal',
      ].forEach((name, index) =>
        statements.push(
          db
            .prepare(
              'INSERT INTO levels (id, career_ladder_id, code, name, ordering_value, is_retired) VALUES (?, ?, ?, ?, ?, 0)',
            )
            .bind(id(), ladderId, `L${index + 1}`, name, index + 1),
        ),
      );
    statements.push(audit('ladder.created', 'career_ladder', ladderId));
    await write(statements);
    return ladderId;
  }
  if (command.action === 'level') {
    const ladder = await db
      .prepare(
        'SELECT c.id FROM career_ladders c JOIN disciplines d ON d.id = c.discipline_id WHERE c.id = ? AND d.organization_id = ?',
      )
      .bind(command.ladderId, organizationId)
      .first<Row>();
    if (!ladder) throw new OfficeWorkspaceError('Career ladder was not found.');
    const levelId = command.id || id();
    const existingLevel = command.id
      ? await levelScope(db, levelId, organizationId)
      : null;
    if (command.id && !existingLevel)
      throw new OfficeWorkspaceError('Job level was not found.');
    if (existingLevel && existingLevel.ladderId !== command.ladderId)
      throw new OfficeWorkspaceError(
        'A job level cannot be moved to another ladder.',
      );
    const duplicateCode = await db
      .prepare(
        'SELECT id FROM levels WHERE career_ladder_id = ? AND lower(code) = lower(?) AND id <> ?',
      )
      .bind(command.ladderId, command.code, levelId)
      .first<Row>();
    if (duplicateCode)
      throw new OfficeWorkspaceError(
        'Level codes must be unique within a ladder.',
      );
    const levelRows = await db
      .prepare(
        'SELECT id FROM levels WHERE career_ladder_id = ? AND id <> ? ORDER BY ordering_value',
      )
      .bind(command.ladderId, levelId)
      .all<Row>();
    const ids = levelRows.results.map((r) => String(r.id));
    ids.splice(
      Math.max(0, Math.min(command.position - 1, ids.length)),
      0,
      levelId,
    );
    const temporary = [...new Set([...ids, levelId])]
      .filter((item) => item !== levelId || command.id)
      .map((item, index) =>
        db
          .prepare('UPDATE levels SET ordering_value = ? WHERE id = ?')
          .bind(-100000 - index, item),
      );
    const statements = [
      ...temporary,
      ...ids.map((item, index) =>
        item === levelId
          ? db
              .prepare(
                'INSERT INTO levels (id, career_ladder_id, code, name, ordering_value, description, is_retired) VALUES (?, ?, ?, ?, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET career_ladder_id = excluded.career_ladder_id, code = excluded.code, name = excluded.name, ordering_value = excluded.ordering_value, description = excluded.description',
              )
              .bind(
                levelId,
                command.ladderId,
                command.code,
                command.name,
                index + 1,
                command.description ?? null,
              )
          : db
              .prepare('UPDATE levels SET ordering_value = ? WHERE id = ?')
              .bind(index + 1, item),
      ),
    ];
    statements.push(audit('level.saved', 'level', levelId));
    await write(statements);
    return levelId;
  }
  if (command.action === 'retire-level') {
    if (!(await levelScope(db, command.id, organizationId)))
      throw new OfficeWorkspaceError('Job level was not found.');
    await write([
      db
        .prepare('UPDATE levels SET is_retired = 1 WHERE id = ?')
        .bind(command.id),
      audit('level.retired', 'level', command.id),
    ]);
    return command.id;
  }
  if (command.action === 'delete-level') {
    if (!(await levelScope(db, command.id, organizationId)))
      throw new OfficeWorkspaceError('Job level was not found.');
    const used = await db
      .prepare(
        'SELECT 1 FROM employees WHERE level_id = ? UNION SELECT 1 FROM market_compensation WHERE level_id = ? UNION SELECT 1 FROM pay_band_versions WHERE level_id = ? UNION SELECT 1 FROM hiring_assumptions WHERE level_id = ? UNION SELECT 1 FROM survey_import_mappings WHERE mapping_json LIKE ? UNION SELECT 1 FROM salary_history WHERE employee_id IN (SELECT id FROM employees WHERE level_id = ?) LIMIT 1',
      )
      .bind(
        command.id,
        command.id,
        command.id,
        command.id,
        `%${command.id}%`,
        command.id,
      )
      .first<Row>();
    if (used)
      throw new OfficeWorkspaceError(
        'A referenced job level can only be retired.',
      );
    await write([
      db.prepare('DELETE FROM levels WHERE id = ?').bind(command.id),
      audit('level.deleted', 'level', command.id),
    ]);
    return command.id;
  }
  if (
    command.action === 'publish-bands' ||
    command.action === 'end-band-override'
  ) {
    if (
      command.marketId &&
      !(await belongs(db, 'labor_markets', command.marketId, organizationId))
    )
      throw new OfficeWorkspaceError('Labor market was not found.');
    const rows =
      command.action === 'end-band-override'
        ? [{ levelId: command.levelId, min: null, mid: null, max: null }]
        : command.rows;
    if (rows.length > 80)
      throw new OfficeWorkspaceError(
        'Publish bands in batches of 80 or fewer.',
      );
    const statements: DatabaseStatement[] = [];
    for (const row of rows) {
      if (!(await levelScope(db, row.levelId, organizationId)))
        throw new OfficeWorkspaceError('Job level was not found.');
      statements.push(
        db
          .prepare(
            "DELETE FROM pay_band_versions WHERE organization_id = ? AND level_id = ? AND COALESCE(labor_market_id, '') = COALESCE(?, '') AND effective_date = ?",
          )
          .bind(organizationId, row.levelId, command.marketId, command.date),
        db
          .prepare(
            'INSERT INTO pay_band_versions (id, organization_id, level_id, labor_market_id, effective_date, minimum, midpoint, maximum) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            id(),
            organizationId,
            row.levelId,
            command.marketId,
            command.date,
            row.min,
            row.mid,
            row.max,
          ),
      );
    }
    statements.push(
      audit(
        command.action === 'publish-bands'
          ? 'bands.published'
          : 'bands.override_ended',
        'pay_band',
      ),
    );
    await write(statements);
    return undefined;
  }
  throw new OfficeWorkspaceError('Unknown office workspace command.');
}
