'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Database,
  Info,
  Plus,
  Settings2,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeDialog, WorkspaceDialog } from '@/components/management-dialogs';
import { EmployeeDirectory } from '@/components/employee-directory';
import type { Employee, Workspace } from '@/lib/domain';
import type {
  WorkspaceContexts,
  WorkspaceSelection,
} from '@/lib/workspace-repository';
import {
  calculateReplacementCost,
  employeeMetrics,
  monotoneCubicInterpolate,
  splitContiguousSeries,
  summarizeReplacementCostsByLevel,
  teamMedianForLevel,
  validateMarketPoint,
} from '@/lib/domain';

type ViewMode = 'curve' | 'replacement' | 'matrix';
type Visibility = {
  band: boolean;
  market: boolean;
  team: boolean;
  employees: boolean;
};

const emptyContexts: WorkspaceContexts = {
  organizations: [],
  laborMarkets: [],
  disciplines: [],
  ladders: [],
  datasets: [],
};

function includeCurrent<T extends { id: string }>(items: T[], current: T): T[] {
  return [...new Map([...items, current].map((item) => [item.id, item])).values()];
}

function formatMoney(value: number, currencyCode: string, compact = false) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencyCode || 'USD'} ${Math.round(value).toLocaleString('en-US')}`;
  }
}

function signedMoney(value: number, currencyCode: string) {
  return `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value), currencyCode)}`;
}

function signedPercent(value: number) {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`;
}

function pathFrom(points: Array<{ x: number; y: number }>) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(' ');
}

function LegendToggle({
  label,
  color,
  active,
  onClick,
  variant = 'line',
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  variant?: 'dot' | 'line' | 'band';
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`legend-toggle ${active ? 'is-active' : ''}`}
    >
      <span
        className={`legend-mark legend-${variant}`}
        style={{ '--legend-color': color } as CSSProperties}
      />
      {label}
    </button>
  );
}

function CompensationChart({
  workspace,
  visibility,
  onSelect,
}: {
  workspace: Workspace;
  visibility: Visibility;
  onSelect: (employee: Employee) => void;
}) {
  const [hoveredEmployee, setHoveredEmployee] = useState<{
    employee: Employee;
    x: number;
    y: number;
  } | null>(null);
  const width = 1040;
  const height = 485;
  const frame = { left: 78, right: 30, top: 28, bottom: 58 };
  const levels = [...workspace.levels].sort((a, b) => a.order - b.order);
  const validMarket = workspace.market.filter(validateMarketPoint);
  const validEmployees = workspace.employees.filter(
    (employee) => Number.isFinite(employee.salary) && employee.salary > 0,
  );
  const allValues = validMarket.flatMap((point) => [point.p25, point.p75]);
  const salaries = validEmployees
    .map((employee) => employee.salary)
    .filter((salary) => Number.isFinite(salary) && salary > 0);
  const chartValues = [...allValues, ...salaries];
  const rawMin = chartValues.length
    ? chartValues.reduce((lowest, value) => Math.min(lowest, value), Number.POSITIVE_INFINITY)
    : 0;
  const rawMax = chartValues.length
    ? chartValues.reduce((highest, value) => Math.max(highest, value), Number.NEGATIVE_INFINITY)
    : 100000;
  const min = Math.floor((rawMin - 15000) / 25000) * 25000;
  const max = Math.ceil((rawMax + 15000) / 25000) * 25000;
  const innerWidth = width - frame.left - frame.right;
  const innerHeight = height - frame.top - frame.bottom;
  const xForIndex = (index: number) =>
    frame.left + (index / Math.max(1, levels.length - 1)) * innerWidth;
  const yForValue = (value: number) =>
    frame.top + ((max - value) / Math.max(1, max - min)) * innerHeight;
  const levelIndex = new Map(levels.map((level, index) => [level.id, index]));

  const marketSeries = validMarket
    .map((point) => ({ point, index: levelIndex.get(point.levelId) }))
    .filter(
      (
        item,
      ): item is {
        point: (typeof workspace.market)[number];
        index: number;
      } => item.index !== undefined,
    )
    .sort((a, b) => a.index - b.index);

  const curve = (key: 'p25' | 'p50' | 'p75') =>
    splitContiguousSeries(
      marketSeries.map(({ point, index }) => ({ x: index, y: point[key] })),
    ).map((segment) =>
      monotoneCubicInterpolate(segment, 20).map((point) => ({
        x: xForIndex(point.x),
        y: yForValue(point.y),
      })),
    );

  const lowCurves = curve('p25');
  const midCurves = curve('p50');
  const highCurves = curve('p75');
  const bandPaths = lowCurves.map((lowCurve, index) => {
    const highCurve = highCurves[index];
    return `${pathFrom(lowCurve)} ${highCurve
      .slice()
      .reverse()
      .map((point) => `L${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ')} Z`;
  });
  const teamPoints = levels.flatMap((level, index) => {
    const result = teamMedianForLevel(workspace.employees, level.id);
    return result.median === null || result.sampleSize < 2
      ? []
      : [{ x: index, y: result.median }];
  });
  const teamCurves = splitContiguousSeries(teamPoints).map((segment) =>
    monotoneCubicInterpolate(segment, 20).map((point) => ({
      x: xForIndex(point.x),
      y: yForValue(point.y),
    })),
  );
  const ticks = Array.from(
    { length: 6 },
    (_, index) => min + ((max - min) * index) / 5,
  );

  return (
    <div className="chart-frame">
      <svg
        className="primary-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Employee compensation plotted against the selected market range and team median curve"
      >
        <defs>
          <linearGradient id="marketBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5ed3c2" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#5ed3c2" stopOpacity="0.07" />
          </linearGradient>
          <filter id="pointShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.18" />
          </filter>
        </defs>
        {ticks.map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line
                className="chart-grid"
                x1={frame.left}
                x2={width - frame.right}
                y1={y}
                y2={y}
              />
              <text
                className="axis-label axis-money"
                x={frame.left - 16}
                y={y + 5}
                textAnchor="end"
              >
                {formatMoney(tick, workspace.organization.currency, true)}
              </text>
            </g>
          );
        })}
        {levels.map((level, index) => {
          const x = xForIndex(index);
          return (
            <g key={level.id}>
              <line
                className="chart-grid chart-grid-vertical"
                x1={x}
                x2={x}
                y1={frame.top}
                y2={height - frame.bottom}
              />
              <text
                className="axis-level"
                x={x}
                y={height - 20}
                textAnchor="middle"
              >
                {level.name}
              </text>
            </g>
          );
        })}
        {visibility.band && bandPaths.map((bandPath, index) => (
          <path key={`band-${index}`} d={bandPath} fill="url(#marketBand)" />
        ))}
        {visibility.band && (
          <>
            {lowCurves.map((curvePoints, index) => (
              <path key={`low-${index}`} d={pathFrom(curvePoints)} className="band-boundary" />
            ))}
            {highCurves.map((curvePoints, index) => (
              <path key={`high-${index}`} d={pathFrom(curvePoints)} className="band-boundary" />
            ))}
          </>
        )}
        {visibility.market && (
          <>
            {midCurves.map((curvePoints, index) => (
              <path key={`market-${index}`} d={pathFrom(curvePoints)} className="market-curve" />
            ))}
            {marketSeries.map(({ point, index }) => (
              <g key={`market-observation-${point.levelId}`} className="market-observation">
                <title>{`${levels[index].name}: P25 ${formatMoney(point.p25, workspace.organization.currency)}, P50 ${formatMoney(point.p50, workspace.organization.currency)}, P75 ${formatMoney(point.p75, workspace.organization.currency)}`}</title>
                <circle cx={xForIndex(index)} cy={yForValue(point.p25)} r="3" />
                <circle cx={xForIndex(index)} cy={yForValue(point.p50)} r="4" />
                <circle cx={xForIndex(index)} cy={yForValue(point.p75)} r="3" />
              </g>
            ))}
          </>
        )}
        {visibility.team && (
          <>
            {teamCurves.map((curvePoints, index) => curvePoints.length > 1 && (
              <path key={`team-${index}`} d={pathFrom(curvePoints)} className="team-curve" />
            ))}
            {teamPoints.map((point) => (
              <circle key={`team-observation-${point.x}`} className="team-observation" cx={xForIndex(point.x)} cy={yForValue(point.y)} r="3.5">
                <title>{`${levels[point.x].name} team median: ${formatMoney(point.y, workspace.organization.currency)}`}</title>
              </circle>
            ))}
          </>
        )}
        {visibility.employees &&
          validEmployees.map((employee, employeeIndex) => {
            const index = levelIndex.get(employee.levelId);
            if (index === undefined) return null;
            const sameLevel = validEmployees.filter(
              (item) => item.levelId === employee.levelId,
            );
            const localIndex = sameLevel.findIndex(
              (item) => item.id === employee.id,
            );
            const offset = (localIndex - (sameLevel.length - 1) / 2) * 12;
            const x = xForIndex(index) + offset;
            const y = yForValue(employee.salary);
            const metrics = employeeMetrics(workspace, employee);
            const marketDetail = metrics.marketGap
              ? `Market gap ${signedMoney(metrics.marketGap.amount, workspace.organization.currency)} (${signedPercent(metrics.marketGap.percent)})`
              : 'Market comparison unavailable';
            const teamDetail = metrics.teamGap
              ? `Team gap ${signedMoney(metrics.teamGap.amount, workspace.organization.currency)} (${signedPercent(metrics.teamGap.percent)})`
              : metrics.teamSampleSize < 2
                ? 'Team comparison needs at least two observations'
                : 'Team comparison unavailable';
            const replacementDetail = metrics.replacement
              ? `Estimated replacement cost ${formatMoney(metrics.replacement.total, workspace.organization.currency)}`
              : 'Replacement estimate unavailable';
            return (
              <g
                key={employee.id}
                className="employee-point"
                role="button"
                tabIndex={0}
                aria-label={`${employee.name}, ${levels[index].name}, salary ${formatMoney(employee.salary, workspace.organization.currency)}. ${marketDetail}. ${teamDetail}. ${replacementDetail}.`}
                onClick={() => onSelect(employee)}
                onPointerEnter={() => setHoveredEmployee({ employee, x, y })}
                onPointerLeave={() => setHoveredEmployee(null)}
                onFocus={() => setHoveredEmployee({ employee, x, y })}
                onBlur={() => setHoveredEmployee(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ')
                    onSelect(employee);
                }}
              >
                <title>{`${employee.name} · ${levels[index].name} · ${formatMoney(employee.salary, workspace.organization.currency)}`}</title>
                <circle cx={x} cy={y} r="12" fill="transparent" />
                <circle cx={x} cy={y} r="6.5" filter="url(#pointShadow)" />
                <text x={x} y={y - 15} textAnchor="middle" className="point-name">
                  {[6, 9, 11].includes(employeeIndex)
                    ? employee.name.split(' ')[0]
                    : ''}
                </text>
              </g>
            );
          })}
        {hoveredEmployee && (() => {
          const metrics = employeeMetrics(workspace, hoveredEmployee.employee);
          const level = levels.find((item) => item.id === hoveredEmployee.employee.levelId);
          const tooltipWidth = 282;
          const tooltipHeight = 122;
          const x = Math.min(Math.max(frame.left + 8, hoveredEmployee.x + 14), width - frame.right - tooltipWidth);
          const y = hoveredEmployee.y < frame.top + tooltipHeight + 20
            ? hoveredEmployee.y + 15
            : hoveredEmployee.y - tooltipHeight - 15;
          return (
            <g id="employee-chart-tooltip" className="employee-chart-tooltip" role="tooltip" pointerEvents="none">
              <rect x={x} y={y} width={tooltipWidth} height={tooltipHeight} rx="8" />
              <text x={x + 12} y={y + 22}>
                <tspan className="employee-tooltip-name">{hoveredEmployee.employee.name}</tspan>
                <tspan x={x + 12} dy="17">{`${level?.name ?? 'Level unavailable'} · ${formatMoney(hoveredEmployee.employee.salary, workspace.organization.currency)}`}</tspan>
                <tspan x={x + 12} dy="17">{metrics.marketGap ? `Market P50 ${formatMoney(metrics.market?.p50 ?? 0, workspace.organization.currency)} · ${signedMoney(metrics.marketGap.amount, workspace.organization.currency)}` : 'Market: not available'}</tspan>
                <tspan x={x + 12} dy="17">{metrics.teamGap ? `Team median ${formatMoney(metrics.teamMedian ?? 0, workspace.organization.currency)} · ${signedMoney(metrics.teamGap.amount, workspace.organization.currency)}` : metrics.teamSampleSize < 2 ? 'Team: insufficient observations' : 'Team: not available'}</tspan>
                <tspan x={x + 12} dy="17">{metrics.replacement ? `Replacement ${formatMoney(metrics.replacement.total, workspace.organization.currency)}` : 'Replacement: not available'}</tspan>
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function ReplacementChart({
  workspace,
  onSelect,
}: {
  workspace: Workspace;
  onSelect: (employee: Employee) => void;
}) {
  const levelSummaries = summarizeReplacementCostsByLevel(
    workspace.levels,
    workspace.employees,
    workspace.assumptions,
  );
  const levelsById = new Map(workspace.levels.map((level) => [level.id, level]));
  const maxLevelCost = Math.max(...levelSummaries.map((summary) => summary.total), 1);
  const items = workspace.employees.map((employee) => ({
    employee,
    cost:
      calculateReplacementCost(
        employee.salary,
        workspace.assumptions.find(
          (item) => item.levelId === employee.levelId,
        ),
      )?.total ?? null,
  }));
  const max = Math.max(...items.map((item) => item.cost ?? 0), 1);
  return (
    <div className="replacement-view">
      <section className="level-cost-summary" aria-labelledby="level-cost-summary-title">
        <div className="level-cost-summary-header">
          <div>
            <p className="detail-kicker">Planning assumptions</p>
            <h3 id="level-cost-summary-title">Replacement cost by level</h3>
          </div>
          <div className="cost-legend" aria-label="Replacement cost component legend">
            <span><i className="cost-hiring" />Hiring</span>
            <span><i className="cost-vacancy" />Vacancy</span>
            <span><i className="cost-ramp" />Ramp</span>
          </div>
        </div>
        <p className="level-cost-note">Totals aggregate modeled employee estimates. Missing inputs remain unavailable.</p>
        <div className="level-cost-rows">
          {levelSummaries.map((summary) => {
            const level = levelsById.get(summary.levelId);
            const hasModeledCost = summary.employeeCount > summary.unavailableEmployeeCount;
            return (
              <div className="level-cost-row" key={summary.levelId}>
                <div className="level-cost-label">
                  <strong>{level?.name ?? 'Level unavailable'}</strong>
                  <span>{summary.employeeCount === 1 ? '1 employee' : `${summary.employeeCount} employees`}</span>
                </div>
                <div className="level-cost-track" aria-label={`${level?.name ?? 'Level'} modeled replacement cost composition`}>
                  {hasModeledCost ? (
                    <>
                      <span className="cost-hiring" style={{ width: `${(summary.hiringCost / maxLevelCost) * 100}%` }} />
                      <span className="cost-vacancy" style={{ width: `${(summary.vacancyCost / maxLevelCost) * 100}%` }} />
                      <span className="cost-ramp" style={{ width: `${(summary.rampCost / maxLevelCost) * 100}%` }} />
                    </>
                  ) : (
                    <span className="level-cost-empty">{summary.employeeCount ? 'Assumptions needed' : 'No employees'}</span>
                  )}
                </div>
                <div className="level-cost-total">
                  <strong>{hasModeledCost ? formatMoney(summary.total, workspace.organization.currency, true) : 'N/A'}</strong>
                  {summary.unavailableEmployeeCount > 0 && <span>{summary.unavailableEmployeeCount} unavailable</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="exposure-list" aria-labelledby="employee-exposure-title">
        <div className="exposure-list-header">
          <div>
            <p className="detail-kicker">Observed employees</p>
            <h3 id="employee-exposure-title">Employee replacement estimates</h3>
          </div>
          <span>Each row opens the employee detail.</span>
        </div>
        <div className="exposure-scale" aria-hidden="true">
          <span>$0</span>
          <span>{formatMoney(max / 2, workspace.organization.currency, true)}</span>
          <span>{formatMoney(max, workspace.organization.currency, true)}</span>
        </div>
        <div className="exposure-rows">
          {items
            .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
            .map(({ employee, cost }) => {
            const level = workspace.levels.find(
              (item) => item.id === employee.levelId,
            );
            return (
              <button
                key={employee.id}
                className="exposure-row"
                onClick={() => onSelect(employee)}
              >
                <span className="exposure-person">
                  <strong>{employee.name}</strong>
                  <small>
                    {level?.name} · {formatMoney(employee.salary, workspace.organization.currency)}
                  </small>
                </span>
                <span className="exposure-track">
                  {cost !== null ? (
                    <span
                      className="exposure-fill"
                      style={{ width: `${(cost / max) * 100}%` }}
                    />
                  ) : (
                    <span className="not-available">Assumptions needed</span>
                  )}
                </span>
                <strong className="exposure-value">
                  {cost === null ? 'N/A' : formatMoney(cost, workspace.organization.currency, true)}
                </strong>
              </button>
            );
            })}
        </div>
      </section>
    </div>
  );
}

function MatrixChart({
  workspace,
  onSelect,
}: {
  workspace: Workspace;
  onSelect: (employee: Employee) => void;
}) {
  const width = 1040;
  const height = 485;
  const frame = { left: 82, right: 44, top: 30, bottom: 62 };
  const items = workspace.employees.flatMap((employee) => {
    const metrics = employeeMetrics(workspace, employee);
    return metrics.marketGap && metrics.replacement
      ? [
          {
            employee,
            gap: -metrics.marketGap.percent,
            cost: metrics.replacement.total,
          },
        ]
      : [];
  });
  const minGap = Math.min(-12, ...items.map((item) => item.gap));
  const maxGap = Math.max(18, ...items.map((item) => item.gap));
  const maxCost = Math.max(...items.map((item) => item.cost), 1) * 1.12;
  const xFor = (gap: number) =>
    frame.left +
    ((gap - minGap) / (maxGap - minGap)) *
      (width - frame.left - frame.right);
  const yFor = (cost: number) =>
    frame.top +
    ((maxCost - cost) / maxCost) * (height - frame.top - frame.bottom);
  const midX = xFor(5);
  const midY = yFor(maxCost / 2);

  return (
    <div className="chart-frame matrix-frame">
      <svg
        className="primary-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Market compensation gap versus estimated replacement cost"
      >
        <rect
          x={frame.left}
          y={frame.top}
          width={midX - frame.left}
          height={midY - frame.top}
          className="quadrant quadrant-watch"
        />
        <rect
          x={midX}
          y={frame.top}
          width={width - frame.right - midX}
          height={midY - frame.top}
          className="quadrant quadrant-priority"
        />
        <rect
          x={frame.left}
          y={midY}
          width={midX - frame.left}
          height={height - frame.bottom - midY}
          className="quadrant quadrant-low"
        />
        <rect
          x={midX}
          y={midY}
          width={width - frame.right - midX}
          height={height - frame.bottom - midY}
          className="quadrant quadrant-gap"
        />
        <line
          x1={midX}
          x2={midX}
          y1={frame.top}
          y2={height - frame.bottom}
          className="quadrant-line"
        />
        <line
          x1={frame.left}
          x2={width - frame.right}
          y1={midY}
          y2={midY}
          className="quadrant-line"
        />
        <text x={frame.left + 22} y={frame.top + 28} className="quadrant-label">
          HIGH COST · NEAR MARKET
        </text>
        <text x={midX + 22} y={frame.top + 28} className="quadrant-label strong">
          PRIORITY REVIEW
        </text>
        <text x={frame.left + 22} y={midY + 30} className="quadrant-label">
          LOWER EXPOSURE
        </text>
        <text x={midX + 22} y={midY + 30} className="quadrant-label">
          COMPENSATION GAP
        </text>
        <text
          x={frame.left - 18}
          y={frame.top + 4}
          textAnchor="end"
          className="axis-label"
        >
          {formatMoney(maxCost, workspace.organization.currency, true)}
        </text>
        <text
          x={frame.left - 18}
          y={height - frame.bottom + 4}
          textAnchor="end"
          className="axis-label"
        >
          $0
        </text>
        <text
          x={frame.left}
          y={height - 22}
          textAnchor="start"
          className="axis-label"
        >
          Above market
        </text>
        <text
          x={width - frame.right}
          y={height - 22}
          textAnchor="end"
          className="axis-label"
        >
          Far below market
        </text>
        {items.map(({ employee, gap, cost }) => {
          const x = xFor(gap);
          const y = yFor(cost);
          return (
            <g
              key={employee.id}
              className="matrix-point"
              role="button"
              tabIndex={0}
              onClick={() => onSelect(employee)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ')
                  onSelect(employee);
              }}
            >
              <title>{`${employee.name} · ${(-gap).toFixed(1)}% vs market · ${formatMoney(cost, workspace.organization.currency)} replacement`}</title>
              <circle cx={x} cy={y} r="12" fill="transparent" />
              <circle cx={x} cy={y} r="7" />
              <text x={x + 12} y={y - 10} className="matrix-name">
                {employee.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'negative' | 'positive' | 'accent';
}) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function EmployeeDetail({
  workspace,
  employee,
  open,
  onOpenChange,
  onEdit,
  onConfigure,
}: {
  workspace: Workspace;
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
  onConfigure: () => void;
}) {
  if (!employee) return null;
  const metrics = employeeMetrics(workspace, employee);
  const level = workspace.levels.find((item) => item.id === employee.levelId);
  const marketTone =
    (metrics.marketGap?.amount ?? 0) < 0 ? 'negative' : 'positive';
  const teamTone =
    (metrics.teamGap?.amount ?? 0) < 0 ? 'negative' : 'positive';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="employee-sheet sm:max-w-[430px]">
        <SheetHeader className="employee-sheet-header">
          <div className="avatar-mark">
            {employee.name
              .split(' ')
              .map((part) => part[0])
              .join('')}
          </div>
          <div>
            <SheetTitle className="employee-name">{employee.name}</SheetTitle>
            <SheetDescription>
              {employee.title} · {level?.name}
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="sheet-scroll">
          <section className="detail-section">
            <p className="detail-kicker">Compensation</p>
            <MetricRow label="Base salary" value={formatMoney(employee.salary, workspace.organization.currency)} />
            <MetricRow
              label="Market median"
              value={
                metrics.market
                  ? formatMoney(metrics.market.p50, workspace.organization.currency)
                  : 'Not available'
              }
            />
            <MetricRow
              label="Market gap"
              value={
                metrics.marketGap
                  ? signedMoney(metrics.marketGap.amount, workspace.organization.currency)
                  : 'Not available'
              }
              tone={marketTone}
            />
            <MetricRow
              label="Market position"
              value={
                metrics.marketPosition
                  ? `${metrics.marketPosition.label}${metrics.marketPosition.percentile === null ? '' : ` · ~P${Math.round(metrics.marketPosition.percentile)}`}`
                  : 'Not available'
              }
            />
            <MetricRow
              label="Market gap %"
              value={
                metrics.marketGap
                  ? signedPercent(metrics.marketGap.percent)
                  : 'Not available'
              }
              tone={marketTone}
            />
            <div className="detail-divider" />
            <MetricRow
              label={`Team ${level?.name} median`}
              value={
                metrics.teamMedian === null
                  ? 'Not available'
                  : formatMoney(metrics.teamMedian, workspace.organization.currency)
              }
            />
            <MetricRow
              label="Team gap"
              value={
                metrics.teamGap
                  ? signedMoney(metrics.teamGap.amount, workspace.organization.currency)
                  : 'Not available'
              }
              tone={teamTone}
            />
            <MetricRow
              label="Team gap %"
              value={
                metrics.teamGap
                  ? signedPercent(metrics.teamGap.percent)
                  : 'Not available'
              }
              tone={teamTone}
            />
            {metrics.teamSampleSize < 3 && (
              <p className="confidence-note">
                <Info /> Internal comparison is directional; this level has only{' '}
                {metrics.teamSampleSize} employee
                {metrics.teamSampleSize === 1 ? '' : 's'}.
              </p>
            )}
          </section>
          <section className="detail-section replacement-section">
            <p className="detail-kicker">Replacement planning</p>
            <MetricRow
              label="Expected time to hire"
              value={
                metrics.assumption?.timeToHireDays == null
                  ? 'Not available'
                  : `${metrics.assumption.timeToHireDays} days`
              }
            />
            <MetricRow
              label="Expected ramp time"
              value={
                metrics.assumption?.rampDays == null
                  ? 'Not available'
                  : `${metrics.assumption.rampDays} days`
              }
            />
            <div className="detail-divider" />
            <MetricRow
              label="Hiring cost"
              value={
                metrics.replacement
                  ? formatMoney(metrics.replacement.hiringCost, workspace.organization.currency)
                  : 'Not available'
              }
            />
            <MetricRow
              label="Vacancy cost"
              value={
                metrics.replacement
                  ? formatMoney(metrics.replacement.vacancyCost, workspace.organization.currency)
                  : 'Not available'
              }
            />
            <MetricRow
              label="Ramp cost"
              value={
                metrics.replacement
                  ? formatMoney(metrics.replacement.rampCost, workspace.organization.currency)
                  : 'Not available'
              }
            />
            <MetricRow
              label="Estimated replacement cost"
              value={
                metrics.replacement
                  ? formatMoney(metrics.replacement.total, workspace.organization.currency)
                  : 'Not available'
              }
              tone="accent"
            />
          </section>
          <section className="exposure-card">
            <div>
              <p>Retention exposure</p>
              <span>Market adjustment + modeled replacement cost</span>
            </div>
            <strong>
              {metrics.retentionExposure === null
                ? 'N/A'
                : formatMoney(metrics.retentionExposure, workspace.organization.currency)}
            </strong>
            <p className="exposure-disclaimer">
              Planning exposure only. This does not estimate the probability that an
              employee will leave.
            </p>
          </section>
          {employee.notes && (
            <p className="employee-note">“{employee.notes}”</p>
          )}
        </div>
        <div className="sheet-actions">
          <Button variant="outline" className="flex-1" onClick={() => onEdit(employee)}>
            Edit employee
          </Button>
          <Button className="flex-1" onClick={onConfigure}>Review assumptions</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function WorkforceExplorer({
  initialWorkspace,
}: {
  initialWorkspace: Workspace;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [view, setView] = useState<ViewMode>('curve');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [contexts, setContexts] = useState<WorkspaceContexts>(emptyContexts);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const editingDisabled = !workspaceLoaded || saveState === 'loading' || saveState === 'saving';
  const [visibility, setVisibility] = useState<Visibility>({
    band: true,
    market: true,
    team: true,
    employees: true,
  });
  const summary = useMemo(() => {
    const below = workspace.employees.filter((employee) => {
      const metrics = employeeMetrics(workspace, employee);
      return (metrics.marketGap?.percent ?? 0) < -5;
    }).length;
    const replacementValues = workspace.employees.flatMap((employee) => {
      const total = employeeMetrics(workspace, employee).replacement?.total;
      return total === undefined ? [] : [total];
    });
    return {
      below,
      averageReplacement: replacementValues.length
        ? replacementValues.reduce((sum, value) => sum + value, 0) /
          replacementValues.length
        : null,
    };
  }, [workspace]);
  const selectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailOpen(true);
  };

  const contextOptions = useMemo(() => {
    const organizations = includeCurrent(contexts.organizations, {
      ...workspace.organization,
      defaultLaborMarketId: workspace.laborMarket.id,
    });
    const laborMarkets = includeCurrent(
      contexts.laborMarkets.filter(
        (market) => market.organizationId === workspace.organization.id,
      ),
      { ...workspace.laborMarket, organizationId: workspace.organization.id },
    );
    const disciplines = includeCurrent(
      contexts.disciplines.filter(
        (discipline) => discipline.organizationId === workspace.organization.id,
      ),
      { ...workspace.discipline, organizationId: workspace.organization.id },
    );
    const ladders = includeCurrent(
      contexts.ladders.filter(
        (ladder) => ladder.disciplineId === workspace.discipline.id,
      ),
      { ...workspace.ladder, disciplineId: workspace.discipline.id },
    );
    const datasets = includeCurrent(
      contexts.datasets.filter(
        (dataset) => dataset.laborMarketId === workspace.laborMarket.id,
      ),
      { ...workspace.dataset, laborMarketId: workspace.laborMarket.id, active: true },
    );
    return { organizations, laborMarkets, disciplines, ladders, datasets };
  }, [contexts, workspace]);

  const refreshContexts = useCallback(async () => {
    const response = await fetch('/api/workspace/contexts');
    if (!response.ok) throw new Error('Context load failed');
    const result = (await response.json()) as { contexts: WorkspaceContexts };
    setContexts(result.contexts);
  }, []);

  const loadSelection = useCallback(async (selection: WorkspaceSelection) => {
    setSaveState('loading');
    try {
      const parameters = new URLSearchParams();
      for (const [key, value] of Object.entries(selection)) {
        if (value) parameters.set(key, value);
      }
      const response = await fetch(`/api/workspace?${parameters.toString()}`);
      if (!response.ok) throw new Error('Workspace load failed');
      const result = (await response.json()) as { workspace: Workspace | null };
      if (!result.workspace) throw new Error('Workspace unavailable');
      setWorkspace(result.workspace);
      setSelectedEmployee(null);
      setDetailOpen(false);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  const persistWorkspace = useCallback(async (next: Workspace): Promise<boolean> => {
    setSaveState('saving');
    try {
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: next }),
      });
      if (!response.ok) throw new Error('Save failed');
      const result = (await response.json()) as { workspace?: Workspace };
      setWorkspace(result.workspace ?? next);
      setWorkspaceLoaded(true);
      setSaveState('saved');
      try {
        await refreshContexts();
      } catch {
        // The workspace is saved; the active context remains usable until the
        // catalog can be refreshed on the next load.
      }
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [refreshContexts]);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      try {
        const response = await fetch('/api/workspace');
        if (!response.ok) throw new Error('Load failed');
        const result = (await response.json()) as { workspace: Workspace | null };
        if (!active) return;
        if (result.workspace) {
          setWorkspace(result.workspace);
          setWorkspaceLoaded(true);
          await refreshContexts();
          if (!active) return;
          setSaveState('saved');
        } else {
          await persistWorkspace(initialWorkspace);
        }
      } catch {
        if (active) setSaveState('error');
      }
    }
    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [initialWorkspace, persistWorkspace, refreshContexts]);

  const saveEmployee = useCallback(async (employee: Employee) => {
    if (editingDisabled) return false;
    const exists = workspace.employees.some((item) => item.id === employee.id);
    return persistWorkspace({
      ...workspace,
      employees: exists
        ? workspace.employees.map((item) => item.id === employee.id ? employee : item)
        : [...workspace.employees, employee],
    });
  }, [editingDisabled, persistWorkspace, workspace]);

  async function deleteEmployee(employeeId: string) {
    const saved = await persistWorkspace({
      ...workspace,
      employees: workspace.employees.filter((employee) => employee.id !== employeeId),
    });
    if (saved) {
      setDetailOpen(false);
      setSelectedEmployee(null);
    }
    return saved;
  }

  function startAddEmployee() {
    if (editingDisabled) return;
    setEditingEmployee(null);
    setEmployeeDialogOpen(true);
  }

  function startEditEmployee(employee: Employee) {
    if (editingDisabled) return;
    setDetailOpen(false);
    setEditingEmployee(employee);
    setEmployeeDialogOpen(true);
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const reportError = () => undefined;

    void Promise.resolve(
      context.registerTool(
        {
          name: 'get_compensation_summary',
          title: 'Get compensation summary',
          description:
            'Read the active workforce scope and summarize employee market gaps and modeled replacement exposure.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return {
              organization: workspace.organization.name,
              laborMarket: workspace.laborMarket.name,
              discipline: workspace.discipline.name,
              careerLadder: workspace.ladder.name,
              dataset: workspace.dataset.name,
              employeeCount: workspace.employees.length,
              employeesMoreThanFivePercentBelowMarket: summary.below,
              averageEstimatedReplacementCost: summary.averageReplacement,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(reportError);

    void Promise.resolve(
      context.registerTool(
        {
          name: 'add_employee_observation',
          title: 'Add employee observation',
          description:
            'Add and persist an employee compensation observation in the active discipline and career ladder.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1 },
              title: { type: 'string' },
              level: { type: 'string', description: 'Level ID or display name' },
              salary: { type: 'number', exclusiveMinimum: 0 },
              notes: { type: 'string' },
            },
            required: ['name', 'level', 'salary'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const candidate = input as {
              name?: unknown;
              title?: unknown;
              level?: unknown;
              salary?: unknown;
              notes?: unknown;
            };
            if (
              typeof candidate.name !== 'string' ||
              !candidate.name.trim() ||
              typeof candidate.level !== 'string' ||
              typeof candidate.salary !== 'number' ||
              !Number.isFinite(candidate.salary) ||
              candidate.salary <= 0
            ) {
              throw new Error('Name, level, and a positive salary are required.');
            }
            const requestedLevel = candidate.level;
            const level = workspace.levels.find(
              (item) =>
                item.id === requestedLevel ||
                item.name.toLowerCase() === requestedLevel.toLowerCase(),
            );
            if (!level) throw new Error('The requested career level does not exist.');
            const employee: Employee = {
              id: crypto.randomUUID(),
              name: candidate.name.trim(),
              title:
                typeof candidate.title === 'string' ? candidate.title : undefined,
              levelId: level.id,
              salary: candidate.salary,
              notes:
                typeof candidate.notes === 'string' ? candidate.notes : undefined,
            };
            const saved = await saveEmployee(employee);
            if (!saved) throw new Error('The employee could not be persisted.');
            return {
              id: employee.id,
              name: employee.name,
              level: level.name,
              salary: employee.salary,
              status: 'saved',
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(reportError);

    return () => lifecycle.abort();
  }, [saveEmployee, workspace, summary]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-symbol">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>Workforce Compass</strong>
            <span>Compensation. Context. Clarity.</span>
          </div>
        </div>
        <div className="header-actions">
          <span className={`save-status status-${saveState}`} aria-live="polite">
            {saveState === 'loading' ? 'Loading…' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save unavailable'}
          </span>
          <Button variant="ghost" size="sm" disabled={editingDisabled} onClick={() => setWorkspaceDialogOpen(true)}>
            <Database /> Manage data
          </Button>
          <Button size="sm" disabled={editingDisabled} onClick={startAddEmployee}>
            <Plus /> Add employee
          </Button>
          <button className="profile-button" aria-label="Open user menu">
            AJ
          </button>
        </div>
      </header>

      <section className="workspace-toolbar" aria-label="Analysis filters">
        <div className="context-copy">
          <p className="eyebrow">Compensation workspace</p>
          <h1>See the shape of your workforce.</h1>
        </div>
        <div className="filter-row">
          <div className="filter-label">
            <span>Organization</span>
            <Select value={workspace.organization.id} disabled={saveState === 'loading' || saveState === 'saving'} onValueChange={(organizationId) => void loadSelection({ organizationId: String(organizationId) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {contextOptions.organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="filter-label">
            <span>Labor market</span>
            <Select value={workspace.laborMarket.id} disabled={saveState === 'loading' || saveState === 'saving'} onValueChange={(laborMarketId) => void loadSelection({ organizationId: workspace.organization.id, laborMarketId: String(laborMarketId), disciplineId: workspace.discipline.id, ladderId: workspace.ladder.id })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {contextOptions.laborMarkets.map((market) => <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="filter-label">
            <span>Discipline</span>
            <Select value={workspace.discipline.id} disabled={saveState === 'loading' || saveState === 'saving'} onValueChange={(disciplineId) => void loadSelection({ organizationId: workspace.organization.id, laborMarketId: workspace.laborMarket.id, disciplineId: String(disciplineId), datasetId: workspace.dataset.id })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {contextOptions.disciplines.map((discipline) => <SelectItem key={discipline.id} value={discipline.id}>{discipline.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="filter-label">
            <span>Career ladder</span>
            <Select value={workspace.ladder.id} disabled={saveState === 'loading' || saveState === 'saving'} onValueChange={(ladderId) => void loadSelection({ organizationId: workspace.organization.id, laborMarketId: workspace.laborMarket.id, disciplineId: workspace.discipline.id, ladderId: String(ladderId), datasetId: workspace.dataset.id })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {contextOptions.ladders.map((ladder) => <SelectItem key={ladder.id} value={ladder.id}>{ladder.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="filter-label">
            <span>Market dataset</span>
            <Select value={workspace.dataset.id} disabled={saveState === 'loading' || saveState === 'saving'} onValueChange={(datasetId) => void loadSelection({ organizationId: workspace.organization.id, laborMarketId: workspace.laborMarket.id, disciplineId: workspace.discipline.id, ladderId: workspace.ladder.id, datasetId: String(datasetId) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {contextOptions.datasets.map((dataset) => <SelectItem key={dataset.id} value={dataset.id}>{dataset.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="analysis-card">
        <div className="analysis-heading">
          <div>
            <p className="chart-kicker">
              {view === 'curve'
                ? 'Annual base salary'
                : view === 'replacement'
                  ? 'Modeled organizational cost'
                  : 'Compensation gap & replacement exposure'}
            </p>
            <h2>
              {view === 'curve'
                ? 'Compensation curve'
                : view === 'replacement'
                  ? 'Replacement exposure'
                  : 'Where gaps and costs compound'}
            </h2>
          </div>
          <div className="signal-summary">
            <span>
              <ArrowDownRight /> <strong>{summary.below}</strong> employees 5%+
              below market
            </span>
            <span>
              <CircleDollarSign />{' '}
              <strong>
                {summary.averageReplacement === null
                  ? 'N/A'
                  : formatMoney(summary.averageReplacement, workspace.organization.currency, true)}
              </strong>{' '}
              avg. replacement
            </span>
          </div>
        </div>

        {view === 'curve' && (
          <CompensationChart
            workspace={workspace}
            visibility={visibility}
            onSelect={selectEmployee}
          />
        )}
        {view === 'replacement' && (
          <ReplacementChart workspace={workspace} onSelect={selectEmployee} />
        )}
        {view === 'matrix' && (
          <MatrixChart workspace={workspace} onSelect={selectEmployee} />
        )}

        <div className="chart-footer">
          {view === 'curve' ? (
            <div className="legend-row" aria-label="Chart layers">
              <LegendToggle
                label="Market range"
                color="#5ed3c2"
                active={visibility.band}
                onClick={() =>
                  setVisibility((state) => ({ ...state, band: !state.band }))
                }
                variant="band"
              />
              <LegendToggle
                label="Market median"
                color="#208d83"
                active={visibility.market}
                onClick={() =>
                  setVisibility((state) => ({ ...state, market: !state.market }))
                }
              />
              <LegendToggle
                label="Team median"
                color="#667085"
                active={visibility.team}
                onClick={() =>
                  setVisibility((state) => ({ ...state, team: !state.team }))
                }
              />
              <LegendToggle
                label="Employees"
                color="#f1a65a"
                active={visibility.employees}
                onClick={() =>
                  setVisibility((state) => ({
                    ...state,
                    employees: !state.employees,
                  }))
                }
                variant="dot"
              />
            </div>
          ) : (
            <p className="view-guidance">
              <Info /> Estimates use the editable hiring, vacancy, and ramp
              assumptions for each level.
            </p>
          )}
          <p className="dataset-note">
            <Sparkles /> {workspace.dataset.name} · Effective{' '}
            {workspace.dataset.effectiveDate?.slice(0, 4)}
          </p>
        </div>
      </section>

      <div className="view-switcher-wrap">
        <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
          <TabsList className="view-switcher">
            <TabsTrigger value="curve">
              <BarChart3 /> Compensation curve
            </TabsTrigger>
            <TabsTrigger value="replacement">
              <Users /> Replacement exposure
            </TabsTrigger>
            <TabsTrigger value="matrix">
              <ArrowUpRight /> Market gap × cost
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" disabled={editingDisabled} onClick={() => setWorkspaceDialogOpen(true)}>
          <Settings2 /> Configure workspace
        </Button>
      </div>

      <EmployeeDirectory
        key={JSON.stringify([workspace.organization.id, workspace.discipline.id, workspace.ladder.id])}
        workspace={workspace}
        disabled={editingDisabled}
        onSelect={selectEmployee}
        onEdit={startEditEmployee}
        onAdd={startAddEmployee}
      />

      <EmployeeDetail
        workspace={workspace}
        employee={workspace.employees.find((employee) => employee.id === selectedEmployee?.id) ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={startEditEmployee}
        onConfigure={() => {
          if (editingDisabled) return;
          setDetailOpen(false);
          setWorkspaceDialogOpen(true);
        }}
      />
      {employeeDialogOpen && <EmployeeDialog
        key={editingEmployee?.id ?? 'new-employee'}
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
        workspace={workspace}
        employee={editingEmployee}
        onSave={saveEmployee}
        onDelete={editingEmployee ? deleteEmployee : undefined}
      />}
      {workspaceDialogOpen && <WorkspaceDialog
        key={`workspace-${workspace.organization.id}`}
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        workspace={workspace}
        onSave={persistWorkspace}
      />}
    </main>
  );
}
