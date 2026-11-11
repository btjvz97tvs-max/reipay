// アカウントの作成（はじめて開いたとき）と、自分の情報の取得。ログインも招待コードもない。

import { WELCOME_BONUS } from '../config.js';
import { generateHandle } from '../lib/codes.js';
import { buildSessionCookie } from '../lib/cookie.js';
import { isUniqueViolation } from '../lib/db-errors.js';
import { jsonResponse, readJson } from '../lib/http.js';
import { toPublicUser } from '../lib/presenters.js';
import { parseDisplayName } from '../lib/validate.js';
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

async function insertUserWithWelcomeBonus(env, { displayName, isAdmin }) {
  for (let attempt = 1; attempt <= HANDLE_RETRY_LIMIT; attempt += 1) {
    const handle = generateHandle();
    try {
      await env.DB.batch([
        buildInsertUserStatement(env.DB, {
          handle,
          displayName,
          isAdmin,
          balance: WELCOME_BONUS,
        }),
        buildInsertGrantStatement(env.DB, { handle, amount: WELCOME_BONUS, memo: WELCOME_MEMO }),
      ]);
      return handle;
    } catch (error) {
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
  // いちばん最初に始めた人が管理者になる。
  const isAdmin = !(await hasAnyUser(env.DB));

  const handle = await insertUserWithWelcomeBonus(env, { displayName, isAdmin });
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
