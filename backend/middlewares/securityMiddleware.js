const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');

module.exports = (req, res, next) => {
    // กำหนด Method ที่บังคับต้องเข้ารหัสขาเข้า (Inbound)
    const ENCRYPTED_METHODS = ['POST', 'PUT', 'PATCH'];

    // --- 1. ตรวจสอบและถอดรหัส (Inbound) ---
    if (ENCRYPTED_METHODS.includes(req.method)) {
        
        if (req.body && req.body.encKey && req.body.payload) {
            
            // ✅ 1. พยายามถอดรหัส
            const result = decryptHybridPayload(req.body);
            
            if (!result) {
                console.warn(`⚠️ Security Alert: Decryption failed from IP ${req.ip}`);
                return res.status(400).json({ 
                    error: 'Security Error', 
                    message: 'Decryption failed. Data may be tampered.' 
                });
            }

            const { data, aesKey } = result;

            // ✅ 2. [FIXED] Anti-Replay Attack Protection
            // ลดเวลาเหลือ 15 วินาที (จากเดิม 60s) เพื่อความปลอดภัยสูงสุด
            const REQUEST_MAX_AGE = 15 * 1000; 
            const now = Date.now();

            if (!data._ts || typeof data._ts !== 'number') {
                 console.warn(`⚠️ Security Alert: Missing timestamp in payload from IP ${req.ip}`);
                 return res.status(400).json({ error: 'Security Error', message: 'Missing timestamp (_ts) in encrypted payload.' });
            }

            if (now - data._ts > REQUEST_MAX_AGE) {
                console.warn(`⚠️ Replay Attack Detected: Expired timestamp from IP ${req.ip}`);
                return res.status(403).json({ error: 'Security Error', message: 'Request expired. Please sync your clock.' });
            }

            // (Optional) Future timestamp check (กันคนตั้งเวลาล่วงหน้าเกิน 5 วิ)
            if (data._ts > now + 5000) {
                 return res.status(400).json({ error: 'Security Error', message: 'Invalid timestamp (future).' });
            }

            // ถอดรหัสสำเร็จ & ผ่าน Security Check: แทนที่ Body เดิม
            req.body = data;
            res.locals.sessionKey = aesKey; 

        } else {
            // ❌ ไม่มีการเข้ารหัสมา (Plaintext) -> REJECT
            console.warn(`⛔ Blocked unencrypted request to ${req.path} from IP ${req.ip}`);
            return res.status(403).json({ 
                error: 'Access Denied', 
                message: 'This API requires Encryption. Please encrypt your payload.' 
            });
        }
    }

    // --- 3. เข้ารหัสข้อมูลขากลับ (Outbound) ---
    const originalJson = res.json;
    res.json = function (data) {

        // จะเข้ารหัสขากลับได้ ต้องมี sessionKey (ซึ่งได้มาจากการ Decrypt Request ขาเข้า)
        // หมายเหตุ: GET Request จะไม่มี sessionKey ทำให้ Response เป็น Plaintext (ถ้าต้องการ E2EE ขา GET ต้องเปลี่ยนเป็น POST)
        if (res.locals.sessionKey) {
            try {
                // ตอบกลับพร้อม Timestamp ใหม่
                const responseData = typeof data === 'object' ? { ...data, _ts: Date.now() } : data;
                
                const encryptedResponse = encryptSymmetric(responseData, res.locals.sessionKey);
                return originalJson.call(this, encryptedResponse);
            } catch (err) {
                console.error('Response Encryption Error:', err);
                return res.status(500).send('Internal Security Error');
            }
        }
        
        return originalJson.call(this, data);
    };

    next();
};