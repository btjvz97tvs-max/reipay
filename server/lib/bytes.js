// バイト列・文字列の変換と比較、ランダムな値の作成。

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeText(text) {
  return encoder.encode(text);
}

export function decodeText(bytes) {
  return decoder.decode(bytes);
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(text) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text) {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function concatBytes(...parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function createRandomToken(byteLength = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

// alphabet の文字だけでできたランダムな文字列を作る。偏りが出ないよう、はみ出た値は捨てて引き直す。
export function createRandomString(alphabet, length) {
  const limit = 256 - (256 % alphabet.length);
  let result = '';
  while (result.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && result.length < length) {
        result += alphabet[byte % alphabet.length];
      }
    }
  }
  return result;
}

export async function sha256(input) {
  const data = typeof input === 'string' ? encodeText(input) : input;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

export async function sha256Hex(input) {
  return bytesToHex(await sha256(input));
}

// 比較にかかる時間から中身を推測されないよう、最後まで比較してから結果を返す。
export function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

// 長さの違う文字列でも同じ手順で比較できるよう、ハッシュ同士を比べる。
export async function timingSafeEqualText(left, right) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  return timingSafeEqual(leftHash, rightHash);
}
