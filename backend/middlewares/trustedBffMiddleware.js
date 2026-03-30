const crypto = require('crypto');

function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

function getConfiguredSharedSecret() {
  return String(process.env.TRUSTED_BFF_SHARED_SECRET || '').trim();
}

function getProvidedSharedSecret(req) {
  const headerName = String(process.env.TRUSTED_BFF_AUTH_HEADER_NAME || 'x-bff-auth')
    .trim()
    .toLowerCase();
  const headerValue = req.headers?.[headerName];

  if (typeof headerValue !== 'string') {
    return '';
  }

  return headerValue.trim();
}

module.exports = (req, res, next) => {
  if (!isTruthy(process.env.TRUSTED_BFF_AUTH_ENABLED || 'false')) {
    return res.status(503).json({
      error: 'Trusted BFF auth disabled',
      message: 'Trusted BFF auth is not enabled on this backend.'
    });
  }

  const configuredSecret = getConfiguredSharedSecret();
  const providedSecret = getProvidedSharedSecret(req);

  if (!configuredSecret || !providedSecret) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Trusted BFF credentials are missing.'
    });
  }

  const configuredBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);

  if (
    configuredBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(configuredBuffer, providedBuffer)
  ) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Trusted BFF credentials are invalid.'
    });
  }

  return next();
};
