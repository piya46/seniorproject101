const crypto = require('crypto');

const SAFE_TOKEN_METRIC_FIELDS = new Set([
  'prompt_tokens',
  'candidate_tokens',
  'total_tokens',
  'used_tokens',
  'daily_limit'
]);

const redactValue = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.length > 400 ? `${value.slice(0, 397)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (typeof value === 'object') {
    const redacted = {};

    for (const [key, innerValue] of Object.entries(value)) {
      if (SAFE_TOKEN_METRIC_FIELDS.has(key)) {
        redacted[key] = redactValue(innerValue);
        continue;
      }

      if (/token|secret|password|authorization|cookie|encKey|payload_base64/i.test(key)) {
        redacted[key] = '[REDACTED]';
        continue;
      }

      redacted[key] = redactValue(innerValue);
    }

    return redacted;
  }

  return value;
};

const baseLog = (level, event, payload = {}) => {
  const entry = redactValue({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload
  });

  const serialized = JSON.stringify(entry);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

const createRequestLogger = (req) => {
  const getRequestContext = () => ({
    request_id: req.requestId,
    method: req.method,
    route: req.originalUrl || req.url,
    path: req.path,
    ip: req.ip,
    session_id: req.user?.session_id || null,
    user_email: req.user?.email || null
  });

  return {
    debug(event, payload = {}) {
      baseLog('debug', event, { ...getRequestContext(), ...payload });
    },
    info(event, payload = {}) {
      baseLog('info', event, { ...getRequestContext(), ...payload });
    },
    warn(event, payload = {}) {
      baseLog('warn', event, { ...getRequestContext(), ...payload });
    },
    error(event, payload = {}) {
      baseLog('error', event, { ...getRequestContext(), ...payload });
    },
    audit(event, payload = {}) {
      baseLog('info', event, { ...getRequestContext(), audit: true, ...payload });
    }
  };
};

const generateRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString('hex');
};

module.exports = {
  baseLog,
  createRequestLogger,
  generateRequestId
};
