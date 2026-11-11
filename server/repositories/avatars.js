// アイコン画像の保存と読み出し。画像は Base64 の文字列で保存する。

export async function saveAvatar(db, userId, { contentType, imageBase64 }) {
  const updatedAt = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO avatars (user_id, content_type, image_base64, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           content_type = excluded.content_type,
           image_base64 = excluded.image_base64,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, contentType, imageBase64, updatedAt),
    db.prepare('UPDATE users SET avatar_updated_at = ? WHERE id = ?').bind(updatedAt, userId),
  ]);
}

export async function deleteAvatar(db, userId) {
  await db.batch([
    db.prepare('DELETE FROM avatars WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE users SET avatar_updated_at = NULL WHERE id = ?').bind(userId),
  ]);
}

export async function findAvatarByHandle(db, handle) {
  const row = await db
    .prepare(
      `SELECT avatars.content_type, avatars.image_base64
       FROM avatars
       JOIN users ON users.id = avatars.user_id
       WHERE users.handle = ?`,
    )
    .bind(handle)
    .first();
  if (!row) {
    return null;
  }
  return { contentType: row.content_type, imageBase64: row.image_base64 };
}
