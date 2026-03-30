const https = require('https');
const jwt = require('jsonwebtoken');

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const CACHE_TTL_MS = 60 * 60 * 1000;
const STATE_TTL_SECONDS = 10 * 60;

let cachedCerts = null;
let cachedCertsExpireAt = 0;
let inFlightCertFetch = null;

function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

function parseAllowedOrigins() {
  const rawOrigins =
    process.env.FRONTEND_URL ||
    'http://localhost:5173|http://127.0.0.1:5500';

  return rawOrigins
    .split(/[,|]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSafeReturnUrl(returnTo) {
  const allowedOrigins = parseAllowedOrigins();
  const preferredOrigin =
    allowedOrigins.find((origin) => origin.startsWith('https://')) ||
    allowedOrigins[0] ||
    null;

  if (!returnTo) {
    return preferredOrigin;
  }

  try {
    const parsed = new URL(returnTo);
    const normalizedOrigin = parsed.origin.replace(/\/$/, '');
    if (!allowedOrigins.includes(normalizedOrigin)) {
      return null;
    }
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function getAllowedDomains() {
  return String(process.env.OIDC_ALLOWED_DOMAINS || 'chula.ac.th,student.chula.ac.th')
    .split(/[,|]/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function isHostedDomainRequired() {
  if (process.env.OIDC_REQUIRE_HOSTED_DOMAIN === undefined) {
    return true;
  }

  return isTruthy(process.env.OIDC_REQUIRE_HOSTED_DOMAIN);
}

function extractDomain(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return null;
  }

  return email.split('@').pop().trim().toLowerCase();
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
          reject(new Error(`HTTP ${response.statusCode}`));
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
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

function postForm(url, formBody) {
  const body = new URLSearchParams(formBody).toString();
  const parsedUrl = new URL(url);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (response) => {
        let rawData = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          rawData += chunk;
        });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            return reject(new Error(`Token exchange failed: HTTP ${response.statusCode} ${rawData}`));
          }

          try {
            resolve(JSON.parse(rawData));
          } catch (error) {
            reject(new Error(`Failed to parse token response: ${error.message}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function getGoogleCerts(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedCerts && now < cachedCertsExpireAt) {
    return cachedCerts;
  }

  if (!forceRefresh && inFlightCertFetch) {
    return inFlightCertFetch;
  }

  inFlightCertFetch = (async () => {
    const { body, cacheControl } = await fetchJson(GOOGLE_CERTS_URL);
    cachedCerts = body;
    cachedCertsExpireAt = Date.now() + parseMaxAge(cacheControl);
    return cachedCerts;
  })();

  try {
    return await inFlightCertFetch;
  } finally {
    inFlightCertFetch = null;
  }
}

function buildCallbackUrl(req, callbackUrlOverride = '') {
  if (callbackUrlOverride) {
    return callbackUrlOverride.trim();
  }

  if (process.env.GOOGLE_OIDC_CALLBACK_URL) {
    return process.env.GOOGLE_OIDC_CALLBACK_URL.trim();
  }

  const protocol = req.protocol || 'https';
  const host = req.get('host');
  return `${protocol}://${host}/api/v1/oidc/google/callback`;
}

function getOidcConfig(req, options = {}) {
  const clientId = String(process.env.GOOGLE_OIDC_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OIDC_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Google OIDC client credentials are not configured.');
  }

  return {
    clientId,
    clientSecret,
    callbackUrl: buildCallbackUrl(req, options.callbackUrl || '')
  };
}

function createStateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: STATE_TTL_SECONDS
  });
}

function verifyStateToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256']
  });
}

function buildGoogleLoginUrl(req, returnTo, options = {}) {
  const safeReturnUrl = getSafeReturnUrl(returnTo);
  if (!safeReturnUrl) {
    throw new Error('return_to must match an allowed frontend origin.');
  }

  const { clientId, callbackUrl } = getOidcConfig(req, options);
  const nonce = jwt.sign(
    {
      type: 'oidc_nonce',
      iat_ms: Date.now()
    },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL_SECONDS }
  );
  const state = createStateToken({
    provider: 'google_oidc',
    return_to: safeReturnUrl,
    nonce
  });

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

async function exchangeCodeForTokens(req, code, options = {}) {
  const { clientId, clientSecret, callbackUrl } = getOidcConfig(req, options);

  return postForm(GOOGLE_TOKEN_ENDPOINT, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code'
  });
}

async function verifyGoogleIdToken(req, idToken, expectedNonce) {
  const { clientId } = getOidcConfig(req);
  const decoded = jwt.decode(idToken, { complete: true });

  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Malformed Google ID token.');
  }

  if (decoded.header.alg !== 'RS256') {
    throw new Error(`Unexpected Google ID token alg: ${decoded.header.alg}`);
  }

  let certs = await getGoogleCerts();
  let publicKey = certs[decoded.header.kid];

  if (!publicKey) {
    certs = await getGoogleCerts(true);
    publicKey = certs[decoded.header.kid];
  }

  if (!publicKey) {
    throw new Error(`Unknown Google certificate key id: ${decoded.header.kid}`);
  }

  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    clockTolerance: 5
  });

  if (!payload.email || payload.email_verified !== true) {
    throw new Error('Google account email is missing or not verified.');
  }

  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('OIDC nonce verification failed.');
  }

  return payload;
}

function normalizeGoogleIdentity(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const emailDomain = extractDomain(email);
  const hostedDomain = String(payload.hd || '').trim().toLowerCase() || null;
  const allowedDomains = getAllowedDomains();

  if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
    throw new Error('Your Google account domain is not allowed.');
  }

  if (isHostedDomainRequired() && allowedDomains.length > 0 && !allowedDomains.includes(hostedDomain)) {
    throw new Error('Your Google Workspace hosted domain is not allowed.');
  }

  return {
    email,
    hosted_domain: hostedDomain,
    auth_provider: 'google_oidc',
    google_sub: payload.sub || null,
    name: payload.name || null,
    picture: payload.picture || null
  };
}

module.exports = {
  buildGoogleLoginUrl,
  createStateToken,
  exchangeCodeForTokens,
  extractDomain,
  getAllowedDomains,
  getOidcConfig,
  getSafeReturnUrl,
  isHostedDomainRequired,
  isTruthy,
  normalizeGoogleIdentity,
  verifyGoogleIdToken,
  verifyStateToken
};
