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
  
  const fullConfig = getFormConfig(form_code, degree_level, sub_type);
  
  if (!fullConfig) {
    return res.status(404).json({ error: "Form not found" });
  }

  const publicDocuments = fullConfig.required_documents.map(doc => {
      const { validation_criteria, ...publicInfo } = doc; 
      return publicInfo;
  });

  const publicConfig = {
      ...fullConfig,
      required_documents: publicDocuments
  };

  res.json(publicConfig);
});

module.exports = router;