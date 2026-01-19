const express = require('express');
const router = express.Router();
const { getPublicKey } = require('../utils/cryptoUtils');

/**
 * @swagger
 * tags:
 * - name: Auth
 * description: ระบบความปลอดภัยและ Key Exchange
 */

/**
 * @swagger
 * /auth/public-key:
 * get:
 * summary: ขอ Public Key ของ Server
 * tags: [Auth]
 * security: []
 * description: ใช้สำหรับเข้ารหัสข้อมูล (RSA Encryption) ก่อนส่งมาที่ Server
 * responses:
 * 200:
 * description: ส่งคืน Public Key (PEM Format)
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * publicKey:
 * type: string
 * example: "-----BEGIN PUBLIC KEY-----\n..."
 * 500:
 * description: ไม่สามารถโหลด Key ได้ (Server Error)
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 */
router.get('/public-key', (req, res) => {
    const key = getPublicKey();
    if (!key) return res.status(500).json({ error: 'Public Key not available' });
    res.json({ publicKey: key });
});

module.exports = router;