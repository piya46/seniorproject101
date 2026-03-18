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

function buildSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 86400 * 1000
  };
}

async function ensureAppSession(req, res) {
  const sessionId = resolveSessionIdFromCookie(req.cookies?.sci_session_token);
  await initSessionRecord(sessionId);

  const expiresIn = 86400;
  const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

  res.cookie('sci_session_token', token, buildSessionCookieOptions());

  return { sessionId, expiresIn };
}

module.exports = {
  buildSessionCookieOptions,
  ensureAppSession,
  generateSecureSessionId,
  resolveSessionIdFromCookie
};
