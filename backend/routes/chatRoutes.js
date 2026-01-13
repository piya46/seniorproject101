const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms } = require('../data/staticData'); 

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

    // ✅ ใช้ Project Number โดยตรงในโค้ด AI เพื่อแก้ปัญหา 404
    const projectNumber = "466086429766"; 
    const location = process.env.GCP_LOCATION;

    const vertex_ai = new VertexAI({
      project: projectNumber,
      location: location
    });

    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

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
    aiText = aiText.replace(/```json|```/g, '').trim(); 

    res.json({ data: JSON.parse(aiText) });

  } catch (error) {
    console.error('Chat AI Error:', error);
    res.status(500).json({ 
        error: 'Failed to process chat request',
        details: error.message 
    });
  }
});

module.exports = router;