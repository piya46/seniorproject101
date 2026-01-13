const express = require('express');
const router = express.Router();
const { forms, getFormConfig } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

// 4.1 GET /forms
// ดึงรายชื่อฟอร์มทั้งหมด (สามารถกรองตามระดับการศึกษาได้)
router.get('/', authMiddleware, (req, res) => {
  const { degree_level } = req.query;
  // Filter forms based on degree if provided
  const availableForms = forms.filter(f => !degree_level || f.degree_level.includes(degree_level));
  res.json({ data: availableForms });
});

// 4.2 GET /forms/:form_code
// ดึงรายละเอียดเอกสารที่ต้องใช้สำหรับฟอร์มนั้นๆ
router.get('/:form_code', authMiddleware, (req, res) => {
  const { form_code } = req.params;
  const { degree_level, sub_type } = req.query;
  
  // 1. ดึง Config ตัวเต็ม (ซึ่งมี validation_criteria สำหรับ AI อยู่ด้วย)
  const fullConfig = getFormConfig(form_code, degree_level, sub_type);
  
  if (!fullConfig) {
    return res.status(404).json({ error: "Form not found" });
  }

  // 2. ✨ สร้าง Config ตัวใหม่สำหรับส่งให้ Frontend (Sanitize Data)
  // เราจะตัด 'validation_criteria' ทิ้ง เพราะหน้าบ้านไม่จำเป็นต้องใช้ และเพื่อลดขนาดข้อมูล
  const publicDocuments = fullConfig.required_documents.map(doc => {
      // เทคนิค Destructuring: แยก validation_criteria ออกไปทิ้ง เก็บส่วนที่เหลือไว้ในตัวแปร publicInfo
      const { validation_criteria, ...publicInfo } = doc; 
      return publicInfo;
  });

  // สร้าง Object ใหม่ที่จะส่งกลับไป (Clean Version)
  const publicConfig = {
      ...fullConfig,
      required_documents: publicDocuments
  };

  res.json(publicConfig);
});

module.exports = router;