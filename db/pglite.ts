import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { AppDatabase } from './index';
import * as schema from './schema';

export async function openPgliteDatabase(dataDirectory: string) {
  if (dataDirectory !== 'memory://')
    await mkdir(dataDirectory, { mode: 0o700, recursive: true });
  const client = new PGlite(dataDirectory);
  try {
    const orm = drizzle(client, { schema });
    await migrate(orm, { migrationsFolder: resolve('drizzle/postgres') });
    return {
      db: new AppDatabase(orm, (callback) => orm.transaction(callback)),
      close: () => client.close(),
    };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
