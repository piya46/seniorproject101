const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');
const { checkAndMarkNonce } = require('../utils/dbUtils'); // ✅ Import ฟังก์ชันใหม่
const { isAllowedBrowserOrigin } = require('../utils/browserOrigin');

const MULTIPART_ALLOWED_PATHS = new Set([
    '/api/v1/upload',
    '/api/v1/support/technical-email'
]);

function isMultipartRequest(req) {
    const contentType = req.headers['content-type'];
    return typeof contentType === 'string' && contentType.includes('multipart/form-data');
}

function buildEncryptedResponseData(data) {
    const timestamped = { _ts: Date.now() };

    if (Buffer.isBuffer(data)) {
        return { ...timestamped, payload_base64: data.toString('base64') };
    }

    if (typeof data === 'string') {
        return { ...timestamped, message: data };
    }

    if (data && typeof data === 'object') {
        return { ...data, _ts: Date.now() };
    }

    return { ...timestamped, value: data };
}

module.exports = async (req, res, next) => { // ✅ เปลี่ยนเป็น async function
    if (isMultipartRequest(req)) {
        if (!MULTIPART_ALLOWED_PATHS.has(req.path)) {
            console.warn(`⛔ Blocked unexpected multipart request to ${req.path} from IP ${req.ip}`);
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'multipart/form-data is only allowed for approved upload endpoints.'
            });
        }

        if (!isAllowedBrowserOrigin(req, { requireHeader: true })) {
            console.warn(`⛔ Blocked multipart request with invalid browser origin to ${req.path} from IP ${req.ip}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Origin is not allowed for multipart browser requests.'
            });
        }

        return next();
    }
    
    const ENCRYPTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

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
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (data) {
        if (res.locals.sessionKey) {
            try {
                const encryptedResponse = encryptSymmetric(
                    buildEncryptedResponseData(data),
                    res.locals.sessionKey
                );
                res.locals.__skipEncryptedSend = true;
                return originalJson.call(this, encryptedResponse);
            } catch (err) {
                console.error('Response Encryption Error:', err);
                res.locals.__skipEncryptedSend = true;
                this.status(500);
                return originalSend.call(this, 'Internal Security Error');
            } finally {
                res.locals.__skipEncryptedSend = false;
            }
        }
        return originalJson.call(this, data);
    };

    res.send = function (data) {
        if (res.locals.__skipEncryptedSend || !res.locals.sessionKey) {
            return originalSend.call(this, data);
        }

        try {
            const encryptedResponse = encryptSymmetric(
                buildEncryptedResponseData(data),
                res.locals.sessionKey
            );
            res.locals.__skipEncryptedSend = true;
            this.type('application/json');
            return originalSend.call(this, JSON.stringify(encryptedResponse));
        } catch (err) {
            console.error('Response Send Encryption Error:', err);
            res.locals.__skipEncryptedSend = true;
            this.status(500);
            return originalSend.call(this, 'Internal Security Error');
        } finally {
            res.locals.__skipEncryptedSend = false;
        }
    };

    next();
};
