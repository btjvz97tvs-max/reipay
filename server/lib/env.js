import { HttpError } from './http.js';

export function requireEnv(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(500, 'server_misconfigured', `サーバーの設定（${name}）がまだ登録されていません`);
  }
  return value;
}
