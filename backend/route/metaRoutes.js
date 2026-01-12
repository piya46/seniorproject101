const express = require('express');
const router = express.Router();
const { departments } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

// 3.1 GET /departments
router.get('/', authMiddleware, (req, res) => {
  res.json({ data: departments });
});

module.exports = router;
