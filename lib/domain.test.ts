import { describe, expect, it } from 'vitest';
import {
  calculateGap,
  calculateReplacementCost,
  calculateRetentionExposure,
  employeeMetrics,
  marketRangePosition,
  median,
  monotoneCubicInterpolate,
  teamMedianForLevel,
  validateMarketPoint,
  type Employee,
  type HiringAssumption,
  type Workspace,
} from './domain';

const assumption: HiringAssumption = {
  levelId: 'l4',
  timeToHireDays: 85,
  rampDays: 120,
  vacancyMultiplier: 1.2,
  rampLossFactor: 0.4,
  recruitingCost: 9500,
  interviewCost: 4000,
  signingCost: 3500,
  otherCost: 1000,
};

describe('compensation calculations', () => {
  it('calculates odd and even team medians without mutating observations', () => {
    const values = [176000, 161000, 169500];
    expect(median(values)).toBe(169500);
    expect(values).toEqual([176000, 161000, 169500]);
    expect(median([99000, 108000])).toBe(103500);
    expect(median([])).toBeNull();
  });

  it('returns the sample size with the level median', () => {
    const employees: Employee[] = [
      { id: '1', name: 'A', levelId: 'l2', salary: 99000 },
      { id: '2', name: 'B', levelId: 'l2', salary: 108000 },
      { id: '3', name: 'C', levelId: 'l3', salary: 140000 },
    ];
    expect(teamMedianForLevel(employees, 'l2')).toEqual({
      median: 103500,
      sampleSize: 2,
    });
  });

  it('calculates signed market gaps and rejects invalid references', () => {
    expect(calculateGap(161000, 174000)).toEqual({
      amount: -13000,
      percent: (-13000 / 174000) * 100,
    });
    expect(calculateGap(100000, 0)).toBeNull();
    expect(calculateGap(Number.NaN, 100000)).toBeNull();
  });

  it('describes an employee position within the market range', () => {
    const point = { levelId: 'l4', p25: 150000, p50: 172000, p75: 190000 };
    expect(marketRangePosition(161000, point)).toEqual({
      label: 'Within market range',
      percentile: 37.5,
    });
    expect(marketRangePosition(145000, point)).toEqual({
      label: 'Below market range',
      percentile: null,
    });
  });

  it('keeps calculations unavailable when market data and assumptions are missing', () => {
    const employee: Employee = { id: '1', name: 'A', levelId: 'l1', salary: 90000 };
    const workspace: Workspace = {
      organization: { id: 'org', name: 'Acme', currency: 'USD' },
      laborMarket: { id: 'market', name: 'Remote — US' },
      discipline: { id: 'discipline', name: 'Engineering' },
      ladder: { id: 'ladder', name: 'IC' },
      dataset: { id: 'dataset', name: 'Survey' },
      levels: [{ id: 'l1', name: 'L1', order: 1 }],
      market: [],
      employees: [employee],
      assumptions: [],
    };

    const metrics = employeeMetrics(workspace, employee);
    expect(metrics.marketGap).toBeNull();
    expect(metrics.marketPosition).toBeNull();
    expect(metrics.replacement).toBeNull();
    expect(metrics.retentionExposure).toBeNull();
  });
});

describe('replacement planning calculations', () => {
  it('exposes hiring, vacancy, ramp, and total cost components', () => {
    const result = calculateReplacementCost(161000, assumption);
    expect(result).not.toBeNull();
    expect(result!.hiringCost).toBe(18000);
    expect(result!.vacancyCost).toBeCloseTo(63161.54, 2);
    expect(result!.rampCost).toBeCloseTo(29723.08, 2);
    expect(result!.total).toBeCloseTo(110884.62, 2);
  });

  it('returns unavailable when a required assumption is missing or invalid', () => {
    expect(
      calculateReplacementCost(161000, { ...assumption, rampDays: null }),
    ).toBeNull();
    expect(
      calculateReplacementCost(161000, { ...assumption, vacancyMultiplier: -1 }),
    ).toBeNull();
  });

  it('adds only a positive market adjustment to replacement exposure', () => {
    const replacement = calculateReplacementCost(161000, assumption)!;
    expect(calculateRetentionExposure(161000, 174000, replacement)).toBeCloseTo(
      replacement.total + 13000,
    );
    expect(calculateRetentionExposure(180000, 174000, replacement)).toBeCloseTo(
      replacement.total,
    );
    expect(calculateRetentionExposure(180000, null, replacement)).toBeNull();
  });
});

describe('market curves and validation', () => {
  it('enforces ordered, positive market percentiles', () => {
    expect(
      validateMarketPoint({ levelId: 'l1', p25: 75000, p50: 84000, p75: 92000 }),
    ).toBe(true);
    expect(
      validateMarketPoint({ levelId: 'l1', p25: 90000, p50: 84000, p75: 92000 }),
    ).toBe(false);
    expect(
      validateMarketPoint({ levelId: 'l1', p25: 0, p50: 84000, p75: 92000 }),
    ).toBe(false);
  });

  it('produces deterministic curves without introducing level decreases', () => {
    const input = [
      { x: 1, y: 80000 },
      { x: 2, y: 100000 },
      { x: 3, y: 95000 },
      { x: 4, y: 140000 },
    ];
    const first = monotoneCubicInterpolate(input, 8);
    const second = monotoneCubicInterpolate(input, 8);
    expect(first).toEqual(second);
    expect(first.every((point, index) => index === 0 || point.y >= first[index - 1].y)).toBe(true);
    expect(first[0]).toEqual(input[0]);
    expect(first.at(-1)).toEqual(input.at(-1));
  });
});
