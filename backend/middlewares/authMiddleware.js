const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // ✅ แก้ไข: ลองอ่านจาก Cookie ทั้ง 2 ชื่อ (sci_session_token คือตัวหลักที่ใช้ในโปรเจกต์นี้)
  let token = req.cookies.sci_session_token || req.cookies.session_token;

  // 2. ถ้าไม่มีใน Cookie ลองดูใน Header (เผื่อกรณี Client ไม่รองรับ Cookie)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.log('❌ Auth Failed: No token found in cookies or headers');
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.session = decoded; // { session_id: '...', iat: ... }
    next();
  } catch (err) {
    console.error('❌ Auth Error:', err.message);
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};