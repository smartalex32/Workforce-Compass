# Workforce Compass Roadmap

This roadmap translates the PRD and GUI reference in [Issue #1](https://github.com/smartalex32/Workforce-Compass/issues/1) into traceable delivery work. Requirement IDs resolve to [REQUIREMENTS.md](./REQUIREMENTS.md).

## Phase 0 — Product structure

- [x] Establish canonical requirements, roadmap, README, visual direction, and issue traceability — [#1](https://github.com/smartalex32/Workforce-Compass/issues/1)

## Phase 1 — MVP foundation

- [x] Strongly typed domain model and D1 relational schema — [#2](https://github.com/smartalex32/Workforce-Compass/issues/2)
  - Organization, labor market, discipline, ladder, and arbitrary ordered levels
  - Named datasets, market rows, employees, and per-level assumptions
  - Persist/reload flow with explicit unavailable values
  - Scope-preserving multi-context saves, explicit context selection, and a context catalog
- [x] Career structure and active market-data editor — [#3](https://github.com/smartalex32/Workforce-Compass/issues/3)
  - Level add/remove/reorder
  - P25/P50/P75 entry and validation
  - Dataset metadata and planning assumptions
- [x] Employee create/edit/delete workflow — [#4](https://github.com/smartalex32/Workforce-Compass/issues/4)

## Phase 2 — Core analysis

- [x] Dominant compensation-curve workspace — [#5](https://github.com/smartalex32/Workforce-Compass/issues/5)
  - P25–P75 band and monotone P50 curve
  - Individual employee points with deterministic same-level jitter
  - Team curve derived only from level medians with adequate sample size
  - Market/team gap, range-position, and low-confidence states
  - Right-side contextual employee detail
- [x] Transparent replacement model — [#6](https://github.com/smartalex32/Workforce-Compass/issues/6)
  - Hiring, vacancy, and ramp cost components
  - Estimated replacement cost and retention exposure
  - Editable per-level assumptions and explicit planning disclaimers
- [x] Linked alternate views — [#7](https://github.com/smartalex32/Workforce-Compass/issues/7)
  - Replacement exposure by employee/level
  - Market Gap × Replacement Cost matrix

## Phase 3 — Production hardening

- [x] Owner-only hosted access boundary, responsive behavior, semantic unavailable states, and accessible interactions — [#8](https://github.com/smartalex32/Workforce-Compass/issues/8)
- [x] Calculation unit tests, type check, lint, production build, schema migration, and self-hosting documentation — [#9](https://github.com/smartalex32/Workforce-Compass/issues/9)
- [x] Add API route/integration tests for persistence transactionality and malformed payloads — [#9](https://github.com/smartalex32/Workforce-Compass/issues/9)

## Phase 4 — Multi-context MVP completion

- [x] Create and manage multiple organizations, labor markets, disciplines, ladders, and datasets in the UI instead of editing one active workspace — [#3](https://github.com/smartalex32/Workforce-Compass/issues/3)
- [x] Make all context filter controls switch persisted scopes and refresh every linked view — [#3](https://github.com/smartalex32/Workforce-Compass/issues/3), [#9](https://github.com/smartalex32/Workforce-Compass/issues/9)
- [x] Add searchable employee table/filter treatment from the reference GUI while keeping the compensation curve dominant — [#4](https://github.com/smartalex32/Workforce-Compass/issues/4), [#8](https://github.com/smartalex32/Workforce-Compass/issues/8)
- [x] Add contextual sidebar navigation and owner-access treatment from the reference GUI — [#8](https://github.com/smartalex32/Workforce-Compass/issues/8)
- [x] Add stacked replacement-cost-by-level summary from the reference GUI — [#7](https://github.com/smartalex32/Workforce-Compass/issues/7)

## Post-MVP

- [ ] CSV workflows, integrations, history, total compensation, geography, tenure, organizational hierarchy, scenarios, budgets, richer productivity curves, roles, audit history, and advanced statistics — [#10](https://github.com/smartalex32/Workforce-Compass/issues/10)
