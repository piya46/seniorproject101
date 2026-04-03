const jwt = require('jsonwebtoken');
const { firestore, COLLECTION_NAME } = require('../utils/dbUtils'); // ✅ Import Firestore
const { extractDomain, getAllowedDomains, isHostedDomainRequired, isTruthy } = require('../utils/oidcUtils');
const { resolveTrustedBffIdentity } = require('../utils/trustedBffAuth');

function isOidcEnabled() {
  return isTruthy(process.env.OIDC_ENABLED !== undefined ? process.env.OIDC_ENABLED : 'true');
}

function isTrustedBffAuthEnabled() {
  return isTruthy(process.env.TRUSTED_BFF_AUTH_ENABLED || 'false');
}

module.exports = async (req, res, next) => { // ✅ เปลี่ยนเป็น async
  res.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // 1. อ่าน Token จาก Cookie เป็นหลัก
  let token = req.cookies.sci_session_token;
  let trustedBffIdentity = null;

  // Bearer fallback is opt-in only. Default flow should stay cookie-based.
  if (
    !token &&
    isTruthy(process.env.ALLOW_BEARER_SESSION_TOKEN) &&
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    const trustedBffResolution = isTrustedBffAuthEnabled()
      ? await resolveTrustedBffIdentity(req)
      : { ok: false };
    trustedBffIdentity = trustedBffResolution.ok ? trustedBffResolution.identity : null;
    if (!trustedBffIdentity) {
      return res.status(401).json({ error: 'Unauthorized: No session token found' });
    }
  }

  try {
    // 2. Verify JWT Signature & Algorithm
    const decoded = trustedBffIdentity || jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
    });

    if (decoded.session_id) {
        const sessionRef = await firestore.collection(COLLECTION_NAME).doc(decoded.session_id).get();
        if (!sessionRef.exists) {
            req.log?.warn('revoked_session_attempt', { session_id: decoded.session_id });
            res.clearCookie('sci_session_token'); // สั่งลบ Cookie ที่เครื่องลูกข่าย
            return res.status(401).json({ error: 'Session Revoked', message: 'Your session has been terminated.' });
        }
    }
 
    req.user = decoded;

    if (isOidcEnabled()) {
      const email = String(decoded.email || '').trim().toLowerCase();
      const hostedDomain = String(decoded.hosted_domain || '').trim().toLowerCase() || null;
      const allowedDomains = getAllowedDomains();
      const emailDomain = extractDomain(email);

      if (!email) {
        return res.status(403).json({ error: 'Forbidden', message: 'OIDC-backed session is required.' });
      }

      if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Your Google account domain is not allowed.' });
      }

      if (isHostedDomainRequired() && allowedDomains.length > 0 && !allowedDomains.includes(hostedDomain)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Your Google Workspace hosted domain is not allowed.' });
      }
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};
