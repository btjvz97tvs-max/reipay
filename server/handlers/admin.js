// 管理者だけができる操作（れいを配る、みんなの残高を見る）。

import { isUniqueViolation } from '../lib/db-errors.js';
import { duplicateRequestError, userNotFoundError } from '../lib/errors.js';
import { jsonResponse, readJson } from '../lib/http.js';
import { toAdminUserView } from '../lib/presenters.js';
import { parseAmount, parseHandle, parseMemo, parseRequestId } from '../lib/validate.js';
import { buildInsertTransactionStatement } from '../repositories/transactions.js';
import { buildAddBalanceStatement, findUserByHandle, listUsers } from '../repositories/users.js';

export async function listAllUsers(request, env) {
  const users = await listUsers(env.DB);
  return jsonResponse({ users: users.map(toAdminUserView) });
}

export async function createIssue(request, env) {
  const body = await readJson(request);
  const requestId = parseRequestId(body.requestId);
  const toHandle = parseHandle(body.toHandle);
  const amount = parseAmount(body.amount);
  const memo = parseMemo(body.memo);

  const recipient = await findUserByHandle(env.DB, toHandle);
  if (!recipient) {
    throw userNotFoundError();
  }

  try {
    await env.DB.batch([
      buildInsertTransactionStatement(env.DB, {
        requestId,
        kind: 'issue',
        fromUserId: null,
        toUserId: recipient.id,
        amount,
        memo,
      }),
      buildAddBalanceStatement(env.DB, recipient.id, amount),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, 'request_id')) {
      throw duplicateRequestError();
    }
    throw error;
  }

  const users = await listUsers(env.DB);
  return jsonResponse({ users: users.map(toAdminUserView) }, { status: 201 });
}
