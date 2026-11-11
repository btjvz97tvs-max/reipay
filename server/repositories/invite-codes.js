// 招待コード。使われたかどうかは users.invite_code と結びつけて判断する。

function toInviteCode(row) {
  if (!row) {
    return null;
  }
  return {
    code: row.code,
    createdAt: row.created_at,
    usedBy:
      row.used_by_handle === null
        ? null
        : { handle: row.used_by_handle, displayName: row.used_by_display_name },
  };
}

const INVITE_CODE_QUERY = `
  SELECT
    invite_codes.code,
    invite_codes.created_at,
    users.handle AS used_by_handle,
    users.display_name AS used_by_display_name
  FROM invite_codes
  LEFT JOIN users ON users.invite_code = invite_codes.code`;

export async function findInviteCode(db, code) {
  const row = await db
    .prepare(`${INVITE_CODE_QUERY} WHERE invite_codes.code = ?`)
    .bind(code)
    .first();
  return toInviteCode(row);
}

export async function listInviteCodes(db) {
  const { results } = await db
    .prepare(`${INVITE_CODE_QUERY} ORDER BY invite_codes.created_at DESC`)
    .all();
  return results.map(toInviteCode);
}

export async function insertInviteCode(db, code) {
  await db.prepare('INSERT INTO invite_codes (code) VALUES (?)').bind(code).run();
}
