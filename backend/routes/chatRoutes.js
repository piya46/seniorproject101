const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms } = require('../data/staticData'); 

// รับค่า Config (จะได้รับ us-central1 จาก Deploy script)
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION; 

// Init AI
const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: 'global', // 🟢 ต้องใช้ global ตาม Doc
  apiEndpoint: 'us-central1-aiplatform.googleapis.com' // 🟢 สำคัญมาก! ต้องชี้ไปที่ Gateway นี้ไม่งั้น SDK จะหลงทาง
});

// ✅ ใช้ Gemini 3 Flash Preview (ผ่าน Gateway us-central1)
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-3-flash-preview',
});

const getFormsContext = () => {
  return forms.map(f => {
    let desc = `- รหัส ${f.form_code}: ${f.name_th} (${f.category})`;
    if (f.sub_categories) {
      desc += `\n  ตัวเลือกย่อย: ${f.sub_categories.map(s => s.label).join(', ')}`;
    }
    return desc;
  }).join('\n');
};

router.post('/recommend', authMiddleware, async (req, res) => {
  try {
    const { message, degree_level } = req.body;
    
    if (!message) return res.status(400).json({ error: "Message is required" });

    const formsInfo = getFormsContext();
    
    const prompt = `
      คุณคือ "พี่ทะเบียนใจดี" ของคณะวิทยาศาสตร์ จุฬาฯ
      หน้าที่: แนะนำแบบฟอร์มคำร้องให้นิสิต
      
      ข้อมูลฟอร์ม: ${formsInfo}
      ข้อมูลนิสิต: ${degree_level || 'ไม่ระบุ'}
      คำถาม: "${message}"
      
      ตอบเป็น JSON เท่านั้น:
      {
        "recommended_form": "รหัสฟอร์ม หรือ null",
        "reply_message": "คำตอบที่สุภาพและเป็นประโยชน์",
        "confidence": "high/medium/low"
      }
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) aiText = jsonMatch[0];

    let aiResponse;
    try {
        aiResponse = JSON.parse(aiText);
    } catch (e) {
        aiResponse = { reply_message: aiText, recommended_form: null };
    }

    res.json({ data: aiResponse });

  } catch (error) {
    console.error('Chat AI Error:', error);
    res.status(500).json({ 
        error: 'Failed to process chat request',
        details: error.message
    });
  }
});

module.exports = router;