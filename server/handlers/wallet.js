// 残高・履歴・送金（相手を選んで送る、受け取りQRを読み取って払う）。

import { HISTORY_LIMIT } from '../config.js';
import { isCheckViolation, isUniqueViolation } from '../lib/db-errors.js';
import {
  duplicateRequestError,
  insufficientBalanceError,
  selfTransferError,
  userNotFoundError,
} from '../lib/errors.js';
import { jsonResponse, readJson } from '../lib/http.js';
import { toPublicUser, toTransactionView, toUserSummary } from '../lib/presenters.js';
import { parseAmount, parseHandle, parseMemo, parseRequestId } from '../lib/validate.js';
import { hasPasskey } from '../repositories/passkeys.js';
import {
  buildInsertTransactionStatement,
  listTransactionsForUser,
} from '../repositories/transactions.js';
import {
  buildAddBalanceStatement,
  buildSubtractBalanceStatement,
  findUserByHandle,
  findUserById,
  listUsers,
} from '../repositories/users.js';

export async function listRecipients(request, env, context) {
  const users = await listUsers(env.DB);
  const recipients = users.filter((user) => user.id !== context.user.id).map(toUserSummary);
  return jsonResponse({ recipients });
}

export async function lookupUser(request, env) {
  const handle = parseHandle(new URL(request.url).searchParams.get('handle'));
  const user = await findUserByHandle(env.DB, handle);
  if (!user) {
    throw userNotFoundError();
  }
  return jsonResponse({ user: toUserSummary(user) });
}

export async function listMyTransactions(request, env, context) {
  const transactions = await listTransactionsForUser(env.DB, context.user.id, HISTORY_LIMIT);
  return jsonResponse({ transactions: transactions.map(toTransactionView) });
}

export async function createTransfer(request, env, context) {
  const sender = context.user;
  const body = await readJson(request);
  const requestId = parseRequestId(body.requestId);
  const toHandle = parseHandle(body.toHandle);
  const amount = parseAmount(body.amount);
  const memo = parseMemo(body.memo);

  const recipient = await findUserByHandle(env.DB, toHandle);
  if (!recipient) {
    throw userNotFoundError();
  }
  if (recipient.id === sender.id) {
    throw selfTransferError();
  }
  if (sender.balance < amount) {
    throw insufficientBalanceError();
  }

  // 3つの文は1つのトランザクションとして実行され、どれか1つでも失敗すると全部取り消される。
  // 上の残高チェックのあとに別の送金が入っても、CHECK (balance >= 0) が最終的に防ぐ。
  try {
    await env.DB.batch([
      buildInsertTransactionStatement(env.DB, {
        requestId,
        kind: 'transfer',
        fromUserId: sender.id,
        toUserId: recipient.id,
        amount,
        memo,
      }),
      buildSubtractBalanceStatement(env.DB, sender.id, amount),
      buildAddBalanceStatement(env.DB, recipient.id, amount),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, 'request_id')) {
      throw duplicateRequestError();
    }
    if (isCheckViolation(error)) {
      throw insufficientBalanceError();
    }
    throw error;
  }

  const updatedSender = await findUserById(env.DB, sender.id);
  const userHasPasskey = await hasPasskey(env.DB, sender.id);
  return jsonResponse(
    { user: toPublicUser(updatedSender, { hasPasskey: userHasPasskey }) },
    { status: 201 },
  );
}
