// Face ID（パスキー）の登録と、それを使った復元。

import { createRandomToken } from '../lib/bytes.js';
import { buildSessionCookie } from '../lib/cookie.js';
import { isUniqueViolation } from '../lib/db-errors.js';
import { HttpError, jsonResponse, readJson } from '../lib/http.js';
import { toPublicUser } from '../lib/presenters.js';
import { parseBase64Url } from '../lib/validate.js';
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  getRelyingParty,
  readClientData,
  verifyAssertion,
  verifyRegistration,
} from '../lib/webauthn.js';
import {
  findPasskeyByCredentialId,
  insertPasskey,
  listCredentialIdsForUser,
  updatePasskeyUsage,
} from '../repositories/passkeys.js';
import { insertSession } from '../repositories/sessions.js';
import { findUserById } from '../repositories/users.js';
import {
  consumeChallenge,
  deleteExpiredChallenges,
  insertChallenge,
} from '../repositories/webauthn-challenges.js';

function expiredChallengeError() {
  return new HttpError(400, 'passkey_expired', '時間切れです。もう一度やり直してください');
}

function readCredential(body) {
  const credential = body.credential;
  const isCredential =
    credential !== null &&
    typeof credential === 'object' &&
    typeof credential.response === 'object';
  if (!isCredential) {
    throw new HttpError(400, 'passkey_verification_failed', 'Face ID の確認に失敗しました');
  }
  return credential;
}

export async function createRegistrationChallenge(request, env, context) {
  const { user } = context;
  const challenge = createRandomToken();
  await deleteExpiredChallenges(env.DB);
  await insertChallenge(env.DB, { challenge, purpose: 'register', userId: user.id });

  const options = createRegistrationOptions({
    relyingParty: getRelyingParty(request),
    user,
    challenge,
    excludeCredentialIds: await listCredentialIdsForUser(env.DB, user.id),
  });
  return jsonResponse({ options });
}

export async function registerPasskey(request, env, context) {
  const { user } = context;
  const credential = readCredential(await readJson(request));
  const relyingParty = getRelyingParty(request);

  const credentialId = parseBase64Url(credential.id);
  const clientDataJson = parseBase64Url(credential.response.clientDataJSON);
  const attestationObject = parseBase64Url(credential.response.attestationObject);

  const challenge = readClientData(clientDataJson, 'webauthn.create', relyingParty);
  const storedChallenge = await consumeChallenge(env.DB, { challenge, purpose: 'register' });
  if (!storedChallenge || storedChallenge.userId !== user.id) {
    throw expiredChallengeError();
  }

  const { publicKeyJwk, algorithm, signCount } = await verifyRegistration({
    credentialId,
    attestationObject,
    relyingParty,
  });

  try {
    await insertPasskey(env.DB, {
      credentialId,
      userId: user.id,
      publicKeyJwk,
      algorithm,
      signCount,
    });
  } catch (error) {
    if (isUniqueViolation(error, 'passkeys.credential_id')) {
      throw new HttpError(409, 'passkey_exists', 'この Face ID はすでに登録されています');
    }
    throw error;
  }
  return jsonResponse({ user: toPublicUser(user, { hasPasskey: true }) }, { status: 201 });
}

export async function createAuthenticationChallenge(request, env) {
  const challenge = createRandomToken();
  await deleteExpiredChallenges(env.DB);
  await insertChallenge(env.DB, { challenge, purpose: 'authenticate', userId: null });

  const options = createAuthenticationOptions({
    relyingParty: getRelyingParty(request),
    challenge,
  });
  return jsonResponse({ options });
}

export async function authenticateWithPasskey(request, env) {
  const credential = readCredential(await readJson(request));
  const relyingParty = getRelyingParty(request);

  const credentialId = parseBase64Url(credential.id);
  const clientDataJson = parseBase64Url(credential.response.clientDataJSON);
  const authenticatorData = parseBase64Url(credential.response.authenticatorData);
  const signature = parseBase64Url(credential.response.signature);

  const challenge = readClientData(clientDataJson, 'webauthn.get', relyingParty);
  const storedChallenge = await consumeChallenge(env.DB, { challenge, purpose: 'authenticate' });
  if (!storedChallenge) {
    throw expiredChallengeError();
  }

  const passkey = await findPasskeyByCredentialId(env.DB, credentialId);
  if (!passkey) {
    throw new HttpError(
      404,
      'passkey_not_found',
      'この Face ID で登録されたデータが見つかりません（別のサイトのものかもしれません）',
    );
  }

  const { signCount } = await verifyAssertion({
    authenticatorData,
    clientDataJson,
    signature,
    passkey,
    relyingParty,
  });
  await updatePasskeyUsage(env.DB, credentialId, signCount);

  const user = await findUserById(env.DB, passkey.userId);
  const token = await insertSession(env.DB, user.id);
  return jsonResponse(
    { user: toPublicUser(user, { hasPasskey: true }) },
    { headers: { 'Set-Cookie': buildSessionCookie(token) } },
  );
}
