// backend/routes/formRoutes.js

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

  // แยก conditions ออกมาเพื่อไม่ให้ส่งไป Frontend
  const { conditions, required_documents, ...publicInfo } = fullConfig;

  // แยก validation_criteria ออกจากเอกสารแต่ละตัว
  const publicDocuments = required_documents.map(doc => {
      const { validation_criteria, ...safeDoc } = doc; 
      return safeDoc;
  });

  // ประกอบ Object ใหม่ที่จะส่งกลับไป
  const publicConfig = {
      ...publicInfo,
      required_documents: publicDocuments
  };

  res.json(publicConfig);
});

module.exports = router;