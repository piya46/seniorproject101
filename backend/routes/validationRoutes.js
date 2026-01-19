const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
const { getFormConfig } = require('../data/staticData'); 

router.post('/check-completeness', authMiddleware, async (req, res) => {
  try {
    const { form_code, uploaded_files, student_level, sub_type } = req.body;
    
    // 1. Validate Input: ตรวจสอบว่ามีการส่งไฟล์มาจริง
    if (!uploaded_files || uploaded_files.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No files uploaded' });
    }

    // 2. ดึง Config ของแบบฟอร์ม
    const formConfig = getFormConfig(form_code, student_level, sub_type);

    
    if (!formConfig) {
        console.warn(`[Validation] Invalid Form Code received: ${form_code}`);
        return res.status(404).json({ 
            status: 'error', 
            message: `Form Code "${form_code}" not found in system configuration. Please check your request.` 
        });
    }

    // 3. เตรียมเกณฑ์การตรวจ (Validation Criteria)
    const criteriaMap = {};
    if (formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง ชัดเจน";
        });
    }

    // Config Google Cloud Services
    const project = process.env.GCP_PROJECT_ID || "seniorproject101";
    const location = process.env.GCP_LOCATION || "us-central1";
    const bucketName = process.env.GCS_BUCKET_NAME;

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const vertex_ai = new VertexAI({ project: project, location: location });

    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
      generationConfig: { responseMimeType: "application/json" }
    });

    // 4. เตรียมไฟล์ส่งให้ AI (Multimodal)
    const fileProcessingPromises = uploaded_files.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        
        // เช็คว่าไฟล์มีอยู่จริงใน Bucket ก่อน (กัน Error)
        const [exists] = await gcsFile.exists();
        if (!exists) {
            throw new Error(`File not found in GCS: ${file.gcs_path}`);
        }

        const [metadata] = await gcsFile.getMetadata();
        
        // [STRICT RULE] กฎสำรองที่เข้มงวดขึ้น
        // ถ้าหา key ไม่เจอ จะบังคับให้ AI เช็คว่าเป็นเอกสารราชการเท่านั้น
        const specificRule = criteriaMap[file.key] || "ตรวจสอบว่าเป็นเอกสารราชการที่มีตราประทับชัดเจน และเนื้อหาต้องอ่านออกได้ 100% เท่านั้น หากเป็นภาพวาดหรือภาพถ่ายทั่วไปให้ตอบ invalid";

        return {
            inlinePart: {
                fileData: {
                    mimeType: metadata.contentType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}`
                }
            },
            ruleDescription: `[ไฟล์ที่ ${uploaded_files.indexOf(file) + 1} - Key: "${file.key}"] \n   -> กฎการตรวจ: "${specificRule}"`
        };
    });

    const processedFiles = await Promise.all(fileProcessingPromises);
    const fileParts = processedFiles.map(f => f.inlinePart);
    const promptRules = processedFiles.map(f => f.ruleDescription).join('\n\n');
    
    // 5. สร้าง Prompt
    const promptText = `
    คุณคือเจ้าหน้าที่ตรวจสอบเอกสาร (Document Validator) ของคณะวิทยาศาสตร์ จุฬาฯ ที่มีความเข้มงวดสูงสุด
    
    ภารกิจ: ตรวจสอบความสมบูรณ์ของเอกสารแนบสำหรับคำร้องรหัส: "${form_code}"
    
    เงื่อนไขและกฎการตรวจสอบ:
    --------------------------------------------------
    ${promptRules}
    --------------------------------------------------
    
    คำสั่งสำคัญ (Instructions):
    1. ตรวจสอบไฟล์ทีละไฟล์ตาม "กฎการตรวจ" ที่ระบุไว้ด้านบนอย่างเคร่งครัด
    2. **Cross-Check:** หากมีเอกสารหลายฉบับ ให้ตรวจสอบความสอดคล้องของข้อมูล (เช่น วันที่, ชื่อ-นามสกุล)
    3. หากเอกสาร "อ่านไม่ออก", "เบลอ", "ผิดประเภท", "ไม่มีลายเซ็น(ถ้าจำเป็น)" หรือ "ไม่ทำตามกฎ" ให้ระบุ status: "invalid" ทันที
    
    ให้ตอบกลับเป็น JSON Format เท่านั้น:
    {
      "ชื่อ_key_ของไฟล์": {
         "status": "valid" หรือ "invalid",
         "reason": "เหตุผลภาษาไทย (ถ้า invalid ต้องบอกจุดที่ผิดชัดเจน)",
         "confidence": "high"
      }
    }
    `;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    // 6. เรียก AI
    const result = await model.generateContent({ contents });
    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean Output
    aiText = aiText.replace(/```json|```/g, '').trim();

    res.json(JSON.parse(aiText));

  } catch (error) {
    console.error('AI Validation Error:', error);
    

    if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Resource Not Found', details: error.message });
    }

    res.status(500).json({ 
        error: 'Validation Process Failed', 
        details: error.message 
    });
  }
});

module.exports = router;