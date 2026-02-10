const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // ✅ Clean: อ่านแค่ชื่อเดียวที่ถูกต้อง
  let token = req.cookies.sci_session_token;

  // Fallback: กรณี Client ไม่รองรับ Cookie (เช่น Mobile App ในอนาคต)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    // 401 Unauthorized
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  try {
    // ✅ Security Fix: ระบุ Algorithm ให้ชัดเจน (HS256) ป้องกัน Downgrade Attack
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'] 
    });
    
    req.session = decoded; 
    next();
  } catch (err) {
    // 403 Forbidden (Token ผิดหรือหมดอายุ)
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};