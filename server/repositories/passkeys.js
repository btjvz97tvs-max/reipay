function toPasskey(row) {
  if (!row) {
    return null;
  }
  return {
    credentialId: row.credential_id,
    userId: row.user_id,
    publicKeyJwk: JSON.parse(row.public_key_jwk),
    algorithm: row.algorithm,
    signCount: row.sign_count,
  };
}

export async function findPasskeyByCredentialId(db, credentialId) {
  const row = await db
    .prepare(
      `SELECT credential_id, user_id, public_key_jwk, algorithm, sign_count
       FROM passkeys WHERE credential_id = ?`,
    )
    .bind(credentialId)
    .first();
  return toPasskey(row);
}

export async function listCredentialIdsForUser(db, userId) {
  const { results } = await db
    .prepare('SELECT credential_id FROM passkeys WHERE user_id = ?')
    .bind(userId)
    .all();
  return results.map((row) => row.credential_id);
}

export async function hasPasskey(db, userId) {
  const row = await db
    .prepare('SELECT 1 AS found FROM passkeys WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first();
  return row !== null;
}

export async function insertPasskey(
  db,
  { credentialId, userId, publicKeyJwk, algorithm, signCount },
) {
  await db
    .prepare(
      `INSERT INTO passkeys (credential_id, user_id, public_key_jwk, algorithm, sign_count)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(credentialId, userId, JSON.stringify(publicKeyJwk), algorithm, signCount)
    .run();
}

export async function updatePasskeyUsage(db, credentialId, signCount) {
  await db
    .prepare('UPDATE passkeys SET sign_count = ?, last_used_at = ? WHERE credential_id = ?')
    .bind(signCount, new Date().toISOString(), credentialId)
    .run();
}
