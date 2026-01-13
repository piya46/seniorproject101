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
const { getFormConfig } = require('../data/staticData'); 

// Init Google Services
const storage = new Storage();
const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION
});

// ✅ Use 'gemini-1.5-flash' for speed and cost efficiency
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-pro-vision',
});

router.post('/check-completeness', authMiddleware, async (req, res) => {
  try {
    const { form_code, uploaded_files, student_level, sub_type } = req.body;
    
    // Guard: Validate input
    if (!uploaded_files || !Array.isArray(uploaded_files) || uploaded_files.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No files uploaded or invalid format' });
    }

    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);
    
    // 1. Get Config
    const formConfig = getFormConfig(form_code, student_level, sub_type);
    
    const criteriaMap = {};
    if (formConfig && formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง";
        });
    }

    // 2. Prepare Files (Parallel Processing)
    const fileProcessingPromises = uploaded_files.map(async (file, index) => {
        const gcsFile = bucket.file(file.gcs_path);
        const [metadata] = await gcsFile.getMetadata();
        const fileSize = parseInt(metadata.size, 10);
        const mimeType = metadata.contentType;

        // Validation
        if (fileSize > 5 * 1024 * 1024) {
            throw new Error(`ไฟล์ลำดับที่ ${index + 1} (${file.key}) ใหญ่เกิน 5MB`);
        }
        const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(mimeType)) {
            throw new Error(`ไฟล์ลำดับที่ ${index + 1} (${file.key}) เป็นประเภท ${mimeType} ซึ่งไม่รองรับ`);
        }

        const rule = criteriaMap[file.key] || "ตรวจสอบความถูกต้องทั่วไป";

        return {
            part: {
                fileData: {
                    mimeType: mimeType,
                    fileUri: `gs://${bucketName}/${file.gcs_path}`
                }
            },
            ruleDescription: `- ไฟล์ลำดับที่ ${index + 1} (ประเภท: ${file.key}): ${rule}`
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
    
    // 3. Construct Prompt
    const promptText = `
      คุณคือ "เจ้าหน้าที่ทะเบียนผู้เชี่ยวชาญ" ของคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย
      
      หน้าที่ของคุณคือ: ตรวจสอบความถูกต้องของ "แบบฟอร์มคำร้อง" และ "เอกสารแนบ" อย่างละเอียด
      
      **คำสั่งสำคัญในการตรวจสอบ (Validation Rules):**
      กรุณาตรวจสอบแต่ละไฟล์ตามเงื่อนไขต่อไปนี้อย่างเคร่งครัด:
      
      ${promptRules}
      
      **เกณฑ์การตัดสินใจ:**
      1. **Form Identity:** ถ้าเอกสารหลักไม่มีรหัสแบบฟอร์ม (เช่น จท.31) หรือตราสัญลักษณ์ ให้ถือว่า "ไม่ผ่าน"
      2. **Content Check:** ถ้าช่องสำคัญว่างเปล่า ให้ถือว่า "ไม่ผ่าน"
      3. **Image Quality:** ถ้าภาพเบลอจนอ่านไม่ออก ให้แจ้งเตือน
      
      Output Instruction:
      - ตอบกลับเป็น JSON เท่านั้น
      - ใช้โครงสร้างนี้:
      {
        "status": "success",
        "data": {
          "is_complete": boolean, 
          "validation_details": {
            "checks": [
              { 
                "key": "ระบุ key ของไฟล์", 
                "status": "ผ่าน" หรือ "ไม่ผ่าน", 
                "message": "เหตุผลสั้นๆ ภาษาไทย" 
              }
            ]
          }
        }
      }
    `;

    const parts = [{ text: promptText }];
    parts.push(...fileParts); 

    // 4. Call Vertex AI
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });

    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Robust JSON Extraction
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        aiText = jsonMatch[0];
    } else {
        throw new Error("AI did not return a valid JSON object");
    }

    let aiResponse;
    try {
        aiResponse = JSON.parse(aiText);
    } catch (e) {
        console.error("Failed to parse AI response:", aiText);
        aiResponse = {
            status: "error",
            data: {
                is_complete: false,
                validation_details: {
                    checks: [{ key: "system", status: "ไม่ผ่าน", message: "ระบบ AI ขัดข้องชั่วคราว (JSON Parsing Error)" }]
                }
            }
        };
    }

    res.json(aiResponse);

  } catch (error) {
    console.error('Vertex AI Error:', error);
    res.status(500).json({ error: 'AI Validation Failed', details: error.message });
  }
});

module.exports = router;