'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { CompensationChart } from '@/components/workforce-explorer';
import {
  employeeMetrics,
  hasMarketRange,
  teamMedianForLevel,
  type Employee,
  type Workspace,
} from '@/lib/domain';
import {
  effectivePayBand,
  utcDate,
  type Office,
  type OfficeWorkspaceData,
  type RosterPerson,
} from '@/lib/office-workspace';
import { officeMoney } from '@/components/office-people';

function hasAnalysisInputs(
  person: RosterPerson,
): person is RosterPerson & Employee {
  return Boolean(
    person.levelId &&
    person.careerLadderId &&
    person.disciplineId &&
    person.salary !== null &&
    person.salary > 0,
  );
}

export function OfficeAnalysis({
  data,
  office,
  demoWorkspace,
}: {
  data: OfficeWorkspaceData;
  office?: Office;
  demoWorkspace?: Workspace;
}) {
  const [scope, setScope] = useState(office ? 'office' : 'organization');
  const [ladder, setLadder] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{
    key: string;
    workspace?: Workspace;
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  const people =
    scope === 'office'
      ? data.people.filter((person) => person.officeId === office?.id)
      : data.people;
  const currentLadder =
    data.ladders.find((item) => item.id === ladder) ??
    data.ladders.find((item) =>
      people.some((person) => person.careerLadderId === item.id),
    ) ??
    data.ladders[0];
  const marketId =
    scope === 'office'
      ? (office?.laborMarketId ?? '')
      : selectedMarketId || office?.laborMarketId || data.markets[0]?.id || '';
  const currentMarket = data.markets.find((market) => market.id === marketId);
  const datasets = data.datasets
    .filter((item) => item.laborMarketId === marketId)
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') ||
        a.name.localeCompare(b.name),
    );
  const currentDataset =
    datasets.find((item) => item.id === selectedDatasetId) ??
    datasets.find((item) => item.active) ??
    datasets[0];
  const query =
    currentLadder && currentMarket && currentDataset
      ? new URLSearchParams({
          organizationId: data.organization.id,
          laborMarketId: currentMarket.id,
          disciplineId: currentLadder.disciplineId,
          ladderId: currentLadder.id,
          datasetId: currentDataset.id,
        }).toString()
      : '';
  const key = query && `${query}:${retry}`;

  useEffect(() => {
    if (!query || demoWorkspace) return;
    const controller = new AbortController();
    void fetch(`/api/workspace?${query}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('The dataset could not be loaded.');
        const result: { workspace: Workspace | null } = await response.json();
        if (!result.workspace) throw new Error('The dataset is unavailable.');
        setLoaded({ key, workspace: result.workspace });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted)
          setLoaded({ key, error: error.message });
      });
    return () => controller.abort();
  }, [demoWorkspace, key, query]);

  const source =
    demoWorkspace && demoWorkspace.dataset.id === currentDataset?.id
      ? demoWorkspace
      : loaded?.key === key
        ? loaded?.workspace
        : undefined;
  const error = loaded?.key === key ? loaded?.error : undefined;
  const loading = Boolean(query && !demoWorkspace && loaded?.key !== key);
  const levels = data.levels.filter(
    (level) => level.ladderId === currentLadder?.id,
  );
  const asOf = utcDate();
  const bandMarketId =
    scope === 'office' ? (office?.laborMarketId ?? null) : null;
  const payBands = levels.flatMap((level) => {
    const band = effectivePayBand(
      data.bands,
      level.id,
      bandMarketId,
      asOf,
    )?.values;
    return band ? [band] : [];
  });
  const bandLabel =
    scope === 'office' ? 'Effective pay band' : 'Company pay band';
  const eligible = people
    .filter(hasAnalysisInputs)
    .filter((person) => person.careerLadderId === currentLadder?.id);
  const pending = people.filter((person) => !hasAnalysisInputs(person)).length;
  const workspace: Workspace | undefined = currentLadder
    ? {
        organization: data.organization,
        discipline: {
          id: currentLadder.disciplineId,
          name:
            data.disciplines.find(
              (item) => item.id === currentLadder.disciplineId,
            )?.name ?? '',
        },
        ladder: currentLadder,
        laborMarket: currentMarket ?? {
          id: '',
          name: 'No labor market selected',
        },
        dataset: currentDataset ?? {
          id: '',
          name: 'No market dataset',
          active: false,
        },
        levels,
        employees: eligible,
        assumptions: source?.assumptions ?? [],
        market: currentDataset?.active ? (source?.market ?? []) : [],
      }
    : undefined;
  const selected = eligible.find((person) => person.id === selectedPerson);
  const selectedBand = payBands.find(
    (band) => band.levelId === selected?.levelId,
  );
  const metrics =
    workspace && selected ? employeeMetrics(workspace, selected) : undefined;
  const format = (amount: number) =>
    officeMoney(amount, data.organization.currency);
  const anyRange = workspace?.market.some(hasMarketRange);
  const anyTeamMedian = levels.some(
    (level) => teamMedianForLevel(eligible, level.id).sampleSize >= 2,
  );
  const rangeMissing =
    workspace?.market.filter((point) => !hasMarketRange(point)).length ?? 0;

  return (
    <>
      <div className="office-heading">
        <div>
          <h1>Analysis</h1>
          <p className="office-muted">
            {scope === 'office' ? office?.name : data.organization.name} ·
            Annual base salary ({data.organization.currency})
          </p>
        </div>
        {!demoWorkspace && (
          <Link
            className="office-link"
            href={`/analysis?${new URLSearchParams({ organizationId: data.organization.id })}`}
          >
            Open full analysis <ArrowUpRight />
          </Link>
        )}
      </div>
      {data.ladders.length ? (
        <section
          className="office-panel office-analysis"
          aria-label="Compensation analysis"
          aria-busy={loading}
        >
          <div className="office-panel-pad office-stack">
            <div>
              <h2>Compensation curve</h2>
              <p className="office-muted">
                {currentMarket?.name ?? 'No labor market selected'}
                {currentDataset ? ` · ${currentDataset.name}` : ''}
              </p>
            </div>
            <div className="office-form-grid office-analysis-fields">
              {office && (
                <label>
                  People
                  <select
                    className="office-input"
                    value={scope}
                    onChange={(event) => {
                      setScope(event.target.value);
                      setSelectedPerson(null);
                    }}
                  >
                    <option value="office">{office.name} office</option>
                    <option value="organization">Entire organization</option>
                  </select>
                </label>
              )}
              <label>
                Career ladder
                <select
                  className="office-input"
                  value={currentLadder?.id ?? ''}
                  onChange={(event) => {
                    setLadder(event.target.value);
                    setSelectedPerson(null);
                  }}
                >
                  {data.disciplines.map((discipline) => {
                    const ladders = data.ladders.filter(
                      (item) => item.disciplineId === discipline.id,
                    );
                    return (
                      ladders.length > 0 && (
                        <optgroup label={discipline.name} key={discipline.id}>
                          {ladders.map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                    );
                  })}
                </select>
              </label>
              {scope === 'organization' && data.markets.length > 0 && (
                <label>
                  Labor market
                  <select
                    className="office-input"
                    value={marketId}
                    onChange={(event) => {
                      setSelectedMarketId(event.target.value);
                      setSelectedDatasetId('');
                    }}
                  >
                    {data.markets.map((market) => (
                      <option key={market.id} value={market.id}>
                        {market.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {datasets.length > 0 && (
                <label>
                  Market dataset
                  <select
                    className="office-input"
                    value={currentDataset?.id}
                    onChange={(event) =>
                      setSelectedDatasetId(event.target.value)
                    }
                  >
                    {datasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                        {dataset.active ? '' : ' · Inactive'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {error && (
              <p className="office-error" role="alert">
                {error}{' '}
                <button
                  type="button"
                  className="office-link"
                  onClick={() => setRetry(retry + 1)}
                >
                  Retry
                </button>
              </p>
            )}
            {loading ? (
              <div
                className="office-loading-chart"
                role="status"
                aria-label="Loading market data"
              />
            ) : (
              <>
                {workspace &&
                levels.length > 0 &&
                (eligible.length > 0 ||
                  workspace.market.length > 0 ||
                  payBands.length > 0) ? (
                  <>
                    <ul
                      className="office-analysis-legend"
                      aria-label="Chart legend"
                    >
                      {payBands.length > 0 ? (
                        <li data-series="range">{bandLabel}</li>
                      ) : (
                        anyRange && <li data-series="range">Market P25–P75</li>
                      )}
                      {workspace.market.length > 0 && (
                        <li data-series="market">Market median</li>
                      )}
                      {anyTeamMedian && <li data-series="team">Team median</li>}
                      {eligible.length > 0 && (
                        <li data-series="employee">Employee salary</li>
                      )}
                    </ul>
                    <CompensationChart
                      key={`${scope}:${key}:${currentLadder?.id}`}
                      responsive
                      workspace={workspace}
                      payBands={payBands}
                      visibility={{
                        band: true,
                        market: true,
                        team: true,
                        employees: true,
                      }}
                      onSelect={(person) => setSelectedPerson(person.id)}
                    />
                  </>
                ) : (
                  <p className="office-muted">
                    Add people with a job level and salary, or import benchmarks
                    for this ladder.
                  </p>
                )}
                <div className="office-muted office-small">
                  {pending > 0 && (
                    <p>
                      {pending} {pending === 1 ? 'person is' : 'people are'}{' '}
                      missing a level or base salary and excluded from this
                      chart.
                    </p>
                  )}
                  {!payBands.length && rangeMissing > 0 && (
                    <p>
                      Market range unavailable for {rangeMissing}{' '}
                      {rangeMissing === 1 ? 'level' : 'levels'} with incomplete
                      percentiles.
                    </p>
                  )}
                  {currentDataset && !currentDataset.active && (
                    <p>
                      Market comparisons are unavailable for an inactive
                      dataset.
                    </p>
                  )}
                </div>
                {selected && metrics && (
                  <p className="office-chart-selection" role="status">
                    <strong>{selected.name}</strong> · {format(selected.salary)}{' '}
                    base salary
                    {selectedBand &&
                      ` · ${bandLabel} ${format(selectedBand.min)}–${format(selectedBand.max)}`}
                    {metrics.market &&
                      ` · Market median ${format(metrics.market.p50)}`}
                    {metrics.teamMedian !== null &&
                      ` · Team median ${format(metrics.teamMedian)}`}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      ) : (
        <div className="office-panel office-empty">
          <h2>No job levels to analyze</h2>
          <p className="office-muted">
            Create a career ladder in Job Levels to start comparing salaries.
          </p>
        </div>
      )}
    </>
  );
}
