const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
// ✅ เพิ่ม Rate Limiter ป้องกันการยิงถล่ม
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { getFormConfig } = require('../data/staticData'); 
const { getDecryptedSessionFiles } = require('../utils/dbUtils');

// ❌ เอา isValidFileSignature ออกแล้ว (ย้ายไปตรวจสอบที่ AI แทน เพื่อความยืดหยุ่น)

// ✅ เพิ่ม strictLimiter ใน Route
router.post('/check-completeness', authMiddleware, strictLimiter, async (req, res) => {
  try {
    const { form_code, student_level, sub_type } = req.body;
    const sessionId = req.session.session_id;

    // 1. ดึงไฟล์จาก Firestore (Decrypt อัตโนมัติจาก Utility)
    const userFiles = await getDecryptedSessionFiles(sessionId);
    
    if (!userFiles || userFiles.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No uploaded files found.' });
    }

    // ดึง Config ของฟอร์มเพื่อดูว่าต้องตรวจอะไรบ้าง
    const formConfig = getFormConfig(form_code, student_level, sub_type);
    
    if (!formConfig) {
        return res.status(404).json({ 
            status: 'error', 
            message: `Form Code "${form_code}" not found` 
        });
    }

    // สร้าง Map เกณฑ์การตรวจรายไฟล์
    const criteriaMap = {};
    if (formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง ชัดเจน และสมบูรณ์";
        });
    }

    const project = process.env.GCP_PROJECT_ID || "seniorproject101";
    // ✅ เปลี่ยน Location ของ AI เป็น global
    const location = "global";
    const bucketName = process.env.GCS_BUCKET_NAME;

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const vertex_ai = new VertexAI({ project: project, location: location });

    // ✅ เลือกใช้ 'gemini-1.5-pro' : เก่งที่สุดในเรื่องภาพ (Vision) และเอกสาร
    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-1.5-pro', 
      generationConfig: { responseMimeType: "application/json" }
    });

    // 2. เตรียมข้อมูลไฟล์ส่งให้ AI
    const fileProcessingPromises = userFiles.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        
        // ตรวจสอบว่าไฟล์มีอยู่จริงใน Storage
        const [exists] = await gcsFile.exists();
        if (!exists) {
            console.warn(`File missing in GCS: ${file.gcs_path}`);
            return null;
        }
        
        const [metadata] = await gcsFile.getMetadata();
        // ดึงกฎเฉพาะของไฟล์นั้นๆ มาใส่ใน Prompt
        const specificRule = criteriaMap[file.file_key] || "ตรวจสอบความถูกต้องสมบูรณ์ตามมาตรฐานราชการ";

        return {
            inlinePart: {
                fileData: {
                    mimeType: metadata.contentType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}` // ส่ง URI จริงให้ AI อ่าน
                }
            },
            // Label ให้ AI รู้ว่าไฟล์นี้คืออะไร และต้องตรวจอะไร
            ruleDescription: `[เอกสารรหัส: "${file.file_key}"] \n   -> เกณฑ์การตรวจ: "${specificRule}"`
        };
    });

    const processedResults = await Promise.all(fileProcessingPromises);
    const validFiles = processedResults.filter(f => f !== null);

    if (validFiles.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid files available for validation (Files might be missing).' });
    }

    const fileParts = validFiles.map(f => f.inlinePart);
    const promptRules = validFiles.map(f => f.ruleDescription).join('\n\n');
    
    // ✅ PROMPT ฉบับสมบูรณ์: เพิ่ม Cross-Check, Persona และแนวทางการตอบ
    const promptText = `
    คุณคือ "เจ้าหน้าที่ทะเบียนผู้เชี่ยวชาญ" (Senior Registrar Officer) ของคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย
    หน้าที่ของคุณคือ: ตรวจสอบความถูกต้องและสอดคล้องของเอกสารประกอบคำร้องรหัส "${form_code}" อย่างละเอียดที่สุด

    รายการเอกสารที่ได้รับและเกณฑ์การตรวจ:
    ${promptRules}
    
    🛑 ขั้นตอนการตรวจสอบ (Think Step-by-Step):
    
    1. **Individual Check (ตรวจความสมบูรณ์รายใบ):**
       - **Visual Scan:** ภาพชัดเจนไหม? เอกสารเอียงหรือตัดขอบจนข้อความหายหรือไม่?
       - **Validity Check:** เป็นเอกสารประเภทที่ถูกต้องหรือไม่ (เช่น ให้ส่งสำเนาบัตรประชาชน แต่ส่งรูปเซลฟี่มาถือว่าผิด)
       - **Completeness:** มีลายเซ็นครบถ้วนหรือไม่? (โดยเฉพาะลายเซ็นผู้ปกครองและนิสิต)

    2. **Cross-Check (ตรวจความสอดคล้องข้ามเอกสาร):** **(สำคัญมาก!)**
       - **ชื่อ-นามสกุล:** ต้องสะกดตรงกันทุกใบ (เทียบชื่อในแบบฟอร์ม กับ บัตรประชาชน/บัตรนิสิต/ใบรับรองแพทย์)
       - **รหัสนิสิต:** ตัวเลขต้องตรงกันทุกจุด
       - **วันที่:** หากเป็นใบรับรองแพทย์ วันที่ต้องสอดคล้องกับวันที่ระบุขอลาป่วยในแบบฟอร์ม
       - **ความสมเหตุสมผล:** หากคำร้องระบุสาเหตุ A แต่หลักฐานระบุสาเหตุ B ถือว่าขัดแย้ง

    รูปแบบการตอบกลับ (JSON Format เท่านั้น):
    {
      "key_ของไฟล์": {
        "status": "valid" หรือ "invalid",
        "reason": "อธิบายเหตุผลภาษาไทยอย่างสุภาพ ทางการ และชัดเจน (สามารถอธิบายยาวได้หากจำเป็น)",
        "confidence": "high" หรือ "medium" หรือ "low"
      }
    }

    แนวทางการเขียนเหตุผล (Reasoning Guidelines):
    - **กรณีผ่าน:** "เอกสารครบถ้วนสมบูรณ์ (พบลายเซ็นครบถ้วน และชื่อ-นามสกุลตรงกับฐานข้อมูล)"
    - **กรณีไม่ผ่าน (เอกสารไม่สมบูรณ์):** ระบุจุดที่ขาดให้ชัด เช่น "ไม่พบส่วนลายเซ็นของผู้ปกครองที่มุมขวาล่าง กรุณาตรวจสอบว่าอัปโหลดไฟล์ฉบับที่มีลายเซ็นแล้วหรือไม่"
    - **กรณีไม่ผ่าน (ข้อมูลขัดแย้ง):** "ชื่อผู้ยื่นคำร้องในแบบฟอร์ม (นาย ก.) ไม่ตรงกับชื่อในใบรับรองแพทย์ (นาย ข.) กรุณาตรวจสอบเอกสารอีกครั้ง"
    - **กรณีไม่ผ่าน (ภาพไม่ชัด):** "ภาพถ่ายเอกสารมืดหรือเบลอจนไม่สามารถอ่านรายละเอียดสำคัญ (เช่น รหัสนิสิต) ได้ กรุณาถ่ายใหม่"
    - ใช้ภาษาไทยแบบกึ่งทางการที่เข้าใจง่าย และเป็นมิตรแต่เด็ดขาดในความถูกต้อง
    `;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean JSON String (เผื่อ AI เผลอใส่ Markdown backticks มา)
    aiText = aiText.replace(/```json|```/g, '').trim();

    res.json(JSON.parse(aiText));

  } catch (error) {
    console.error('AI Validation Error:', error);
    
    // จัดการ Error ให้ Frontend เข้าใจง่าย
    if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Resource Not Found', details: error.message });
    }
    
    // กรณี Gemini มีปัญหา หรือ Quota เต็ม
    res.status(500).json({ 
        error: 'Validation Process Failed', 
        details: process.env.NODE_ENV === 'development' ? error.message : 'AI Service is temporarily unavailable. Please try again later.' 
    });
  }
});

module.exports = router;