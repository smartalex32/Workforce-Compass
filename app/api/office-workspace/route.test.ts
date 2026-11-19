import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, type TestDatabase } from '@/lib/test-database';

const workerEnv = vi.hoisted(() => ({
  DB: undefined as unknown,
  WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL: 'true' as string | undefined,
}));
vi.mock('@/db/runtime', () => ({
  getDb: async () => workerEnv.DB,
  runtimeEnv: workerEnv,
}));
import { GET, POST } from './route';

describe('office workspace API', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await createTestDatabase();
    workerEnv.DB = db;
  });
  afterEach(async () => db.close());
  it('creates an explicitly empty organization and returns the office workspace response', async () => {
    const created = await POST(
      new Request('http://workforce.test/api/office-workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'organization',
          name: 'Northstar',
          currency: 'USD',
        }),
      }),
    );
    expect(created.status).toBe(200);
    const payload = (await created.json()) as {
      entityId: string;
      workspace: { offices: unknown[] };
      organizations: unknown[];
    };
    expect(payload.entityId).toBeTruthy();
    expect(payload.workspace.offices).toEqual([]);
    const defaultLoaded = await GET(
      new Request('http://workforce.test/api/office-workspace'),
    );
    expect(
      (
        (await defaultLoaded.json()) as {
          workspace: { organization: { name: string } };
        }
      ).workspace.organization.name,
    ).toBe('Northstar');
    const loaded = await GET(
      new Request(
        `http://workforce.test/api/office-workspace?organizationId=${payload.entityId}`,
      ),
    );
    expect(loaded.status).toBe(200);
    expect(
      (
        (await loaded.json()) as {
          workspace: { organization: { name: string } };
        }
      ).workspace.organization.name,
    ).toBe('Northstar');
  });
});
