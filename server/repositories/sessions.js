// このブラウザが誰なのか（セッション）の保存。
// ブラウザにはランダムなトークンをクッキーで渡し、DBにはそのハッシュだけを保存する。

import { SESSION_TTL_DAYS } from '../config.js';
import { createRandomToken, sha256Hex } from '../lib/bytes.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function createExpiresAt() {
  return new Date(Date.now() + SESSION_TTL_DAYS * MILLISECONDS_PER_DAY).toISOString();
}

export async function insertSession(db, userId) {
  const token = createRandomToken();
  const tokenHash = await sha256Hex(token);

  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, createExpiresAt())
    .run();
  return token;
}

export async function findUserIdBySessionToken(db, token) {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, new Date().toISOString())
    .first();
  return row ? row.user_id : null;
}

export async function extendSession(db, token) {
  const tokenHash = await sha256Hex(token);
  await db
    .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
    .bind(createExpiresAt(), tokenHash)
    .run();
}

export async function deleteExpiredSessions(db) {
  await db
    .prepare('DELETE FROM sessions WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run();
}
