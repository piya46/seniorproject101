const jwt = require('jsonwebtoken');
const { firestore, COLLECTION_NAME } = require('../utils/dbUtils'); // ✅ Import Firestore

module.exports = async (req, res, next) => { // ✅ เปลี่ยนเป็น async
  // 1. อ่าน Token จาก Cookie เป็นหลัก
  let token = req.cookies.sci_session_token;

  // Fallback: รองรับ Bearer Token
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  try {
    // 2. Verify JWT Signature & Algorithm
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'] 
    });

    if (decoded.session_id) {
        const sessionRef = await firestore.collection(COLLECTION_NAME).doc(decoded.session_id).get();
        if (!sessionRef.exists) {
            console.warn(`⛔ Security: Revoked Session Attempt ${decoded.session_id}`);
            res.clearCookie('sci_session_token'); // สั่งลบ Cookie ที่เครื่องลูกข่าย
            return res.status(401).json({ error: 'Session Revoked', message: 'Your session has been terminated.' });
        }
    }
 
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};