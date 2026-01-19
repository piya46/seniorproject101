const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');

module.exports = (req, res, next) => {
    // กำหนด Method ที่บังคับต้องเข้ารหัส
    const ENCRYPTED_METHODS = ['POST', 'PUT', 'PATCH'];

    // --- 1. ตรวจสอบและถอดรหัส (Inbound) ---
    if (ENCRYPTED_METHODS.includes(req.method)) {
        
        // เช็คว่ามี Body และมีโครงสร้างการเข้ารหัสครบไหม (encKey + payload)
        if (req.body && req.body.encKey && req.body.payload) {
            
            // ✅ มีการเข้ารหัสมา -> พยายามถอดรหัส
            const result = decryptHybridPayload(req.body);
            
            if (!result) {
                // กรณี Key ผิด หรือข้อมูลถูกดัดแปลงกลางทาง
                console.warn(`⚠️ Security Alert: Decryption failed from IP ${req.ip}`);
                return res.status(400).json({ 
                    error: 'Security Error', 
                    message: 'Decryption failed. Data may be tampered.' 
                });
            }

            // ถอดรหัสสำเร็จ: แทนที่ Body เดิมด้วยข้อมูลจริง
            req.body = result.data;
            res.locals.sessionKey = result.aesKey; // เก็บ Key ไว้ตอบกลับ

        } else {
            // ❌ ไม่มีการเข้ารหัสมา (Plaintext) -> REJECT ทันที!
            console.warn(`⛔ Blocked unencrypted request to ${req.path} from IP ${req.ip}`);
            
            // if(req.path === '/api/v1/session/init') return next;
            // ข้อยกเว้น: ถ้าต้องการปล่อยบาง Path ให้รับ Plaintext ได้ (เช่น Webhook) ให้ใส่ตรงนี้
            // if (req.path === '/api/v1/webhook') return next();

            return res.status(403).json({ 
                error: 'Access Denied', 
                message: 'This API requires Encryption. Please encrypt your payload.' 
            });
        }
    }

    // --- 2. เข้ารหัสข้อมูลขากลับ (Outbound) ---
    const originalJson = res.json;
    res.json = function (data) {

        if (res.locals.sessionKey) {
            try {
                const encryptedResponse = encryptSymmetric(data, res.locals.sessionKey);
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