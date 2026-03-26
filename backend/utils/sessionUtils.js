const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initSessionRecord } = require('./dbUtils');

function generateSecureSessionId() {
  return 'sess_' + crypto.randomBytes(16).toString('hex');
}

function resolveSessionIdFromCookie(existingToken) {
  if (!existingToken) {
    return generateSecureSessionId();
  }

  try {
    const decoded = jwt.verify(existingToken, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    return decoded.session_id || generateSecureSessionId();
  } catch (_error) {
    return generateSecureSessionId();
  }
}

function extractIdentityFromCookie(existingToken) {
  if (!existingToken) {
    return {};
  }

  try {
    const decoded = jwt.verify(existingToken, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });

    return {
      email: decoded.email || null,
      hosted_domain: decoded.hosted_domain || null,
      auth_provider: decoded.auth_provider || null,
      google_sub: decoded.google_sub || null,
      name: decoded.name || null,
      picture: decoded.picture || null
    };
  } catch (_error) {
    return {};
  }
}

function buildSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 86400 * 1000
  };
}

function buildSessionPayload(sessionId, identity = {}) {
  const payload = {
    session_id: sessionId
  };

  const fields = ['email', 'hosted_domain', 'auth_provider', 'google_sub', 'name', 'picture'];
  for (const field of fields) {
    if (identity[field]) {
      payload[field] = identity[field];
    }
  }

  return payload;
}

async function ensureAppSession(req, res, identity = {}) {
  const existingToken = req.cookies?.sci_session_token;
  const sessionId = resolveSessionIdFromCookie(existingToken);
  const existingIdentity = extractIdentityFromCookie(existingToken);
  const mergedIdentity = { ...existingIdentity, ...identity };
  await initSessionRecord(sessionId);

  const expiresIn = 86400;
  const token = jwt.sign(buildSessionPayload(sessionId, mergedIdentity), process.env.JWT_SECRET, { expiresIn });

  res.cookie('sci_session_token', token, buildSessionCookieOptions());

  return { sessionId, expiresIn };
}

module.exports = {
  buildSessionCookieOptions,
  buildSessionPayload,
  ensureAppSession,
  extractIdentityFromCookie,
  generateSecureSessionId,
  resolveSessionIdFromCookie
};
