# Workforce Compass

A self-hostable workforce planning application for comparing employee base salaries with external market ranges, internal level medians, and configurable replacement-cost assumptions. It is designed to answer a practical question without overstating certainty: where does an employee sit relative to the market and team, and what is the modeled economic exposure of replacing them?

The product is built around three linked views:

- Compensation curve — P25–P75 market band, market median, team-level median curve, and employee observations.
- Replacement exposure — the modeled hiring, vacancy, and ramp cost for each employee.
- Market gap × cost — compensation gap and replacement exposure in one planning view.

Retention exposure is a planning metric, not a prediction that an employee will leave.

## Current capabilities

- Configure the active organization, labor market, discipline, ladder, arbitrary levels, and market dataset.
- Enter validated P25/P50/P75 ranges and preserve missing rows as unavailable.
- Add, edit, delete, level, and compensate employees.
- Inspect a market band, monotone market median, team-level median curve, and individual observations.
- Select an employee for market gap, team gap, market position, replacement-cost components, and retention exposure.
- Configure time-to-hire, ramp, vacancy, productivity-loss, recruiting, interview, relocation/signing, and other cost assumptions by level.
- Switch among Compensation Curve, Replacement Exposure, and Market Gap × Cost views.
- Persist the active workspace in Cloudflare D1.

The relational schema supports multiple contexts, but the current UI edits and displays one active organization/market/discipline/ladder/dataset workspace. Multi-context creation and switching remain tracked in the [roadmap](./ROADMAP.md).

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

## Architecture

- `lib/domain.ts` contains deterministic compensation, team median, monotone curve, replacement-cost, and retention-exposure calculations.
- `db/schema.ts` defines the relational organization, labor market, discipline, ladder, level, dataset, employee, market compensation, and assumption entities.
- `app/api/workspace/route.ts` is the persistence boundary for the active analysis workspace.
- `components/workforce-explorer.tsx` owns the primary visualization and linked analysis views.
- `components/management-dialogs.tsx` contains employee, career structure, market data, and planning assumption editors.

Employee records are not logged or sent to analytics. The Sites deployment is owner-only, so its application and data endpoints are protected by the platform access layer. Self-hosters should place the app behind their organization’s authentication boundary before entering production compensation data.
