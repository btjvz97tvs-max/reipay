// 自分のアイコンの設定・削除と、アイコン画像の表示。

import { AVATAR_REQUEST_MAX_BYTES } from '../config.js';
import { base64ToBytes } from '../lib/bytes.js';
import { HttpError, jsonResponse, readJson } from '../lib/http.js';
import { toPublicUser } from '../lib/presenters.js';
import { parseAvatarImage, parseHandle } from '../lib/validate.js';
import { deleteAvatar, findAvatarByHandle, saveAvatar } from '../repositories/avatars.js';
import { hasPasskey } from '../repositories/passkeys.js';
import { findUserById } from '../repositories/users.js';

// URL に更新日時が入っているので、同じ URL の画像は変わらない。長くキャッシュしてよい。
const AVATAR_CACHE_CONTROL = 'private, max-age=31536000, immutable';

async function respondWithCurrentUser(env, userId) {
  const user = await findUserById(env.DB, userId);
  const userHasPasskey = await hasPasskey(env.DB, userId);
  return jsonResponse({ user: toPublicUser(user, { hasPasskey: userHasPasskey }) });
}

export async function updateMyAvatar(request, env, context) {
  const body = await readJson(request, { maxBytes: AVATAR_REQUEST_MAX_BYTES });
  const { contentType, imageBase64 } = parseAvatarImage(body.image);
  await saveAvatar(env.DB, context.user.id, { contentType, imageBase64 });
  return respondWithCurrentUser(env, context.user.id);
}

export async function deleteMyAvatar(request, env, context) {
  await deleteAvatar(env.DB, context.user.id);
  return respondWithCurrentUser(env, context.user.id);
}

export async function getAvatar(request, env) {
  const handle = parseHandle(new URL(request.url).searchParams.get('handle'));
  const avatar = await findAvatarByHandle(env.DB, handle);
  if (!avatar) {
    throw new HttpError(404, 'avatar_not_found', 'アイコンが見つかりません');
  }
  return new Response(base64ToBytes(avatar.imageBase64), {
    headers: { 'Content-Type': avatar.contentType, 'Cache-Control': AVATAR_CACHE_CONTROL },
  });
}
