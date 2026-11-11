// サーバー（/api/）との通信だけを担当する。画面の操作はここでは行わない。

export const UNAUTHORIZED_EVENT = 'reipay:unauthorized';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  const options = {
    method,
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError(0, 'network_error', '通信できませんでした。電波の状況を確認してください');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error;
    const apiError = new ApiError(
      response.status,
      error?.code ?? 'unknown_error',
      error?.message ?? 'エラーが起きました。少し待ってからもう一度試してください',
    );
    if (apiError.code === 'unauthorized') {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw apiError;
  }
  return data;
}

// アカウント -------------------------------------------------------------

export function startAccount(account) {
  return request('POST', '/api/account/start', account);
}

export function fetchCurrentUser() {
  return request('GET', '/api/me');
}

// Face ID（パスキー） ----------------------------------------------------

export function fetchPasskeyRegistrationOptions() {
  return request('POST', '/api/passkeys/register/options', {});
}

export function registerPasskey(credential) {
  return request('POST', '/api/passkeys/register', { credential });
}

export function fetchPasskeyAuthenticationOptions() {
  return request('POST', '/api/passkeys/authenticate/options', {});
}

export function authenticateWithPasskey(credential) {
  return request('POST', '/api/passkeys/authenticate', { credential });
}

// 送金・履歴 -------------------------------------------------------------

export function fetchRecipients() {
  return request('GET', '/api/recipients');
}

export function lookupUser(handle) {
  return request('GET', `/api/users/lookup?handle=${encodeURIComponent(handle)}`);
}

export function fetchTransactions() {
  return request('GET', '/api/transactions');
}

export function sendTransfer(transfer) {
  return request('POST', '/api/transfers', transfer);
}

// 支払いコード（バーコード・QR） ----------------------------------------

export function createPaymentCode() {
  return request('POST', '/api/payment-codes', {});
}

export function fetchPaymentCodeStatus(code) {
  return request('POST', '/api/payment-codes/status', { code });
}

export function lookupPaymentCode(code) {
  return request('POST', '/api/payment-codes/lookup', { code });
}

export function chargePaymentCode(charge) {
  return request('POST', '/api/payment-codes/charge', charge);
}

// 管理者 -----------------------------------------------------------------

export function fetchAdminUsers() {
  return request('GET', '/api/admin/users');
}

export function issueCurrency(issue) {
  return request('POST', '/api/admin/issues', issue);
}
