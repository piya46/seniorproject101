const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { ensureCsrfCookie } = require('../utils/csrfUtils');
const { getPublicKey } = require('../utils/cryptoUtils');

router.get('/public-key', (req, res) => {
    const key = getPublicKey();
    if (!key) return res.status(500).json({ error: 'Public Key not available' });
    res.json({ publicKey: key });
});

router.get('/csrf-token', authMiddleware, (req, res) => {
    const csrfToken = ensureCsrfCookie(req, res);

    req.log?.audit('csrf_token_issued');

    res.json({
        csrf_token: csrfToken
    });
});

module.exports = router;
