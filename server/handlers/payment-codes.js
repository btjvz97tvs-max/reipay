// バーコード決済（PayPay の「支払う」と同じ流れ）。
// 1. 払う人が「支払う」画面を開くと、5分だけ使えるコードがバーコードとQRで表示される
// 2. 受け取る人がそのコードを読み取り、金額を入れて請求する
// 3. 払う人の残高から引かれる（コードは1回しか使えない）

import { CURRENCY_UNIT, PAYMENT_CODE_TTL_MINUTES } from '../config.js';
import { sha256Hex } from '../lib/bytes.js';
import { generatePaymentCode } from '../lib/codes.js';
import { isCheckViolation, isUniqueViolation } from '../lib/db-errors.js';
import { HttpError, jsonResponse, readJson } from '../lib/http.js';
import { toPublicUser, toUserSummary } from '../lib/presenters.js';
import { parseAmount, parseMemo, parsePaymentCode } from '../lib/validate.js';
import { hasPasskey } from '../repositories/passkeys.js';
import {
  deleteExpiredPaymentCodes,
  findPaymentCode,
  replacePaymentCode,
} from '../repositories/payment-codes.js';
import {
  buildInsertTransactionStatement,
  findTransferByRequestId,
} from '../repositories/transactions.js';
import {
  buildAddBalanceStatement,
  buildSubtractBalanceStatement,
  findUserById,
} from '../repositories/users.js';

const MILLISECONDS_PER_MINUTE = 60 * 1000;

function isExpired(paymentCode) {
  return paymentCode.expiresAt <= new Date().toISOString();
}

// コードから作る取引ID。UNIQUE なので、同じコードで2回目の支払いは必ず失敗する。
function toPaymentRequestId(codeHash) {
  return `pc:${codeHash}`;
}

function unusableCodeError() {
  return new HttpError(404, 'payment_code_unusable', 'このコードは使えません（期限切れか、まちがったコードです）');
}

function usedCodeError() {
  return new HttpError(409, 'payment_code_used', 'このコードはすでに使われています');
}

// 受け取る人の側で、読み取ったコードが今使えるかを確かめる。
async function findUsablePaymentCode(env, code, receiver) {
  const codeHash = await sha256Hex(code);
  const paymentCode = await findPaymentCode(env.DB, codeHash);
  if (!paymentCode || isExpired(paymentCode)) {
    throw unusableCodeError();
  }
  if (paymentCode.payerUserId === receiver.id) {
    throw new HttpError(400, 'self_payment', '自分のコードは読み取れません');
  }
  if (await findTransferByRequestId(env.DB, toPaymentRequestId(codeHash))) {
    throw usedCodeError();
  }

  const payer = await findUserById(env.DB, paymentCode.payerUserId);
  return { codeHash, payer };
}

export async function createPaymentCode(request, env, context) {
  const code = generatePaymentCode();
  const expiresAt = new Date(Date.now() + PAYMENT_CODE_TTL_MINUTES * MILLISECONDS_PER_MINUTE);

  await deleteExpiredPaymentCodes(env.DB);
  await replacePaymentCode(env.DB, {
    payerUserId: context.user.id,
    codeHash: await sha256Hex(code),
    expiresAt: expiresAt.toISOString(),
  });
  return jsonResponse({ code, expiresAt: expiresAt.toISOString() }, { status: 201 });
}

// 払う人の画面が数秒ごとに呼び、支払いが済んだかを確かめる。
export async function getPaymentCodeStatus(request, env, context) {
  const { user } = context;
  const code = parsePaymentCode((await readJson(request)).code);
  const codeHash = await sha256Hex(code);

  const payment = await findTransferByRequestId(env.DB, toPaymentRequestId(codeHash));
  if (payment) {
    const updatedUser = await findUserById(env.DB, user.id);
    const userHasPasskey = await hasPasskey(env.DB, user.id);
    return jsonResponse({
      status: 'paid',
      payment,
      user: toPublicUser(updatedUser, { hasPasskey: userHasPasskey }),
    });
  }

  const paymentCode = await findPaymentCode(env.DB, codeHash);
  if (!paymentCode || paymentCode.payerUserId !== user.id || isExpired(paymentCode)) {
    return jsonResponse({ status: 'expired' });
  }
  return jsonResponse({ status: 'waiting', expiresAt: paymentCode.expiresAt });
}

export async function lookupPaymentCode(request, env, context) {
  const code = parsePaymentCode((await readJson(request)).code);
  const { payer } = await findUsablePaymentCode(env, code, context.user);
  return jsonResponse({ payer: toUserSummary(payer) });
}

export async function chargePaymentCode(request, env, context) {
  const receiver = context.user;
  const body = await readJson(request);
  const code = parsePaymentCode(body.code);
  const amount = parseAmount(body.amount);
  const memo = parseMemo(body.memo);

  const { codeHash, payer } = await findUsablePaymentCode(env, code, receiver);

  try {
    await env.DB.batch([
      buildInsertTransactionStatement(env.DB, {
        requestId: toPaymentRequestId(codeHash),
        kind: 'transfer',
        fromUserId: payer.id,
        toUserId: receiver.id,
        amount,
        memo,
      }),
      buildSubtractBalanceStatement(env.DB, payer.id, amount),
      buildAddBalanceStatement(env.DB, receiver.id, amount),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, 'request_id')) {
      throw usedCodeError();
    }
    if (isCheckViolation(error)) {
      throw new HttpError(
        400,
        'payer_insufficient_balance',
        `相手の残高が足りません（${amount}${CURRENCY_UNIT}）`,
      );
    }
    throw error;
  }

  const updatedReceiver = await findUserById(env.DB, receiver.id);
  const userHasPasskey = await hasPasskey(env.DB, receiver.id);
  return jsonResponse(
    {
      user: toPublicUser(updatedReceiver, { hasPasskey: userHasPasskey }),
      payment: { amount, memo, payer: toUserSummary(payer) },
    },
    { status: 201 },
  );
}
