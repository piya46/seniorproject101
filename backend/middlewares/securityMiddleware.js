const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');
const { checkAndMarkNonce } = require('../utils/dbUtils'); // ✅ Import ฟังก์ชันใหม่
const { isAllowedBrowserOrigin } = require('../utils/browserOrigin');
const { isValidCsrfToken } = require('../utils/csrfUtils');
const { wipeBuffer } = require('../utils/memorySecurity');

const MULTIPART_ALLOWED_PATHS = new Set([
    '/api/v1/upload',
    '/api/v1/support/technical-email'
]);
const UNENCRYPTED_STATE_CHANGING_ALLOWED_PATHS = new Set([
    '/api/v1/oidc/logout'
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

function requiresCsrfProtection(req) {
    const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

    return stateChangingMethods.has(req.method) && Boolean(req.cookies?.sci_session_token);
}

function allowsPlaintextStateChangingRequest(req) {
    return UNENCRYPTED_STATE_CHANGING_ALLOWED_PATHS.has(req.path);
}

module.exports = async (req, res, next) => { // ✅ เปลี่ยนเป็น async function
    const clearSessionKey = () => {
        wipeBuffer(res.locals.sessionKey);
        res.locals.sessionKey = null;
    };

    if (typeof res.once === 'function') {
        res.once('finish', clearSessionKey);
        res.once('close', clearSessionKey);
    }

    if (requiresCsrfProtection(req) && !isValidCsrfToken(req)) {
        req.log?.warn('csrf_validation_failed', {
            has_cookie_token: Boolean(req.cookies?.sci_csrf_token),
            has_header_token: typeof req.headers['x-csrf-token'] === 'string'
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'CSRF token is missing or invalid.'
        });
    }

    if (isMultipartRequest(req)) {
        if (!MULTIPART_ALLOWED_PATHS.has(req.path)) {
            req.log?.warn('unexpected_multipart_blocked');
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'multipart/form-data is only allowed for approved upload endpoints.'
            });
        }

        if (!isAllowedBrowserOrigin(req, { requireHeader: true })) {
            req.log?.warn('multipart_origin_blocked');
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
                req.log?.warn('payload_decryption_failed');
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
                 req.log?.warn('payload_timestamp_missing');
                 return res.status(400).json({ error: 'Security Error', message: 'Missing timestamp (_ts).' });
            }

            if (now - data._ts > REQUEST_MAX_AGE * 1000) {
                req.log?.warn('payload_timestamp_expired');
                return res.status(403).json({ error: 'Security Error', message: 'Request expired. Please sync your clock.' });
            }

            if (data._ts > now + 5000) { // เผื่อ Clock เหลื่อมได้นิดหน่อย (Future date check)
                 return res.status(400).json({ error: 'Security Error', message: 'Invalid timestamp (future).' });
            }

            // เช็ค Nonce
            if (!data.nonce) {
                req.log?.warn('payload_nonce_missing');
                return res.status(400).json({ error: 'Security Error', message: 'Missing unique nonce.' });
            }

            // ✅ เรียกเช็คกับ Firestore (แทน Map เดิม)
            const isNonceValid = await checkAndMarkNonce(data.nonce, REQUEST_MAX_AGE);

            if (!isNonceValid) {
                req.log?.warn('payload_replay_blocked', { nonce: data.nonce });
                return res.status(403).json({ error: 'Security Error', message: 'Replay detected (Duplicate Nonce).' });
            }

            // ถอดรหัสสำเร็จ & ผ่าน Security Check: แทนที่ Body เดิม
            req.body = data;
            res.locals.sessionKey = aesKey; 

        } else if (!allowsPlaintextStateChangingRequest(req)) {
            req.log?.warn('unencrypted_request_blocked');
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
                req.log?.error('response_encryption_error', { message: err.message });
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
            req.log?.error('response_send_encryption_error', { message: err.message });
            res.locals.__skipEncryptedSend = true;
            this.status(500);
            return originalSend.call(this, 'Internal Security Error');
        } finally {
            res.locals.__skipEncryptedSend = false;
        }
    };

    next();
};
