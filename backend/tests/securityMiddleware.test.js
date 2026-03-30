const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DB_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const securityMiddleware = require('../middlewares/securityMiddleware');

function createResponseDouble() {
  return {
    statusCode: 200,
    jsonPayload: null,
    sendPayload: null,
    locals: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
    send(payload) {
      this.sendPayload = payload;
      return this;
    },
    type() {
      return this;
    }
  };
}

test('security middleware allows plaintext logout only after CSRF succeeds', async () => {
  const req = {
    method: 'POST',
    path: '/api/v1/oidc/logout',
    headers: {
      'x-csrf-token': 'csrf-token'
    },
    cookies: {
      sci_session_token: 'session-token',
      sci_csrf_token: 'csrf-token'
    },
    body: {},
    log: {
      warn() {},
      error() {}
    }
  };
  const res = createResponseDouble();

  let nextCalled = false;
  await securityMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, null);
});

test('security middleware still blocks other plaintext POST requests', async () => {
  const req = {
    method: 'POST',
    path: '/api/v1/chat/recommend',
    headers: {
      'x-csrf-token': 'csrf-token'
    },
    cookies: {
      sci_session_token: 'session-token',
      sci_csrf_token: 'csrf-token'
    },
    body: {},
    log: {
      warn() {},
      error() {}
    }
  };
  const res = createResponseDouble();

  let nextCalled = false;
  await securityMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonPayload, {
    error: 'Access Denied',
    message: 'This API requires Encryption. Please encrypt your payload.'
  });
});
