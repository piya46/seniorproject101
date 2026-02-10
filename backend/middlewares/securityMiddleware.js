const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');
const { checkAndMarkNonce } = require('../utils/dbUtils'); // ✅ Import ฟังก์ชันใหม่

module.exports = async (req, res, next) => { // ✅ เปลี่ยนเป็น async function
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        return next();
    }
    
    const ENCRYPTED_METHODS = ['POST', 'PUT', 'PATCH'];

    // --- 1. ตรวจสอบและถอดรหัส (Inbound) ---
    if (ENCRYPTED_METHODS.includes(req.method)) {
        
        if (req.body && req.body.encKey && req.body.payload) {
            
            // 1.1 พยายามถอดรหัส
            const result = decryptHybridPayload(req.body);
            
            if (!result) {
                console.warn(`⚠️ Security Alert: Decryption failed from IP ${req.ip}`);
                return res.status(400).json({ 
                    error: 'Security Error', 
                    message: 'Decryption failed. Data may be tampered.' 
                });
            }

            const { data, aesKey } = result;

            // 1.2 ตรวจสอบ Replay Attack (Timestamp + Nonce)
            const REQUEST_MAX_AGE = 15; // 15 วินาที
            const now = Date.now();

            // เช็ค Timestamp
            if (!data._ts || typeof data._ts !== 'number') {
                 console.warn(`⚠️ Security Alert: Missing timestamp in payload from IP ${req.ip}`);
                 return res.status(400).json({ error: 'Security Error', message: 'Missing timestamp (_ts).' });
            }

            if (now - data._ts > REQUEST_MAX_AGE * 1000) {
                console.warn(`⚠️ Replay Attack Detected: Expired timestamp from IP ${req.ip}`);
                return res.status(403).json({ error: 'Security Error', message: 'Request expired. Please sync your clock.' });
            }

            if (data._ts > now + 5000) { // เผื่อ Clock เหลื่อมได้นิดหน่อย (Future date check)
                 return res.status(400).json({ error: 'Security Error', message: 'Invalid timestamp (future).' });
            }

            // เช็ค Nonce
            if (!data.nonce) {
                console.warn(`⚠️ Security Alert: Missing Nonce from IP ${req.ip}`);
                return res.status(400).json({ error: 'Security Error', message: 'Missing unique nonce.' });
            }

            // ✅ เรียกเช็คกับ Firestore (แทน Map เดิม)
            const isNonceValid = await checkAndMarkNonce(data.nonce, REQUEST_MAX_AGE);

            if (!isNonceValid) {
                console.warn(`🔥 Replay Attack BLOCKED: Duplicate Nonce ${data.nonce} from IP ${req.ip}`);
                return res.status(403).json({ error: 'Security Error', message: 'Replay detected (Duplicate Nonce).' });
            }

            // ถอดรหัสสำเร็จ & ผ่าน Security Check: แทนที่ Body เดิม
            req.body = data;
            res.locals.sessionKey = aesKey; 

        } else {
            console.warn(`⛔ Blocked unencrypted request to ${req.path} from IP ${req.ip}`);
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
                // ตอบกลับพร้อม Timestamp (Nonce ขากลับอาจไม่จำเป็นถ้า Client ไม่ได้เช็ค)
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