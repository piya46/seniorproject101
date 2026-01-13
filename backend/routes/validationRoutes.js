const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
const { getFormConfig } = require('../data/staticData'); 

// Init Google Services
const storage = new Storage();
const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION || 'us-central1'
});

// ✅ ใช้ตัวปกติ ไม่ต้อง .preview และบังคับ JSON Output
const model = vertex_ai.getGenerativeModel({
  model: 'gemini-1.5-flash-001',
  generationConfig: {
    responseMimeType: "application/json"
  }
});

router.post('/check-completeness', authMiddleware, async (req, res) => {
  try {
    const { form_code, uploaded_files, student_level, sub_type } = req.body;
    
    if (!uploaded_files || !Array.isArray(uploaded_files) || uploaded_files.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No files uploaded' });
    }

    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);
    
    const formConfig = getFormConfig(form_code, student_level, sub_type);
    const criteriaMap = {};
    if (formConfig && formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง";
        });
    }

    // เตรียมข้อมูลไฟล์เพื่อส่งให้ Gemini
    const fileProcessingPromises = uploaded_files.map(async (file, index) => {
        const gcsFile = bucket.file(file.gcs_path);
        const [metadata] = await gcsFile.getMetadata();
        const mimeType = metadata.contentType;

        const rule = criteriaMap[file.key] || "ตรวจสอบความถูกต้องทั่วไป";

        return {
            inlinePart: {
                fileData: {
                    mimeType: mimeType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}`
                }
            },
            ruleDescription: `- ไฟล์ [${file.key}]: ${rule}`
        };
    });

    const processedFiles = await Promise.all(fileProcessingPromises);
    const fileParts = processedFiles.map(f => f.inlinePart);
    const promptRules = processedFiles.map(f => f.ruleDescription).join('\n');
    
    const promptText = `
      คุณคือผู้เชี่ยวชาญการตรวจสอบเอกสาร หน้าที่ของคุณคือตรวจสอบไฟล์ที่แนบมาว่าถูกต้องตามเงื่อนไขหรือไม่
      
      เงื่อนไขการตรวจสอบ:
      ${promptRules}
      
      ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างนี้:
      {
        "status": "success",
        "data": {
          "is_complete": boolean, 
          "validation_details": {
            "checks": [{ "key": "ชื่อ key ของไฟล์", "status": "ผ่าน/ไม่ผ่าน", "message": "ระบุเหตุผลที่ชัดเจน" }]
          }
        }
      }
    `;

    // รวม Text Prompt กับ File Parts
    const contents = [
      {
        role: 'user',
        parts: [
          { text: promptText },
          ...fileParts
        ]
      }
    ];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean string เผื่อมี markdown backticks
    aiText = aiText.replace(/```json|```/g, '').trim();

    try {
        const aiResponse = JSON.parse(aiText);
        res.json(aiResponse);
    } catch (parseError) {
        console.error("AI JSON Parse Error:", aiText);
        res.status(500).json({ 
            error: 'AI Response Format Error', 
            details: 'AI ตอบกลับในรูปแบบที่ไม่ใช่ JSON' 
        });
    }

  } catch (error) {
    console.error('Vertex AI Error:', error);
    res.status(500).json({ 
        error: 'AI Validation Failed', 
        details: error.message 
    });
  }
});

module.exports = router;