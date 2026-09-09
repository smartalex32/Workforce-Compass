import type { Employee, MarketPoint, Workspace } from './domain';
import {
  employeeMetrics,
  employeeTenureYears,
  median,
  totalCompensation,
  validateMarketPoint,
} from './domain';

export type PlanningRole = 'viewer' | 'analyst' | 'admin';

export type ScenarioChange = {
  employeeId: string;
  proposedSalary: number;
};

export type WorkforceScenario = {
  id: string;
  name: string;
  budget: number;
  changes: ScenarioChange[];
};

export type ProductivityPoint = { day: number; productivity: number };
export type HiringObservation = {
  levelId: string;
  openedAt: string;
  filledAt: string;
};

export type PlanningState = {
  version: 1;
  members: Array<{ email: string; role: PlanningRole }>;
  scenarios: WorkforceScenario[];
  hiringHistory: HiringObservation[];
  productivityCurves: Array<{ levelId: string; points: ProductivityPoint[] }>;
  geographicDifferentials: Array<{ location: string; factor: number }>;
  integrations: Array<{
    id: string;
    kind: 'hris' | 'survey';
    name: string;
    enabled: boolean;
    lastSyncedAt?: string;
  }>;
};

export type CsvImportResult<T> = { records: T[]; errors: string[] };

function csvCell(value: unknown) {
  const text =
    value == null
      ? ''
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(value.replace(/\r$/, ''));
  if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
}

function recordsFromCsv(input: string) {
  const [header = [], ...rows] = parseCsv(input);
  const headers = header.map((cell) => cell.trim());
  return rows.map((cells) =>
    Object.fromEntries(
      headers.map((key, index) => [key, cells[index]?.trim() ?? '']),
    ),
  );
}

function optionalNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function exportEmployeesCsv(workspace: Workspace) {
  const header = [
    'id',
    'employeeNumber',
    'name',
    'title',
    'levelId',
    'baseSalary',
    'annualBonus',
    'annualEquity',
    'annualBenefits',
    'location',
    'startDate',
    'team',
    'managerId',
    'performanceRating',
    'notes',
  ];
  return [
    header,
    ...workspace.employees.map((employee) => [
      employee.id,
      employee.employeeNumber,
      employee.name,
      employee.title,
      employee.levelId,
      employee.salary,
      employee.annualBonus,
      employee.annualEquity,
      employee.annualBenefits,
      employee.location,
      employee.startDate,
      employee.team,
      employee.managerId,
      employee.performanceRating,
      employee.notes,
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export function importEmployeesCsv(
  input: string,
  workspace: Workspace,
): CsvImportResult<Employee> {
  const levelIds = new Set(workspace.levels.map((level) => level.id));
  const errors: string[] = [];
  const records = recordsFromCsv(input).flatMap((row, index) => {
    const salary = Number(row.baseSalary);
    const employee: Employee = {
      id: row.id || crypto.randomUUID(),
      employeeNumber: row.employeeNumber || undefined,
      name: row.name,
      title: row.title || undefined,
      disciplineId: workspace.discipline.id,
      careerLadderId: workspace.ladder.id,
      levelId: row.levelId,
      salary,
      annualBonus: optionalNumber(row.annualBonus),
      annualEquity: optionalNumber(row.annualEquity),
      annualBenefits: optionalNumber(row.annualBenefits),
      location: row.location || undefined,
      startDate: row.startDate || undefined,
      team: row.team || undefined,
      managerId: row.managerId || undefined,
      performanceRating: optionalNumber(row.performanceRating),
      notes: row.notes || undefined,
    };
    const optionalNumbers = [
      employee.annualBonus,
      employee.annualEquity,
      employee.annualBenefits,
      employee.performanceRating,
    ];
    if (
      !employee.name ||
      !levelIds.has(employee.levelId) ||
      !Number.isFinite(salary) ||
      salary <= 0 ||
      optionalNumbers.some(Number.isNaN)
    ) {
      errors.push(
        `Row ${index + 2}: name, valid levelId, positive baseSalary, and non-negative compensation fields are required.`,
      );
      return [];
    }
    return [employee];
  });
  if (new Set(records.map((record) => record.id)).size !== records.length)
    errors.push('Employee IDs must be unique.');
  const employeeNumbers = records.flatMap((record) =>
    record.employeeNumber ? [record.employeeNumber] : [],
  );
  if (new Set(employeeNumbers).size !== employeeNumbers.length)
    errors.push('Employee numbers must be unique when provided.');
  return { records, errors };
}

export function exportMarketCsv(workspace: Workspace) {
  return [
    ['levelId', 'p25', 'p50', 'p75'],
    ...workspace.market.map((point) => [
      point.levelId,
      point.p25,
      point.p50,
      point.p75,
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export function importMarketCsv(
  input: string,
  workspace: Workspace,
): CsvImportResult<MarketPoint> {
  const levelIds = new Set(workspace.levels.map((level) => level.id));
  const errors: string[] = [];
  const records = recordsFromCsv(input).flatMap((row, index) => {
    const point = {
      levelId: row.levelId,
      p25: Number(row.p25),
      p50: Number(row.p50),
      p75: Number(row.p75),
    };
    if (!levelIds.has(point.levelId) || !validateMarketPoint(point)) {
      errors.push(
        `Row ${index + 2}: valid levelId and positive P25 ≤ P50 ≤ P75 are required.`,
      );
      return [];
    }
    return [point];
  });
  if (new Set(records.map((record) => record.levelId)).size !== records.length)
    errors.push('Market level IDs must be unique.');
  return { records, errors };
}

export function mergeHrisEmployees(workspace: Workspace, records: Employee[]) {
  const incoming = new Map(
    records.map((record) => [record.employeeNumber || record.id, record]),
  );
  const retained = workspace.employees.filter(
    (employee) => !incoming.has(employee.employeeNumber || employee.id),
  );
  return [...retained, ...records];
}

export function applyGeographicDifferential(
  point: MarketPoint,
  factor: number,
): MarketPoint | null {
  if (!Number.isFinite(factor) || factor <= 0 || !validateMarketPoint(point))
    return null;
  return {
    ...point,
    p25: point.p25 * factor,
    p50: point.p50 * factor,
    p75: point.p75 * factor,
  };
}

export function evaluateScenario(
  workspace: Workspace,
  scenario: WorkforceScenario,
) {
  const current = new Map(
    workspace.employees.map((employee) => [employee.id, employee.salary]),
  );
  const invalidChanges = scenario.changes.filter(
    (change) =>
      !current.has(change.employeeId) ||
      !Number.isFinite(change.proposedSalary) ||
      change.proposedSalary <= 0,
  );
  const annualCost = scenario.changes.reduce(
    (sum, change) =>
      sum +
      Math.max(
        0,
        change.proposedSalary -
          (current.get(change.employeeId) ?? change.proposedSalary),
      ),
    0,
  );
  return {
    annualCost,
    remainingBudget: scenario.budget - annualCost,
    withinBudget: invalidChanges.length === 0 && annualCost <= scenario.budget,
    invalidEmployeeIds: invalidChanges.map((change) => change.employeeId),
  };
}

export function productivityAtDay(
  points: ProductivityPoint[],
  day: number,
): number | null {
  const sorted = [...points]
    .filter(
      (point) =>
        Number.isFinite(point.day) &&
        point.day >= 0 &&
        Number.isFinite(point.productivity) &&
        point.productivity >= 0 &&
        point.productivity <= 1,
    )
    .sort((a, b) => a.day - b.day);
  if (!sorted.length || !Number.isFinite(day) || day < 0) return null;
  if (day <= sorted[0].day) return sorted[0].productivity;
  for (let index = 1; index < sorted.length; index += 1) {
    if (day <= sorted[index].day) {
      const previous = sorted[index - 1];
      const width = sorted[index].day - previous.day;
      return width === 0
        ? sorted[index].productivity
        : previous.productivity +
            ((day - previous.day) / width) *
              (sorted[index].productivity - previous.productivity);
    }
  }
  return sorted.at(-1)!.productivity;
}

export function rampCostFromProductivityCurve(
  annualSalary: number,
  points: ProductivityPoint[],
  rampDays: number,
) {
  if (!Number.isFinite(annualSalary) || annualSalary <= 0 || !Number.isFinite(rampDays) || rampDays < 0) return null;
  let productivityLossDays = 0;
  for (let day = 0; day < Math.ceil(rampDays); day += 1) {
    const sampledDay = Math.min(rampDays, day + 0.5);
    const productivity = productivityAtDay(points, sampledDay);
    if (productivity === null) return null;
    productivityLossDays += (1 - productivity) * Math.min(1, rampDays - day);
  }
  return (annualSalary / 260) * productivityLossDays;
}

export function historicalTimeToHireDays(
  observations: HiringObservation[],
  levelId: string,
) {
  return median(
    observations
      .filter((item) => item.levelId === levelId)
      .map((item) => {
        const opened = new Date(item.openedAt).getTime();
        const filled = new Date(item.filledAt).getTime();
        return (filled - opened) / 86_400_000;
      })
      .filter((days) => Number.isFinite(days) && days >= 0),
  );
}

export function robustSalaryOutliers(employees: Employee[]) {
  if (employees.length < 4) return [];
  const sorted = employees
    .map((employee) => employee.salary)
    .sort((a, b) => a - b);
  const quantile = (value: number) => {
    const position = (sorted.length - 1) * value;
    const lowerIndex = Math.floor(position);
    const fraction = position - lowerIndex;
    return (
      sorted[lowerIndex] +
      (sorted[Math.min(lowerIndex + 1, sorted.length - 1)] -
        sorted[lowerIndex]) *
        fraction
    );
  };
  const lower = quantile(0.25);
  const upper = quantile(0.75);
  const iqr = upper - lower;
  if (iqr <= 0) return [];
  const lowFence = lower - 1.5 * iqr;
  const highFence = upper + 1.5 * iqr;
  return employees
    .filter(
      (employee) => employee.salary < lowFence || employee.salary > highFence,
    )
    .map((employee) => ({
      employeeId: employee.id,
      salary: employee.salary,
      direction:
        employee.salary < lowFence ? ('low' as const) : ('high' as const),
    }));
}

export function performanceCompensationSummary(employees: Employee[]) {
  const observations = employees.filter(
    (employee) =>
      Number.isFinite(employee.performanceRating) &&
      employee.performanceRating! >= 0,
  );
  if (observations.length < 3) return null;
  const meanPerformance =
    observations.reduce(
      (sum, employee) => sum + employee.performanceRating!,
      0,
    ) / observations.length;
  const meanCompensation =
    observations.reduce(
      (sum, employee) => sum + totalCompensation(employee),
      0,
    ) / observations.length;
  const covariance = observations.reduce(
    (sum, employee) =>
      sum +
      (employee.performanceRating! - meanPerformance) *
        (totalCompensation(employee) - meanCompensation),
    0,
  );
  const performanceSpread = Math.sqrt(
    observations.reduce(
      (sum, employee) =>
        sum + (employee.performanceRating! - meanPerformance) ** 2,
      0,
    ),
  );
  const compensationSpread = Math.sqrt(
    observations.reduce(
      (sum, employee) =>
        sum + (totalCompensation(employee) - meanCompensation) ** 2,
      0,
    ),
  );
  return {
    sampleSize: observations.length,
    correlation:
      performanceSpread && compensationSpread
        ? covariance / (performanceSpread * compensationSpread)
        : null,
  };
}

export function retentionRiskSignal(
  workspace: Workspace,
  employee: Employee,
  asOf = new Date(),
) {
  const metrics = employeeMetrics(workspace, employee);
  const tenure = employeeTenureYears(employee, asOf);
  const factors = [
    {
      key: 'market-gap',
      active: (metrics.marketGap?.percent ?? 0) < -10,
      weight: 40,
    },
    { key: 'tenure', active: tenure !== null && tenure >= 3, weight: 20 },
    {
      key: 'performance',
      active: (employee.performanceRating ?? 0) >= 4,
      weight: 20,
    },
    {
      key: 'internal-position',
      active: (metrics.teamGap?.percent ?? 0) < -10,
      weight: 20,
    },
  ];
  const score = factors.reduce(
    (sum, factor) => sum + (factor.active ? factor.weight : 0),
    0,
  );
  return {
    score,
    band:
      score >= 60
        ? ('elevated' as const)
        : score >= 30
          ? ('watch' as const)
          : ('limited-signal' as const),
    factors: factors
      .filter((factor) => factor.active)
      .map((factor) => factor.key),
    disclaimer:
      'Planning signal only; it does not predict whether an employee will leave and must not drive an employment decision by itself.',
  };
}

export function planningSuggestions(workspace: Workspace) {
  const employeeSuggestions = workspace.employees.flatMap((employee) => {
    const metrics = employeeMetrics(workspace, employee);
    const result: Array<{ employeeId: string; kind: 'compensation-review' | 'retention-review'; rationale: string; requiresHumanReview: true }> = [];
    if ((metrics.marketGap?.percent ?? 0) < -10) result.push({
      employeeId: employee.id,
      kind: 'compensation-review',
      rationale: `Base salary is ${Math.abs(metrics.marketGap!.percent).toFixed(1)}% below the selected market median.`,
      requiresHumanReview: true,
    });
    const signal = retentionRiskSignal(workspace, employee);
    if (signal.score >= 60) result.push({
      employeeId: employee.id,
      kind: 'retention-review',
      rationale: `Review the transparent retention signals: ${signal.factors.join(', ')}. This is not a departure prediction.`,
      requiresHumanReview: true,
    });
    return result;
  });
  const staffingSuggestions = workspace.levels
    .filter((level) => !workspace.employees.some((employee) => employee.levelId === level.id))
    .map((level) => ({
      employeeId: '',
      levelId: level.id,
      kind: 'staffing-review' as const,
      rationale: `${level.name} has no employee observations. Review whether this is intentional before making a hiring plan.`,
      requiresHumanReview: true as const,
    }));
  return [...employeeSuggestions, ...staffingSuggestions];
}
