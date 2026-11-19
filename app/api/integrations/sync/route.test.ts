import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleWorkspace } from '@/lib/sample-data';
import { loadWorkspace, saveWorkspace } from '@/lib/workspace-repository';
import { loadPlanningState } from '@/lib/planning-repository';
import { createTestDatabase, type TestDatabase } from '@/lib/test-database';

const workerEnv = vi.hoisted(() => ({
  DB: undefined as unknown,
  WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL: 'true' as string | undefined,
  WORKFORCE_COMPASS_TRUSTED_USER_HEADER: undefined as string | undefined,
}));
vi.mock('@/db/runtime', () => ({
  getDb: async () => workerEnv.DB,
  runtimeEnv: workerEnv,
}));
import { POST } from './route';

describe('integration sync API', () => {
  let adapter: TestDatabase;
  let db: TestDatabase;
  beforeEach(async () => {
    adapter = await createTestDatabase();
    db = adapter;
    workerEnv.DB = adapter;
    await saveWorkspace(db, structuredClone(sampleWorkspace));
  });
  afterEach(async () => adapter.close());

  it('validates and synchronizes an HRIS employee CSV', async () => {
    const csv =
      'id,employeeNumber,name,title,levelId,baseSalary\nnew-1,E-1,New Person,Engineer,l2,105000';
    const response = await POST(
      new Request('http://workforce.test/api/integrations/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'hris', csv }),
      }),
    );
    expect(response.status).toBe(200);
    const workspace = await loadWorkspace(db);
    expect(
      workspace?.employees.some(
        (employee) => employee.employeeNumber === 'E-1',
      ),
    ).toBe(true);
    expect(
      (await loadPlanningState(db, 'org-1')).integrations[0],
    ).toMatchObject({ kind: 'hris', enabled: true });
  });

  it('rejects invalid survey rows atomically', async () => {
    const response = await POST(
      new Request('http://workforce.test/api/integrations/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'survey',
          csv: 'levelId,p25,p50,p75\nl1,100,90,110',
        }),
      }),
    );
    expect(response.status).toBe(422);
    expect((await loadWorkspace(db))?.market[0].p50).toBe(84000);
  });
});
