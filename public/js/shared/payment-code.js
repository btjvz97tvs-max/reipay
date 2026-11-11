// 支払いコード（「支払う」画面のバーコード/QRの中身）の形式。
// 画面とサーバーの両方から使うため、ブラウザ専用の機能は使わない。
// 形式: 「8」+ ランダムな18桁 + チェック用の1桁（ルーン方式）= 20桁の数字

export const PAYMENT_CODE_LENGTH = 20;
export const PAYMENT_CODE_PREFIX = '8';

const PAYMENT_CODE_PATTERN = /^8\d{19}$/;

export function calculateCheckDigit(digits) {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 0) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }
  return String((10 - (sum % 10)) % 10);
}

export function normalizePaymentCode(text) {
  return String(text).replace(/[\s-]/g, '');
}

export function isValidPaymentCode(text) {
  const code = normalizePaymentCode(text);
  if (!PAYMENT_CODE_PATTERN.test(code)) {
    return false;
  }
  return calculateCheckDigit(code.slice(0, -1)) === code.slice(-1);
}

// 読みやすいよう4桁ごとに区切る（例: 8123 4567 8901 2345 6789）
export function formatPaymentCode(code) {
  return normalizePaymentCode(code).replace(/(\d{4})(?=\d)/g, '$1 ');
}
