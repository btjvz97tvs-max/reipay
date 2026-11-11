// クッキーから「このブラウザは誰か」を確かめる。分からなければ 401、管理者でなければ 403 を返す。

import { readSessionToken } from '../lib/cookie.js';
import { forbiddenError, unauthorizedError } from '../lib/errors.js';
import { findUserIdBySessionToken } from '../repositories/sessions.js';
import { findUserById } from '../repositories/users.js';

export async function authenticate(request, env) {
  const sessionToken = readSessionToken(request);
  if (!sessionToken) {
    throw unauthorizedError();
  }

  const userId = await findUserIdBySessionToken(env.DB, sessionToken);
  if (userId === null) {
    throw unauthorizedError();
  }

  const user = await findUserById(env.DB, userId);
  if (!user) {
    throw unauthorizedError();
  }
  return { user, sessionToken };
}

export async function authenticateAdmin(request, env) {
  const context = await authenticate(request, env);
  if (!context.user.isAdmin) {
    throw forbiddenError();
  }
  return context;
}
