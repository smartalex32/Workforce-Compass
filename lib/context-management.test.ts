import { describe, expect, it } from 'vitest';
import type { Workspace } from './domain';
import { createWorkspaceContext } from './context-management';

const source: Workspace = {
  organization: { id: 'org-1', name: 'Acme', currency: 'USD' },
  laborMarket: { id: 'market-1', name: 'Remote' },
  discipline: { id: 'discipline-1', name: 'Engineering' },
  ladder: { id: 'ladder-1', name: 'IC' },
  dataset: { id: 'dataset-1', name: '2026 survey', active: true },
  levels: [{ id: 'level-1', name: 'L1', order: 1 }],
  market: [{ levelId: 'level-1', p25: 80_000, p50: 90_000, p75: 100_000 }],
  employees: [
    { id: 'employee-1', name: 'A', disciplineId: 'discipline-1', careerLadderId: 'ladder-1', levelId: 'level-1', salary: 92_000 },
  ],
  assumptions: [
    {
      levelId: 'level-1',
      timeToHireDays: 45,
      rampDays: 60,
      vacancyMultiplier: 0.7,
      rampLossFactor: 0.4,
      recruitingCost: 1,
      interviewCost: 2,
      signingCost: 3,
      otherCost: 4,
    },
  ],
};

function factory() {
  let next = 0;
  return (entity: string) => `new-${entity}-${++next}`;
}

describe('workspace context creation', () => {
  it('creates an independent dataset while retaining observed team data', () => {
    const draft = createWorkspaceContext(source, 'dataset', factory());
    expect(draft.dataset.id).not.toBe(source.dataset.id);
    expect(draft.market).toEqual([]);
    expect(draft.employees).toEqual(source.employees);
    expect(draft.levels).toEqual(source.levels);
  });

  it('creates a market with its own dataset and no copied market ranges', () => {
    const draft = createWorkspaceContext(source, 'laborMarket', factory());
    expect(draft.laborMarket.id).not.toBe(source.laborMarket.id);
    expect(draft.dataset.id).not.toBe(source.dataset.id);
    expect(draft.market).toEqual([]);
    expect(draft.discipline).toEqual(source.discipline);
    expect(draft.employees).toEqual(source.employees);
  });

  it.each(['discipline', 'ladder'] as const)(
    'creates fresh career data for a new %s',
    (kind) => {
      const draft = createWorkspaceContext(source, kind, factory());
      expect(draft.levels).toHaveLength(1);
      expect(draft.levels[0].id).not.toBe(source.levels[0].id);
      expect(draft.market).toEqual([]);
      expect(draft.employees).toEqual([]);
      expect(draft.assumptions).toHaveLength(1);
      expect(draft.assumptions[0].levelId).toBe(draft.levels[0].id);
    },
  );

  it('creates a fully independent organization scope', () => {
    const draft = createWorkspaceContext(source, 'organization', factory());
    expect(draft.organization.id).not.toBe(source.organization.id);
    expect(draft.laborMarket.id).not.toBe(source.laborMarket.id);
    expect(draft.discipline.id).not.toBe(source.discipline.id);
    expect(draft.ladder.id).not.toBe(source.ladder.id);
    expect(draft.dataset.id).not.toBe(source.dataset.id);
    expect(draft.organization.currency).toBe('USD');
    expect(draft.employees).toEqual([]);
  });

  it('does not mutate the source workspace', () => {
    const before = JSON.stringify(source);
    createWorkspaceContext(source, 'organization', factory());
    expect(JSON.stringify(source)).toBe(before);
  });
});
