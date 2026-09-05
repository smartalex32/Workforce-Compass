import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sampleWorkspace } from './sample-data';
import { TestD1Database } from './test-d1';
import {
  listWorkspaceContexts,
  loadWorkspace,
  reassignEmployee,
  saveWorkspace,
  WorkspaceConflictError,
} from './workspace-repository';

describe('workspace repository', () => {
  let adapter: TestD1Database;
  let db: D1Database;

  beforeEach(() => {
    adapter = new TestD1Database();
    db = adapter as unknown as D1Database;
  });

  afterEach(() => adapter.close());

  it('persists employee creation, edits, level changes, and deletion across reloads without altering market data', async () => {
    const workspace = structuredClone(sampleWorkspace);
    const newEmployee = { id: 'new-employee', name: 'Alex Chen', disciplineId: workspace.discipline.id, careerLadderId: workspace.ladder.id, levelId: workspace.levels[0].id, salary: 93123.45 };
    workspace.employees.push(newEmployee);
    await saveWorkspace(db, workspace);
    const created = (await loadWorkspace(db))!;
    expect(created.employees.find((employee) => employee.id === newEmployee.id)).toMatchObject(newEmployee);

    const changed = { ...newEmployee, name: 'Alex Rivera', title: 'Engineer', notes: 'Updated role', levelId: workspace.levels[1].id, salary: 110222.22 };
    created.employees = created.employees.map((employee) => employee.id === changed.id ? changed : employee);
    await saveWorkspace(db, created);
    const edited = (await loadWorkspace(db))!;
    expect(edited.employees.find((employee) => employee.id === changed.id)).toMatchObject(changed);

    edited.employees = edited.employees.filter((employee) => employee.id !== changed.id);
    await saveWorkspace(db, edited);
    const deleted = (await loadWorkspace(db))!;
    expect(deleted.employees.some((employee) => employee.id === changed.id)).toBe(false);
    expect(deleted.employees).toHaveLength(sampleWorkspace.employees.length);
    expect(deleted.market).toEqual(workspace.market);
    expect(deleted.assumptions).toEqual(workspace.assumptions);
  });

  it('preserves multiple market datasets and loads an explicitly selected context', async () => {
    const first = structuredClone(sampleWorkspace);
    await saveWorkspace(db, first, '2026-01-01T00:00:00.000Z');

    const second = structuredClone(first);
    second.laborMarket = {
      id: 'market-atlanta',
      name: 'Atlanta, GA',
    };
    second.dataset = {
      id: 'dataset-atlanta-2026',
      name: 'Atlanta 2026 Survey',
      effectiveDate: '2026-02-01',
      active: true,
    };
    second.market = second.market.map((point) => ({
      ...point,
      p25: point.p25 + 5000,
      p50: point.p50 + 5000,
      p75: point.p75 + 5000,
    }));
    await saveWorkspace(db, second, '2026-02-01T00:00:00.000Z');

    const original = await loadWorkspace(db, {
      organizationId: first.organization.id,
      laborMarketId: first.laborMarket.id,
      disciplineId: first.discipline.id,
      ladderId: first.ladder.id,
      datasetId: first.dataset.id,
    });
    const atlanta = await loadWorkspace(db, {
      organizationId: second.organization.id,
      laborMarketId: second.laborMarket.id,
      disciplineId: second.discipline.id,
      ladderId: second.ladder.id,
      datasetId: second.dataset.id,
    });

    expect(original?.market).toEqual(first.market);
    expect(atlanta?.market).toEqual(second.market);
    expect(atlanta?.laborMarket.name).toBe('Atlanta, GA');

    const contexts = await listWorkspaceContexts(db, first.organization.id);
    expect(contexts.laborMarkets.map((market) => market.id)).toEqual([
      'market-atlanta',
      first.laborMarket.id,
    ]);
    expect(contexts.datasets.map((dataset) => dataset.id)).toContain(
      first.dataset.id,
    );
    expect(contexts.datasets.map((dataset) => dataset.id)).toContain(
      second.dataset.id,
    );
    expect(contexts.levels.map((level) => level.id)).toEqual(
      first.levels.map((level) => level.id),
    );

    const reordered = structuredClone(first);
    reordered.levels = reordered.levels.map((level, index) => ({
      ...level,
      order: -index,
    }));
    reordered.market = reordered.market.slice(0, 1);
    await saveWorkspace(db, reordered);
    const reloadedReordered = await loadWorkspace(db, {
      organizationId: first.organization.id,
      laborMarketId: first.laborMarket.id,
      disciplineId: first.discipline.id,
      ladderId: first.ladder.id,
      datasetId: first.dataset.id,
    });
    expect(reloadedReordered?.levels.map((level) => level.id)).toEqual(
      first.levels.map((level) => level.id).reverse(),
    );
    expect(reloadedReordered?.market).toEqual(reordered.market);
    const atlantaAfterReorder = await loadWorkspace(db, {
      organizationId: second.organization.id,
      laborMarketId: second.laborMarket.id,
      disciplineId: second.discipline.id,
      ladderId: second.ladder.id,
      datasetId: second.dataset.id,
    });
    expect(atlantaAfterReorder?.market).toEqual(second.market);
  });

  it('round-trips inactive datasets while excluding them from default selection', async () => {
    const active = structuredClone(sampleWorkspace);
    await saveWorkspace(db, active);

    const inactive = structuredClone(active);
    inactive.dataset = {
      id: 'dataset-inactive',
      name: 'Archived estimate',
      effectiveDate: '2027-01-01',
      active: false,
    };
    await saveWorkspace(db, inactive);

    const explicitlyLoaded = await loadWorkspace(db, {
      organizationId: inactive.organization.id,
      laborMarketId: inactive.laborMarket.id,
      disciplineId: inactive.discipline.id,
      ladderId: inactive.ladder.id,
      datasetId: inactive.dataset.id,
    });
    expect(explicitlyLoaded?.dataset.active).toBe(false);

    const defaultWorkspace = await loadWorkspace(db);
    expect(defaultWorkspace?.dataset.id).toBe(active.dataset.id);
    expect(defaultWorkspace?.dataset.active).toBe(true);

    active.dataset.active = false;
    await saveWorkspace(db, active);
    const inactiveFallback = await loadWorkspace(db);
    expect(inactiveFallback?.dataset.active).toBe(false);
    expect(inactiveFallback?.dataset.id).toBe(inactive.dataset.id);
  });

  it('atomically reassigns an employee to a validated discipline, ladder, and level', async () => {
    const source = structuredClone(sampleWorkspace);
    await saveWorkspace(db, source);

    const target = structuredClone(source);
    target.discipline = { id: 'discipline-systems', name: 'Systems Engineering' };
    target.ladder = { id: 'ladder-systems-ic', name: 'Systems IC' };
    target.levels = [{ id: 'systems-senior', name: 'Senior', order: 10 }];
    target.market = [];
    target.employees = [];
    target.assumptions = [];
    await saveWorkspace(db, target);

    const employee = {
      ...source.employees[0],
      name: 'Moved Employee',
      disciplineId: target.discipline.id,
      careerLadderId: target.ladder.id,
      levelId: target.levels[0].id,
      salary: 123_456,
    };
    await expect(reassignEmployee(db, {
      organizationId: source.organization.id,
      sourceDisciplineId: source.discipline.id,
      sourceCareerLadderId: source.ladder.id,
      employee,
    })).resolves.toBe(true);

    const reloadedSource = await loadWorkspace(db, {
      organizationId: source.organization.id,
      laborMarketId: source.laborMarket.id,
      disciplineId: source.discipline.id,
      ladderId: source.ladder.id,
      datasetId: source.dataset.id,
    });
    const reloadedTarget = await loadWorkspace(db, {
      organizationId: target.organization.id,
      laborMarketId: target.laborMarket.id,
      disciplineId: target.discipline.id,
      ladderId: target.ladder.id,
      datasetId: target.dataset.id,
    });
    expect(reloadedSource?.employees.some((item) => item.id === employee.id)).toBe(false);
    expect(reloadedTarget?.employees.find((item) => item.id === employee.id)).toMatchObject(employee);

    await expect(reassignEmployee(db, {
      organizationId: source.organization.id,
      sourceDisciplineId: target.discipline.id,
      sourceCareerLadderId: target.ladder.id,
      employee: { ...employee, levelId: 'missing-level' },
    })).resolves.toBe(false);
    const unchangedTarget = await loadWorkspace(db, {
      organizationId: target.organization.id,
      laborMarketId: target.laborMarket.id,
      disciplineId: target.discipline.id,
      ladderId: target.ladder.id,
      datasetId: target.dataset.id,
    });
    expect(unchangedTarget?.employees.find((item) => item.id === employee.id)?.levelId).toBe(target.levels[0].id);
  });

  it('preserves independent organizations and missing market data', async () => {
    const first = structuredClone(sampleWorkspace);
    await saveWorkspace(db, first);

    const second = structuredClone(first);
    second.organization = { id: 'org-2', name: 'Beta Corp', currency: 'USD' };
    second.laborMarket = { id: 'market-2', name: 'Remote — United States' };
    second.discipline = { id: 'discipline-2', name: 'Systems Engineering' };
    second.ladder = { id: 'ladder-2', name: 'Technical Leadership' };
    second.dataset = { id: 'dataset-2', name: 'Recruiting Estimate', active: true };
    second.levels = second.levels.map((level, index) => ({
      ...level,
      id: `beta-level-${index + 1}`,
    }));
    second.market = [];
    second.assumptions = [];
    second.employees = [];
    await saveWorkspace(db, second);

    expect(
      await loadWorkspace(db, {
        organizationId: first.organization.id,
        laborMarketId: first.laborMarket.id,
        disciplineId: first.discipline.id,
        ladderId: first.ladder.id,
        datasetId: first.dataset.id,
      }),
    ).not.toBeNull();

    const beta = await loadWorkspace(db, {
      organizationId: second.organization.id,
      laborMarketId: second.laborMarket.id,
      disciplineId: second.discipline.id,
      ladderId: second.ladder.id,
      datasetId: second.dataset.id,
    });
    expect(beta?.market).toEqual([]);
    expect(beta?.assumptions).toEqual([]);
    expect(beta?.employees).toEqual([]);
  });

  it('rejects attempts to reuse a child ID under a different parent before writing', async () => {
    const first = structuredClone(sampleWorkspace);
    await saveWorkspace(db, first);

    const conflicting = structuredClone(first);
    conflicting.organization = {
      id: 'other-organization',
      name: 'Other Organization',
      currency: 'USD',
    };

    await expect(saveWorkspace(db, conflicting)).rejects.toBeInstanceOf(
      WorkspaceConflictError,
    );
    expect(
      await loadWorkspace(db, { organizationId: 'other-organization' }),
    ).toBeNull();
  });
});
