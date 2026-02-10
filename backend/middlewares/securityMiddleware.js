const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');

// ✅ SECURITY UPGRADE: In-Memory Replay Cache (ใช้ Map เพื่อประสิทธิภาพสูงสุด)
// เก็บ Nonce ที่ใช้ไปแล้ว และจะลบทิ้งอัตโนมัติเมื่อหมดเวลา
const usedNonces = new Map();

// ฟังก์ชันล้าง Nonce ที่หมดอายุ (Run ทุก 60 วินาที)
setInterval(() => {
    const now = Date.now();
    for (const [nonce, expireTime] of usedNonces) {
        if (now > expireTime) usedNonces.delete(nonce);
    }
}, 60 * 1000);

module.exports = (req, res, next) => {
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

            // ✅ 2. [UPGRADE] Anti-Replay Attack Protection (Timestamp + Nonce)
            const REQUEST_MAX_AGE = 15 * 1000; // 15 วินาที
            const now = Date.now();

            // 2.1 ตรวจสอบ Timestamp
            if (!data._ts || typeof data._ts !== 'number') {
                 console.warn(`⚠️ Security Alert: Missing timestamp in payload from IP ${req.ip}`);
                 return res.status(400).json({ error: 'Security Error', message: 'Missing timestamp (_ts).' });
            }

            if (now - data._ts > REQUEST_MAX_AGE) {
                console.warn(`⚠️ Replay Attack Detected: Expired timestamp from IP ${req.ip}`);
                return res.status(403).json({ error: 'Security Error', message: 'Request expired. Please sync your clock.' });
            }

            if (data._ts > now + 5000) {
                 return res.status(400).json({ error: 'Security Error', message: 'Invalid timestamp (future).' });
            }

            // 2.2 ตรวจสอบ Nonce (ต้อง Unique ภายในช่วงเวลา 15 วินาที)
            if (!data.nonce) {
                // ถ้า Client ยังไม่แก้ให้ส่ง Nonce อาจจะอนุโลมช่วงแรก แต่เพื่อ High Security ควร Reject
                console.warn(`⚠️ Security Alert: Missing Nonce from IP ${req.ip}`);
                return res.status(400).json({ error: 'Security Error', message: 'Missing unique nonce.' });
            }

            if (usedNonces.has(data.nonce)) {
                console.warn(`🔥 Replay Attack BLOCKED: Duplicate Nonce ${data.nonce} from IP ${req.ip}`);
                return res.status(403).json({ error: 'Security Error', message: 'Replay detected (Duplicate Nonce).' });
            }

            // บันทึก Nonce ลง Cache (หมดอายุตามเวลา Max Age)
            usedNonces.set(data.nonce, now + REQUEST_MAX_AGE);

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

    // --- 3. เข้ารหัสข้อมูลขากลับ (Outbound) ---
    const originalJson = res.json;
    res.json = function (data) {
        if (res.locals.sessionKey) {
            try {
                // ตอบกลับพร้อม Timestamp และ Nonce ใหม่ (ถ้าจำเป็น)
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