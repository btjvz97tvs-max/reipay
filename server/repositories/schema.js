// データベースの表がまだなければ作る。
// これがあるので、Cloudflare の画面で SQL を実行する作業はいらない。
// SQL はすべて IF NOT EXISTS 付きなので、何度実行しても今ある表やデータは変わらない。

import schemaSql from '../../migrations/0001_init.sql';
import { splitSqlStatements } from '../lib/sql.js';

// 同じ Worker の中では、一度実行したら次からは実行しない。
let isSchemaReady = false;

export async function ensureSchema(db) {
  if (isSchemaReady) {
    return;
  }
  const statements = splitSqlStatements(schemaSql).map((statement) => db.prepare(statement));
  await db.batch(statements);
  isSchemaReady = true;
}
