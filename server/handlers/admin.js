// 管理者だけができる操作（れいを配る、れいを回収する、みんなの残高を見る）。

import { CURRENCY_UNIT } from '../config.js';
import { isCheckViolation, isUniqueViolation } from '../lib/db-errors.js';
import { duplicateRequestError, userNotFoundError } from '../lib/errors.js';
import { HttpError, jsonResponse, readJson } from '../lib/http.js';
import { toAdminUserView } from '../lib/presenters.js';
import { parseAmount, parseHandle, parseMemo, parseRequestId } from '../lib/validate.js';
import { buildInsertTransactionStatement } from '../repositories/transactions.js';
import {
  buildAddBalanceStatement,
  buildSubtractBalanceStatement,
  findUserByHandle,
  listUsers,
} from '../repositories/users.js';

function collectTooMuchError(user) {
  return new HttpError(
    400,
    'collect_too_much',
    `${user.displayName}さんの残高は${user.balance}${CURRENCY_UNIT}です。それより多くは回収できません`,
  );
}

async function respondWithUsers(env, status) {
  const users = await listUsers(env.DB);
  return jsonResponse({ users: users.map(toAdminUserView) }, { status });
}

export async function listAllUsers(request, env) {
  return respondWithUsers(env, 200);
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

  return respondWithUsers(env, 201);
}

// 回収は「配る」の逆。相手の残高から引いて、そのれいは消える（管理者の残高には入らない）。
export async function createCollection(request, env) {
  const body = await readJson(request);
  const requestId = parseRequestId(body.requestId);
  const fromHandle = parseHandle(body.fromHandle);
  const amount = parseAmount(body.amount);
  const memo = parseMemo(body.memo);

  const target = await findUserByHandle(env.DB, fromHandle);
  if (!target) {
    throw userNotFoundError();
  }
  if (target.balance < amount) {
    throw collectTooMuchError(target);
  }

  try {
    await env.DB.batch([
      buildInsertTransactionStatement(env.DB, {
        requestId,
        kind: 'collect',
        fromUserId: target.id,
        toUserId: null,
        amount,
        memo,
      }),
      buildSubtractBalanceStatement(env.DB, target.id, amount),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, 'request_id')) {
      throw duplicateRequestError();
    }
    if (isCheckViolation(error)) {
      throw collectTooMuchError(await findUserByHandle(env.DB, fromHandle));
    }
    throw error;
  }

  return respondWithUsers(env, 201);
}
