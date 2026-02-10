const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // ✅ Clean: อ่าน Token จาก Cookie เป็นหลัก
  let token = req.cookies.sci_session_token;

  // Fallback: รองรับ Bearer Token กรณี Client ไม่ได้ใช้ Cookie
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    // 401 Unauthorized
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  try {
    // ✅ Security Fix: ระบุ Algorithm (HS256) ป้องกัน Downgrade Attack
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'] 
    });
    
 
    req.user = decoded; 
    next();
  } catch (err) {
    // 403 Forbidden (Token ผิดหรือหมดอายุ)
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};