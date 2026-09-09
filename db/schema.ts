import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultLaborMarketId: text('default_labor_market_id'),
  currency: text('currency').notNull().default('USD'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const laborMarkets = sqliteTable('labor_markets', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
}, (table) => [index('idx_labor_markets_organization_id').on(table.organizationId)]);

export const disciplines = sqliteTable('disciplines', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
}, (table) => [index('idx_disciplines_organization_id').on(table.organizationId)]);

export const careerLadders = sqliteTable('career_ladders', {
  id: text('id').primaryKey(),
  disciplineId: text('discipline_id').notNull().references(() => disciplines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
}, (table) => [index('idx_career_ladders_discipline_id').on(table.disciplineId)]);

export const levels = sqliteTable('levels', {
  id: text('id').primaryKey(),
  careerLadderId: text('career_ladder_id').notNull().references(() => careerLadders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  orderingValue: real('ordering_value').notNull(),
  description: text('description'),
}, (table) => [uniqueIndex('idx_levels_ladder_order').on(table.careerLadderId, table.orderingValue)]);

export const marketDatasets = sqliteTable('market_datasets', {
  id: text('id').primaryKey(),
  laborMarketId: text('labor_market_id').notNull().references(() => laborMarkets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  effectiveDate: text('effective_date'),
  source: text('source'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_market_datasets_labor_market_id').on(table.laborMarketId)]);

export const marketCompensation = sqliteTable('market_compensation', {
  id: text('id').primaryKey(),
  datasetId: text('dataset_id').notNull().references(() => marketDatasets.id, { onDelete: 'cascade' }),
  disciplineId: text('discipline_id').notNull().references(() => disciplines.id, { onDelete: 'cascade' }),
  careerLadderId: text('career_ladder_id').notNull().references(() => careerLadders.id, { onDelete: 'cascade' }),
  levelId: text('level_id').notNull().references(() => levels.id, { onDelete: 'cascade' }),
  p25: real('p25').notNull(),
  p50: real('p50').notNull(),
  p75: real('p75').notNull(),
  p90: real('p90'),
}, (table) => [uniqueIndex('idx_market_compensation_scope').on(table.datasetId, table.disciplineId, table.careerLadderId, table.levelId)]);

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  employeeNumber: text('employee_number'),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  disciplineId: text('discipline_id').notNull().references(() => disciplines.id, { onDelete: 'cascade' }),
  careerLadderId: text('career_ladder_id').notNull().references(() => careerLadders.id, { onDelete: 'cascade' }),
  levelId: text('level_id').notNull().references(() => levels.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  title: text('title'),
  baseSalary: real('base_salary').notNull(),
  annualBonus: real('annual_bonus'),
  annualEquity: real('annual_equity'),
  annualBenefits: real('annual_benefits'),
  location: text('location'),
  startDate: text('start_date'),
  team: text('team'),
  managerId: text('manager_id'),
  performanceRating: real('performance_rating'),
  notes: text('notes'),
}, (table) => [index('idx_employees_analysis_scope').on(table.organizationId, table.disciplineId, table.careerLadderId, table.levelId)]);

export const planningProfiles = sqliteTable('planning_profiles', {
  organizationId: text('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  stateJson: text('state_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const compensationSnapshots = sqliteTable('compensation_snapshots', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  capturedAt: text('captured_at').notNull(),
  dataJson: text('data_json').notNull(),
}, (table) => [index('idx_compensation_snapshots_org_date').on(table.organizationId, table.capturedAt)]);

export const salaryHistory = sqliteTable('salary_history', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  previousSalary: real('previous_salary').notNull(),
  newSalary: real('new_salary').notNull(),
  effectiveAt: text('effective_at').notNull(),
}, (table) => [index('idx_salary_history_employee_date').on(table.employeeId, table.effectiveAt)]);

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_audit_events_org_date').on(table.organizationId, table.createdAt)]);

export const hiringAssumptions = sqliteTable('hiring_assumptions', {
  id: text('id').primaryKey(),
  disciplineId: text('discipline_id').notNull().references(() => disciplines.id, { onDelete: 'cascade' }),
  careerLadderId: text('career_ladder_id').notNull().references(() => careerLadders.id, { onDelete: 'cascade' }),
  levelId: text('level_id').notNull().references(() => levels.id, { onDelete: 'cascade' }),
  timeToHireDays: integer('time_to_hire_days'),
  rampDays: integer('ramp_days'),
  vacancyMultiplier: real('vacancy_multiplier'),
  rampLossFactor: real('ramp_loss_factor'),
  recruitingCost: real('recruiting_cost'),
  interviewCost: real('interview_cost'),
  signingCost: real('signing_cost'),
  otherCost: real('other_cost'),
}, (table) => [uniqueIndex('idx_hiring_assumptions_scope').on(table.disciplineId, table.careerLadderId, table.levelId)]);
