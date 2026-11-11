function toCounterparty(handle, displayName) {
  if (handle === null) {
    return null;
  }
  return { handle, displayName };
}

// kind: 'grant'（はじめのプレゼント）/ 'issue'（管理者が配る）/ 'collect'（管理者が回収）/ 'transfer'
// 回収には受け取る人がいないので、相手（counterparty）は null になる。
function toTransactionForUser(row, userId) {
  const isIncoming = row.to_user_id === userId;
  const counterparty = isIncoming
    ? toCounterparty(row.from_handle, row.from_display_name)
    : toCounterparty(row.to_handle, row.to_display_name);

  return {
    id: row.id,
    kind: row.kind,
    direction: isIncoming ? 'in' : 'out',
    amount: row.amount,
    memo: row.memo,
    counterparty,
    createdAt: row.created_at,
  };
}

// 残高の更新と同じ batch で実行するため、ここでは実行せずに文だけを返す。
export function buildInsertTransactionStatement(db, transaction) {
  const { requestId, kind, fromUserId, toUserId, amount, memo } = transaction;
  return db
    .prepare(
      `INSERT INTO transactions (request_id, kind, from_user_id, to_user_id, amount, memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(requestId, kind, fromUserId, toUserId, amount, memo);
}

// アカウント作成と同じ batch で使う。まだ id が分からないので handle から探す。
export function buildInsertGrantStatement(db, { handle, amount, memo }) {
  return db
    .prepare(
      `INSERT INTO transactions (request_id, kind, from_user_id, to_user_id, amount, memo)
       SELECT ?, 'grant', NULL, id, ?, ? FROM users WHERE handle = ?`,
    )
    .bind(`grant:${handle}`, amount, memo, handle);
}

export async function listTransactionsForUser(db, userId, limit) {
  const { results } = await db
    .prepare(
      `SELECT
         t.id,
         t.kind,
         t.amount,
         t.memo,
         t.created_at,
         t.to_user_id,
         from_user.handle AS from_handle,
         from_user.display_name AS from_display_name,
         to_user.handle AS to_handle,
         to_user.display_name AS to_display_name
       FROM transactions AS t
       LEFT JOIN users AS from_user ON from_user.id = t.from_user_id
       LEFT JOIN users AS to_user ON to_user.id = t.to_user_id
       WHERE t.from_user_id = ?1 OR t.to_user_id = ?1
       ORDER BY t.id DESC
       LIMIT ?2`,
    )
    .bind(userId, limit)
    .all();
  return results.map((row) => toTransactionForUser(row, userId));
}

export async function findTransferByRequestId(db, requestId) {
  const row = await db
    .prepare(
      `SELECT t.amount, t.memo, to_user.handle AS to_handle, to_user.display_name AS to_display_name
       FROM transactions AS t
       JOIN users AS to_user ON to_user.id = t.to_user_id
       WHERE t.request_id = ?`,
    )
    .bind(requestId)
    .first();
  if (!row) {
    return null;
  }
  return {
    amount: row.amount,
    memo: row.memo,
    receiver: { handle: row.to_handle, displayName: row.to_display_name },
  };
}
