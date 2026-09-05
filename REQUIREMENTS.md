# Workforce Compass Requirements

This is the canonical requirement inventory derived from the product requirements document and the GUI reference in [Issue #1](https://github.com/smartalex32/Workforce-Compass/issues/1). Status describes the current implementation; an issue link provides traceability for every requirement.

Status values: **Implemented** means the requirement is complete; **Partial** means the foundation exists but the full workflow remains; **Planned** is not implemented; **Deferred** is intentionally post-MVP.

## Domain and persistence

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-DOM-01 | Model Organization → Labor Market → Discipline → Career Ladder → Level as explicit relational entities. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-02 | Levels have an ID, display name, numeric order, and optional description; names and count are not hardcoded. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-03 | Market compensation belongs to a labor market, discipline, ladder, level, and named dataset. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-04 | Market datasets store name, description, effective date, source, labor market, and active status. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-05 | Employees store name, discipline, ladder, level, base salary, and optional title/notes. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-06 | Hiring assumptions are scoped by discipline, ladder, and level. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-07 | Keep employee, market, and assumption data logically distinct. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-DOM-08 | Leave room for future employee, market, and compensation fields without redesigning the core model. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-01 | Persist all configured data in relational storage rather than browser-only storage. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-02 | Reload the application without losing saved data. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-03 | Treat missing market rows and assumptions as unavailable, never as implicit zero. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |
| R-PER-04 | Support multiple entities/datasets in the schema even when only one active workspace is displayed. | Implemented | [#2](https://github.com/smartalex32/Workforce-Compass/issues/2) |

## Market and structure management

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-MKT-01 | Create and edit organization, labor market, discipline, ladder, and dataset context in the UI. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-02 | Add, rename, describe, order, and remove arbitrary levels in the UI. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-03 | Enter P25, P50, and P75 base compensation per level. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-04 | Enforce positive values and P25 ≤ P50 ≤ P75 for every entered row. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-05 | Allow a level to have no market row and present that analysis as unavailable. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-06 | Retain dataset name, source, description, and effective date. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-07 | Support multiple datasets in the architecture and one selected dataset in the MVP UI. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-08 | Filter the analysis by labor market, discipline, ladder, and market dataset. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MKT-09 | Make all MVP configuration editable without source or configuration-file changes. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-01 | Clearly label observed data, market data, planning assumptions, and calculated metrics. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-02 | Use direct editing and progressive disclosure instead of raw configuration. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-03 | Display save/loading/error state for persistence. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |
| R-MGT-04 | Validate referential integrity and reject malformed workspace input. | Implemented | [#3](https://github.com/smartalex32/Workforce-Compass/issues/3) |

## Employees

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-EMP-01 | Add employees manually with name, level, base salary, optional title, and optional notes. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-02 | Edit an employee’s identity, title, level, salary, and notes. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-03 | Delete an employee with an explicit confirmation step. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-04 | Keep sensitive fields unnecessary for the core workflow. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-05 | Plot every employee as an independent observation at level and salary. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-06 | Make same-level employees distinguishable without implying a different level. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-07 | Select an employee from any analysis view to open contextual detail. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |
| R-EMP-08 | Provide searchable/tabular employee management inspired by the GUI reference. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4) |

## Compensation calculations and visualization

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-CALC-01 | Calculate signed market gap amount and percentage against the selected P50. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-02 | Calculate a level team median from individual employee salaries. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-03 | Calculate signed team gap amount and percentage against the level median. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-04 | Describe market-range/percentile position where calculable. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-05 | Use transparent outlier language; never declare an employee incorrectly compensated. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-06 | Keep formulas deterministic, UI-independent, documented, and unit testable. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-CALC-07 | Handle missing and invalid inputs explicitly. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-01 | Make an interactive compensation chart the dominant workspace. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-02 | Use ordered career levels on X and annual compensation on Y. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-03 | Render P25–P75 as a coherent market band. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-04 | Render P50 as a smooth market median curve while preserving observations. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-05 | Render employee observations separately from estimated structures. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-06 | Derive the team curve from level medians, never directly from employee points. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-07 | Avoid a team curve at a level with fewer than two observations. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-08 | Use deterministic monotone interpolation that avoids artificial decreases. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-09 | Toggle market band, market median, team curve, and employees independently. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-10 | Show employee name, level, salary, market difference, team difference, and replacement estimate on hover/select. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-11 | Keep market and team comparisons visually distinct. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-12 | Open detail in a right-side panel without navigating away. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-13 | Use the reference GUI’s restrained navy/blue data-product visual language. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |
| R-VIZ-14 | Do not let supporting information compete with the primary graph. | Implemented | [#5](https://github.com/smartalex32/Workforce-Compass/issues/5) |

## Replacement planning

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-REP-01 | Configure time to hire and ramp days by discipline, ladder, and level. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-02 | Configure vacancy multiplier and ramp loss factor by level. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-03 | Configure recruiting, interview, signing/relocation, and other hiring cost. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-04 | Calculate daily compensation as annual base salary ÷ 260. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-05 | Calculate hiring cost as the sum of its four editable components. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-06 | Calculate vacancy cost as daily compensation × hire days × vacancy multiplier. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-07 | Calculate ramp cost as daily compensation × ramp days × ramp loss factor. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-08 | Calculate estimated replacement cost as hiring + vacancy + ramp cost. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-09 | Expose every assumption and cost component to the user. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-10 | Label replacement results as estimates based on planning assumptions. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-11 | Calculate market adjustment as max(0, P50 − salary). | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-12 | Calculate retention exposure as market adjustment + estimated replacement cost. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |
| R-REP-13 | State that retention exposure does not predict whether an employee will leave. | Implemented | [#6](https://github.com/smartalex32/Workforce-Compass/issues/6) |

## Alternate views

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-VIEW-01 | Switch among Compensation Curve, Replacement Exposure, and Market Gap × Cost as views of one dataset. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-02 | Show estimated replacement exposure across career levels/employees. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-03 | Plot market compensation gap on X and estimated replacement cost on Y. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-04 | Plot each calculable employee as a selectable point. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-05 | Use descriptive quadrant guidance, not definitive employee classifications. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-06 | Preserve the current filters and detail interaction across views. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |
| R-VIEW-07 | Provide stacked level-cost and matrix summaries like the reference GUI without crowding the primary view. | Implemented | [#7](https://github.com/smartalex32/Workforce-Compass/issues/7) |

## UX, data quality, and privacy

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-UX-01 | Use a desktop-first responsive layout with functional mobile behavior. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-02 | Keep navigation minimal and switching fast. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-03 | Use contextual side panels and dialogs for progressive disclosure. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-04 | Provide keyboard-focusable chart points and accessible labels. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-05 | Give data-management actions clear labels and feedback. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-06 | Provide sidebar navigation and user identity treatment shown in the GUI reference. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-07 | Provide employee search/filter controls shown in the GUI reference. | Implemented | [#4](https://github.com/smartalex32/Workforce-Compass/issues/4), [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-08 | Use clear currency formatting and signed positive/negative comparisons. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-UX-09 | Avoid implying more precision than source data and assumptions support. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-01 | Display “Not available” when required market or assumption inputs are absent. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-02 | Never silently substitute missing compensation or cost inputs with zero. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-03 | Warn about low internal sample sizes. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-04 | Keep original observations visible alongside estimates. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-DQ-05 | Validate IDs, references, ordering, uniqueness, ranges, and non-negative assumptions at the persistence boundary. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-01 | Do not expose compensation data through unauthenticated public deployment endpoints. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-02 | Do not log employee names or salaries unnecessarily. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-03 | Do not send production employee records to analytics/telemetry. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-04 | Establish an authorization boundary that can grow into granular roles later. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-05 | Keep the hosted site owner-only by default. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |
| R-PRIV-06 | Document that self-hosted installations require an authentication boundary. | Implemented | [#8](https://github.com/smartalex32/Workforce-Compass/issues/8) |

## Engineering and acceptance

| ID | Requirement | Status | Issue |
|---|---|---|---|
| R-ENG-01 | Use strongly typed domain models and presentation-independent calculation functions. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-02 | Use reusable visualization primitives and deterministic curve calculations. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-03 | Unit-test financial, comparison, median, validation, and interpolation logic. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-04 | Keep the application self-hostable with minimal external dependencies. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-05 | Avoid premature enterprise HR infrastructure. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-06 | Pass type checking, linting, unit tests, and production build. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-07 | Keep dependencies free of known high/critical vulnerabilities where practical. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-08 | Provide a relational migration for all core entities. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-09 | Provide web-agent-readable summary and employee-add actions. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ENG-10 | Document setup, architecture, validation, privacy, and known limitations. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-01 | A user can create a discipline and career ladder. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-02 | A user can define arbitrary ordered levels. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-03 | A user can create a labor market. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-04 | A user can create a market dataset. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-05 | A user can enter P25/P50/P75 compensation for each available level. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-06 | A user can add employees and assign salary and level. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-07 | Employees are plotted against the market compensation band. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-08 | The selected market median appears as a smooth curve. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-09 | The internal curve is derived from team level medians. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-10 | Selecting an employee shows market and internal differences. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-11 | A user can configure time-to-hire and ramp assumptions by level. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-12 | A user can configure replacement-cost assumptions. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-13 | The application calculates estimated replacement cost for an employee. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-14 | The employee detail exposes each component contributing to the replacement estimate. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-15 | Employees can be viewed on the Market Gap × Replacement Cost visualization. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-16 | Changing among multiple markets, disciplines, ladders, or datasets updates the analysis. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-17 | Reloading the application preserves configured data. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-18 | Missing required inputs produce clear “Not available” states. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |
| R-ACC-19 | All primary functionality is available without editing source or configuration files. | Implemented | [#9](https://github.com/smartalex32/Workforce-Compass/issues/9) |

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
