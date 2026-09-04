# Workforce Compass Requirements

This is the canonical requirement inventory derived from the product requirements document and the GUI reference in [Issue #1](https://github.com/smartalex32/Workforce-Compass/issues/1). Status describes the current local implementation; an issue link provides traceability for every requirement.

Status values: **Implemented locally** means complete in the current checkout but not yet merged to `main`; **Partial** means the foundation exists but the full workflow remains; **Planned** is not implemented; **Deferred** is intentionally post-MVP.

## Domain and persistence

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-DOM-01 | Model Organization → Labor Market → Discipline → Career Ladder → Level as explicit relational entities. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-02 | Levels have an ID, display name, numeric order, and optional description; names and count are not hardcoded. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-03 | Market compensation belongs to a labor market, discipline, ladder, level, and named dataset. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-04 | Market datasets store name, description, effective date, source, labor market, and active status. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-05 | Employees store name, discipline, ladder, level, base salary, and optional title/notes. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-06 | Hiring assumptions are scoped by discipline, ladder, and level. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-07 | Keep employee, market, and assumption data logically distinct. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-08 | Leave room for future employee, market, and compensation fields without redesigning the core model. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-01 | Persist all configured data in relational storage rather than browser-only storage. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-02 | Reload the application without losing saved data. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-03 | Treat missing market rows and assumptions as unavailable, never as implicit zero. | Implemented locally | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-04 | Support multiple entities/datasets in the schema even when only one active workspace is displayed. | Partial | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |

## Market and structure management

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-MKT-01 | Create and edit organization, labor market, discipline, ladder, and dataset context in the UI. | Partial | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-02 | Add, rename, describe, order, and remove arbitrary levels in the UI. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-03 | Enter P25, P50, and P75 base compensation per level. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-04 | Enforce positive values and P25 ≤ P50 ≤ P75 for every entered row. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-05 | Allow a level to have no market row and present that analysis as unavailable. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-06 | Retain dataset name, source, description, and effective date. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-07 | Support multiple datasets in the architecture and one selected dataset in the MVP UI. | Partial | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-08 | Filter the analysis by labor market, discipline, ladder, and market dataset. | Partial | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-09 | Make all MVP configuration editable without source or configuration-file changes. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-01 | Clearly label observed data, market data, planning assumptions, and calculated metrics. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-02 | Use direct editing and progressive disclosure instead of raw configuration. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-03 | Display save/loading/error state for persistence. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-04 | Validate referential integrity and reject malformed workspace input. | Implemented locally | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |

## Employees

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-EMP-01 | Add employees manually with name, level, base salary, optional title, and optional notes. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-02 | Edit an employee’s identity, title, level, salary, and notes. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-03 | Delete an employee with an explicit confirmation step. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-04 | Keep sensitive fields unnecessary for the core workflow. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-05 | Plot every employee as an independent observation at level and salary. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-06 | Make same-level employees distinguishable without implying a different level. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-07 | Select an employee from any analysis view to open contextual detail. | Implemented locally | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-08 | Provide searchable/tabular employee management inspired by the GUI reference. | Planned | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |

## Compensation calculations and visualization

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-CALC-01 | Calculate signed market gap amount and percentage against the selected P50. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-02 | Calculate a level team median from individual employee salaries. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-03 | Calculate signed team gap amount and percentage against the level median. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-04 | Describe market-range/percentile position where calculable. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-05 | Use transparent outlier language; never declare an employee incorrectly compensated. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-06 | Keep formulas deterministic, UI-independent, documented, and unit testable. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-07 | Handle missing and invalid inputs explicitly. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-01 | Make an interactive compensation chart the dominant workspace. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-02 | Use ordered career levels on X and annual compensation on Y. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-03 | Render P25–P75 as a coherent market band. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-04 | Render P50 as a smooth market median curve while preserving observations. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-05 | Render employee observations separately from estimated structures. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-06 | Derive the team curve from level medians, never directly from employee points. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-07 | Avoid a team curve at a level with fewer than two observations. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-08 | Use deterministic monotone interpolation that avoids artificial decreases. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-09 | Toggle market band, market median, team curve, and employees independently. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-10 | Show employee name, level, salary, market difference, team difference, and replacement estimate on hover/select. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-11 | Keep market and team comparisons visually distinct. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-12 | Open detail in a right-side panel without navigating away. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-13 | Use the reference GUI’s restrained navy/blue data-product visual language. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-14 | Do not let supporting information compete with the primary graph. | Implemented locally | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |

## Replacement planning

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-REP-01 | Configure time to hire and ramp days by discipline, ladder, and level. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-02 | Configure vacancy multiplier and ramp loss factor by level. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-03 | Configure recruiting, interview, signing/relocation, and other hiring cost. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-04 | Calculate daily compensation as annual base salary ÷ 260. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-05 | Calculate hiring cost as the sum of its four editable components. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-06 | Calculate vacancy cost as daily compensation × hire days × vacancy multiplier. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-07 | Calculate ramp cost as daily compensation × ramp days × ramp loss factor. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-08 | Calculate estimated replacement cost as hiring + vacancy + ramp cost. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-09 | Expose every assumption and cost component to the user. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-10 | Label replacement results as estimates based on planning assumptions. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-11 | Calculate market adjustment as max(0, P50 − salary). | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-12 | Calculate retention exposure as market adjustment + estimated replacement cost. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-13 | State that retention exposure does not predict whether an employee will leave. | Implemented locally | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |

## Alternate views

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-VIEW-01 | Switch among Compensation Curve, Replacement Exposure, and Market Gap × Cost as views of one dataset. | Implemented locally | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-02 | Show estimated replacement exposure across career levels/employees. | Implemented locally | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-03 | Plot market compensation gap on X and estimated replacement cost on Y. | Implemented locally | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-04 | Plot each calculable employee as a selectable point. | Implemented locally | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-05 | Use descriptive quadrant guidance, not definitive employee classifications. | Implemented locally | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-06 | Preserve the current filters and detail interaction across views. | Implemented locally | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-07 | Provide stacked level-cost and matrix summaries like the reference GUI without crowding the primary view. | Partial | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |

## UX, data quality, and privacy

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-UX-01 | Use a desktop-first responsive layout with functional mobile behavior. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-02 | Keep navigation minimal and switching fast. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-03 | Use contextual side panels and dialogs for progressive disclosure. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-04 | Provide keyboard-focusable chart points and accessible labels. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-05 | Give data-management actions clear labels and feedback. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-06 | Provide sidebar navigation and user identity treatment shown in the GUI reference. | Partial | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-07 | Provide employee search/filter controls shown in the GUI reference. | Planned | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-08 | Use clear currency formatting and signed positive/negative comparisons. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-09 | Avoid implying more precision than source data and assumptions support. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-01 | Display “Not available” when required market or assumption inputs are absent. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-02 | Never silently substitute missing compensation or cost inputs with zero. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-03 | Warn about low internal sample sizes. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-04 | Keep original observations visible alongside estimates. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-05 | Validate IDs, references, ordering, uniqueness, ranges, and non-negative assumptions at the persistence boundary. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-01 | Do not expose compensation data through unauthenticated public deployment endpoints. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-02 | Do not log employee names or salaries unnecessarily. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-03 | Do not send production employee records to analytics/telemetry. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-04 | Establish an authorization boundary that can grow into granular roles later. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-05 | Keep the hosted site owner-only by default. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-06 | Document that self-hosted installations require an authentication boundary. | Implemented locally | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |

## Engineering and acceptance

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-ENG-01 | Use strongly typed domain models and presentation-independent calculation functions. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-02 | Use reusable visualization primitives and deterministic curve calculations. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-03 | Unit-test financial, comparison, median, validation, and interpolation logic. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-04 | Keep the application self-hostable with minimal external dependencies. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-05 | Avoid premature enterprise HR infrastructure. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-06 | Pass type checking, linting, unit tests, and production build. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-07 | Keep dependencies free of known high/critical vulnerabilities where practical. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-08 | Provide a relational migration for all core entities. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-09 | Provide web-agent-readable summary and employee-add actions. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-10 | Document setup, architecture, validation, privacy, and known limitations. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-01 | A user can create a discipline and career ladder. | Partial | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-02 | A user can define arbitrary ordered levels. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-03 | A user can create a labor market. | Partial | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-04 | A user can create a market dataset. | Partial | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-05 | A user can enter P25/P50/P75 compensation for each available level. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-06 | A user can add employees and assign salary and level. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-07 | Employees are plotted against the market compensation band. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-08 | The selected market median appears as a smooth curve. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-09 | The internal curve is derived from team level medians. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-10 | Selecting an employee shows market and internal differences. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-11 | A user can configure time-to-hire and ramp assumptions by level. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-12 | A user can configure replacement-cost assumptions. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-13 | The application calculates estimated replacement cost for an employee. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-14 | The employee detail exposes each component contributing to the replacement estimate. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-15 | Employees can be viewed on the Market Gap × Replacement Cost visualization. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-16 | Changing among multiple markets, disciplines, ladders, or datasets updates the analysis. | Planned | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-17 | Reloading the application preserves configured data. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-18 | Missing required inputs produce clear “Not available” states. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-19 | All primary functionality is available without editing source or configuration files. | Implemented locally | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |

## Explicitly deferred opportunities

All items below are **Deferred** and tracked in [#10](https://github.com/smartalex32/Workforce-Compass/issues/10):

| ID | Requirement |
|---|---|
| R-FUT-01 | CSV employee import/export |
| R-FUT-02 | CSV market-data import/export |
| R-FUT-03 | HRIS integration |
| R-FUT-04 | Compensation-survey APIs and automatic market retrieval |
| R-FUT-05 | Multiple market datasets overlaid simultaneously |
| R-FUT-06 | Historical compensation snapshots and salary-change history |
| R-FUT-07 | Bonus, equity, benefits, and total compensation |
| R-FUT-08 | Geographic cost-of-labor adjustments |
| R-FUT-09 | Employee tenure |
| R-FUT-10 | Organization, team, and manager hierarchy |
| R-FUT-11 | Scenario planning and budget modeling |
| R-FUT-12 | Productivity-over-time replacement curves |
| R-FUT-13 | Historical time-to-hire analysis |
| R-FUT-14 | Granular authentication roles and permissions |
| R-FUT-15 | Audit history |
| R-FUT-16 | Advanced statistical outlier detection |
| R-FUT-17 | Performance analysis |
| R-FUT-18 | Turnover prediction or “flight risk” scoring |
| R-FUT-19 | Automated compensation, termination, or hiring recommendations |
