import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleWorkspace } from '@/lib/sample-data';
import { saveWorkspace } from '@/lib/workspace-repository';
import { TestD1Database } from '@/lib/test-d1';
import type { PlanningState } from '@/lib/workforce-planning';

const workerEnv = vi.hoisted(() => ({
  DB: undefined as unknown,
  WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL: 'true' as string | undefined,
  WORKFORCE_COMPASS_TRUSTED_USER_HEADER: 'x-user-email' as string | undefined,
}));

vi.mock('cloudflare:workers', () => ({ env: workerEnv }));

import { GET, PUT } from './route';

const state: PlanningState = {
  version: 1,
  members: [
    { email: 'admin@example.com', role: 'admin' },
    { email: 'viewer@example.com', role: 'viewer' },
  ],
  scenarios: [
    { id: 'scenario-1', name: 'Market review', budget: 50000, changes: [] },
  ],
  hiringHistory: [],
  productivityCurves: [],
  geographicDifferentials: [{ location: 'Chicago', factor: 1.05 }],
  integrations: [],
};

describe('planning API route', () => {
  let adapter: TestD1Database;

  beforeEach(async () => {
    adapter = new TestD1Database();
    workerEnv.DB = adapter;
    await saveWorkspace(
      adapter as unknown as D1Database,
      structuredClone(sampleWorkspace),
    );
  });

  afterEach(() => adapter.close());

  it('bootstraps admin access, persists planning state, and returns history', async () => {
    const save = await PUT(
      new Request('http://workforce.test/api/planning', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-user-email': 'admin@example.com',
        },
        body: JSON.stringify({ organizationId: 'org-1', state }),
      }),
    );
    expect(save.status).toBe(200);

    const response = await GET(
      new Request('http://workforce.test/api/planning?organizationId=org-1', {
        headers: { 'x-user-email': 'admin@example.com' },
      }),
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      state: PlanningState;
      role: string;
      history: { snapshots: unknown[]; auditEvents: unknown[] };
    };
    expect(result.state.scenarios).toHaveLength(1);
    expect(result.role).toBe('admin');
    expect(result.history.snapshots.length).toBeGreaterThan(0);
    expect(result.history.auditEvents.length).toBeGreaterThan(0);
  });

  it('allows viewers to read but not edit', async () => {
    await PUT(
      new Request('http://workforce.test/api/planning', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-user-email': 'admin@example.com',
        },
        body: JSON.stringify({ organizationId: 'org-1', state }),
      }),
    );
    expect(
      (
        await GET(
          new Request(
            'http://workforce.test/api/planning?organizationId=org-1',
            { headers: { 'x-user-email': 'viewer@example.com' } },
          ),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await PUT(
          new Request('http://workforce.test/api/planning', {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              'x-user-email': 'viewer@example.com',
            },
            body: JSON.stringify({ organizationId: 'org-1', state }),
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await GET(
          new Request(
            'http://workforce.test/api/planning?organizationId=org-1',
            { headers: { 'x-user-email': 'unknown@example.com' } },
          ),
        )
      ).status,
    ).toBe(403);
  });

  it('rejects malformed planning state', async () => {
    const response = await PUT(
      new Request('http://workforce.test/api/planning', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationId: 'org-1',
          state: { version: 1 },
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
