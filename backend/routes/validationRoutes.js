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

    // ✅ Config Project/Region
    const project = process.env.GCP_PROJECT_ID || "seniorproject101";
    const location = process.env.GCP_LOCATION || "us-central1"; // ใช้ US ตามที่ตกลงกัน
    
    const bucketName = process.env.GCS_BUCKET_NAME;

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const vertex_ai = new VertexAI({ 
        project: project, 
        location: location 
    });

    // ✅ Model Config
    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    // 1. เตรียมกฎการตรวจสอบ (Rules)
    const formConfig = getFormConfig(form_code, student_level, sub_type);
    const criteriaMap = {};
    if (formConfig && formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง ชัดเจน อ่านออก";
        });
    }

    // 2. เตรียมไฟล์ส่งให้ AI
    const fileProcessingPromises = uploaded_files.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        const [metadata] = await gcsFile.getMetadata();
        const rule = criteriaMap[file.key] || "ตรวจสอบความถูกต้องทั่วไป";

        return {
            inlinePart: {
                fileData: {
                    mimeType: metadata.contentType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}`
                }
            },
            // Mapping ชื่อไฟล์ไว้ใน Prompt เพื่อให้ AI รู้ว่ารูปไหนคือกฎข้อไหน
            ruleDescription: `ไฟล์ลำดับที่ ${uploaded_files.indexOf(file) + 1} (Key: "${file.key}"): ต้องตรวจสอบเงื่อนไขดังนี้ -> ${rule}`
        };
    });

    const processedFiles = await Promise.all(fileProcessingPromises);
    const fileParts = processedFiles.map(f => f.inlinePart);
    const promptRules = processedFiles.map(f => f.ruleDescription).join('\n');
    
    // 🔥 3. (จุดสำคัญ) ปรับ Prompt สั่งงานให้ละเอียด และกำหนด Format JSON
    const promptText = `
    คุณคือเจ้าหน้าที่ตรวจสอบเอกสาร (Document Validator) ของคณะวิทยาศาสตร์
    
    งานของคุณคือ: ตรวจสอบความถูกต้องของไฟล์เอกสารที่แนบมา ทีละไฟล์ ตามเงื่อนไขด้านล่างนี้:
    --------------------------------------------------
    ${promptRules}
    --------------------------------------------------
    
    คำสั่ง:
    1. วิเคราะห์ไฟล์ทีละไฟล์อย่างละเอียด
    2. ถ้าเอกสารไม่ชัดเจน, ผิดประเภท, หรือขาดองค์ประกอบสำคัญตามเงื่อนไข ให้ถือว่า "invalid"
    3. ให้ตอบกลับเป็น JSON Object โดยใช้ Key เป็นชื่อไฟล์ ("file.key") และมีโครงสร้างดังนี้:

    Format การตอบ (JSON):
    {
      "ชื่อ_key_ของไฟล์": {
         "status": "valid" หรือ "invalid",
         "reason": "อธิบายเหตุผลอย่างละเอียดเป็นภาษาไทย ถ้าไม่ผ่านต้องบอกว่าขาดอะไร หรือผิดตรงไหน (เช่น 'ไม่พบลายเซ็นนิสิต', 'หัวกระดาษไม่ใช่ จท.31')",
         "confidence": "high" หรือ "medium" หรือ "low"
      },
      ... (ทำซ้ำให้ครบทุกไฟล์)
    }
    
    ตัวอย่าง Output:
    {
       "main_form": { "status": "invalid", "reason": "ไม่พบตราพระเกี้ยวที่หัวกระดาษ และภาพเบลอมาก", "confidence": "high" },
       "parent_consent": { "status": "valid", "reason": "เอกสารถูกต้อง มีลายเซ็นผู้ปกครองครบถ้วน", "confidence": "high" }
    }
    `;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    // 4. เรียกใช้งาน Gemini
    const result = await model.generateContent({ contents });
    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean JSON String (เผื่อ AI เผลอใส่ Markdown มา)
    aiText = aiText.replace(/```json|```/g, '').trim();

    res.json(JSON.parse(aiText));

  } catch (error) {
    console.error('Vertex AI Error:', error);
    res.status(500).json({ 
        error: 'AI Validation Failed', 
        details: error.message 
    });
  }
});

module.exports = router;