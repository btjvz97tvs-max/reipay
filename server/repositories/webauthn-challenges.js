// パスキーの登録・復元で使うチャレンジ。1回使ったら消すので、同じ応答を使い回せない。

import { WEBAUTHN_CHALLENGE_TTL_MINUTES } from '../config.js';

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export async function insertChallenge(db, { challenge, purpose, userId }) {
  const expiresAt = new Date(
    Date.now() + WEBAUTHN_CHALLENGE_TTL_MINUTES * MILLISECONDS_PER_MINUTE,
  ).toISOString();
  await db
    .prepare(
      `INSERT INTO webauthn_challenges (challenge, purpose, user_id, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(challenge, purpose, userId, expiresAt)
    .run();
}

// 見つかったチャレンジは削除し、期限内なら { userId } を返す。なければ null。
export async function consumeChallenge(db, { challenge, purpose }) {
  const row = await db
    .prepare(
      `DELETE FROM webauthn_challenges WHERE challenge = ? AND purpose = ?
       RETURNING user_id, expires_at`,
    )
    .bind(challenge, purpose)
    .first();
  if (!row || row.expires_at <= new Date().toISOString()) {
    return null;
  }
  return { userId: row.user_id };
}

export async function deleteExpiredChallenges(db) {
  await db
    .prepare('DELETE FROM webauthn_challenges WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run();
}
