const express = require('express');
const router = express.Router();
const { departments } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 * - name: Meta
 * description: ข้อมูลพื้นฐานระบบ
 */

/**
 * @swagger
 * /departments:
 * get:
 * summary: ดึงรายชื่อภาควิชาและอีเมล
 * tags: [Meta]
 * responses:
 * 200:
 * description: รายชื่อภาควิชา
 * 401:
 * description: Unauthorized
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, (req, res) => {
  res.json({ data: departments });
});

module.exports = router;