import { openPgliteDatabase } from '@/db/pglite';

export async function createTestDatabase() {
  const { db, close } = await openPgliteDatabase('memory://');
  return Object.assign(db, { close });
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
