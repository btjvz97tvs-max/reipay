// ランダムなID・コードの作成。

import {
  calculateCheckDigit,
  PAYMENT_CODE_LENGTH,
  PAYMENT_CODE_PREFIX,
} from '../../public/js/shared/payment-code.js';
import { createRandomString } from './bytes.js';

// 見間違えやすい文字（0/o、1/l/i）を除いている。
const HANDLE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const HANDLE_LENGTH = 8;
const DIGITS = '0123456789';

export const HANDLE_PATTERN = new RegExp(`^[${HANDLE_ALPHABET}]{${HANDLE_LENGTH}}$`);

export function generateHandle() {
  return createRandomString(HANDLE_ALPHABET, HANDLE_LENGTH);
}

export function generatePaymentCode() {
  const randomLength = PAYMENT_CODE_LENGTH - PAYMENT_CODE_PREFIX.length - 1;
  const body = PAYMENT_CODE_PREFIX + createRandomString(DIGITS, randomLength);
  return body + calculateCheckDigit(body);
}
