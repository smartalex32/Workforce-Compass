export type Level = {
  id: string;
  name: string;
  order: number;
  description?: string;
};

export type MarketPoint = {
  levelId: string;
  p25: number;
  p50: number;
  p75: number;
};

export type Employee = {
  id: string;
  name: string;
  title?: string;
  disciplineId: string;
  careerLadderId: string;
  levelId: string;
  salary: number;
  notes?: string;
};

export type HiringAssumption = {
  levelId: string;
  timeToHireDays: number | null;
  rampDays: number | null;
  vacancyMultiplier: number | null;
  rampLossFactor: number | null;
  recruitingCost: number | null;
  interviewCost: number | null;
  signingCost: number | null;
  otherCost: number | null;
};

export type Workspace = {
  organization: { id: string; name: string; currency: string };
  laborMarket: { id: string; name: string; description?: string };
  discipline: { id: string; name: string; description?: string };
  ladder: { id: string; name: string; description?: string };
  dataset: {
    id: string;
    name: string;
    description?: string;
    source?: string;
    effectiveDate?: string;
    active: boolean;
  };
  levels: Level[];
  market: MarketPoint[];
  employees: Employee[];
  assumptions: HiringAssumption[];
};

export type Gap = {
  amount: number;
  percent: number;
};

export type ReplacementCost = {
  hiringCost: number;
  vacancyCost: number;
  rampCost: number;
  total: number;
};

export type LevelReplacementSummary = ReplacementCost & {
  levelId: string;
  employeeCount: number;
  unavailableEmployeeCount: number;
};

export function median(values: number[]): number | null {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return null;
  const sorted = [...finiteValues].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateGap(value: number, reference: number | null): Gap | null {
  if (!Number.isFinite(value) || value <= 0 || reference === null || !Number.isFinite(reference) || reference <= 0) return null;
  const amount = value - reference;
  return { amount, percent: (amount / reference) * 100 };
}

export function teamMedianForLevel(
  employees: Employee[],
  levelId: string,
): { median: number | null; sampleSize: number } {
  const salaries = employees
    .filter((employee) => employee.levelId === levelId)
    .map((employee) => employee.salary)
    .filter((salary) => Number.isFinite(salary) && salary > 0);
  return { median: median(salaries), sampleSize: salaries.length };
}

export function calculateReplacementCost(
  salary: number,
  assumption: HiringAssumption | undefined,
): ReplacementCost | null {
  if (!assumption) return null;
  const required = [
    assumption.timeToHireDays,
    assumption.rampDays,
    assumption.vacancyMultiplier,
    assumption.rampLossFactor,
    assumption.recruitingCost,
    assumption.interviewCost,
    assumption.signingCost,
    assumption.otherCost,
  ];
  if (
    !Number.isFinite(salary) ||
    salary <= 0 ||
    required.some(
      (value) =>
        value === null ||
        value === undefined ||
        !Number.isFinite(value) ||
        value < 0,
    )
  ) return null;

  const dailyCompensation = salary / 260;
  const hiringCost =
    assumption.recruitingCost! +
    assumption.interviewCost! +
    assumption.signingCost! +
    assumption.otherCost!;
  const vacancyCost =
    dailyCompensation *
    assumption.timeToHireDays! *
    assumption.vacancyMultiplier!;
  const rampCost =
    dailyCompensation * assumption.rampDays! * assumption.rampLossFactor!;

  return {
    hiringCost,
    vacancyCost,
    rampCost,
    total: hiringCost + vacancyCost + rampCost,
  };
}

export function calculateRetentionExposure(
  salary: number,
  marketMedian: number | null,
  replacementCost: ReplacementCost | null,
): number | null {
  if (!Number.isFinite(salary) || salary <= 0 || marketMedian === null || replacementCost === null) return null;
  return Math.max(0, marketMedian - salary) + replacementCost.total;
}

/**
 * Aggregates the modeled replacement-cost components for each configured
 * level. Employees without a complete, valid estimate remain counted as
 * unavailable rather than contributing an implied zero cost.
 */
export function summarizeReplacementCostsByLevel(
  levels: Level[],
  employees: Employee[],
  assumptions: HiringAssumption[],
): LevelReplacementSummary[] {
  const assumptionsByLevel = new Map(
    assumptions.map((assumption) => [assumption.levelId, assumption]),
  );

  return [...levels]
    .sort((a, b) => a.order - b.order)
    .map((level) => {
      const observations = employees.filter((employee) => employee.levelId === level.id);
      const costs = observations
        .map((employee) => calculateReplacementCost(employee.salary, assumptionsByLevel.get(level.id)))
        .filter((cost): cost is ReplacementCost => cost !== null);
      return {
        levelId: level.id,
        employeeCount: observations.length,
        unavailableEmployeeCount: observations.length - costs.length,
        hiringCost: costs.reduce((total, cost) => total + cost.hiringCost, 0),
        vacancyCost: costs.reduce((total, cost) => total + cost.vacancyCost, 0),
        rampCost: costs.reduce((total, cost) => total + cost.rampCost, 0),
        total: costs.reduce((total, cost) => total + cost.total, 0),
      };
    });
}

export function validateMarketPoint(point: MarketPoint): boolean {
  return (
    [point.p25, point.p50, point.p75].every(
      (value) => Number.isFinite(value) && value > 0,
    ) &&
    point.p25 <= point.p50 &&
    point.p50 <= point.p75
  );
}

export function marketRangePosition(
  salary: number,
  point: MarketPoint | undefined,
): { label: string; percentile: number | null } | null {
  if (!point || !validateMarketPoint(point) || !Number.isFinite(salary) || salary <= 0) return null;
  if (salary < point.p25) return { label: 'Below market range', percentile: null };
  if (salary > point.p75) return { label: 'Above market range', percentile: null };
  if (salary === point.p50) return { label: 'At market median', percentile: 50 };
  if (salary < point.p50) {
    const percentile = 25 + ((salary - point.p25) / (point.p50 - point.p25 || 1)) * 25;
    return { label: 'Within market range', percentile };
  }
  const percentile = 50 + ((salary - point.p50) / (point.p75 - point.p50 || 1)) * 25;
  return { label: 'Within market range', percentile };
}

/**
 * Deterministic monotone cubic Hermite interpolation (Fritsch-Carlson style).
 * It preserves monotonicity between ordered level observations and avoids the
 * artificial dips common with unconstrained polynomial regression.
 */
export function monotoneCubicInterpolate(
  points: Array<{ x: number; y: number }>,
  samplesPerSegment = 16,
  allowDecreases = false,
): Array<{ x: number; y: number }> {
  if (points.length < 2) return [...points];
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x)
    .map((point) => ({ ...point }));
  if (sorted.length < 2) return sorted;
  if (!allowDecreases) {
    for (let index = 1; index < sorted.length; index += 1) {
      sorted[index].y = Math.max(sorted[index - 1].y, sorted[index].y);
    }
  }
  const deltas = sorted.slice(0, -1).map((point, index) => {
    const next = sorted[index + 1];
    return (next.y - point.y) / (next.x - point.x);
  });
  const tangents = Array.from({ length: sorted.length }, () => 0);
  tangents[0] = deltas[0];
  tangents[tangents.length - 1] = deltas[deltas.length - 1];

  for (let index = 1; index < tangents.length - 1; index += 1) {
    if (deltas[index - 1] * deltas[index] <= 0) {
      tangents[index] = 0;
    } else {
      tangents[index] = (deltas[index - 1] + deltas[index]) / 2;
    }
  }

  for (let index = 0; index < deltas.length; index += 1) {
    if (deltas[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index] / deltas[index];
    const b = tangents[index + 1] / deltas[index];
    const magnitude = Math.hypot(a, b);
    if (magnitude > 3) {
      const scale = 3 / magnitude;
      tangents[index] = scale * a * deltas[index];
      tangents[index + 1] = scale * b * deltas[index];
    }
  }

  const result: Array<{ x: number; y: number }> = [];
  sorted.slice(0, -1).forEach((point, index) => {
    const next = sorted[index + 1];
    const width = next.x - point.x;
    for (let sample = 0; sample < samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      result.push({
        x: point.x + t * width,
        y:
          h00 * point.y +
          h10 * width * tangents[index] +
          h01 * next.y +
          h11 * width * tangents[index + 1],
      });
    }
  });
  result.push(sorted[sorted.length - 1]);
  return result;
}

/**
 * Separates ordered observations when an intervening career level has no
 * usable value. Rendering each segment independently prevents a smooth curve
 * from implying market or team data at an unavailable level.
 */
export function splitContiguousSeries(
  points: Array<{ x: number; y: number }>,
): Array<Array<{ x: number; y: number }>> {
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x)
    .map((point) => ({ ...point }));
  if (!sorted.length) return [];

  const result: Array<Array<{ x: number; y: number }>> = [[sorted[0]]];
  for (let index = 1; index < sorted.length; index += 1) {
    const point = sorted[index];
    const current = result[result.length - 1];
    if (point.x === current[current.length - 1].x + 1) current.push(point);
    else result.push([point]);
  }
  return result;
}

export function employeeMetrics(workspace: Workspace, employee: Employee) {
  const market = workspace.market.find((point) => point.levelId === employee.levelId);
  const team = teamMedianForLevel(workspace.employees, employee.levelId);
  const assumption = workspace.assumptions.find(
    (item) => item.levelId === employee.levelId,
  );
  const replacement = calculateReplacementCost(employee.salary, assumption);
  const marketMedian = market?.p50 ?? null;
  return {
    market,
    marketPosition: marketRangePosition(employee.salary, market),
    marketGap: calculateGap(employee.salary, marketMedian),
    teamMedian: team.median,
    teamSampleSize: team.sampleSize,
    teamGap: calculateGap(employee.salary, team.median),
    assumption,
    replacement,
    retentionExposure: calculateRetentionExposure(
      employee.salary,
      marketMedian,
      replacement,
    ),
  };
}
