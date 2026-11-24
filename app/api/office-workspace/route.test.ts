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
  async function post(body: unknown) {
    return POST(
      new Request('http://workforce.test/api/office-workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }
  it('creates an explicitly empty organization and returns the office workspace response', async () => {
    const created = await post({
      action: 'organization',
      name: 'Northstar',
      currency: 'USD',
      companySize: 'mid',
    });
    expect(created.status).toBe(200);
    const payload = (await created.json()) as {
      entityId: string;
      workspace: { offices: unknown[]; organization: { companySize: string } };
      organizations: unknown[];
    };
    expect(payload.entityId).toBeTruthy();
    expect(payload.workspace.offices).toEqual([]);
    expect(payload.workspace.organization.companySize).toBe('mid');
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

  it('round-trips optional profile fields without overwriting them when omitted', async () => {
    const created = await post({
      action: 'organization',
      name: 'Northstar',
      currency: 'USD',
    });
    const organization = (await created.json()) as {
      entityId: string;
      workspace: { revision: number };
    };
    const officeResponse = await post({
      action: 'office',
      organizationId: organization.entityId,
      revision: organization.workspace.revision,
      name: 'Austin',
      laborMarketId: null,
    });
    const office = (await officeResponse.json()) as {
      entityId: string;
      workspace: { revision: number };
    };
    const firstPersonResponse = await post({
      action: 'person',
      organizationId: organization.entityId,
      revision: office.workspace.revision,
      name: 'Avery Adams',
      officeId: office.entityId,
      levelId: null,
      salary: null,
    });
    const firstPerson = (await firstPersonResponse.json()) as {
      entityId: string;
      workspace: {
        revision: number;
        people: {
          clearanceLevel: string | null;
          yearsExperience: number | null;
        }[];
      };
    };
    expect(firstPerson.workspace.people[0]).toMatchObject({
      clearanceLevel: null,
      yearsExperience: null,
    });

    const profiledResponse = await post({
      action: 'person',
      organizationId: organization.entityId,
      revision: firstPerson.workspace.revision,
      id: firstPerson.entityId,
      name: 'Avery Adams',
      officeId: office.entityId,
      levelId: null,
      salary: null,
      clearanceLevel: 'secret',
      yearsExperience: 8.5,
    });
    const profiled = (await profiledResponse.json()) as {
      entityId: string;
      workspace: {
        revision: number;
        people: {
          clearanceLevel: string | null;
          yearsExperience: number | null;
        }[];
      };
    };
    expect(profiled.workspace.people[0]).toMatchObject({
      clearanceLevel: 'secret',
      yearsExperience: 8.5,
    });

    const retainedResponse = await post({
      action: 'person',
      organizationId: organization.entityId,
      revision: profiled.workspace.revision,
      id: profiled.entityId,
      name: 'Avery A.',
      officeId: office.entityId,
      levelId: null,
      salary: null,
    });
    const retained = (await retainedResponse.json()) as {
      workspace: {
        revision: number;
        people: {
          clearanceLevel: string | null;
          yearsExperience: number | null;
        }[];
      };
    };
    expect(retained.workspace.people[0]).toMatchObject({
      clearanceLevel: 'secret',
      yearsExperience: 8.5,
    });

    const clearedResponse = await post({
      action: 'person',
      organizationId: organization.entityId,
      revision: retained.workspace.revision,
      id: profiled.entityId,
      name: 'Avery A.',
      officeId: office.entityId,
      levelId: null,
      salary: null,
      clearanceLevel: null,
      yearsExperience: null,
    });
    const cleared = (await clearedResponse.json()) as {
      workspace: {
        people: {
          clearanceLevel: string | null;
          yearsExperience: number | null;
        }[];
      };
    };
    expect(cleared.workspace.people[0]).toMatchObject({
      clearanceLevel: null,
      yearsExperience: null,
    });
  });

  it('validates profile values and company settings revisions', async () => {
    const invalidPerson = await post({
      action: 'person',
      organizationId: 'organization',
      name: 'Avery Adams',
      officeId: 'office',
      levelId: null,
      salary: null,
      clearanceLevel: 'restricted',
      yearsExperience: -1,
    });
    expect(invalidPerson.status).toBe(400);
    expect(
      (
        await post({
          action: 'organization',
          name: 'Northstar',
          currency: 'USD',
          companySize: 'enterprise',
        })
      ).status,
    ).toBe(400);

    const created = await post({
      action: 'organization',
      name: 'Northstar',
      currency: 'USD',
    });
    const organization = (await created.json()) as {
      entityId: string;
      workspace: {
        revision: number;
        organization: { companySize: string | null };
      };
    };
    const saved = await post({
      action: 'organization-settings',
      organizationId: organization.entityId,
      revision: organization.workspace.revision,
      companySize: 'large',
    });
    expect(saved.status).toBe(200);
    const updated = (await saved.json()) as {
      workspace: { organization: { companySize: string | null } };
    };
    expect(updated.workspace.organization.companySize).toBe('large');
    const stale = await post({
      action: 'organization-settings',
      organizationId: organization.entityId,
      revision: organization.workspace.revision,
      companySize: null,
    });
    expect(stale.status).toBe(409);
  });
});
