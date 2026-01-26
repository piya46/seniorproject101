const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
// ✅ เพิ่ม Rate Limiter ป้องกันการยิงถล่ม
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { getFormConfig } = require('../data/staticData'); 
const { getDecryptedSessionFiles } = require('../utils/dbUtils');

// ✅ Helper: ตรวจสอบ Magic Bytes (File Signature)
// ป้องกันการปลอมนามสกุลไฟล์ (เช่นเปลี่ยน .exe เป็น .pdf)
const isValidFileSignature = async (fileBucket, filePath, mimeType) => {
    try {
        // โหลด 262 bytes แรกเพื่อเช็ค Header
        const [buffer] = await fileBucket.file(filePath).download({ start: 0, end: 261 });
        
        // ใช้ dynamic import เพราะ file-type v16+ เป็น ESM
        const { fileTypeFromBuffer } = await import('file-type');
        const type = await fileTypeFromBuffer(buffer);

        if (!type) return false;

        // ตรวจสอบความสอดคล้อง
        if (mimeType === 'application/pdf' && type.ext === 'pdf') return true;
        if (mimeType.startsWith('image/') && ['jpg', 'png', 'webp', 'tif'].includes(type.ext)) return true;

        console.warn(`⚠️ Signature Mismatch: Claimed ${mimeType}, Found ${type.mime}`);
        return false;
    } catch (error) {
        console.error('Signature Check Error:', error);
        return false; 
    }
};

// ✅ เพิ่ม strictLimiter ใน Route
router.post('/check-completeness', authMiddleware, strictLimiter, async (req, res) => {
  try {
    const { form_code, student_level, sub_type } = req.body;
    const sessionId = req.session.session_id;

    // 1. ดึงไฟล์จาก Firestore (Decrypt อัตโนมัติ)
    const userFiles = await getDecryptedSessionFiles(sessionId);
    
    if (!userFiles || userFiles.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No uploaded files found.' });
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

    // 2. เตรียมข้อมูลส่ง AI (พร้อมการตรวจสอบความปลอดภัยไฟล์)
    const fileProcessingPromises = userFiles.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        
        // ตรวจสอบว่าไฟล์มีอยู่จริง
        const [exists] = await gcsFile.exists();
        if (!exists) {
            console.warn(`File missing in GCS: ${file.gcs_path}`);
            return null;
        }

        // 🛡️ SECURITY: เช็คว่าเป็นไฟล์ประเภทนั้นจริงหรือไม่ (Magic Bytes)
        const isSafe = await isValidFileSignature(bucket, file.gcs_path, file.file_type);
        if (!isSafe) {
            console.warn(`🚫 Blocked malicious/invalid file: ${file.gcs_path}`);
            return null; // ข้ามไฟล์ต้องสงสัย ไม่ส่งให้ AI
        }
        
        const [metadata] = await gcsFile.getMetadata();
        const specificRule = criteriaMap[file.file_key] || "ตรวจสอบว่าเป็นเอกสารราชการที่มีตราประทับชัดเจน และเนื้อหาต้องอ่านออกได้ 100% เท่านั้น";

        return {
            inlinePart: {
                fileData: {
                    mimeType: metadata.contentType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}` // ส่ง URI จริงให้ AI
                }
            },
            ruleDescription: `[ไฟล์: "${file.file_key}"] \n   -> กฎการตรวจ: "${specificRule}"`
        };
    });

    const processedResults = await Promise.all(fileProcessingPromises);
    const validFiles = processedResults.filter(f => f !== null); // ตัดไฟล์ที่มีปัญหาออก

    if (validFiles.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid files available for validation (Files might be missing or failed security checks).' });
    }

    const fileParts = validFiles.map(f => f.inlinePart);
    const promptRules = validFiles.map(f => f.ruleDescription).join('\n\n');
    
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