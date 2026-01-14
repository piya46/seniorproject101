const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
const { getFormConfig } = require('../data/staticData'); 

router.post('/check-completeness', authMiddleware, async (req, res) => {
  try {
    const { form_code, uploaded_files, student_level, sub_type } = req.body;
    
    if (!uploaded_files || uploaded_files.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No files uploaded' });
    }

    // Config Google Cloud
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

    // 1. ดึงกฎการตรวจสอบ (Validation Criteria) จาก Static Data
    const formConfig = getFormConfig(form_code, student_level, sub_type);
    const criteriaMap = {};
    
    if (formConfig && formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            // ใช้เกณฑ์ที่ละเอียดที่ระบุไว้ใน staticData
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง ชัดเจน";
        });
    }

    // 2. เตรียมไฟล์ส่งให้ AI
    const fileProcessingPromises = uploaded_files.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        const [metadata] = await gcsFile.getMetadata();
        
        // Match กฎให้ตรงกับไฟล์ (ถ้าไม่เจอกฎ ให้ใช้ค่า Default)
        const specificRule = criteriaMap[file.key] || "ตรวจสอบความถูกต้องสมบูรณ์ทั่วไปของเอกสาร";

        return {
            inlinePart: {
                fileData: {
                    mimeType: metadata.contentType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}`
                }
            },
            // Mapping ชื่อไฟล์กับกฎ เพื่อใส่ใน Prompt
            ruleDescription: `[ไฟล์ที่ ${uploaded_files.indexOf(file) + 1} - Key: "${file.key}"] \n   -> กฎการตรวจ: "${specificRule}"`
        };
    });

    const processedFiles = await Promise.all(fileProcessingPromises);
    const fileParts = processedFiles.map(f => f.inlinePart);
    const promptRules = processedFiles.map(f => f.ruleDescription).join('\n\n');
    
    // 3. สร้าง Prompt ที่เน้นการ Cross-check และความละเอียด
    const promptText = `
    คุณคือเจ้าหน้าที่ตรวจสอบเอกสาร (Document Validator) ของคณะวิทยาศาสตร์ จุฬาฯ ที่มีความเข้มงวด
    
    ภารกิจ: ตรวจสอบความสมบูรณ์ของเอกสารแนบ (Attachments) สำหรับคำร้องรหัส ${form_code}
    
    เงื่อนไขและกฎการตรวจสอบของแต่ละไฟล์ (Strict Criteria):
    --------------------------------------------------
    ${promptRules}
    --------------------------------------------------
    
    คำสั่งสำคัญ (Important Instructions):
    1. ตรวจสอบไฟล์ทีละไฟล์ตาม "กฎการตรวจ" ที่ระบุไว้ด้านบนอย่างเคร่งครัด
    2. **Cross-Check:** หากกฎระบุให้ตรวจสอบความสอดคล้อง (เช่น "วันที่ในใบรับรองแพทย์ ต้องตรงกับตารางสอบ") ให้คุณเปรียบเทียบข้อมูลระหว่างไฟล์ภาพต่างๆ ให้แน่ใจ
    3. หากเอกสาร "อ่านไม่ออก", "เบลอ", "ผิดประเภท", หรือ "ไม่ทำตามกฎ" ให้ระบุ status: "invalid" ทันที
    
    ให้ตอบกลับเป็น JSON เท่านั้น โดยมี Format ดังนี้:
    {
      "ชื่อ_key_ของไฟล์": {
         "status": "valid" หรือ "invalid",
         "reason": "อธิบายเหตุผลภาษาไทย ถ้าไม่ผ่านให้บอกจุดที่ผิดให้ชัดเจน (เช่น 'วันที่ในใบรับรองแพทย์ (12 ต.ค.) ไม่ตรงกับวันสอบในตาราง (14 ต.ค.)')",
         "confidence": "high"
      },
      ...
    }
    `;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    // 4. เรียก AI ประมวลผล
    const result = await model.generateContent({ contents });
    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean Output
    aiText = aiText.replace(/```json|```/g, '').trim();

    res.json(JSON.parse(aiText));

  } catch (error) {
    console.error('AI Validation Error:', error);
    res.status(500).json({ 
        error: 'Validation Process Failed', 
        details: error.message 
    });
  }
});

module.exports = router;