const USER_COLUMNS = 'id, handle, display_name, is_admin, balance, created_at';

function toUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    balance: row.balance,
    createdAt: row.created_at,
  };
}

export async function findUserById(db, userId) {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(userId)
    .first();
  return toUser(row);
}

export async function findUserByHandle(db, handle) {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE handle = ?`)
    .bind(handle)
    .first();
  return toUser(row);
}

export async function hasAnyUser(db) {
  const row = await db.prepare('SELECT 1 AS found FROM users LIMIT 1').first();
  return row !== null;
}

export async function listUsers(db) {
  const { results } = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY display_name, handle`)
    .all();
  return results.map(toUser);
}

// アカウント作成は「はじめのプレゼント」の記録と一緒に batch で実行するため、文だけを返す。
export function buildInsertUserStatement(db, { handle, displayName, isAdmin, balance }) {
  return db
    .prepare('INSERT INTO users (handle, display_name, is_admin, balance) VALUES (?, ?, ?, ?)')
    .bind(handle, displayName, isAdmin ? 1 : 0, balance);
}

// 残高を変える文は batch でまとめて実行するため、ここでは実行せずに文だけを返す。
export function buildAddBalanceStatement(db, userId, amount) {
  return db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').bind(amount, userId);
}

// 残高が足りないと CHECK (balance >= 0) に違反し、batch 全体が取り消される。
export function buildSubtractBalanceStatement(db, userId, amount) {
  return db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').bind(amount, userId);
}
