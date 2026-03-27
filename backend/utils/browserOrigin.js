function getAllowedOrigins() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173|http://127.0.0.1:5500')
    .split(/[,|]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getRequestOrigin(req) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const referer = typeof req.headers.referer === 'string' ? req.headers.referer.trim() : '';

  if (origin) {
    return origin;
  }

  if (referer) {
    try {
      return new URL(referer).origin;
    } catch (_error) {
      return '';
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
  getRequestOrigin,
  isAllowedBrowserOrigin
};
