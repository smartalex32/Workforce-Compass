import { describe, expect, it } from 'vitest';
import { sampleWorkspace } from './sample-data';
import {
  applyGeographicDifferential,
  evaluateScenario,
  exportEmployeesCsv,
  exportMarketCsv,
  historicalTimeToHireDays,
  importEmployeesCsv,
  importMarketCsv,
  parseCsv,
  performanceCompensationSummary,
  planningSuggestions,
  productivityAtDay,
  rampCostFromProductivityCurve,
  retentionRiskSignal,
  robustSalaryOutliers,
} from './workforce-planning';

describe('CSV workflows and integration records', () => {
  it('round-trips quoted employee fields and total compensation columns', () => {
    const workspace = structuredClone(sampleWorkspace);
    workspace.employees = [
      {
        ...workspace.employees[0],
        name: 'Chen, Maya',
        notes: 'Said "hello"',
        annualBonus: 5000,
        location: 'Austin, TX',
      },
    ];
    const csv = exportEmployeesCsv(workspace);
    const result = importEmployeesCsv(csv, workspace);
    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({
      name: 'Chen, Maya',
      notes: 'Said "hello"',
      annualBonus: 5000,
      location: 'Austin, TX',
    });
  });

  it('reports bad market rows without importing them', () => {
    const result = importMarketCsv(
      'levelId,p25,p50,p75\nl1,100,90,120',
      sampleWorkspace,
    );
    expect(result.records).toEqual([]);
    expect(result.errors[0]).toContain('Row 2');
  });

  it('round-trips valid market rows', () => {
    const result = importMarketCsv(
      exportMarketCsv(sampleWorkspace),
      sampleWorkspace,
    );
    expect(result.errors).toEqual([]);
    expect(result.records).toEqual(sampleWorkspace.market);
  });

  it('parses CRLF, embedded commas, quotes, and newlines', () => {
    expect(parseCsv('a,b\r\n"x,y","line 1\nline 2"')).toEqual([
      ['a', 'b'],
      ['x,y', 'line 1\nline 2'],
    ]);
    expect(() => parseCsv('a,"unfinished')).toThrow(/unterminated/);
  });
});

describe('workforce planning models', () => {
  it('applies positive geographic cost-of-labor factors', () => {
    expect(applyGeographicDifferential(sampleWorkspace.market[0], 1.1)).toEqual(
      {
        levelId: 'l1',
        p25: 82500,
        p50: 92400.00000000001,
        p75: 101200.00000000001,
      },
    );
    expect(
      applyGeographicDifferential(sampleWorkspace.market[0], 0),
    ).toBeNull();
  });

  it('evaluates scenario cost and budget without applying changes', () => {
    expect(
      evaluateScenario(sampleWorkspace, {
        id: 's1',
        name: 'Review',
        budget: 5000,
        changes: [{ employeeId: 'e1', proposedSalary: 85000 }],
      }),
    ).toEqual({
      annualCost: 3000,
      remainingBudget: 2000,
      withinBudget: true,
      invalidEmployeeIds: [],
    });
  });

  it('interpolates productivity curves and summarizes historical hiring time', () => {
    expect(
      productivityAtDay(
        [
          { day: 0, productivity: 0.25 },
          { day: 100, productivity: 0.75 },
        ],
        50,
      ),
    ).toBe(0.5);
    expect(rampCostFromProductivityCurve(26000, [
      { day: 0, productivity: 0 },
      { day: 10, productivity: 1 },
    ], 10)).toBeCloseTo(500);
    expect(
      historicalTimeToHireDays(
        [
          { levelId: 'l1', openedAt: '2026-01-01', filledAt: '2026-01-31' },
          { levelId: 'l1', openedAt: '2026-02-01', filledAt: '2026-04-02' },
        ],
        'l1',
      ),
    ).toBe(45);
  });

  it('uses an IQR fence only when sample size supports it', () => {
    const employees = [10, 11, 12, 13, 100].map((salary, index) => ({
      ...sampleWorkspace.employees[0],
      id: String(index),
      salary,
    }));
    expect(robustSalaryOutliers(employees)).toEqual([
      { employeeId: '4', salary: 100, direction: 'high' },
    ]);
    expect(robustSalaryOutliers(employees.slice(0, 3))).toEqual([]);
  });

  it('keeps performance analysis descriptive and sample-gated', () => {
    const employees = sampleWorkspace.employees
      .slice(0, 3)
      .map((employee, index) => ({
        ...employee,
        performanceRating: index + 1,
        annualBonus: index * 1000,
      }));
    expect(performanceCompensationSummary(employees)?.sampleSize).toBe(3);
    expect(performanceCompensationSummary(employees.slice(0, 2))).toBeNull();
  });

  it('provides transparent review signals rather than decisions', () => {
    const workspace = structuredClone(sampleWorkspace);
    workspace.employees[0] = {
      ...workspace.employees[0],
      salary: 60000,
      startDate: '2020-01-01',
      performanceRating: 5,
    };
    const signal = retentionRiskSignal(
      workspace,
      workspace.employees[0],
      new Date('2026-01-01'),
    );
    expect(signal.score).toBeGreaterThanOrEqual(60);
    expect(signal.disclaimer).toMatch(/does not predict/);
    expect(planningSuggestions(workspace)[0]).toMatchObject({
      employeeId: 'e1',
      requiresHumanReview: true,
    });
  });
});
