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
  location: 'global', // 🟢 global only
  apiEndpoint: 'us-central1-aiplatform.googleapis.com' // 🟢 บังคับ Route เข้า Gateway หลัก
});

// ✅ Gemini 3 Flash Preview
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-3-flash-preview',
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

    const fileProcessingPromises = uploaded_files.map(async (file, index) => {
        const gcsFile = bucket.file(file.gcs_path);
        const [metadata] = await gcsFile.getMetadata();
        const mimeType = metadata.contentType;

        const rule = criteriaMap[file.key] || "ตรวจสอบความถูกต้องทั่วไป";

        return {
            part: {
                fileData: {
                    mimeType: mimeType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}`
                }
            },
            ruleDescription: `- ไฟล์ลำดับที่ ${index + 1} (${file.key}): ${rule}`
        };
    });

    let processedFiles;
    try {
        processedFiles = await Promise.all(fileProcessingPromises);
    } catch (validationError) {
        return res.status(400).json({ status: 'error', message: validationError.message });
    }

    const fileParts = processedFiles.map(f => f.part);
    const promptRules = processedFiles.map(f => f.ruleDescription).join('\n');
    
    const promptText = `
      ตรวจสอบความถูกต้องของเอกสารตามเงื่อนไข:
      ${promptRules}
      
      ตอบกลับเป็น JSON:
      {
        "status": "success",
        "data": {
          "is_complete": boolean, 
          "validation_details": {
            "checks": [{ "key": "file_key", "status": "ผ่าน/ไม่ผ่าน", "message": "เหตุผล" }]
          }
        }
      }
    `;

    const parts = [{ text: promptText }, ...fileParts];

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });

    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) aiText = jsonMatch[0];

    let aiResponse = JSON.parse(aiText);
    res.json(aiResponse);

  } catch (error) {
    console.error('Vertex AI Error:', error);
    res.status(500).json({ error: 'AI Validation Failed', details: error.message });
  }
});

module.exports = router;