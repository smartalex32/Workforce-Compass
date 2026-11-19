CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_ladders" (
	"id" text PRIMARY KEY NOT NULL,
	"discipline_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "compensation_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"captured_at" text NOT NULL,
	"data_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_number" text,
	"organization_id" text NOT NULL,
	"office_id" text,
	"discipline_id" text,
	"career_ladder_id" text,
	"level_id" text,
	"name" text NOT NULL,
	"title" text,
	"base_salary" double precision,
	"annual_bonus" double precision,
	"annual_equity" double precision,
	"annual_benefits" double precision,
	"location" text,
	"start_date" text,
	"team" text,
	"manager_id" text,
	"performance_rating" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "hiring_assumptions" (
	"id" text PRIMARY KEY NOT NULL,
	"discipline_id" text NOT NULL,
	"career_ladder_id" text NOT NULL,
	"level_id" text NOT NULL,
	"time_to_hire_days" integer,
	"ramp_days" integer,
	"vacancy_multiplier" double precision,
	"ramp_loss_factor" double precision,
	"recruiting_cost" double precision,
	"interview_cost" double precision,
	"signing_cost" double precision,
	"other_cost" double precision
);
--> statement-breakpoint
CREATE TABLE "labor_markets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" text PRIMARY KEY NOT NULL,
	"career_ladder_id" text NOT NULL,
	"name" text NOT NULL,
	"ordering_value" double precision NOT NULL,
	"description" text,
	"code" text,
	"is_retired" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_compensation" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"discipline_id" text NOT NULL,
	"career_ladder_id" text NOT NULL,
	"level_id" text NOT NULL,
	"p25" double precision,
	"p50" double precision NOT NULL,
	"p75" double precision,
	"p90" double precision
);
--> statement-breakpoint
CREATE TABLE "market_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"labor_market_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"effective_date" text,
	"source" text,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"labor_market_id" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_labor_market_id" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"workspace_revision" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_band_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"level_id" text NOT NULL,
	"labor_market_id" text,
	"effective_date" text NOT NULL,
	"minimum" double precision,
	"midpoint" double precision,
	"maximum" double precision
);
--> statement-breakpoint
CREATE TABLE "planning_profiles" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"state_json" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_history" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"previous_salary" double precision NOT NULL,
	"new_salary" double precision NOT NULL,
	"effective_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_import_mappings" (
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"mapping_json" text NOT NULL,
	CONSTRAINT "survey_import_mappings_organization_id_name_pk" PRIMARY KEY("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_ladders" ADD CONSTRAINT "career_ladders_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_snapshots" ADD CONSTRAINT "compensation_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_career_ladder_id_career_ladders_id_fk" FOREIGN KEY ("career_ladder_id") REFERENCES "public"."career_ladders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assumptions" ADD CONSTRAINT "hiring_assumptions_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assumptions" ADD CONSTRAINT "hiring_assumptions_career_ladder_id_career_ladders_id_fk" FOREIGN KEY ("career_ladder_id") REFERENCES "public"."career_ladders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_assumptions" ADD CONSTRAINT "hiring_assumptions_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_markets" ADD CONSTRAINT "labor_markets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_career_ladder_id_career_ladders_id_fk" FOREIGN KEY ("career_ladder_id") REFERENCES "public"."career_ladders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_compensation" ADD CONSTRAINT "market_compensation_dataset_id_market_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."market_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_compensation" ADD CONSTRAINT "market_compensation_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_compensation" ADD CONSTRAINT "market_compensation_career_ladder_id_career_ladders_id_fk" FOREIGN KEY ("career_ladder_id") REFERENCES "public"."career_ladders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_compensation" ADD CONSTRAINT "market_compensation_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_datasets" ADD CONSTRAINT "market_datasets_labor_market_id_labor_markets_id_fk" FOREIGN KEY ("labor_market_id") REFERENCES "public"."labor_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_labor_market_id_labor_markets_id_fk" FOREIGN KEY ("labor_market_id") REFERENCES "public"."labor_markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_band_versions" ADD CONSTRAINT "pay_band_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_band_versions" ADD CONSTRAINT "pay_band_versions_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_band_versions" ADD CONSTRAINT "pay_band_versions_labor_market_id_labor_markets_id_fk" FOREIGN KEY ("labor_market_id") REFERENCES "public"."labor_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_profiles" ADD CONSTRAINT "planning_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_import_mappings" ADD CONSTRAINT "survey_import_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_events_org_date" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_career_ladders_discipline_id" ON "career_ladders" USING btree ("discipline_id");--> statement-breakpoint
CREATE INDEX "idx_compensation_snapshots_org_date" ON "compensation_snapshots" USING btree ("organization_id","captured_at");--> statement-breakpoint
CREATE INDEX "idx_disciplines_organization_id" ON "disciplines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employees_analysis_scope" ON "employees" USING btree ("organization_id","discipline_id","career_ladder_id","level_id");--> statement-breakpoint
CREATE INDEX "idx_employees_office_id" ON "employees" USING btree ("office_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hiring_assumptions_scope" ON "hiring_assumptions" USING btree ("discipline_id","career_ladder_id","level_id");--> statement-breakpoint
CREATE INDEX "idx_labor_markets_organization_id" ON "labor_markets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_levels_ladder_order" ON "levels" USING btree ("career_ladder_id","ordering_value");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_market_compensation_scope" ON "market_compensation" USING btree ("dataset_id","discipline_id","career_ladder_id","level_id");--> statement-breakpoint
CREATE INDEX "idx_market_datasets_labor_market_id" ON "market_datasets" USING btree ("labor_market_id");--> statement-breakpoint
CREATE INDEX "idx_offices_organization_id" ON "offices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_pay_band_versions_lookup" ON "pay_band_versions" USING btree ("organization_id","level_id","labor_market_id","effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pay_band_versions_scope" ON "pay_band_versions" USING btree ("organization_id","level_id",coalesce("labor_market_id", ''),"effective_date");--> statement-breakpoint
CREATE INDEX "idx_salary_history_employee_date" ON "salary_history" USING btree ("employee_id","effective_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_events_workspace_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations
  SET workspace_revision = workspace_revision + 1
  WHERE id = NEW.organization_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_workspace_revision
AFTER INSERT ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_workspace_revision();
