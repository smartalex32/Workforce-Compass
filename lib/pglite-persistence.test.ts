import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openPgliteDatabase } from '@/db/pglite';
import { createOfficeOrganization } from './office-repository';

it('migrates a new nested PGlite directory and retains workspace data after reopening', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'workforce-pglite-'));
  const dataDirectory = join(directory, 'nested', 'workspace');
  try {
    const first = await openPgliteDatabase(dataDirectory);
    let organizationId: string;
    try {
      organizationId = await createOfficeOrganization(
        first.db,
        'Persistence test',
        'USD',
        'tester@example.test',
      );
    } finally {
      await first.close();
    }
    const reopened = await openPgliteDatabase(dataDirectory);
    try {
      const saved = await reopened.db
        .prepare(
          'SELECT name, workspace_revision FROM organizations WHERE id = ?',
        )
        .bind(organizationId)
        .first();
      expect(saved).toEqual({
        name: 'Persistence test',
        workspace_revision: 1,
      });
    } finally {
      await reopened.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
