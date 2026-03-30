const test = require('node:test');
const assert = require('node:assert/strict');

const { validate } = require('../middlewares/validationMiddleware');
const { chatRecommendSchema } = require('../validators/schemas');

test('validate assigns parsed body defaults back onto req.body', () => {
  const middleware = validate(chatRecommendSchema);
  const req = {
    body: {
      _ts: Date.now(),
      nonce: 'nonce-1',
      message: 'hello'
    },
    ip: '127.0.0.1'
  };
  const res = {};

  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.body.degree_level, 'bachelor');
});
