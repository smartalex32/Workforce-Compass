# Workforce Compass

A self-hostable workforce planning application for comparing employee base salaries with external market ranges, internal level medians, and configurable replacement-cost assumptions. It is designed to answer a practical question without overstating certainty: where does an employee sit relative to the market and team, and what is the modeled economic exposure of replacing them?

The workspace opens on the office roster. Create an office by name, add people while salary or leveling is still pending, and choose a comparison labor market when ready. **Job Levels**, **Pay Bands**, **Market Data**, and **Analysis** are available from the same navigation. **Open full analysis** opens the existing organization and ladder views.

The product is built around three linked views:

- Compensation curve — P25–P75 market band, market median, team-level median curve, and employee observations.
- Replacement exposure — modeled hiring, vacancy, and ramp cost by employee, with a stacked summary across career levels.
- Market gap × cost — compensation gap and replacement exposure in one planning view.

Retention exposure is a planning metric, not a prediction that an employee will leave.

## Current capabilities

- Manage office rosters and transfers. Review suggested matches for legacy location text in **Unassigned** before applying office assignments. New workspaces start empty, with a separate read-only demo at `/demo`.
- Use an editable engineering starter ladder or create a blank ladder for a job family or management track. Rename and reorder levels without changing their identity, and retire levels with existing references.
- Publish dated internal base-salary bands with an optional midpoint. A labor market override takes precedence while effective, and offices sharing the market use the same override. Preview changed bands before publishing.
- Import purchased CSV or XLSX surveys through worksheet selection, column and job matching, and a row-by-row review before saving. Save reusable mappings. The import accepts annual base salary for one market and currency at a time, with a positive P50 and optional P25/P75. A median-only row never fills in a missing market range.
- Create and edit organizations, labor markets, disciplines, ladders, arbitrary levels, and active or inactive named market datasets.
- Enter validated P25/P50/P75 ranges and preserve missing rows as unavailable.
- Add, edit, delete, level, and compensate employees, including atomic reassignment to another discipline and career ladder.
- Search employee observations by name, title, or level and filter the directory by career level. Open details or edit from the list; deleting still requires confirmation. Directory filters leave chart observations and team medians unchanged.
- Inspect raw market and team observations alongside their monotone curves; unavailable career levels break the curve rather than implying a value. Hover or focus an employee point for market, team, and replacement context.
- Select an employee for market gap, team gap, market position, replacement-cost components, and retention exposure.
- Configure time-to-hire, ramp, vacancy, productivity-loss, recruiting, interview, relocation/signing, and other cost assumptions by level.
- Switch among Compensation Curve, Replacement Exposure, and Market Gap × Cost views; inspect hiring, vacancy, and ramp cost composition by level without treating missing inputs as zero.
- Use desktop sidebar navigation to move among analysis views, employee management, and data assumptions while retaining the active workspace context.
- Switch persisted organization, market, discipline, ladder, and dataset contexts while every linked analysis view updates together.
- Persist each scoped workspace in PostgreSQL without replacing unrelated contexts. Local development uses embedded PGlite.
- Import and export quoted, validated employee and market CSV files, or use the authenticated vendor-neutral HRIS/survey sync endpoint.
- Record bonus, equity, benefits, total compensation, location, start date, team, manager, and performance context without changing base-salary market comparisons.
- Compare multiple market datasets, model geographic differentials, and save budgeted market-alignment scenarios without applying proposed pay changes.
- Retain compensation snapshots, salary-change history, and audit events; restrict reads and writes with viewer, analyst, and admin planning roles.
- Review sample-gated IQR outliers, performance correlation, historical time-to-hire, productivity curves, and transparent retention signals. Suggestions always require human review and never make termination or hiring decisions.

The relational schema, persistence API, management editor, and analysis filters support multiple organizations, markets, disciplines, ladders, and datasets without replacing unrelated scopes.

Survey imports process up to 5,000 rows per review. Use the labor-market field and saved mappings to process multi-market exports by market. Import compatibility was verified with a synthetic technical-engineering workbook. Purchased exports use the same column and job mapping flow.

## Product documentation

- [Requirements and implementation status](./REQUIREMENTS.md)
- [Feature roadmap](./ROADMAP.md)
- [Project structure and GUI reference](https://github.com/smartalex32/Workforce-Compass/issues/1)

## Local development

Use Node.js 26 to match CI and run the PGlite integration tests.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The Node server initializes PGlite in `.data/pglite` and applies the shared Drizzle migrations on first use. Set `WORKFORCE_COMPASS_PGLITE_DIR` to use a separate local database. Run one server per PGlite directory. Use `memory://` for a disposable database.

### Preview on a phone

Connect the phone to the same private Wi-Fi as your computer. Substitute your computer's Wi-Fi address for `192.168.1.42` in the command and URL.

```bash
DATABASE_URL= WORKFORCE_COMPASS_PGLITE_DIR=.data/phone-preview WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL=true npm run dev -- --hostname 192.168.1.42 --port 4266
```

Open `http://192.168.1.42:4266` to set up a test office, or open `/demo` for a populated read-only example. Anyone who can reach that Wi-Fi address and port can access the preview. Use synthetic data.

### Production with PostgreSQL

Run the Node server with an exported `DATABASE_URL`, the production authentication settings below, and a maintained PostgreSQL instance. Apply migrations as a release step before starting the app.

```bash
npm run db:migrate
npm run build
NODE_ENV=production npm start
```

PGlite and PostgreSQL both use the Drizzle schema in `db/schema.ts` and migrations under `drizzle/postgres/`. Include the migrations in the deployment and run `npm run db:generate` when the schema changes. The SQLite migrations kept directly under `drizzle/` document the previous Cloudflare D1 database. Existing D1 data needs a separate export and transfer before switching a deployment.

Set `WORKFORCE_COMPASS_LEGACY_ENTRY=true` to open the full Analysis view by default. Open `/?workspace=offices` to reach the office workspace.

## Validation

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs the same locked-install, unit/integration test, Chromium acceptance test, typecheck, lint, and production-build gates for every pull request and push to `main`.

## Architecture

- `lib/domain.ts` contains deterministic compensation, team median, monotone curve, replacement-cost, and retention-exposure calculations.
- `lib/workforce-planning.ts` contains CSV, total-compensation, geography, scenario, productivity, hiring-history, outlier, performance, and review-signal models.
- `db/schema.ts` defines the relational organization, labor market, discipline, ladder, level, dataset, employee, market compensation, and assumption entities.
- `db/runtime.ts` selects PGlite or a pooled PostgreSQL connection. `db/index.ts` executes parameterized statements and transactions through Drizzle.
- `lib/workspace-repository.ts` owns scope-preserving reads and writes, context discovery, atomic employee reassignment, and parent/scope conflict protection.
- `lib/planning-repository.ts` persists planning profiles and reads bounded compensation, salary, and audit history.
- `lib/api-auth.ts` enforces the identity boundary before compensation APIs access the database.
- `lib/context-management.ts` creates new related scopes while preserving only data that remains valid for the selected hierarchy.
- `app/api/workspace/route.ts` validates requests and exposes the persistence boundary for analysis workspaces.
- `components/workforce-explorer.tsx` owns the primary visualization and linked analysis views.
- `components/management-dialogs.tsx` contains employee, career structure, market data, and planning assumption editors.
- `components/planning-center.tsx` exposes portability, dataset overlays, hierarchy, scenarios, history, and decision-support summaries.

## Workspace persistence API

- `GET|POST /api/office-workspace` loads the authorized organization and roster or applies a scoped office, person, ladder, level, or pay-band change. Read access follows workspace membership. Analyst or admin access is required for changes within an existing workspace.
- `GET|POST /api/survey-import` loads saved mappings or previews and applies reviewed survey rows into a named market dataset.
- `GET /api/workspace` loads the default persisted context.
- `GET /api/workspace?organizationId=…&laborMarketId=…&disciplineId=…&ladderId=…&datasetId=…` loads an explicit, relationship-validated context and returns 404 when the selection is invalid.
- `GET /api/workspace/contexts` returns the organization, market, discipline, ladder, level, and dataset catalog. An optional `organizationId` narrows the catalog.
- `PUT /api/workspace` atomically upserts the selected hierarchy and replaces only that ladder/dataset’s observations and assumptions. Other organizations, markets, ladders, and datasets are preserved.
- `POST /api/employees/reassign` atomically edits and moves an existing employee to a relationship-validated discipline, ladder, and level in the same organization.
- `GET|PUT /api/planning?organizationId=…` reads or saves scenarios, roles, geography factors, hiring history, productivity curves, and integration status. Writes require analyst or admin access; membership changes require admin access.
- `POST /api/integrations/sync` accepts a validated employee HRIS or market-survey CSV payload and atomically persists it in the selected workspace. This vendor-neutral boundary is intended for a trusted connector or scheduled retrieval job; vendor credentials never enter browser state.

Existing child IDs cannot be silently moved to a different parent or analysis scope; conflicting writes return HTTP 409.

Every workspace save records a compensation snapshot and audit event. Salary changes record the prior and new base salary. History endpoints return bounded recent results rather than an unbounded employee-data archive.

Automated route tests cover authentication, valid persistence, malformed JSON, invalid references and market ranges, inactive dataset behavior, atomic employee reassignment, unchanged stored data after rejected writes, parent-scope conflicts, and missing explicit scopes. Playwright covers the primary chart, employee, alternate-view, dataset-status, and reload workflow in a real browser.

Employee records are not logged or sent to analytics. Deployments must configure one of these server-side boundaries before entering compensation data:

- A trusted gateway that supplies the Sites identity header can set `WORKFORCE_COMPASS_TRUST_SITES_IDENTITY=true` to authorize `oai-authenticated-user-id`. Restrict direct access to the Node server and strip client-supplied copies of the header at the gateway.
- `WORKFORCE_COMPASS_TRUSTED_USER_HEADER` names an identity header injected by a trusted authentication proxy. The proxy must strip client-supplied copies and prevent direct access to the app server.
- `WORKFORCE_COMPASS_AUTH_TOKEN` requires a matching `Authorization: Bearer …` header, typically injected by a trusted proxy or service gateway.

`WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL=true` is only for local development and automated tests. Without an authentication boundary or that local opt-in, every compensation API returns HTTP 401 before opening the database.

Planning profiles with explicit members require a stable per-user identity header (the configured trusted header, Cloudflare Access's `cf-access-authenticated-user-email`, or the Sites user ID). A token-only deployment is treated as the shared `authenticated-user` identity; include that identity as an admin before adding explicit members, or use a trusted per-user header. The first authenticated identity can bootstrap an organization whose member list is still empty, and every non-empty member list must retain at least one admin.
