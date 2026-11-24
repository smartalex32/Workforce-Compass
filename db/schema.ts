import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultLaborMarketId: text('default_labor_market_id'),
  currency: text('currency').notNull().default('USD'),
  companySize: text('company_size'),
  workspaceRevision: integer('workspace_revision').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const laborMarkets = pgTable(
  'labor_markets',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
  },
  (table) => [
    index('idx_labor_markets_organization_id').on(table.organizationId),
  ],
);

export const offices = pgTable(
  'offices',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    laborMarketId: text('labor_market_id').references(() => laborMarkets.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('idx_offices_organization_id').on(table.organizationId)],
);

export const disciplines = pgTable(
  'disciplines',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
  },
  (table) => [
    index('idx_disciplines_organization_id').on(table.organizationId),
  ],
);

export const careerLadders = pgTable(
  'career_ladders',
  {
    id: text('id').primaryKey(),
    disciplineId: text('discipline_id')
      .notNull()
      .references(() => disciplines.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
  },
  (table) => [index('idx_career_ladders_discipline_id').on(table.disciplineId)],
);

export const levels = pgTable(
  'levels',
  {
    id: text('id').primaryKey(),
    careerLadderId: text('career_ladder_id')
      .notNull()
      .references(() => careerLadders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    orderingValue: doublePrecision('ordering_value').notNull(),
    description: text('description'),
    code: text('code'),
    isRetired: integer('is_retired').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_levels_ladder_order').on(
      table.careerLadderId,
      table.orderingValue,
    ),
  ],
);

export const marketDatasets = pgTable(
  'market_datasets',
  {
    id: text('id').primaryKey(),
    laborMarketId: text('labor_market_id')
      .notNull()
      .references(() => laborMarkets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    effectiveDate: text('effective_date'),
    source: text('source'),
    isActive: integer('is_active').notNull().default(1),
  },
  (table) => [
    index('idx_market_datasets_labor_market_id').on(table.laborMarketId),
  ],
);

export const marketCompensation = pgTable(
  'market_compensation',
  {
    id: text('id').primaryKey(),
    datasetId: text('dataset_id')
      .notNull()
      .references(() => marketDatasets.id, { onDelete: 'cascade' }),
    disciplineId: text('discipline_id')
      .notNull()
      .references(() => disciplines.id, { onDelete: 'cascade' }),
    careerLadderId: text('career_ladder_id')
      .notNull()
      .references(() => careerLadders.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    p25: doublePrecision('p25'),
    p50: doublePrecision('p50').notNull(),
    p75: doublePrecision('p75'),
    p90: doublePrecision('p90'),
  },
  (table) => [
    uniqueIndex('idx_market_compensation_scope').on(
      table.datasetId,
      table.disciplineId,
      table.careerLadderId,
      table.levelId,
    ),
  ],
);

export const employees = pgTable(
  'employees',
  {
    id: text('id').primaryKey(),
    employeeNumber: text('employee_number'),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    officeId: text('office_id').references(() => offices.id, {
      onDelete: 'set null',
    }),
    disciplineId: text('discipline_id').references(() => disciplines.id, {
      onDelete: 'cascade',
    }),
    careerLadderId: text('career_ladder_id').references(
      () => careerLadders.id,
      { onDelete: 'cascade' },
    ),
    levelId: text('level_id').references(() => levels.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    title: text('title'),
    baseSalary: doublePrecision('base_salary'),
    annualBonus: doublePrecision('annual_bonus'),
    annualEquity: doublePrecision('annual_equity'),
    annualBenefits: doublePrecision('annual_benefits'),
    location: text('location'),
    startDate: text('start_date'),
    team: text('team'),
    managerId: text('manager_id'),
    performanceRating: doublePrecision('performance_rating'),
    notes: text('notes'),
    clearanceLevel: text('clearance_level'),
    yearsExperience: doublePrecision('years_experience'),
  },
  (table) => [
    index('idx_employees_analysis_scope').on(
      table.organizationId,
      table.disciplineId,
      table.careerLadderId,
      table.levelId,
    ),
    index('idx_employees_office_id').on(table.officeId),
  ],
);

export const payBandVersions = pgTable(
  'pay_band_versions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'restrict' }),
    laborMarketId: text('labor_market_id').references(() => laborMarkets.id, {
      onDelete: 'cascade',
    }),
    effectiveDate: text('effective_date').notNull(),
    minimum: doublePrecision('minimum'),
    midpoint: doublePrecision('midpoint'),
    maximum: doublePrecision('maximum'),
  },
  (table) => [
    index('idx_pay_band_versions_lookup').on(
      table.organizationId,
      table.levelId,
      table.laborMarketId,
      table.effectiveDate,
    ),
    uniqueIndex('idx_pay_band_versions_scope').on(
      table.organizationId,
      table.levelId,
      sql`coalesce(${table.laborMarketId}, '')`,
      table.effectiveDate,
    ),
  ],
);

export const surveyImportMappings = pgTable(
  'survey_import_mappings',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mappingJson: text('mapping_json').notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.name] })],
);

export const planningProfiles = pgTable('planning_profiles', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  stateJson: text('state_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const compensationSnapshots = pgTable(
  'compensation_snapshots',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    capturedAt: text('captured_at').notNull(),
    dataJson: text('data_json').notNull(),
  },
  (table) => [
    index('idx_compensation_snapshots_org_date').on(
      table.organizationId,
      table.capturedAt,
    ),
  ],
);

export const salaryHistory = pgTable(
  'salary_history',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull(),
    previousSalary: doublePrecision('previous_salary').notNull(),
    newSalary: doublePrecision('new_salary').notNull(),
    effectiveAt: text('effective_at').notNull(),
  },
  (table) => [
    index('idx_salary_history_employee_date').on(
      table.employeeId,
      table.effectiveAt,
    ),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_events_org_date').on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const hiringAssumptions = pgTable(
  'hiring_assumptions',
  {
    id: text('id').primaryKey(),
    disciplineId: text('discipline_id')
      .notNull()
      .references(() => disciplines.id, { onDelete: 'cascade' }),
    careerLadderId: text('career_ladder_id')
      .notNull()
      .references(() => careerLadders.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    timeToHireDays: integer('time_to_hire_days'),
    rampDays: integer('ramp_days'),
    vacancyMultiplier: doublePrecision('vacancy_multiplier'),
    rampLossFactor: doublePrecision('ramp_loss_factor'),
    recruitingCost: doublePrecision('recruiting_cost'),
    interviewCost: doublePrecision('interview_cost'),
    signingCost: doublePrecision('signing_cost'),
    otherCost: doublePrecision('other_cost'),
  },
  (table) => [
    uniqueIndex('idx_hiring_assumptions_scope').on(
      table.disciplineId,
      table.careerLadderId,
      table.levelId,
    ),
  ],
);
