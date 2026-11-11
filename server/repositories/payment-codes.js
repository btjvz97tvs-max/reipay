// 「支払う」画面のコード。DBにはコードそのものではなくハッシュを保存する。
// 1人につき有効なコードは1つだけで、新しいコードを出すと前のコードは使えなくなる。

export async function replacePaymentCode(db, { payerUserId, codeHash, expiresAt }) {
  await db.batch([
    db.prepare('DELETE FROM payment_codes WHERE payer_user_id = ?').bind(payerUserId),
    db
      .prepare('INSERT INTO payment_codes (code_hash, payer_user_id, expires_at) VALUES (?, ?, ?)')
      .bind(codeHash, payerUserId, expiresAt),
  ]);
}

export async function findPaymentCode(db, codeHash) {
  const row = await db
    .prepare('SELECT payer_user_id, expires_at FROM payment_codes WHERE code_hash = ?')
    .bind(codeHash)
    .first();
  if (!row) {
    return null;
  }
  return { payerUserId: row.payer_user_id, expiresAt: row.expires_at };
}

export async function deleteExpiredPaymentCodes(db) {
  await db
    .prepare('DELETE FROM payment_codes WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run();
}
