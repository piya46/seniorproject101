function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

function getAllowedOrigins() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173|http://127.0.0.1:5500')
    .split(/[,|]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  try {
    return new URL(value.trim()).origin;
  } catch (_error) {
    return '';
  }
}

function getTrustedBrowserOriginHeaderName() {
  return String(process.env.BROWSER_ORIGIN_HEADER_NAME || 'x-browser-origin')
    .trim()
    .toLowerCase();
}

function shouldTrustProxyBrowserOriginHeader() {
  return isTruthy(process.env.TRUST_PROXY_BROWSER_ORIGIN_HEADER || 'false');
}

function getRequestOrigin(req) {
  const origin = normalizeOrigin(req.headers.origin);
  const referer = normalizeOrigin(req.headers.referer);

  if (origin) {
    return origin;
  }

  if (referer) {
    return referer;
  }

  if (shouldTrustProxyBrowserOriginHeader()) {
    const headerName = getTrustedBrowserOriginHeaderName();
    const forwardedOrigin = normalizeOrigin(req.headers[headerName]);
    if (forwardedOrigin) {
      return forwardedOrigin;
    }
  }

  return '';
}

function isAllowedBrowserOrigin(req, options = {}) {
  const requireHeader = options.requireHeader !== false;
  const requestOrigin = getRequestOrigin(req);

  if (!requestOrigin) {
    return !requireHeader;
  }

  return getAllowedOrigins().includes(requestOrigin);
}

module.exports = {
  getAllowedOrigins,
  getTrustedBrowserOriginHeaderName,
  getRequestOrigin,
  isAllowedBrowserOrigin,
  shouldTrustProxyBrowserOriginHeader
};
