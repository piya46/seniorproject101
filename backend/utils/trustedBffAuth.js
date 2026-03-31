const crypto = require('crypto');

const TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN_ENV = 'TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN';
const TRUSTED_BFF_IDENTITY_TOKEN_HEADER_ENV = 'TRUSTED_BFF_IDENTITY_TOKEN_HEADER';
const TRUSTED_BFF_EXPECTED_SERVICE_ACCOUNT_EMAIL_ENV = 'TRUSTED_BFF_EXPECTED_SERVICE_ACCOUNT_EMAIL';
const TRUSTED_BFF_IDENTITY_TOKEN_AUDIENCE_ENV = 'TRUSTED_BFF_IDENTITY_TOKEN_AUDIENCE';

let identityTokenVerifierOverride = null;

function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

function isTrustedBffAuthEnabled() {
  return isTruthy(process.env.TRUSTED_BFF_AUTH_ENABLED || 'false');
}

function isTrustedBffIdentityTokenRequired() {
  return isTruthy(process.env[TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN_ENV] || 'false');
}

function getTrustedBffHeaderName() {
  return String(process.env.TRUSTED_BFF_AUTH_HEADER_NAME || 'x-bff-auth').trim().toLowerCase();
}

function getTrustedBffIdentityTokenHeaderName() {
  return String(process.env[TRUSTED_BFF_IDENTITY_TOKEN_HEADER_ENV] || 'x-bff-identity-token')
    .trim()
    .toLowerCase();
}

function getConfiguredSharedSecret() {
  return String(process.env.TRUSTED_BFF_SHARED_SECRET || '').trim();
}

function getExpectedTrustedBffServiceAccountEmail() {
  return String(process.env[TRUSTED_BFF_EXPECTED_SERVICE_ACCOUNT_EMAIL_ENV] || '').trim().toLowerCase();
}

function getExpectedTrustedBffAudience() {
  return String(process.env[TRUSTED_BFF_IDENTITY_TOKEN_AUDIENCE_ENV] || '').trim();
}

function getProvidedTrustedBffSharedSecret(req) {
  const headerValue = req.headers?.[getTrustedBffHeaderName()];
  return typeof headerValue === 'string' ? headerValue.trim() : '';
}

function getProvidedTrustedBffIdentityToken(req) {
  const headerValue = req.headers?.[getTrustedBffIdentityTokenHeaderName()];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const authorization = req.headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return '';
}

function hasValidTrustedBffSharedSecret(req) {
  const configuredSecret = getConfiguredSharedSecret();
  const providedSecret = getProvidedTrustedBffSharedSecret(req);

  if (!configuredSecret || !providedSecret) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);

  try {
    return (
      configuredBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(configuredBuffer, providedBuffer)
    );
  } finally {
    configuredBuffer.fill(0);
    providedBuffer.fill(0);
  }
}

async function defaultIdentityTokenVerifier({ token, audience }) {
  const { OAuth2Client } = require('google-auth-library');
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience
  });

  return ticket.getPayload() || null;
}

function setTrustedBffIdentityTokenVerifierForTests(verifier) {
  identityTokenVerifierOverride = verifier || null;
}

async function verifyTrustedBffIdentityToken(req) {
  const token = getProvidedTrustedBffIdentityToken(req);
  const required = isTrustedBffIdentityTokenRequired();

  if (!token) {
    return required
      ? { ok: false, reason: 'missing_identity_token' }
      : { ok: true, skipped: true, payload: null };
  }

  const audience = getExpectedTrustedBffAudience();
  if (!audience) {
    return required
      ? { ok: false, reason: 'missing_identity_token_audience' }
      : { ok: true, skipped: true, payload: null };
  }

  const verifier = identityTokenVerifierOverride || defaultIdentityTokenVerifier;

  try {
    const payload = await verifier({ token, audience, req });
    const expectedEmail = getExpectedTrustedBffServiceAccountEmail();
    const actualEmail = String(payload?.email || '').trim().toLowerCase();

    if (expectedEmail && actualEmail !== expectedEmail) {
      return required
        ? { ok: false, reason: 'unexpected_identity_email', payload }
        : { ok: true, skipped: true, payload: null };
    }

    return { ok: true, payload };
  } catch (_error) {
    return required
      ? { ok: false, reason: 'invalid_identity_token' }
      : { ok: true, skipped: true, payload: null };
  }
}

async function resolveTrustedBffIdentity(req, options = {}) {
  const requireIdentityHeaders = options.requireIdentityHeaders !== false;

  if (!isTrustedBffAuthEnabled()) {
    return { ok: false, statusCode: 503, reason: 'disabled' };
  }

  if (!hasValidTrustedBffSharedSecret(req)) {
    return { ok: false, statusCode: 403, reason: 'invalid_shared_secret' };
  }

  const identityTokenResult = await verifyTrustedBffIdentityToken(req);
  if (!identityTokenResult.ok) {
    return { ok: false, statusCode: 403, reason: identityTokenResult.reason };
  }

  if (!requireIdentityHeaders) {
    return {
      ok: true,
      identity: null,
      attestation: identityTokenResult.payload
        ? {
            email: String(identityTokenResult.payload.email || '').trim().toLowerCase() || null,
            sub: String(identityTokenResult.payload.sub || '').trim() || null
          }
        : null
    };
  }

  const sessionId = String(req.headers['x-bff-user-session-id'] || '').trim();
  const email = String(req.headers['x-bff-user-email'] || '').trim().toLowerCase();
  const hostedDomain = String(req.headers['x-bff-user-hosted-domain'] || '').trim().toLowerCase();

  if (!/^sess_[a-f0-9]{32}$/i.test(sessionId) || !email) {
    return { ok: false, statusCode: 403, reason: 'missing_identity_headers' };
  }

  return {
    ok: true,
    identity: {
      session_id: sessionId,
      email,
      hosted_domain: hostedDomain || null,
      auth_provider: 'trusted_bff',
      google_sub: String(req.headers['x-bff-user-google-sub'] || '').trim() || null,
      name: String(req.headers['x-bff-user-name'] || '').trim() || null,
      picture: String(req.headers['x-bff-user-picture'] || '').trim() || null
    },
    attestation: identityTokenResult.payload
      ? {
          email: String(identityTokenResult.payload.email || '').trim().toLowerCase() || null,
          sub: String(identityTokenResult.payload.sub || '').trim() || null
        }
      : null
  };
}

module.exports = {
  TRUSTED_BFF_EXPECTED_SERVICE_ACCOUNT_EMAIL_ENV,
  TRUSTED_BFF_IDENTITY_TOKEN_AUDIENCE_ENV,
  TRUSTED_BFF_IDENTITY_TOKEN_HEADER_ENV,
  TRUSTED_BFF_REQUIRE_IDENTITY_TOKEN_ENV,
  getConfiguredSharedSecret,
  getExpectedTrustedBffAudience,
  getExpectedTrustedBffServiceAccountEmail,
  getProvidedTrustedBffIdentityToken,
  getProvidedTrustedBffSharedSecret,
  getTrustedBffHeaderName,
  getTrustedBffIdentityTokenHeaderName,
  hasValidTrustedBffSharedSecret,
  isTrustedBffAuthEnabled,
  isTrustedBffIdentityTokenRequired,
  isTruthy,
  resolveTrustedBffIdentity,
  setTrustedBffIdentityTokenVerifierForTests,
  verifyTrustedBffIdentityToken
};
