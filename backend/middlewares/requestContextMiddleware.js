const { createRequestLogger, generateRequestId } = require('../utils/logger');

module.exports = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  req.startedAt = Date.now();
  req.log = createRequestLogger(req);

  res.setHeader('X-Request-Id', req.requestId);

  res.on('finish', () => {
    req.log.info('request_completed', {
      status_code: res.statusCode,
      duration_ms: Date.now() - req.startedAt
    });
  });

  next();
};
