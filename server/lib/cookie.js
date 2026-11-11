import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from '../config.js';

const SECONDS_PER_DAY = 60 * 60 * 24;
const COOKIE_ATTRIBUTES = ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];

function buildCookie(value, maxAgeSeconds) {
  return [`${SESSION_COOKIE_NAME}=${value}`, ...COOKIE_ATTRIBUTES, `Max-Age=${maxAgeSeconds}`].join(
    '; ',
  );
}

export function readSessionToken(request) {
  const header = request.headers.get('Cookie');
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return valueParts.join('=') || null;
    }
  }
  return null;
}

export function buildSessionCookie(token) {
  return buildCookie(token, SESSION_TTL_DAYS * SECONDS_PER_DAY);
}

export function buildClearedSessionCookie() {
  return buildCookie('', 0);
}
