const crypto = require('crypto');
const { getCookieSameSitePolicy, shouldUseSecureCookies } = require('./runtimeSecurityConfig');

const CSRF_COOKIE_NAME = 'sci_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

function buildCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: shouldUseSecureCookies(),
    sameSite: getCookieSameSitePolicy(),
    maxAge: 86400 * 1000
  };
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token = generateCsrfToken()) {
  res.cookie(CSRF_COOKIE_NAME, token, buildCsrfCookieOptions());
  return token;
}

function ensureCsrfCookie(req, res) {
  const existingToken = typeof req.cookies?.[CSRF_COOKIE_NAME] === 'string'
    ? req.cookies[CSRF_COOKIE_NAME].trim()
    : '';

  if (existingToken) {
    res.cookie(CSRF_COOKIE_NAME, existingToken, buildCsrfCookieOptions());
    return existingToken;
  }

  return setCsrfCookie(res);
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...buildCsrfCookieOptions(),
    maxAge: undefined,
    expires: new Date(0)
  });
}

function isValidCsrfToken(req) {
  const cookieToken = typeof req.cookies?.[CSRF_COOKIE_NAME] === 'string'
    ? req.cookies[CSRF_COOKIE_NAME].trim()
    : '';
  const headerToken = typeof req.headers[CSRF_HEADER_NAME] === 'string'
    ? req.headers[CSRF_HEADER_NAME].trim()
    : '';

  if (!cookieToken || !headerToken) {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  buildCsrfCookieOptions,
  clearCsrfCookie,
  ensureCsrfCookie,
  generateCsrfToken,
  isValidCsrfToken,
  setCsrfCookie
};
