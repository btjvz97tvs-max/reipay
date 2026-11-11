// パスキー（Face ID など）の登録と確認。WebAuthn の仕様のうち、このアプリで使う部分だけを実装している。
// 仕組み: サーバーが出したランダムな値（チャレンジ）に端末が秘密鍵で署名し、サーバーは公開鍵で確かめる。
// 秘密鍵は端末（iCloud キーチェーンなど）から出ないので、クッキーが消えても本人だけが復元できる。

import { WEBAUTHN_RP_NAME } from '../config.js';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  concatBytes,
  decodeText,
  sha256,
  timingSafeEqual,
} from './bytes.js';
import { decodeCbor, decodeFirstCborItem } from './cbor.js';
import { HttpError } from './http.js';

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED_CREDENTIAL_DATA = 0x40;

const RP_ID_HASH_LENGTH = 32;
const AAGUID_LENGTH = 16;

const COSE_KEY_TYPE = 1;
const COSE_ALGORITHM = 3;
const COSE_KEY_TYPE_EC2 = 2;
const COSE_KEY_TYPE_RSA = 3;
const COSE_CURVE_P256 = 1;

export const ALGORITHM_ES256 = -7;
export const ALGORITHM_RS256 = -257;

function verificationError() {
  return new HttpError(400, 'passkey_verification_failed', 'Face ID の確認に失敗しました');
}

export function getRelyingParty(request) {
  const url = new URL(request.url);
  return { id: url.hostname, origin: url.origin, name: WEBAUTHN_RP_NAME };
}

// clientDataJSON から種類・送り元・チャレンジを確かめ、チャレンジを返す。
export function readClientData(clientDataBase64Url, expectedType, relyingParty) {
  let clientData;
  try {
    clientData = JSON.parse(decodeText(base64UrlToBytes(clientDataBase64Url)));
  } catch {
    throw verificationError();
  }

  if (clientData.type !== expectedType || clientData.origin !== relyingParty.origin) {
    throw verificationError();
  }
  if (typeof clientData.challenge !== 'string' || clientData.challenge.length === 0) {
    throw verificationError();
  }
  return clientData.challenge;
}

async function parseAuthenticatorData(bytes, relyingParty) {
  if (bytes.length < RP_ID_HASH_LENGTH + 5) {
    throw verificationError();
  }

  const rpIdHash = bytes.subarray(0, RP_ID_HASH_LENGTH);
  const expectedRpIdHash = await sha256(relyingParty.id);
  if (!timingSafeEqual(rpIdHash, expectedRpIdHash)) {
    throw verificationError();
  }

  const flags = bytes[RP_ID_HASH_LENGTH];
  if (!(flags & FLAG_USER_PRESENT) || !(flags & FLAG_USER_VERIFIED)) {
    throw verificationError();
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signCount = view.getUint32(RP_ID_HASH_LENGTH + 1);
  const result = { flags, signCount };

  if (flags & FLAG_ATTESTED_CREDENTIAL_DATA) {
    const credentialIdLengthOffset = RP_ID_HASH_LENGTH + 5 + AAGUID_LENGTH;
    const credentialIdLength = view.getUint16(credentialIdLengthOffset);
    const credentialIdStart = credentialIdLengthOffset + 2;
    const credentialIdEnd = credentialIdStart + credentialIdLength;
    result.credentialId = bytes.subarray(credentialIdStart, credentialIdEnd);
    result.coseKey = decodeFirstCborItem(bytes.subarray(credentialIdEnd)).value;
  }
  return result;
}

function coseKeyToJwk(coseKey) {
  if (!(coseKey instanceof Map)) {
    throw verificationError();
  }

  const keyType = coseKey.get(COSE_KEY_TYPE);
  const algorithm = coseKey.get(COSE_ALGORITHM);

  if (keyType === COSE_KEY_TYPE_EC2 && algorithm === ALGORITHM_ES256) {
    if (coseKey.get(-1) !== COSE_CURVE_P256) {
      throw verificationError();
    }
    return {
      algorithm,
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToBase64Url(coseKey.get(-2)),
        y: bytesToBase64Url(coseKey.get(-3)),
      },
    };
  }

  if (keyType === COSE_KEY_TYPE_RSA && algorithm === ALGORITHM_RS256) {
    return {
      algorithm,
      jwk: {
        kty: 'RSA',
        n: bytesToBase64Url(coseKey.get(-1)),
        e: bytesToBase64Url(coseKey.get(-2)),
      },
    };
  }
  throw new HttpError(400, 'passkey_unsupported', 'この端末の Face ID / 指紋認証には対応していません');
}

// ECDSA の署名は DER 形式で届くので、WebCrypto が使う r||s（64バイト）の形に直す。
function derToRawSignature(der) {
  const readInteger = (offset) => {
    if (der[offset] !== 0x02) {
      throw verificationError();
    }
    const length = der[offset + 1];
    let value = der.subarray(offset + 2, offset + 2 + length);
    while (value.length > 32 && value[0] === 0) {
      value = value.subarray(1);
    }
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return { value: padded, nextOffset: offset + 2 + length };
  };

  if (der[0] !== 0x30) {
    throw verificationError();
  }
  const r = readInteger(2);
  const s = readInteger(r.nextOffset);
  return concatBytes(r.value, s.value);
}

async function importPublicKey(jwk, algorithm) {
  const keyAlgorithm =
    algorithm === ALGORITHM_ES256
      ? { name: 'ECDSA', namedCurve: 'P-256' }
      : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  return crypto.subtle.importKey('jwk', jwk, keyAlgorithm, false, ['verify']);
}

export function createRegistrationOptions({ relyingParty, user, challenge, excludeCredentialIds }) {
  return {
    challenge,
    rp: { id: relyingParty.id, name: relyingParty.name },
    user: {
      id: bytesToBase64Url(new TextEncoder().encode(user.handle)),
      name: `${user.displayName}（れいpay）`,
      displayName: user.displayName,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: ALGORITHM_ES256 },
      { type: 'public-key', alg: ALGORITHM_RS256 },
    ],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: excludeCredentialIds.map((id) => ({ type: 'public-key', id })),
    attestation: 'none',
    timeout: 120000,
  };
}

export function createAuthenticationOptions({ relyingParty, challenge }) {
  return {
    challenge,
    rpId: relyingParty.id,
    userVerification: 'required',
    timeout: 120000,
  };
}

export async function verifyRegistration({ credentialId, attestationObject, relyingParty }) {
  let attestation;
  try {
    attestation = decodeCbor(base64UrlToBytes(attestationObject));
  } catch {
    throw verificationError();
  }
  if (!(attestation instanceof Map) || !(attestation.get('authData') instanceof Uint8Array)) {
    throw verificationError();
  }

  const authenticatorData = await parseAuthenticatorData(attestation.get('authData'), relyingParty);
  if (!authenticatorData.credentialId || !authenticatorData.coseKey) {
    throw verificationError();
  }
  if (bytesToBase64Url(authenticatorData.credentialId) !== credentialId) {
    throw verificationError();
  }

  const { jwk, algorithm } = coseKeyToJwk(authenticatorData.coseKey);
  await importPublicKey(jwk, algorithm);
  return { publicKeyJwk: jwk, algorithm, signCount: authenticatorData.signCount };
}

export async function verifyAssertion({
  authenticatorData,
  clientDataJson,
  signature,
  passkey,
  relyingParty,
}) {
  const authenticatorDataBytes = base64UrlToBytes(authenticatorData);
  const parsed = await parseAuthenticatorData(authenticatorDataBytes, relyingParty);

  const clientDataHash = await sha256(base64UrlToBytes(clientDataJson));
  const signedData = concatBytes(authenticatorDataBytes, clientDataHash);
  const signatureBytes = base64UrlToBytes(signature);

  const publicKey = await importPublicKey(passkey.publicKeyJwk, passkey.algorithm);
  const isValid =
    passkey.algorithm === ALGORITHM_ES256
      ? await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          publicKey,
          derToRawSignature(signatureBytes),
          signedData,
        )
      : await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signatureBytes, signedData);
  if (!isValid) {
    throw verificationError();
  }

  // 同期型のパスキーはカウンターが常に0。どちらかが0より大きいときだけ、巻き戻り（複製）を疑う。
  const isCounterInUse = parsed.signCount > 0 || passkey.signCount > 0;
  if (isCounterInUse && parsed.signCount <= passkey.signCount) {
    throw verificationError();
  }
  return { signCount: parsed.signCount };
}
