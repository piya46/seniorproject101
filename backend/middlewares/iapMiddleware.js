const https = require('https');
const jwt = require('jsonwebtoken');

const IAP_PUBLIC_KEYS_URL = 'https://www.gstatic.com/iap/verify/public_key';
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedKeys = null;
let cachedKeysExpireAt = 0;
let inFlightFetch = null;

function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

function stripIdentityPrefix(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const [, stripped = value] = value.split(':');
  return stripped.trim().toLowerCase();
}

function getAllowedDomains() {
  return String(process.env.IAP_ALLOWED_DOMAINS || '')
    .split(/[,|]/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function extractDomain(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return null;
  }

  return email.split('@').pop().trim().toLowerCase();
}

function getExpectedAudience() {
  if (process.env.IAP_EXPECTED_AUDIENCE) {
    return process.env.IAP_EXPECTED_AUDIENCE.trim();
  }

  const projectNumber = String(process.env.GCP_PROJECT_NUMBER || '').trim();
  const region = String(process.env.APP_REGION || '').trim();
  const serviceName = String(process.env.K_SERVICE || process.env.SERVICE_NAME || '').trim();
  const backendServiceId = String(process.env.IAP_BACKEND_SERVICE_ID || '').trim();

  if (projectNumber && backendServiceId) {
    return `/projects/${projectNumber}/global/backendServices/${backendServiceId}`;
  }

  if (projectNumber && region && serviceName) {
    return `/projects/${projectNumber}/locations/${region}/services/${serviceName}`;
  }

  return null;
}

function parseMaxAge(cacheControl) {
  if (!cacheControl) {
    return CACHE_TTL_MS;
  }

  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) {
    return CACHE_TTL_MS;
  }

  const seconds = Number.parseInt(match[1], 10);
  return Number.isFinite(seconds) ? seconds * 1000 : CACHE_TTL_MS;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to fetch IAP public keys: HTTP ${response.statusCode}`));
          return;
        }

        let rawData = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          rawData += chunk;
        });
        response.on('end', () => {
          try {
            resolve({
              body: JSON.parse(rawData),
              cacheControl: response.headers['cache-control'] || ''
            });
          } catch (error) {
            reject(new Error(`Failed to parse IAP public keys: ${error.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function getIapPublicKeys(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedKeys && now < cachedKeysExpireAt) {
    return cachedKeys;
  }

  if (!forceRefresh && inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    const { body, cacheControl } = await fetchJson(IAP_PUBLIC_KEYS_URL);
    cachedKeys = body;
    cachedKeysExpireAt = Date.now() + parseMaxAge(cacheControl);
    return cachedKeys;
  })();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

async function verifyAssertion(assertion, audience) {
  const decoded = jwt.decode(assertion, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Malformed IAP JWT');
  }

  if (decoded.header.alg !== 'ES256') {
    throw new Error(`Unexpected IAP JWT alg: ${decoded.header.alg}`);
  }

  let publicKeys = await getIapPublicKeys();
  let publicKey = publicKeys[decoded.header.kid];

  if (!publicKey) {
    publicKeys = await getIapPublicKeys(true);
    publicKey = publicKeys[decoded.header.kid];
  }

  if (!publicKey) {
    throw new Error(`Unknown IAP key id: ${decoded.header.kid}`);
  }

  return jwt.verify(assertion, publicKey, {
    algorithms: ['ES256'],
    issuer: 'https://cloud.google.com/iap',
    audience,
    clockTolerance: 5
  });
}

module.exports = async (req, res, next) => {
  if (!isTruthy(process.env.IAP_ENABLED)) {
    return next();
  }

  const expectedAudience = getExpectedAudience();
  if (!expectedAudience) {
    console.error('❌ IAP is enabled but expected audience is not configured.');
    return res.status(500).json({
      error: 'Security Misconfiguration',
      message: 'IAP expected audience is not configured on the server.'
    });
  }

  const assertion = req.header('x-goog-iap-jwt-assertion');
  if (!assertion) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Google Cloud IAP assertion.'
    });
  }

  try {
    const payload = await verifyAssertion(assertion, expectedAudience);
    const headerEmail = stripIdentityPrefix(req.header('x-goog-authenticated-user-email'));
    const headerSubject = stripIdentityPrefix(req.header('x-goog-authenticated-user-id'));
    const payloadEmail = stripIdentityPrefix(payload.email);
    const email = payloadEmail || headerEmail;

    if (!email) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'IAP identity did not include an email address.'
      });
    }

    if (headerEmail && payloadEmail && headerEmail !== payloadEmail) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'IAP identity headers do not match the signed assertion.'
      });
    }

    const allowedDomains = getAllowedDomains();
    const emailDomain = extractDomain(email);
    const hostedDomain = String(payload.hd || '').trim().toLowerCase() || null;

    if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your Google account domain is not allowed.'
      });
    }

    if (isTruthy(process.env.IAP_REQUIRE_HOSTED_DOMAIN) && allowedDomains.length > 0 && !allowedDomains.includes(hostedDomain)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your Google Workspace hosted domain is not allowed.'
      });
    }

    req.iap = {
      email,
      subject: headerSubject || payload.sub || null,
      hosted_domain: hostedDomain,
      audience: payload.aud,
      issued_at: payload.iat || null,
      expires_at: payload.exp || null
    };

    return next();
  } catch (error) {
    console.warn(`⛔ IAP verification failed for ${req.method} ${req.originalUrl}: ${error.message}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Google Cloud IAP assertion.'
    });
  }
};

module.exports._private = {
  extractDomain,
  getAllowedDomains,
  getExpectedAudience,
  isTruthy,
  parseMaxAge,
  stripIdentityPrefix
};
