const express = require('express');
const router = express.Router();
const { departments } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, (req, res) => {
  res.json({ data: departments });
});

module.exports = router;