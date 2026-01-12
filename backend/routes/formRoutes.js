const express = require('express');
const router = express.Router();
const { forms, getFormConfig } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, (req, res) => {
  const { degree_level } = req.query;
  const availableForms = forms.filter(f => !degree_level || f.degree_level.includes(degree_level));
  res.json({ data: availableForms });
});

router.get('/:form_code', authMiddleware, (req, res) => {
  const { form_code } = req.params;
  const { degree_level, sub_type } = req.query;
  const config = getFormConfig(form_code, degree_level, sub_type);
  res.json(config);
});

module.exports = router;