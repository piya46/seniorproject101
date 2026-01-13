const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms } = require('../data/staticData'); 

// 🛡️ Debug Check: ตรวจสอบ Config ก่อนเริ่ม
const projectId = process.env.GCP_PROJECT_ID;
const location = "global";

if (!projectId || !location) {
    console.error("❌ CRITICAL: Vertex AI Config Missing", { projectId, location });
}

// Init AI
const vertex_ai = new VertexAI({
  project: projectId,
  location: location || 'asia-southeast1'
});

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

    // ตรวจสอบอีกครั้งก่อนเรียก AI
    if (!process.env.GCP_LOCATION) {
        throw new Error("GCP_LOCATION environment variable is missing.");
    }

    const formsInfo = getFormsContext();
    
    const prompt = `
      คุณคือ "พี่ทะเบียนใจดี" (Smart Assistant) ของคณะวิทยาศาสตร์ จุฬาฯ
      หน้าที่ของคุณคือ: แนะนำนิสิตว่าปัญหาที่เขาเจอ ควรใช้ "แบบฟอร์มคำร้อง" ตัวไหน
      
      ข้อมูลแบบฟอร์มที่มีในระบบ:
      ${formsInfo}
      
      ข้อมูลนิสิต: ระดับการศึกษา ${degree_level || 'ไม่ระบุ'}
      คำถามของนิสิต: "${message}"
      
      คำสั่ง:
      1. วิเคราะห์ปัญหาของนิสิต แล้วจับคู่กับแบบฟอร์มที่เหมาะสมที่สุด
      2. ตอบกลับด้วยภาษาที่สุภาพ เป็นกันเอง และเข้าใจง่าย
      3. ถ้าปัญหาตรงกับฟอร์มไหน ให้ระบุ "รหัสฟอร์ม" (form_code) ให้ชัดเจน เพื่อให้ Frontend สร้างปุ่มกดไปต่อได้
      4. ถ้าไม่แน่ใจ หรือไม่มีฟอร์มที่ตรง ให้แนะนำให้ติดต่อภาควิชาโดยตรง
      
      Output Format (JSON Only):
      {
        "recommended_form": "JTxx" (หรือ null ถ้าไม่มี),
        "reply_message": "ข้อความตอบกลับนิสิต...",
        "confidence": "high/medium/low"
      }
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) aiText = jsonMatch[0];

    let aiResponse;
    try {
        aiResponse = JSON.parse(aiText);
    } catch (e) {
        console.error("AI Response Parsing Error:", aiText);
        aiResponse = {
            recommended_form: null,
            reply_message: "ระบบขัดข้องชั่วคราว (AI Parse Error)",
            confidence: "low"
        };
    }

    res.json({ data: aiResponse });

  } catch (error) {
    console.error('Chat AI Error Details:', error); // Log ลง Cloud Run
    // ✅ ส่ง Error จริงกลับไปให้ Frontend (ApiTester) เห็น
    res.status(500).json({ 
        error: 'Failed to process chat request',
        details: error.message, // ข้อความ Error จาก Google
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;