const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms } = require('../data/staticData'); 

// รับค่า Config
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION || 'us-central1'; // รับค่า Default ตรงนี้เลย

// Init AI
const vertex_ai = new VertexAI({
  project: projectId,
  location: location
});

// *** FIX: เอา .preview ออก และเพิ่ม Config บังคับ JSON ***
const model = vertex_ai.getGenerativeModel({
  model: 'gemini-1.5-flash-001',
  generationConfig: {
    responseMimeType: "application/json"
  }
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
      
      ตอบเป็น JSON เท่านั้น โดยมีโครงสร้างดังนี้:
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
    
    // พอเราบังคับ MimeType เป็น JSON แล้ว ส่วนใหญ่จะได้ JSON เนื้อๆ เลย
    // แต่กันพลาดด้วยการ Clean string เผื่อมี Backticks ติดมา
    let aiText = response.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json|```/g, '').trim(); 

    let aiResponse;
    try {
        aiResponse = JSON.parse(aiText);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        // Fallback กรณี Parse ไม่ได้จริงๆ
        aiResponse = { 
            reply_message: "ระบบกำลังประมวลผลคำตอบ กรุณาลองใหม่อีกครั้งครับ", 
            recommended_form: null 
        };
    }

    res.json({ data: aiResponse });

  } catch (error) {
    console.error('Chat AI Error:', error);
    // ส่ง Error details กลับไปเพื่อ Debug (Production ควรปิด details)
    res.status(500).json({ 
        error: 'Failed to process chat request',
        details: error.message 
    });
  }
});

module.exports = router;