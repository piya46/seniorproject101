const express = require('express');
const router = express.Router();
const { forms, getFormConfig } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 * - name: Forms
 * description: ข้อมูลแบบฟอร์มและเงื่อนไข
 */

/**
 * @swagger
 * /forms:
 * get:
 * summary: ดึงรายชื่อฟอร์มทั้งหมด
 * tags: [Forms]
 * parameters:
 * - in: query
 * name: degree_level
 * schema:
 * type: string
 * enum: [bachelor, graduate]
 * description: กรองตามระดับการศึกษา
 * responses:
 * 200:
 * description: รายการฟอร์ม
 * 401:
 * description: Unauthorized
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, (req, res) => {
  const { degree_level } = req.query;
  const availableForms = forms.filter(f => !degree_level || f.degree_level.includes(degree_level));
  res.json({ data: availableForms });
});

/**
 * @swagger
 * /forms/{form_code}:
 * get:
 * summary: ดึงรายละเอียดเอกสารที่ต้องใช้ (Config)
 * tags: [Forms]
 * parameters:
 * - in: path
 * name: form_code
 * required: true
 * schema:
 * type: string
 * - in: query
 * name: degree_level
 * schema:
 * type: string
 * - in: query
 * name: sub_type
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Config ของฟอร์มและรายการเอกสารที่ต้องใช้
 * 404:
 * description: ไม่พบฟอร์มดังกล่าว
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * 401:
 * description: Unauthorized
 */
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