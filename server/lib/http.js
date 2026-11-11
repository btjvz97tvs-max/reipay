import { REQUEST_BODY_MAX_BYTES } from '../config.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(error) {
  const body = { error: { code: error.code, message: error.message } };
  return jsonResponse(body, { status: error.status });
}

export async function readJson(request, { maxBytes = REQUEST_BODY_MAX_BYTES } = {}) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'JSON形式で送ってください');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, 'payload_too_large', '送信データが大きすぎます');
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', '送信データの形式が正しくありません');
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_json', '送信データの形式が正しくありません');
  }
  return body;
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expectedOrigin = new URL(request.url).origin;
  if (origin !== expectedOrigin) {
    throw new HttpError(403, 'invalid_origin', 'このページ以外からの操作は受け付けていません');
  }
}
