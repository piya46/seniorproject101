function isTruthy(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parseTrustProxySetting(rawValue = process.env.TRUST_PROXY) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return 1;
  }

  const normalized = String(rawValue).trim();
  const lower = normalized.toLowerCase();

  if (lower === 'true') {
    return true;
  }

  if (lower === 'false') {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  if (normalized.includes(',')) {
    return normalized
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return normalized;
}

function getCookieSameSitePolicy() {
  const configured = String(process.env.COOKIE_SAME_SITE || '').trim().toLowerCase();

  if (configured === 'strict' || configured === 'lax' || configured === 'none') {
    return configured[0].toUpperCase() + configured.slice(1);
  }

  return process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
}

function shouldUseSecureCookies() {
  const explicit = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();

  if (explicit === 'true') {
    return true;
  }

  if (explicit === 'false') {
    return getCookieSameSitePolicy() === 'None';
  }

  return process.env.NODE_ENV === 'production' || getCookieSameSitePolicy() === 'None';
}

module.exports = {
  getCookieSameSitePolicy,
  isTruthy,
  parseTrustProxySetting,
  shouldUseSecureCookies
};
