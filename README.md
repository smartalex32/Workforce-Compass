# Workforce Compass

A self-hostable workforce planning application for comparing employee base salaries with external market ranges, internal level medians, and configurable replacement-cost assumptions. It is designed to answer a practical question without overstating certainty: where does an employee sit relative to the market and team, and what is the modeled economic exposure of replacing them?

The product is built around three linked views:

- Compensation curve — P25–P75 market band, market median, team-level median curve, and employee observations.
- Replacement exposure — the modeled hiring, vacancy, and ramp cost for each employee.
- Market gap × cost — compensation gap and replacement exposure in one planning view.

Retention exposure is a planning metric, not a prediction that an employee will leave.

## Current capabilities

- Create and edit organizations, labor markets, disciplines, ladders, arbitrary levels, and named market datasets.
- Enter validated P25/P50/P75 ranges and preserve missing rows as unavailable.
- Add, edit, delete, level, and compensate employees.
- Search employee observations by name, title, or level and filter the directory by career level. Open details or edit from the list; deleting still requires confirmation. Directory filters leave chart observations and team medians unchanged.
- Inspect raw market and team observations alongside their monotone curves; unavailable career levels break the curve rather than implying a value. Hover or focus an employee point for market, team, and replacement context.
- Select an employee for market gap, team gap, market position, replacement-cost components, and retention exposure.
- Configure time-to-hire, ramp, vacancy, productivity-loss, recruiting, interview, relocation/signing, and other cost assumptions by level.
- Switch among Compensation Curve, Replacement Exposure, and Market Gap × Cost views.
- Switch persisted organization, market, discipline, ladder, and dataset contexts while every linked analysis view updates together.
- Persist each scoped workspace in Cloudflare D1 without replacing unrelated contexts.

The relational schema, persistence API, management editor, and analysis filters support multiple organizations, markets, disciplines, ladders, and datasets without replacing unrelated scopes.

## Product documentation

- [Requirements and implementation status](./REQUIREMENTS.md)
- [Feature roadmap](./ROADMAP.md)
- [Project structure and GUI reference](https://github.com/smartalex32/Workforce-Compass/issues/1)

## Local development

```bash
npm install
npm run db:generate
npm run dev
```

The app uses a Cloudflare D1 binding named `DB`. Apply the generated files in `drizzle/` to the local D1 database before testing persistence.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs the same locked-install, test, typecheck, lint, and production-build gates for every pull request and push to `main`.

## Architecture

- `lib/domain.ts` contains deterministic compensation, team median, monotone curve, replacement-cost, and retention-exposure calculations.
- `db/schema.ts` defines the relational organization, labor market, discipline, ladder, level, dataset, employee, market compensation, and assumption entities.
- `lib/workspace-repository.ts` owns scope-preserving D1 reads, writes, context discovery, and parent/scope conflict protection.
- `lib/context-management.ts` creates new related scopes while preserving only data that remains valid for the selected hierarchy.
- `app/api/workspace/route.ts` validates requests and exposes the persistence boundary for analysis workspaces.
- `components/workforce-explorer.tsx` owns the primary visualization and linked analysis views.
- `components/management-dialogs.tsx` contains employee, career structure, market data, and planning assumption editors.

## Workspace persistence API

- `GET /api/workspace` loads the default persisted context.
- `GET /api/workspace?organizationId=…&laborMarketId=…&disciplineId=…&ladderId=…&datasetId=…` loads an explicit, relationship-validated context and returns 404 when the selection is invalid.
- `GET /api/workspace/contexts` returns the organization, market, discipline, ladder, and dataset catalog. An optional `organizationId` narrows the catalog.
- `PUT /api/workspace` atomically upserts the selected hierarchy and replaces only that ladder/dataset’s observations and assumptions. Other organizations, markets, ladders, and datasets are preserved.

Existing child IDs cannot be silently moved to a different parent or analysis scope; conflicting writes return HTTP 409.

Employee records are not logged or sent to analytics. The Sites deployment is owner-only, so its application and data endpoints are protected by the platform access layer. Self-hosters should place the app behind their organization’s authentication boundary before entering production compensation data.
