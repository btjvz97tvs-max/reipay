// Cloudflare Workers の入口。/api/ はサーバーの処理へ、それ以外は public/ の画面ファイルを返す。

import { errorResponse, HttpError } from './lib/http.js';
import { applySecurityHeaders } from './lib/security-headers.js';
import { handleApiRequest } from './router.js';

async function handleApi(request, env) {
  try {
    return await handleApiRequest(request, env);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error);
    }
    console.error(error);
    return errorResponse(
      new HttpError(
        500,
        'internal_error',
        'サーバーでエラーが起きました。少し待ってからもう一度試してください',
      ),
    );
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const response = pathname.startsWith('/api/')
      ? await handleApi(request, env)
      : await env.ASSETS.fetch(request);
    return applySecurityHeaders(response);
  },
};
