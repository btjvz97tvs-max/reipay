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
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_HALF_LENGTH = 4;
const DIGITS = '0123456789';

export const HANDLE_PATTERN = new RegExp(`^[${HANDLE_ALPHABET}]{${HANDLE_LENGTH}}$`);
const INVITE_CODE_PART = `[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_HALF_LENGTH}}`;
export const INVITE_CODE_PATTERN = new RegExp(`^${INVITE_CODE_PART}-${INVITE_CODE_PART}$`);

export function generateHandle() {
  return createRandomString(HANDLE_ALPHABET, HANDLE_LENGTH);
}

// 例: K7M2-P9QX
export function generateInviteCode() {
  const first = createRandomString(INVITE_CODE_ALPHABET, INVITE_CODE_HALF_LENGTH);
  const second = createRandomString(INVITE_CODE_ALPHABET, INVITE_CODE_HALF_LENGTH);
  return `${first}-${second}`;
}

// 入力の揺れ（小文字、ハイフンなし、空白）を吸収して「XXXX-XXXX」にそろえる。
export function normalizeInviteCode(text) {
  const compact = String(text).toUpperCase().replace(/[\s-]/g, '');
  if (compact.length !== INVITE_CODE_HALF_LENGTH * 2) {
    return compact;
  }
  return `${compact.slice(0, INVITE_CODE_HALF_LENGTH)}-${compact.slice(INVITE_CODE_HALF_LENGTH)}`;
}

export function generatePaymentCode() {
  const randomLength = PAYMENT_CODE_LENGTH - PAYMENT_CODE_PREFIX.length - 1;
  const body = PAYMENT_CODE_PREFIX + createRandomString(DIGITS, randomLength);
  return body + calculateCheckDigit(body);
}
