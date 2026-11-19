import { resolve } from 'node:path';
import type { AuthEnvironment } from '@/lib/api-auth';
import { AppDatabase } from './index';

export const runtimeEnv: NodeJS.ProcessEnv & AuthEnvironment = process.env;

type RuntimeState = typeof globalThis & {
  workforceCompassDatabase?: Promise<AppDatabase>;
};

export function getDb(): Promise<AppDatabase> {
  const state = globalThis as RuntimeState;
  state.workforceCompassDatabase ??= openDatabase().catch((error: unknown) => {
    delete state.workforceCompassDatabase;
    throw error;
  });
  return state.workforceCompassDatabase;
}

async function openDatabase() {
  const databaseUrl = runtimeEnv.DATABASE_URL?.trim();
  const dataDirectory = runtimeEnv.WORKFORCE_COMPASS_PGLITE_DIR?.trim();
  if (databaseUrl && dataDirectory)
    throw new Error(
      'Set only one of DATABASE_URL and WORKFORCE_COMPASS_PGLITE_DIR.',
    );
  if (databaseUrl) {
    const [{ Pool }, { drizzle }, schema] = await Promise.all([
      import('pg'),
      import('drizzle-orm/node-postgres'),
      import('./schema'),
    ]);
    const pool = new Pool({ connectionString: databaseUrl });
    pool.on('error', (error) =>
      console.error('Idle PostgreSQL connection error:', error.message),
    );
    const orm = drizzle(pool, { schema });
    return new AppDatabase(orm, (callback) => orm.transaction(callback));
  }
  if (runtimeEnv.NODE_ENV === 'production' && !dataDirectory)
    throw new Error('Set DATABASE_URL to run Workforce Compass in production.');

  const { openPgliteDatabase } = await import('./pglite');
  const instance = await openPgliteDatabase(
    dataDirectory === 'memory://'
      ? dataDirectory
      : resolve(dataDirectory || '.data/pglite'),
  );
  return instance.db;
}
