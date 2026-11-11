// すべてのレスポンスに付けるセキュリティ用ヘッダー。
// CSP で script/style を 'self'（自分のファイル）だけに限定しているので、
// HTML の中に <style> や style="..."、onclick などを書いても動かない。

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  // カメラは「スキャン」で使うので、このサイト自身にだけ許可する。
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
};

export function applySecurityHeaders(response) {
  const securedResponse = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    securedResponse.headers.set(name, value);
  }
  return securedResponse;
}
