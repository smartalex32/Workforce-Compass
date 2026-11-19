import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDatabase } from '@/db/index';
import { createTestDatabase, type TestDatabase } from './test-database';
import {
  createOfficeOrganization,
  executeOfficeCommand,
  loadOfficeWorkspace,
} from './office-repository';

describe('office workspace repository', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await createTestDatabase();
  });
  afterEach(async () => db.close());

  it('supports an empty organization, incomplete people, and office-only reassignment', async () => {
    const d1: AppDatabase = db;
    const organizationId = await createOfficeOrganization(
      d1,
      'Northstar',
      'USD',
      'admin@example.test',
    );
    const officeId = await executeOfficeCommand(
      d1,
      organizationId,
      { action: 'office', name: 'Austin', laborMarketId: null },
      'admin@example.test',
    );
    const personId = await executeOfficeCommand(
      d1,
      organizationId,
      {
        action: 'person',
        name: 'Taylor',
        officeId: officeId!,
        levelId: null,
        salary: null,
      },
      'admin@example.test',
    );
    await executeOfficeCommand(
      d1,
      organizationId,
      {
        action: 'assign',
        assignments: [{ personId: personId!, officeId: officeId! }],
      },
      'admin@example.test',
    );
    const workspace = await loadOfficeWorkspace(d1, organizationId, 'admin');
    expect(workspace?.people).toMatchObject([
      { id: personId, officeId, levelId: null, salary: null },
    ]);
  });

  it('creates reusable levels and dated company bands', async () => {
    const d1: AppDatabase = db;
    const organizationId = await createOfficeOrganization(
      d1,
      'Northstar',
      'USD',
      'admin@example.test',
    );
    const ladderId = await executeOfficeCommand(
      d1,
      organizationId,
      {
        action: 'ladder',
        disciplineName: 'Engineering',
        name: 'IC',
        template: 'blank',
      },
      'admin@example.test',
    );
    const levelId = await executeOfficeCommand(
      d1,
      organizationId,
      {
        action: 'level',
        ladderId: ladderId!,
        code: 'L1',
        name: 'Engineer I',
        position: 1,
      },
      'admin@example.test',
    );
    await executeOfficeCommand(
      d1,
      organizationId,
      {
        action: 'publish-bands',
        marketId: null,
        date: '2026-01-01',
        rows: [{ levelId: levelId!, min: 90000, mid: 105000, max: 120000 }],
      },
      'admin@example.test',
    );
    const workspace = await loadOfficeWorkspace(d1, organizationId, 'admin');
    expect(workspace?.bands).toEqual([
      {
        levelId,
        marketId: null,
        date: '2026-01-01',
        values: { levelId, min: 90000, mid: 105000, max: 120000 },
      },
    ]);
  });
});
