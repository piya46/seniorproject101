const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // ✅ 1. ลองอ่านจาก Cookie ก่อน (วิธีหลัก)
  let token = req.cookies.session_token;

  // 2. ถ้าไม่มีใน Cookie ลองดูใน Header (เผื่อกรณี Client ไม่รองรับ Cookie)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.session = decoded; // { session_id: '...', iat: ... }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};