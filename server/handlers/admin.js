// 管理者だけができる操作（れいを配る、招待コードを作る、みんなの残高を見る）。

import { generateInviteCode } from '../lib/codes.js';
import { isUniqueViolation } from '../lib/db-errors.js';
import { duplicateRequestError, userNotFoundError } from '../lib/errors.js';
import { jsonResponse, readJson } from '../lib/http.js';
import { toAdminUserView } from '../lib/presenters.js';
import { parseAmount, parseHandle, parseMemo, parseRequestId } from '../lib/validate.js';
import { insertInviteCode, listInviteCodes } from '../repositories/invite-codes.js';
import { buildInsertTransactionStatement } from '../repositories/transactions.js';
import { buildAddBalanceStatement, findUserByHandle, listUsers } from '../repositories/users.js';

const INVITE_CODE_RETRY_LIMIT = 3;

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

export async function listAllInviteCodes(request, env) {
  const inviteCodes = await listInviteCodes(env.DB);
  return jsonResponse({ inviteCodes });
}

export async function createInviteCode(request, env) {
  for (let attempt = 1; attempt <= INVITE_CODE_RETRY_LIMIT; attempt += 1) {
    const code = generateInviteCode();
    try {
      await insertInviteCode(env.DB, code);
      return jsonResponse({ inviteCode: { code, usedBy: null } }, { status: 201 });
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === INVITE_CODE_RETRY_LIMIT) {
        throw error;
      }
    }
  }
  throw new Error('unreachable');
}
