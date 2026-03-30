const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
        req.log?.warn('validation_failed', {
            details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        });
        return res.status(400).json({ 
            error: 'Validation Error', 
            message: 'Invalid data format or missing fields.',
            details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
    }
    // กรณี Error อื่นๆ ให้ส่งต่อให้ Error Handler หลัก
    next(err);
  }
};

module.exports = { validate };
