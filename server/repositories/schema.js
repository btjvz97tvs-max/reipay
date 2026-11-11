// データベースの表の作成と変更（マイグレーション）を、アプリが動いたときに自動で行う。
// これがあるので、Cloudflare の画面で SQL を実行する作業はいらない。
// どこまで実行したかは schema_migrations 表に記録し、同じものを2回実行しない。
// 新しく表を変えるときは migrations/ に次の番号のファイルを足し、MIGRATIONS に追加する。

import initSql from '../../migrations/0001_init.sql';
import collectSql from '../../migrations/0002_collect.sql';
import { isUniqueViolation } from '../lib/db-errors.js';
import { splitSqlStatements } from '../lib/sql.js';

const MIGRATIONS = [
  { version: '0001_init', sql: initSql },
  { version: '0002_collect', sql: collectSql },
];

// 同じ Worker の中では、一度確かめたら次からは確かめない。
let isSchemaReady = false;

async function listAppliedVersions(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       )`,
    )
    .run();
  const { results } = await db.prepare('SELECT version FROM schema_migrations').all();
  return new Set(results.map((row) => row.version));
}

// 変更の SQL と「実行した記録」を1つの batch にまとめる。
// 別の Worker が同時に同じ変更を終えていた場合は、記録が重複して batch ごと取り消される。
async function applyMigration(db, migration) {
  const statements = splitSqlStatements(migration.sql).map((statement) => db.prepare(statement));
  statements.push(
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').bind(migration.version),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (!isUniqueViolation(error, 'schema_migrations.version')) {
      throw error;
    }
  }
}

export async function ensureSchema(db) {
  if (isSchemaReady) {
    return;
  }

  const appliedVersions = await listAppliedVersions(db);
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      await applyMigration(db, migration);
    }
  }
  isSchemaReady = true;
}
