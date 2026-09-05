import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleWorkspace } from '@/lib/sample-data';
import { TestD1Database } from '@/lib/test-d1';

const workerEnv = vi.hoisted(() => ({ DB: undefined as unknown }));

vi.mock('cloudflare:workers', () => ({ env: workerEnv }));

import { GET, PUT } from './route';

function workspaceRequest(workspace: unknown) {
  return new Request('http://workforce.test/api/workspace', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace }),
  });
}

describe('workspace API route', () => {
  let database: TestD1Database;

  beforeEach(() => {
    database = new TestD1Database();
    workerEnv.DB = database;
  });

  afterEach(() => database.close());

  it('persists a valid workspace and reloads its selected scope', async () => {
    const workspace = structuredClone(sampleWorkspace);
    const saveResponse = await PUT(workspaceRequest(workspace));

    expect(saveResponse.status).toBe(200);
    const saved = await saveResponse.json() as { savedAt: string };
    expect(Number.isNaN(Date.parse(saved.savedAt))).toBe(false);

    const loadResponse = await GET(new Request(
      'http://workforce.test/api/workspace?organizationId=org-1&laborMarketId=market-hsv&disciplineId=discipline-swe&ladderId=ladder-ic&datasetId=dataset-2026',
    ));
    expect(loadResponse.status).toBe(200);
    const loaded = await loadResponse.json() as { workspace: typeof sampleWorkspace };
    expect(loaded.workspace.organization).toEqual(sampleWorkspace.organization);
    expect(loaded.workspace.employees).toHaveLength(sampleWorkspace.employees.length);
    expect(loaded.workspace.assumptions).toHaveLength(sampleWorkspace.assumptions.length);
  });

  it('rejects malformed JSON and incomplete workspace bodies', async () => {
    const malformed = await PUT(new Request('http://workforce.test/api/workspace', {
      method: 'PUT', body: '{', headers: { 'content-type': 'application/json' },
    }));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: 'The request body must be valid JSON.' });

    const incomplete = await PUT(workspaceRequest({ organization: {} }));
    expect(incomplete.status).toBe(400);
    await expect(incomplete.json()).resolves.toEqual({ error: 'A complete workspace is required.' });
  });

  it('rejects invalid references and leaves the prior workspace unchanged', async () => {
    const original = structuredClone(sampleWorkspace);
    expect((await PUT(workspaceRequest(original))).status).toBe(200);

    const invalid = structuredClone(sampleWorkspace);
    invalid.employees[0].levelId = 'unknown-level';
    const response = await PUT(workspaceRequest(invalid));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Each employee needs a name, positive salary, and valid level.',
    });

    const loaded = await GET(new Request('http://workforce.test/api/workspace'));
    const payload = await loaded.json() as { workspace: typeof sampleWorkspace };
    expect(payload.workspace.employees.find((employee) => employee.id === 'e1')?.levelId).toBe('l1');
  });

  it('rejects invalid market ranges before persistence', async () => {
    const invalid = structuredClone(sampleWorkspace);
    invalid.market[0] = { ...invalid.market[0], p25: 100000, p50: 90000 };

    const response = await PUT(workspaceRequest(invalid));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Each market row must satisfy P25 ≤ P50 ≤ P75.',
    });

    const loaded = await GET(new Request('http://workforce.test/api/workspace'));
    await expect(loaded.json()).resolves.toEqual({ workspace: null });
  });

  it('returns a conflict when an existing child would change parent scope', async () => {
    expect((await PUT(workspaceRequest(structuredClone(sampleWorkspace)))).status).toBe(200);
    const conflicting = structuredClone(sampleWorkspace);
    conflicting.organization = { ...conflicting.organization, id: 'other-organization' };

    const response = await PUT(workspaceRequest(conflicting));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'labor_markets record market-hsv already belongs to a different parent.',
    });
  });

  it('returns not found for an unknown explicit scope', async () => {
    const response = await GET(new Request(
      'http://workforce.test/api/workspace?organizationId=missing',
    ));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'The requested workspace context was not found.',
    });
  });
});
