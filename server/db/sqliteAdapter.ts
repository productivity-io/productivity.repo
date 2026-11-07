import { DatabaseSync, StatementSync } from 'node:sqlite';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core/db';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core/dialect';
import { BetterSQLiteSession } from 'drizzle-orm/better-sqlite3/session';
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  type ExtractTablesWithRelations,
} from 'drizzle-orm/relations';

type SqlParam = null | number | bigint | string | Uint8Array;

function normalizeParam(value: unknown): SqlParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
    return value;
  }
  return String(value);
}

function toPlainObject<T extends Record<string, unknown>>(row: T): T {
  return Object.assign({}, row);
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

class StatementAdapter {
  private stmt: StatementSync;

  constructor(stmt: StatementSync) {
    this.stmt = stmt;
  }

  run(...params: unknown[]): RunResult {
    const bound = params.map(normalizeParam);
    const res = this.stmt.run(...bound);
    return {
      changes: Number(res.changes),
      lastInsertRowid: Number(res.lastInsertRowid),
    };
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const bound = params.map(normalizeParam);
    this.stmt.setReturnArrays(false);
    const rows = this.stmt.all(...bound) as Record<string, unknown>[];
    return rows.map(toPlainObject);
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const bound = params.map(normalizeParam);
    this.stmt.setReturnArrays(false);
    const row = this.stmt.get(...bound) as Record<string, unknown> | undefined;
    return row ? toPlainObject(row) : undefined;
  }

  raw() {
    const stmt = this.stmt;
    return {
      all(...params: unknown[]): unknown[][] {
        const bound = params.map(normalizeParam);
        stmt.setReturnArrays(true);
        try {
          return stmt.all(...bound) as unknown as unknown[][];
        } finally {
          stmt.setReturnArrays(false);
        }
      },
      get(...params: unknown[]): unknown[] | undefined {
        const bound = params.map(normalizeParam);
        stmt.setReturnArrays(true);
        try {
          return stmt.get(...bound) as unknown as unknown[] | undefined;
        } finally {
          stmt.setReturnArrays(false);
        }
      },
    };
  }
}

export class SqliteClientAdapter {
  private nativeDb: DatabaseSync;

  constructor(filePath: string) {
    this.nativeDb = new DatabaseSync(filePath);
  }

  pragma(statement: string): void {
    this.nativeDb.exec(`PRAGMA ${statement}`);
  }

  exec(sql: string): void {
    this.nativeDb.exec(sql);
  }

  prepare(sql: string): StatementAdapter {
    return new StatementAdapter(this.nativeDb.prepare(sql));
  }

  transaction<T extends (...args: any[]) => any>(fn: T) {
    const createRunner =
      (mode: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE') =>
      (...args: Parameters<T>): ReturnType<T> => {
        this.nativeDb.exec(`BEGIN ${mode}`);
        try {
          const result = fn(...args);
          this.nativeDb.exec('COMMIT');
          return result;
        } catch (err) {
          try {
            this.nativeDb.exec('ROLLBACK');
          } catch {
            // ignore rollback error if transaction already closed
          }
          throw err;
        }
      };

    return Object.assign(createRunner('DEFERRED'), {
      deferred: createRunner('DEFERRED'),
      immediate: createRunner('IMMEDIATE'),
      exclusive: createRunner('EXCLUSIVE'),
    });
  }

  close(): void {
    this.nativeDb.close();
  }
}

export function createDrizzleSqlite<TSchema extends Record<string, unknown>>(
  client: SqliteClientAdapter,
  schema: TSchema
): BaseSQLiteDatabase<'sync', RunResult, TSchema, ExtractTablesWithRelations<TSchema>> {
  const dialect = new SQLiteSyncDialect();
  const tablesConfig = extractTablesRelationalConfig(schema, createTableRelationsHelpers);
  const relationalSchema = {
    fullSchema: schema,
    schema: tablesConfig.tables,
    tableNamesMap: tablesConfig.tableNamesMap,
  };

  const session = new BetterSQLiteSession(
    client as any,
    dialect,
    relationalSchema as any,
    {}
  );

  return new BaseSQLiteDatabase(
    'sync',
    dialect,
    session as any,
    relationalSchema as any
  ) as BaseSQLiteDatabase<'sync', RunResult, TSchema, ExtractTablesWithRelations<TSchema>>;
}
