// 読み取った文字列が「支払いコード」か「受け取りQR」かを見分ける。

import { isValidPaymentCode, normalizePaymentCode } from '../shared/payment-code.js';

const RECEIVE_PATH_PATTERN = /^#\/send\/([23456789a-hjkmnp-z]{8})$/;

export function buildReceiveUrl(handle) {
  return `${window.location.origin}/#/send/${handle}`;
}

// 戻り値: { type: 'payment', code } / { type: 'receive', handle } / null（れいpayのコードではない）
export function parseScannedText(text) {
  if (isValidPaymentCode(text)) {
    return { type: 'payment', code: normalizePaymentCode(text) };
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const match = RECEIVE_PATH_PATTERN.exec(url.hash);
  if (url.origin !== window.location.origin || !match) {
    return null;
  }
  return { type: 'receive', handle: match[1] };
}
