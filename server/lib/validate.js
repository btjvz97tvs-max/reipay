// 画面から送られてきた値のチェック。問題があれば 400 エラーを投げ、正しければ整えた値を返す。

import {
  isValidPaymentCode,
  normalizePaymentCode,
} from '../../public/js/shared/payment-code.js';
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  AVATAR_MAX_BYTES,
  CURRENCY_UNIT,
  DISPLAY_NAME_MAX_LENGTH,
  MEMO_MAX_LENGTH,
} from '../config.js';
import { base64ToBytes } from './bytes.js';
import { HANDLE_PATTERN } from './codes.js';
import { HttpError } from './http.js';
import { detectImageType } from './image-type.js';

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function invalidInput(message) {
  return new HttpError(400, 'invalid_input', message);
}

function countCharacters(text) {
  return Array.from(text).length;
}

export function parseDisplayName(value) {
  const displayName = typeof value === 'string' ? value.trim() : '';
  const length = countCharacters(displayName);
  if (length < 1 || length > DISPLAY_NAME_MAX_LENGTH) {
    throw invalidInput(`名前は1〜${DISPLAY_NAME_MAX_LENGTH}文字にしてください`);
  }
  return displayName;
}

export function parseHandle(value) {
  if (typeof value !== 'string' || !HANDLE_PATTERN.test(value)) {
    throw invalidInput('相手のIDの形式が正しくありません');
  }
  return value;
}

export function parseAmount(value) {
  if (!Number.isInteger(value) || value < AMOUNT_MIN || value > AMOUNT_MAX) {
    throw invalidInput(`金額は${AMOUNT_MIN}${CURRENCY_UNIT}〜${AMOUNT_MAX}${CURRENCY_UNIT}の整数にしてください`);
  }
  return value;
}

export function parseMemo(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw invalidInput('メモの形式が正しくありません');
  }

  const memo = value.trim();
  if (countCharacters(memo) > MEMO_MAX_LENGTH) {
    throw invalidInput(`メモは${MEMO_MAX_LENGTH}文字以内にしてください`);
  }
  return memo;
}

export function parseRequestId(value) {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) {
    throw invalidInput('リクエストIDの形式が正しくありません');
  }
  return value.toLowerCase();
}

export function parsePaymentCode(value) {
  if (typeof value !== 'string' || !isValidPaymentCode(value)) {
    throw invalidInput('コードが正しく読み取れませんでした');
  }
  return normalizePaymentCode(value);
}

export function parseBase64Url(value) {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) {
    throw new HttpError(400, 'passkey_verification_failed', 'Face ID の確認に失敗しました');
  }
  return value;
}

// 「data:image/jpeg;base64,...」の形の画像を受け取り、中身が本当にその種類の画像かを確かめる。
export function parseAvatarImage(value) {
  const match = typeof value === 'string' ? IMAGE_DATA_URL_PATTERN.exec(value) : null;
  if (!match) {
    throw invalidInput('画像の形式が正しくありません（JPEG・PNG・WebP が使えます）');
  }

  const [, declaredType, imageBase64] = match;
  let bytes;
  try {
    bytes = base64ToBytes(imageBase64);
  } catch {
    throw invalidInput('画像の形式が正しくありません');
  }
  if (bytes.length > AVATAR_MAX_BYTES) {
    throw invalidInput('画像が大きすぎます');
  }
  if (detectImageType(bytes) !== declaredType) {
    throw invalidInput('画像の形式が正しくありません');
  }
  return { contentType: declaredType, imageBase64 };
}
