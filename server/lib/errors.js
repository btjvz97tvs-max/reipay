// 複数の場所で使うエラー。メッセージをここにまとめて、言い回しを統一する。

import { HttpError } from './http.js';

export function unauthorizedError() {
  return new HttpError(401, 'unauthorized', 'このブラウザに、れいpayのデータが見つかりません');
}

export function forbiddenError() {
  return new HttpError(403, 'forbidden', 'この操作は管理者だけができます');
}

export function userNotFoundError() {
  return new HttpError(404, 'user_not_found', '相手のユーザーが見つかりません');
}

export function selfTransferError() {
  return new HttpError(400, 'self_transfer', '自分には送れません');
}

export function insufficientBalanceError() {
  return new HttpError(400, 'insufficient_balance', '残高が足りません');
}

export function duplicateRequestError() {
  return new HttpError(409, 'duplicate_request', 'この操作はすでに処理されています');
}
