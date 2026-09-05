import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleWorkspace } from '@/lib/sample-data';
import { saveWorkspace } from '@/lib/workspace-repository';
import { TestD1Database } from '@/lib/test-d1';

const workerEnv = vi.hoisted(() => ({
  DB: undefined as unknown,
  WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL: 'true' as string | undefined,
}));

vi.mock('cloudflare:workers', () => ({ env: workerEnv }));

import { POST } from './route';

describe('employee reassignment API route', () => {
  let adapter: TestD1Database;
  let db: D1Database;

  beforeEach(async () => {
    adapter = new TestD1Database();
    db = adapter as unknown as D1Database;
    workerEnv.DB = adapter;
    workerEnv.WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL = 'true';

    const source = structuredClone(sampleWorkspace);
    await saveWorkspace(db, source);
    const target = structuredClone(source);
    target.discipline = { id: 'discipline-product', name: 'Product Management' };
    target.ladder = { id: 'ladder-product', name: 'Product IC' };
    target.levels = [{ id: 'product-senior', name: 'Senior', order: 3 }];
    target.market = [];
    target.employees = [];
    target.assumptions = [];
    await saveWorkspace(db, target);
  });

  afterEach(() => adapter.close());

  it('updates employee details and scope in one request', async () => {
    const employee = {
      ...sampleWorkspace.employees[0],
      disciplineId: 'discipline-product',
      careerLadderId: 'ladder-product',
      levelId: 'product-senior',
      name: 'Moved Person',
      salary: 150_000,
    };
    const response = await POST(new Request('http://workforce.test/api/employees/reassign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: sampleWorkspace.organization.id,
        sourceDisciplineId: sampleWorkspace.discipline.id,
        sourceCareerLadderId: sampleWorkspace.ladder.id,
        employee,
      }),
    }));
    expect(response.status).toBe(200);
    expect(adapter.sqlite.prepare('SELECT discipline_id, career_ladder_id, level_id, name, base_salary FROM employees WHERE id = ?').get(employee.id)).toEqual({
      discipline_id: 'discipline-product',
      career_ladder_id: 'ladder-product',
      level_id: 'product-senior',
      name: 'Moved Person',
      base_salary: 150_000,
    });
  });

  it('rejects an invalid target without changing the employee', async () => {
    const employee = { ...sampleWorkspace.employees[0], levelId: 'missing-level' };
    const response = await POST(new Request('http://workforce.test/api/employees/reassign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: sampleWorkspace.organization.id,
        sourceDisciplineId: sampleWorkspace.discipline.id,
        sourceCareerLadderId: sampleWorkspace.ladder.id,
        employee,
      }),
    }));
    expect(response.status).toBe(404);
    expect(adapter.sqlite.prepare('SELECT level_id FROM employees WHERE id = ?').get(employee.id)).toEqual({ level_id: 'l1' });
  });
});
