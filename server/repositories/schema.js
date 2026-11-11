// データベースの表がまだなければ作る。
// これがあるので、Cloudflare の画面で SQL を実行する作業はいらない。

import schemaSql from '../../migrations/0001_init.sql';
import { splitSqlStatements } from '../lib/sql.js';

// 同じ Worker の中では、一度確かめたら次からは確かめない。
let isSchemaReady = false;

export async function ensureSchema(db) {
  if (isSchemaReady) {
    return;
  }

  const lastTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'")
    .first();
  if (!lastTable) {
    const statements = splitSqlStatements(schemaSql).map((statement) => db.prepare(statement));
    await db.batch(statements);
  }
  isSchemaReady = true;
}
