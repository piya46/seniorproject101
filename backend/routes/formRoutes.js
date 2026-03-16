// backend/routes/formRoutes.js

const express = require('express');
const router = express.Router();
const { forms, getFormConfig } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');


router.get('/', authMiddleware, (req, res) => {
  const { degree_level } = req.query;
  
  // Filter คำร้องตามระดับการศึกษา (ป.ตรี หรือ บัณฑิตศึกษา)
  let availableForms = forms.filter(f => !degree_level || f.degree_level.includes(degree_level));
  
  // แก้ไขข้อ 3: Sort ลำดับฟอร์มตามเลข จท.
  availableForms.sort((a, b) => {
    // ใช้ Regular Expression ปอกเอาเฉพาะตัวเลขออกมาจาก form_code (เช่น 'JT31' จะได้ 31)
    // ถ้าดึงตัวเลขไม่ได้ (เช่น 'CF') จะถูกเซ็ตเป็นค่า Infinity เพื่อให้เด้งไปอยู่ล่างสุดของ List
    const numA = parseInt(a.form_code.replace(/\D/g, '')) || Infinity;
    const numB = parseInt(b.form_code.replace(/\D/g, '')) || Infinity;
    
    // เรียงจากน้อยไปมาก
    return numA - numB;
  });

  res.json({ data: availableForms });
});

router.get('/:form_code', authMiddleware, (req, res) => {
  const { form_code } = req.params;
  const { degree_level, sub_type } = req.query;
  
  const fullConfig = getFormConfig(form_code, degree_level, sub_type);
  
  if (!fullConfig) {
    return res.status(404).json({ error: "Form not found" });
  }

  const {
    required_documents = [],
    approval_requirements = [],
    case_rules = [],
    ...publicInfo
  } = fullConfig;

  // แยก validation_criteria ออกจากเอกสารแต่ละตัว
  const publicDocuments = required_documents.map(doc => {
      const { validation_criteria, ...safeDoc } = doc; 
      return safeDoc;
  });

  const publicCaseRules = case_rules.map((rule) => ({
      key: rule.key,
      label: rule.label || rule.key,
      note: rule.note || null,
      approval_requirements: Array.isArray(rule.approval_requirements)
        ? rule.approval_requirements
        : []
  }));

  // ประกอบ Object ใหม่ที่จะส่งกลับไป
  const publicConfig = {
      ...publicInfo,
      approval_requirements,
      case_rules: publicCaseRules,
      required_documents: publicDocuments
  };

  res.json(publicConfig);
});

module.exports = router;
