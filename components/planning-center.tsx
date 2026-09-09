'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  GitBranch,
  History,
  LineChart,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Workspace } from '@/lib/domain';
import { employeeTenureYears, totalCompensation } from '@/lib/domain';
import type { PlanningHistory } from '@/lib/planning-repository';
import type { WorkspaceContexts } from '@/lib/workspace-repository';
import type {
  PlanningRole,
  PlanningState,
  WorkforceScenario,
} from '@/lib/workforce-planning';
import {
  evaluateScenario,
  exportEmployeesCsv,
  exportMarketCsv,
  planningSuggestions,
  historicalTimeToHireDays,
  importEmployeesCsv,
  importMarketCsv,
  performanceCompensationSummary,
  robustSalaryOutliers,
} from '@/lib/workforce-planning';

function download(name: string, contents: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

const emptyHistory: PlanningHistory = {
  snapshots: [],
  salaryChanges: [],
  auditEvents: [],
};

export function PlanningCenter({
  workspace,
  contexts,
  disabled,
  onSave,
}: {
  workspace: Workspace;
  contexts: WorkspaceContexts;
  disabled: boolean;
  onSave: (workspace: Workspace) => Promise<boolean>;
}) {
  const [state, setState] = useState<PlanningState | null>(null);
  const [role, setRole] = useState<PlanningRole | null>(null);
  const [history, setHistory] = useState<PlanningHistory>(emptyHistory);
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState(100_000);
  const [overlays, setOverlays] = useState<
    Array<{
      id: string;
      name: string;
      median: number | null;
      market: Workspace['market'];
    }>
  >([]);

  useEffect(() => {
    let active = true;
    void fetch(
      `/api/planning?organizationId=${encodeURIComponent(workspace.organization.id)}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Planning data unavailable');
        return response.json() as Promise<{
          state: PlanningState;
          role: PlanningRole;
          history: PlanningHistory;
        }>;
      })
      .then((result) => {
        if (!active) return;
        setState(result.state);
        setRole(result.role);
        setHistory(result.history);
      })
      .catch(() => {
        if (active)
          setMessage(
            'Planning history is unavailable until the latest database migration is applied.',
          );
      });
    return () => {
      active = false;
    };
  }, [workspace.organization.id]);

  const metrics = useMemo(() => {
    const tenures = workspace.employees.flatMap((employee) => {
      const tenure = employeeTenureYears(employee);
      return tenure === null ? [] : [tenure];
    });
    const outliers = robustSalaryOutliers(workspace.employees);
    const performance = performanceCompensationSummary(workspace.employees);
    const suggestions = planningSuggestions(workspace);
    const totalPayroll = workspace.employees.reduce(
      (sum, employee) => sum + totalCompensation(employee),
      0,
    );
    return {
      averageTenure: tenures.length
        ? tenures.reduce((sum, value) => sum + value, 0) / tenures.length
        : null,
      outliers,
      performance,
      suggestions,
      totalPayroll,
    };
  }, [workspace]);

  const marketAlignedScenario = useMemo<WorkforceScenario>(
    () => ({
      id: 'market-alignment',
      name: 'Bring below-market salaries to P50',
      budget,
      changes: workspace.employees.flatMap((employee) => {
        const market = workspace.market.find(
          (point) => point.levelId === employee.levelId,
        );
        return market && employee.salary < market.p50
          ? [{ employeeId: employee.id, proposedSalary: market.p50 }]
          : [];
      }),
    }),
    [budget, workspace],
  );
  const scenarioResult = evaluateScenario(workspace, marketAlignedScenario);

  async function importCsv(
    file: File | undefined,
    kind: 'employees' | 'market',
  ) {
    if (!file) return;
    try {
      const input = await file.text();
      const result =
        kind === 'employees'
          ? importEmployeesCsv(input, workspace)
          : importMarketCsv(input, workspace);
      if (result.errors.length) {
        setMessage(result.errors.join(' '));
        return;
      }
      const next =
        kind === 'employees'
          ? {
              ...workspace,
              employees: result.records as typeof workspace.employees,
            }
          : { ...workspace, market: result.records as typeof workspace.market };
      setMessage(
        (await onSave(next))
          ? `${result.records.length} ${kind === 'employees' ? 'employees' : 'market rows'} imported.`
          : 'Import could not be saved.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'CSV import failed.');
    }
  }

  async function saveScenario() {
    if (!state || (role !== 'admin' && role !== 'analyst')) return;
    try {
      const next = {
        ...state,
        scenarios: [
          ...state.scenarios.filter(
            (item) => item.id !== marketAlignedScenario.id,
          ),
          marketAlignedScenario,
        ],
      };
      const response = await fetch('/api/planning', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: workspace.organization.id, state: next }),
      });
      if (response.ok) {
        setState(next);
        setMessage('Scenario saved with an audit entry.');
      } else setMessage('Scenario could not be saved.');
    } catch {
      setMessage('Scenario could not be saved.');
    }
  }

  async function compareDatasets() {
    try {
      const candidates = contexts.datasets.filter(
        (dataset) => dataset.laborMarketId === workspace.laborMarket.id,
      );
      const results = await Promise.all(
        candidates.map(async (dataset) => {
          const parameters = new URLSearchParams({ organizationId: workspace.organization.id, laborMarketId: workspace.laborMarket.id, disciplineId: workspace.discipline.id, ladderId: workspace.ladder.id, datasetId: dataset.id });
          const response = await fetch(`/api/workspace?${parameters}`);
          if (!response.ok) return null;
          const result = (await response.json()) as { workspace: Workspace };
          const values = result.workspace.market.map((point) => point.p50);
          return { id: dataset.id, name: dataset.name, median: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, market: result.workspace.market };
        }),
      );
      setOverlays(results.filter((item): item is NonNullable<typeof item> => item !== null));
    } catch {
      setMessage('Market datasets could not be compared.');
    }
  }

  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: workspace.organization.currency,
    maximumFractionDigits: 0,
  });
  const levelHireMedians =
    state?.hiringHistory.flatMap((_, index) =>
      index
        ? []
        : workspace.levels.map((level) => ({
            level: level.name,
            days: historicalTimeToHireDays(state.hiringHistory, level.id),
          })),
    ) ?? [];
  const overlayChart = useMemo(() => {
    const values = overlays.flatMap((overlay) =>
      overlay.market.map((point) => point.p50),
    );
    if (!values.length) return [];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum || 1;
    return overlays.map((overlay) => ({
      ...overlay,
      points: workspace.levels
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap((level, index, levels) => {
          const value = overlay.market.find(
            (point) => point.levelId === level.id,
          )?.p50;
          return value === undefined
            ? []
            : [
                `${20 + (index / Math.max(1, levels.length - 1)) * 260},${90 - ((value - minimum) / span) * 70}`,
              ];
        })
        .join(' '),
    }));
  }, [overlays, workspace.levels]);

  return (
    <section
      id="planning"
      className="planning-center"
      aria-labelledby="planning-title"
    >
      <div className="planning-heading">
        <div>
          <p className="eyebrow">Post-MVP planning</p>
          <h2 id="planning-title">Workforce planning center</h2>
          <p>
            Portable data, historical context, scenario budgets, and transparent
            review signals.
          </p>
        </div>
        <span className="planning-role">
          <ShieldCheck /> {role ?? 'loading'} access
        </span>
      </div>

      <div className="planning-grid">
        <article>
          <Download />
          <h3>Data portability</h3>
          <p>
            Round-trip employee and market observations with validated CSV
            files.
          </p>
          <div className="planning-actions">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download('employees.csv', exportEmployeesCsv(workspace))
              }
            >
              <Download /> Employees
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download('market-data.csv', exportMarketCsv(workspace))
              }
            >
              <Download /> Market
            </Button>
            <label className="file-button">
              <Upload /> Import employees
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={disabled}
                onChange={(event) =>
                  void importCsv(event.target.files?.[0], 'employees')
                }
              />
            </label>
            <label className="file-button">
              <Upload /> Import market
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={disabled}
                onChange={(event) =>
                  void importCsv(event.target.files?.[0], 'market')
                }
              />
            </label>
          </div>
        </article>

        <article>
          <LineChart />
          <h3>Compensation & statistics</h3>
          <dl>
            <div>
              <dt>Annual total compensation</dt>
              <dd>{currency.format(metrics.totalPayroll)}</dd>
            </div>
            <div>
              <dt>Average recorded tenure</dt>
              <dd>
                {metrics.averageTenure === null
                  ? 'Not available'
                  : `${metrics.averageTenure.toFixed(1)} years`}
              </dd>
            </div>
            <div>
              <dt>IQR salary outliers</dt>
              <dd>{metrics.outliers.length}</dd>
            </div>
            <div>
              <dt>Performance sample</dt>
              <dd>
                {metrics.performance
                  ? `${metrics.performance.sampleSize} · r ${metrics.performance.correlation?.toFixed(2) ?? 'N/A'}`
                  : 'Insufficient data'}
              </dd>
            </div>
          </dl>
        </article>

        <article>
          <GitBranch />
          <h3>Organization hierarchy</h3>
          <p>
            {
              new Set(
                workspace.employees
                  .map((employee) => employee.team)
                  .filter(Boolean),
              ).size
            }{' '}
            teams ·{' '}
            {
              workspace.employees.filter((employee) => employee.managerId)
                .length
            }{' '}
            manager relationships
          </p>
          <ul className="planning-list">
            {workspace.employees.slice(0, 5).map((employee) => (
              <li key={employee.id}>
                <strong>{employee.name}</strong>
                <span>
                  {employee.team || 'No team'} ·{' '}
                  {workspace.employees.find(
                    (manager) => manager.id === employee.managerId,
                  )?.name || 'No manager'}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article>
          <History />
          <h3>History & audit</h3>
          <dl>
            <div>
              <dt>Compensation snapshots</dt>
              <dd>{history.snapshots.length}</dd>
            </div>
            <div>
              <dt>Salary changes</dt>
              <dd>{history.salaryChanges.length}</dd>
            </div>
            <div>
              <dt>Audit events</dt>
              <dd>{history.auditEvents.length}</dd>
            </div>
            <div>
              <dt>Saved scenarios</dt>
              <dd>{state?.scenarios.length ?? 0}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="planning-panels">
        <article>
          <h3>Market-alignment scenario</h3>
          <p>
            Model raises to the selected market P50; no pay changes are applied
            automatically.
          </p>
          <label>
            <span>Annual budget</span>
            <Input
              type="number"
              min="0"
              value={budget}
              onChange={(event) =>
                setBudget(Math.max(0, Number(event.target.value) || 0))
              }
            />
          </label>
          <div className="scenario-result">
            <strong>{currency.format(scenarioResult.annualCost)}</strong>
            <span>
              {scenarioResult.withinBudget
                ? `${currency.format(scenarioResult.remainingBudget)} remaining`
                : `${currency.format(Math.abs(scenarioResult.remainingBudget))} over budget`}
            </span>
          </div>
          <Button
            size="sm"
            disabled={!state || (role !== 'admin' && role !== 'analyst')}
            onClick={() => void saveScenario()}
          >
            Save scenario
          </Button>
        </article>
        <article>
          <h3>Market dataset overlay</h3>
          <p>
            Overlay every P50 curve in this labor market without replacing the
            active analysis.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void compareDatasets()}
          >
            Compare{' '}
            {
              contexts.datasets.filter(
                (dataset) => dataset.laborMarketId === workspace.laborMarket.id,
              ).length
            }{' '}
            datasets
          </Button>
          {overlayChart.length > 0 && (
            <svg
              className="overlay-chart"
              viewBox="0 0 300 105"
              role="img"
              aria-label="P50 compensation curves for all market datasets"
            >
              <line x1="20" y1="90" x2="280" y2="90" />
              {overlayChart.map((overlay, index) => (
                <polyline
                  key={overlay.id}
                  points={overlay.points}
                  style={{
                    stroke: ['#208d83', '#667085', '#e28a42', '#6f62a8'][
                      index % 4
                    ],
                  }}
                />
              ))}
            </svg>
          )}
          <ul className="planning-list">
            {overlays.map((overlay) => (
              <li key={overlay.id}>
                <strong>{overlay.name}</strong>
                <span>
                  {overlay.median === null
                    ? 'No market rows'
                    : `${currency.format(overlay.median)} average P50`}
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Decision-support review</h3>
          <p>
            {metrics.suggestions.length} transparent review suggestions. These
            are not termination, hiring, or compensation decisions and always
            require human review.
          </p>
          <ul className="planning-list">
            {metrics.suggestions.slice(0, 4).map((suggestion) => (
              <li key={`${suggestion.employeeId}-${suggestion.kind}-${'levelId' in suggestion ? suggestion.levelId : ''}`}>
                <strong>
                  {(
                    workspace.employees.find(
                      (employee) => employee.id === suggestion.employeeId,
                    )?.name ?? ('levelId' in suggestion
                      ? workspace.levels.find((level) => level.id === suggestion.levelId)?.name
                      : undefined)
                  )}
                </strong>
                <span>{suggestion.rationale}</span>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Hiring & productivity models</h3>
          <p>
            Vendor-neutral sync endpoint: <code>/api/integrations/sync</code>.
            Historical time-to-hire and configurable productivity curves are
            stored with the planning profile.
          </p>
          <ul className="planning-list">
            {levelHireMedians
              .filter((item) => item.days !== null)
              .map((item) => (
                <li key={item.level}>
                  <strong>{item.level}</strong>
                  <span>{item.days!.toFixed(0)} median days to hire</span>
                </li>
              ))}
          </ul>
        </article>
      </div>
      {message && (
        <p className="planning-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
