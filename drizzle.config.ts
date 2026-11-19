import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL?.trim();

export default defineConfig({
  out: './drizzle/postgres',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  ...(url ? { dbCredentials: { url } } : {}),
});
