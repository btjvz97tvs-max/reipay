// API の入口。URL と HTTP メソッドから担当の処理を選び、必要なら「誰か」を確かめる。
// access: 'public' = 誰でも / 'user' = アカウントが必要 / 'admin' = 管理者だけ

import { getCurrentUser, startAccount } from './handlers/account.js';
import { createCollection, createIssue, listAllUsers } from './handlers/admin.js';
import { deleteMyAvatar, getAvatar, updateMyAvatar } from './handlers/avatars.js';
import {
  authenticateWithPasskey,
  createAuthenticationChallenge,
  createRegistrationChallenge,
  registerPasskey,
} from './handlers/passkeys.js';
import {
  chargePaymentCode,
  createPaymentCode,
  getPaymentCodeStatus,
  lookupPaymentCode,
} from './handlers/payment-codes.js';
import {
  createTransfer,
  listMyTransactions,
  listRecipients,
  lookupUser,
} from './handlers/wallet.js';
import { assertSameOrigin, HttpError } from './lib/http.js';
import { authenticate, authenticateAdmin } from './middleware/authenticate.js';

const ROUTES = [
  { method: 'POST', path: '/api/account/start', access: 'public', handler: startAccount },
  { method: 'GET', path: '/api/me', access: 'user', handler: getCurrentUser },
  { method: 'PUT', path: '/api/me/avatar', access: 'user', handler: updateMyAvatar },
  { method: 'DELETE', path: '/api/me/avatar', access: 'user', handler: deleteMyAvatar },
  { method: 'GET', path: '/api/avatars', access: 'user', handler: getAvatar },

  {
    method: 'POST',
    path: '/api/passkeys/register/options',
    access: 'user',
    handler: createRegistrationChallenge,
  },
  { method: 'POST', path: '/api/passkeys/register', access: 'user', handler: registerPasskey },
  {
    method: 'POST',
    path: '/api/passkeys/authenticate/options',
    access: 'public',
    handler: createAuthenticationChallenge,
  },
  {
    method: 'POST',
    path: '/api/passkeys/authenticate',
    access: 'public',
    handler: authenticateWithPasskey,
  },

  { method: 'GET', path: '/api/recipients', access: 'user', handler: listRecipients },
  { method: 'GET', path: '/api/users/lookup', access: 'user', handler: lookupUser },
  { method: 'GET', path: '/api/transactions', access: 'user', handler: listMyTransactions },
  { method: 'POST', path: '/api/transfers', access: 'user', handler: createTransfer },

  { method: 'POST', path: '/api/payment-codes', access: 'user', handler: createPaymentCode },
  {
    method: 'POST',
    path: '/api/payment-codes/status',
    access: 'user',
    handler: getPaymentCodeStatus,
  },
  { method: 'POST', path: '/api/payment-codes/lookup', access: 'user', handler: lookupPaymentCode },
  { method: 'POST', path: '/api/payment-codes/charge', access: 'user', handler: chargePaymentCode },

  { method: 'GET', path: '/api/admin/users', access: 'admin', handler: listAllUsers },
  { method: 'POST', path: '/api/admin/issues', access: 'admin', handler: createIssue },
  { method: 'POST', path: '/api/admin/collections', access: 'admin', handler: createCollection },
];

function findRoute(method, path) {
  const routesForPath = ROUTES.filter((route) => route.path === path);
  if (routesForPath.length === 0) {
    throw new HttpError(404, 'not_found', '見つかりません');
  }

  const route = routesForPath.find((candidate) => candidate.method === method);
  if (!route) {
    throw new HttpError(405, 'method_not_allowed', 'この方法では操作できません');
  }
  return route;
}

async function buildContext(route, request, env) {
  if (route.access === 'admin') {
    return authenticateAdmin(request, env);
  }
  if (route.access === 'user') {
    return authenticate(request, env);
  }
  return {};
}

export async function handleApiRequest(request, env) {
  const { pathname } = new URL(request.url);
  const route = findRoute(request.method, pathname);

  if (request.method !== 'GET') {
    assertSameOrigin(request);
  }

  const context = await buildContext(route, request, env);
  return route.handler(request, env, context);
}
