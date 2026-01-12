// const express = require('express');
// const router = express.Router();
// const { VertexAI } = require('@google-cloud/vertexai');
// const authMiddleware = require('../middlewares/authMiddleware');

// // Init Vertex AI
// const vertex_ai = new VertexAI({
//   project: process.env.GCP_PROJECT_ID,
//   location: process.env.GCP_LOCATION
// });
// const model = vertex_ai.preview.getGenerativeModel({
//   model: 'gemini-1.5-pro-preview-0409', // เลือกโมเดลที่รองรับ Multi-modal
// });

// // 6.1 POST /validation/check-completeness
// router.post('/check-completeness', authMiddleware, async (req, res) => {
//   try {
//     const { form_code, uploaded_files } = req.body;
    
//     // Construct Prompt สำหรับ AI
//     // ส่ง GCS URI ให้ Gemini อ่านไฟล์ตรงๆ (gs://...)
//     const bucketName = process.env.GCS_BUCKET_NAME;
//     const parts = [
//       { text: `ตรวจสอบเอกสารสำหรับคำร้อง ${form_code} โดยมีเงื่อนไขดังนี้... (ใส่ Logic ตรวจสอบ)... ให้ตอบกลับเป็น JSON format` }
//     ];

//     // เพิ่มไฟล์เข้าไปใน Prompt (Gemini Vision/Multimodal)
//     uploaded_files.forEach(file => {
//       parts.push({
//         fileData: {
//           mimeType: 'application/pdf', // หรือ check จากนามสกุล
//           fileUri: `gs://${bucketName}/${file.gcs_path}`
//         }
//       });
//     });

//     // เรียก Vertex AI (Mock Response ไว้ก่อนสำหรับ Dev)
//     // const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
//     // const aiResponse = JSON.parse(result.response.candidates[0].content.parts[0].text);

//     // Mock Response เพื่อให้ Frontend Test ได้
//     const mockResponse = {
//       status: "success",
//       data: {
//         is_complete: true,
//         validation_details: {
//           checks: uploaded_files.map(f => ({
//             key: f.key,
//             status: "pass",
//             message: "ตรวจสอบเบื้องต้นผ่าน"
//           }))
//         }
//       }
//     };

//     res.json(mockResponse);

//   } catch (error) {
//     console.error('Vertex AI Error:', error);
//     res.status(500).json({ error: 'AI Validation Failed' });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');

// Init Google Services
const storage = new Storage();
const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION
});
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-1.5-pro-preview-0409', // รองรับ Multi-modal (Vision & PDF)
});

// 6.1 POST /validation/check-completeness
router.post('/check-completeness', authMiddleware, async (req, res) => {
  try {
    const { form_code, uploaded_files } = req.body;
    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);
    
    // 1. Pre-validation: ตรวจสอบไฟล์จริงบน Cloud Storage (ขนาดและประเภท)
    const fileParts = [];

    for (const file of uploaded_files) {
      const gcsFile = bucket.file(file.gcs_path);
      
      // ดึง Metadata เพื่อดูขนาดและประเภทไฟล์จริง
      const [metadata] = await gcsFile.getMetadata();
      const fileSize = parseInt(metadata.size, 10);
      const mimeType = metadata.contentType; // ดึง MimeType จริงตรงนี้

      // Check 1: ขนาดต้องไม่เกิน 5 MB (5 * 1024 * 1024 bytes)
      if (fileSize > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: 'error',
          message: `ไฟล์ "${file.key}" มีขนาดเกิน 5 MB (ขนาดจริง: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`
        });
      }

      // Check 2: ต้องเป็น PDF หรือ รูปภาพเท่านั้น
      const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(mimeType)) {
        return res.status(400).json({
          status: 'error',
          message: `ไฟล์ "${file.key}" เป็นประเภท ${mimeType} ซึ่งระบบไม่รองรับ (รองรับเฉพาะ PDF และรูปภาพ)`
        });
      }

      // เตรียม Object สำหรับส่งให้ Gemini
      fileParts.push({
        fileData: {
          mimeType: mimeType, // ✅ FIX: ใช้ค่า mimeType ที่ดึงมาจริง (ห้าม Hardcode เป็น pdf)
          fileUri: `gs://${bucketName}/${file.gcs_path}`
        }
      });
    }
    
    // 2. Construct Strict Prompt สำหรับ AI
    const promptText = `
      คุณคือเจ้าหน้าที่งานทะเบียนนิสิต มีหน้าที่ตรวจสอบเอกสารคำร้องรหัส "${form_code}"
      
      งานของคุณคือ:
      1. ตรวจสอบว่าไฟล์แนบแต่ละรายการ (ซึ่งอาจเป็น PDF หรือ รูปภาพถ่ายจากมือถือ) ถูกต้องตามประเภทเอกสารหรือไม่
      2. ถ้าเป็นใบรับรองแพทย์ ให้ดูวันที่ว่าสมเหตุสมผลหรือไม่
      3. ตรวจสอบความชัดเจนของเอกสาร (ถ้าภาพเบลอหรืออ่านไม่ออก ให้แจ้งเตือน)
      
      Output Instruction:
      - ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนำหน้าหรือตามหลัง
      - ใช้โครงสร้าง JSON ดังนี้:
      {
        "status": "success",
        "data": {
          "is_complete": boolean,
          "validation_details": {
            "checks": [
              { 
                "key": "ชื่อ key ของไฟล์ (ตาม input)", 
                "status": "ผ่าน" หรือ "ไม่ผ่าน", 
                "message": "ในกรณีไม่ผ่านขอเหตุผลสั้นๆ ภาษาไทยที่บอกได้ว่าลืมหรือผิดตรงไหน" 
              }
            ]
          }
        }
      }
    `;

    const parts = [{ text: promptText }];
    
    // เพิ่มไฟล์ที่ผ่านการตรวจสอบแล้วเข้าไปใน Prompt
    parts.push(...fileParts);

    // 3. เรียก Vertex AI (Real Implementation)
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });

    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;

    // 4. Clean Output
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

    // 5. Parse JSON และส่งกลับ
    const aiResponse = JSON.parse(aiText);

    res.json(aiResponse);

  } catch (error) {
    console.error('Vertex AI Error:', error);
    res.status(500).json({ 
      error: 'AI Validation Failed',
      details: error.message
    });
  }
});

module.exports = router;