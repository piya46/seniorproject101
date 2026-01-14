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

    // ✅ FIX 1: ใช้ Project Number
    const projectNumber = "466086429766";
    // ✅ FIX 2: บังคับ Region
    const location = "asia-southeast1";
    const bucketName = process.env.GCS_BUCKET_NAME;

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const vertex_ai = new VertexAI({ 
        project: projectNumber, 
        location: location 
    });

    // ✅ FIX 3: ใช้ gemini-1.5-flash
    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const formConfig = getFormConfig(form_code, student_level, sub_type);
    const criteriaMap = {};
    if (formConfig && formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง";
        });
    }

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
            ruleDescription: `- ไฟล์ [${file.key}]: ${rule}`
        };
    });

    const processedFiles = await Promise.all(fileProcessingPromises);
    const fileParts = processedFiles.map(f => f.inlinePart);
    const promptRules = processedFiles.map(f => f.ruleDescription).join('\n');
    
    const promptText = `ตรวจสอบเอกสารตามเงื่อนไข:\n${promptRules}\nตอบเป็น JSON success/data...`;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    res.json(JSON.parse(aiText.replace(/```json|```/g, '').trim()));

  } catch (error) {
    console.error('Vertex AI Error:', error);
    res.status(500).json({ 
        error: 'AI Validation Failed', 
        details: error.message 
    });
  }
});

module.exports = router;