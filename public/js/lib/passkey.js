// Face ID などのパスキーを使う（ブラウザ側）。サーバーとのやりとりは api.js が行う。

function base64UrlToBuffer(text) {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)).buffer;
}

function bufferToBase64Url(buffer) {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function toFriendlyError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
    return new Error('Face ID がキャンセルされたか、時間切れになりました');
  }
  if (error?.name === 'InvalidStateError') {
    return new Error('この端末の Face ID はすでに登録されています');
  }
  return new Error('この端末では Face ID を使えませんでした');
}

export function isPasskeySupported() {
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

export async function createPasskeyCredential(options) {
  const publicKey = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: { ...options.user, id: base64UrlToBuffer(options.user.id) },
    excludeCredentials: options.excludeCredentials.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };

  let credential;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (error) {
    throw toFriendlyError(error);
  }
  return {
    id: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      attestationObject: bufferToBase64Url(credential.response.attestationObject),
    },
  };
}

export async function getPasskeyAssertion(options) {
  const publicKey = { ...options, challenge: base64UrlToBuffer(options.challenge) };

  let credential;
  try {
    credential = await navigator.credentials.get({ publicKey });
  } catch (error) {
    throw toFriendlyError(error);
  }
  return {
    id: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64Url(credential.response.authenticatorData),
      signature: bufferToBase64Url(credential.response.signature),
    },
  };
}
