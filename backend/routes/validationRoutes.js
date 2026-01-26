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

    const formConfig = getFormConfig(form_code, student_level, sub_type);
    
    if (!formConfig) {
        return res.status(404).json({ 
            status: 'error', 
            message: `Form Code "${form_code}" not found` 
        });
    }

    const criteriaMap = {};
    if (formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง ชัดเจน";
        });
    }

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

    const fileProcessingPromises = uploaded_files.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        const [exists] = await gcsFile.exists();
        if (!exists) throw new Error(`File not found in GCS: ${file.gcs_path}`);
        const [metadata] = await gcsFile.getMetadata();
        
        const specificRule = criteriaMap[file.key] || "ตรวจสอบว่าเป็นเอกสารราชการที่มีตราประทับชัดเจน และเนื้อหาต้องอ่านออกได้ 100% เท่านั้น";

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
    
    const promptText = `
    คุณคือเจ้าหน้าที่ตรวจสอบเอกสาร (Document Validator) ของคณะวิทยาศาสตร์ จุฬาฯ
    ภารกิจ: ตรวจสอบความสมบูรณ์ของเอกสารแนบสำหรับคำร้องรหัส: "${form_code}"
    
    เงื่อนไขและกฎการตรวจสอบ:
    ${promptRules}
    
    คำสั่งสำคัญ:
    1. ตรวจสอบไฟล์ทีละไฟล์ตาม "กฎการตรวจ" ที่ระบุ
    2. Cross-Check ข้อมูลระหว่างเอกสาร
    3. หากเอกสาร อ่านไม่ออก, ผิดประเภท, ไม่มีลายเซ็น ให้ตอบ invalid
    
    ให้ตอบกลับเป็น JSON Format เท่านั้น:
    { "key_ของไฟล์": { "status": "valid/invalid", "reason": "...", "confidence": "high" } }
    `;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json|```/g, '').trim();

    res.json(JSON.parse(aiText));

  } catch (error) {
    console.error('AI Validation Error:', error);
    if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Resource Not Found', details: error.message });
    }
    res.status(500).json({ error: 'Validation Process Failed', details: error.message });
  }
});

module.exports = router;