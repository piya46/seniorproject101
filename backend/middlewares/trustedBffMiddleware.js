const { resolveTrustedBffIdentity } = require('../utils/trustedBffAuth');

function createTrustedBffMiddleware(options = {}) {
  return async (req, res, next) => {
    const resolved = await resolveTrustedBffIdentity(req, options);

    if (!resolved.ok && resolved.reason === 'disabled') {
      return res.status(503).json({
        error: 'Trusted BFF auth disabled',
        message: 'Trusted BFF auth is not enabled on this backend.'
      });
    }

    if (!resolved.ok && resolved.reason === 'invalid_shared_secret') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trusted BFF credentials are missing.'
      });
    }

    if (!resolved.ok) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trusted BFF attestation is invalid.'
      });
    }

    return next();
  };
}

module.exports = createTrustedBffMiddleware();
module.exports.createTrustedBffMiddleware = createTrustedBffMiddleware;
