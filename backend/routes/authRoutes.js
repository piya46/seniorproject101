// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { getPublicKey } = require('../utils/cryptoUtils');

router.get('/public-key', (req, res) => {
    const key = getPublicKey();
    if (!key) return res.status(500).json({ error: 'Public Key not available' });
    res.json({ publicKey: key });
});

module.exports = router;