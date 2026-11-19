import { sql, type SQL } from 'drizzle-orm';

export type DatabaseRow = Record<string, unknown>;

type QueryResult = {
  rows: DatabaseRow[];
  affectedRows?: number;
  rowCount?: number | null;
};

export interface DatabaseExecutor {
  execute(query: SQL): PromiseLike<QueryResult>;
}

type Transaction = <T>(
  callback: (executor: DatabaseExecutor) => Promise<T>,
) => Promise<T>;

export class DatabaseStatement {
  constructor(
    private readonly executor: DatabaseExecutor,
    private readonly source: string,
    private readonly parameters: unknown[] = [],
  ) {}

  bind(...parameters: unknown[]): DatabaseStatement {
    return new DatabaseStatement(this.executor, this.source, parameters);
  }

  private query() {
    const parts = this.source.split('?');
    if (parts.length !== this.parameters.length + 1)
      throw new Error('SQL parameter count does not match the statement.');
    return sql.join(
      parts.flatMap((part, index) =>
        index
          ? [sql.param(this.parameters[index - 1] ?? null), sql.raw(part)]
          : [sql.raw(part)],
      ),
    );
  }

  async first<T = DatabaseRow>() {
    const { rows } = await this.executor.execute(this.query());
    return (rows[0] as T | undefined) ?? null;
  }

  async all<T = DatabaseRow>() {
    const { rows } = await this.executor.execute(this.query());
    return { results: rows as T[] };
  }

  async run(executor = this.executor) {
    const { affectedRows, rowCount } = await executor.execute(this.query());
    return { meta: { changes: affectedRows ?? rowCount ?? 0 } };
  }
}

export class AppDatabase {
  constructor(
    private readonly executor: DatabaseExecutor,
    private readonly transact?: Transaction,
  ) {}

  prepare(source: string) {
    return new DatabaseStatement(this.executor, source);
  }

  async transaction<T>(callback: (db: AppDatabase) => Promise<T>) {
    if (!this.transact) return callback(this);
    return this.transact((executor) => callback(new AppDatabase(executor)));
  }

  async batch(statements: DatabaseStatement[]) {
    const run = async (executor: DatabaseExecutor) => {
      const results = [];
      for (const statement of statements)
        results.push(await statement.run(executor));
      return results;
    };
    return this.transact ? this.transact(run) : run(this.executor);
  }
}

export function isNotNullViolation(
  error: unknown,
  table: string,
  column: string,
): boolean {
  if (!error || typeof error !== 'object') return false;
  const info = error as {
    code?: string;
    table?: string;
    column?: string;
    cause?: unknown;
  };
  return (
    (info.code === '23502' && info.table === table && info.column === column) ||
    (info.cause !== error && isNotNullViolation(info.cause, table, column))
  );
}
