const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // JWT_SECRET จะถูกดึงมาจาก Env Var (ซึ่ง Cloud Run จะ Inject มาจาก Secret Manager)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.session = decoded; // { session_id: '...', iat: ... }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};
