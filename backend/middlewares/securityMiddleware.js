const { decryptHybridPayload, encryptSymmetric } = require('../utils/cryptoUtils');

module.exports = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && req.body.encKey && req.body.payload) {
        const result = decryptHybridPayload(req.body);
        
        if (!result) {
            return res.status(400).json({ error: 'Security Error', message: 'Decryption failed or invalid key' });
        }

        req.body = result.data; 
        res.locals.sessionKey = result.aesKey; 
    }

    const originalJson = res.json;
    res.json = function (data) {
        if (res.locals.sessionKey) {
            try {
                const encryptedData = encryptSymmetric(data, res.locals.sessionKey);
                return originalJson.call(this, encryptedData);
            } catch (err) {
                console.error('Response Encryption Error:', err);
                return res.status(500).send('Internal Security Error');
            }
        }
        return originalJson.call(this, data);
    };

    next();
};