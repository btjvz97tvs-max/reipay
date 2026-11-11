// アカウントの作成（はじめて開いたとき）と、自分の情報の取得。ログインはない。

import { WELCOME_BONUS } from '../config.js';
import { timingSafeEqualText } from '../lib/bytes.js';
import { generateHandle } from '../lib/codes.js';
import { buildSessionCookie } from '../lib/cookie.js';
import { isUniqueViolation } from '../lib/db-errors.js';
import { HttpError, jsonResponse, readJson } from '../lib/http.js';
import { toPublicUser } from '../lib/presenters.js';
import { parseDisplayName, parseInviteCode } from '../lib/validate.js';
import { findInviteCode } from '../repositories/invite-codes.js';
import { hasPasskey } from '../repositories/passkeys.js';
import { deleteExpiredSessions, extendSession, insertSession } from '../repositories/sessions.js';
import { buildInsertGrantStatement } from '../repositories/transactions.js';
import {
  buildInsertUserStatement,
  findUserByHandle,
  hasAnyUser,
} from '../repositories/users.js';

const HANDLE_RETRY_LIMIT = 3;
const WELCOME_MEMO = 'はじめのプレゼント';

function inviteCodeUsedError() {
  return new HttpError(
    409,
    'invite_code_used',
    'この招待コードはすでに使われています。前に使っていた人は「Face IDで復元」から戻せます',
  );
}

// 管理者のアカウントになるのは、次のどちらかのとき。
// 1. まだ誰も始めていない（最初に始めた人が管理者になるので、設定の登録はいらない）
// 2. 招待コードの欄に、Cloudflare に登録した ADMIN_CODE と同じ値が入力された（任意の設定）
async function isAdminInvitation(env, rawCode) {
  if (!(await hasAnyUser(env.DB))) {
    return true;
  }
  // 登録時に前後へ空白や改行が入っても一致するよう、両端の空白を取り除いて比べる。
  const adminCode = typeof env.ADMIN_CODE === 'string' ? env.ADMIN_CODE.trim() : '';
  return (
    adminCode.length > 0 &&
    rawCode.length > 0 &&
    (await timingSafeEqualText(rawCode, adminCode))
  );
}

async function resolveInvitation(env, rawCode) {
  if (await isAdminInvitation(env, rawCode)) {
    return { isAdmin: true, inviteCode: null };
  }

  const inviteCode = parseInviteCode(rawCode);
  const invitation = await findInviteCode(env.DB, inviteCode);
  if (!invitation) {
    throw new HttpError(403, 'invalid_invite_code', '招待コードが違います');
  }
  if (invitation.usedBy) {
    throw inviteCodeUsedError();
  }
  return { isAdmin: false, inviteCode };
}

async function insertUserWithWelcomeBonus(env, { displayName, isAdmin, inviteCode }) {
  for (let attempt = 1; attempt <= HANDLE_RETRY_LIMIT; attempt += 1) {
    const handle = generateHandle();
    try {
      await env.DB.batch([
        buildInsertUserStatement(env.DB, {
          handle,
          displayName,
          isAdmin,
          inviteCode,
          balance: WELCOME_BONUS,
        }),
        buildInsertGrantStatement(env.DB, { handle, amount: WELCOME_BONUS, memo: WELCOME_MEMO }),
      ]);
      return handle;
    } catch (error) {
      if (isUniqueViolation(error, 'users.invite_code')) {
        throw inviteCodeUsedError();
      }
      if (!isUniqueViolation(error, 'users.handle') || attempt === HANDLE_RETRY_LIMIT) {
        throw error;
      }
    }
  }
  throw new Error('unreachable');
}

export async function startAccount(request, env) {
  const body = await readJson(request);
  const displayName = parseDisplayName(body.displayName);
  const rawCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
  const { isAdmin, inviteCode } = await resolveInvitation(env, rawCode);

  const handle = await insertUserWithWelcomeBonus(env, { displayName, isAdmin, inviteCode });
  const user = await findUserByHandle(env.DB, handle);
  const token = await insertSession(env.DB, user.id);

  return jsonResponse(
    { user: toPublicUser(user, { hasPasskey: false }) },
    { status: 201, headers: { 'Set-Cookie': buildSessionCookie(token) } },
  );
}

// アプリを開くたびに呼ばれる。クッキーの期限もここで延ばす。
export async function getCurrentUser(request, env, context) {
  const { user, sessionToken } = context;
  await extendSession(env.DB, sessionToken);
  await deleteExpiredSessions(env.DB);

  const userHasPasskey = await hasPasskey(env.DB, user.id);
  return jsonResponse(
    { user: toPublicUser(user, { hasPasskey: userHasPasskey }) },
    { headers: { 'Set-Cookie': buildSessionCookie(sessionToken) } },
  );
}
