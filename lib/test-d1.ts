import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

class TestStatement {
  constructor(
    private readonly database: DatabaseSync,
    readonly sql: string,
    readonly parameters: unknown[] = [],
  ) {}

  bind(...parameters: unknown[]) {
    return new TestStatement(this.database, this.sql, parameters);
  }

  async first<T>() {
    return (
      (this.database.prepare(this.sql).get(...(this.parameters as never[])) as T | undefined) ?? null
    );
  }

  async all<T>() {
    return {
      results: this.database.prepare(this.sql).all(...(this.parameters as never[])) as T[],
    };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...(this.parameters as never[]));
    return { success: true, meta: { changes: result.changes } };
  }
}

/** A D1-shaped in-memory database for repository and route integration tests. */
export class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    const migration = readFileSync(
      new URL('../drizzle/0000_cuddly_cassandra_nova.sql', import.meta.url),
      'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) this.sqlite.exec(statement);
    }
  }

  prepare(sql: string) {
    return new TestStatement(this.sqlite, sql);
  }

  async batch(statements: TestStatement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map((statement) => statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.sqlite.close();
  }
}
