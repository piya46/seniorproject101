const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms } = require('../data/staticData'); 

// Init AI
// ต้องแน่ใจว่า Env GCP_LOCATION ถูกตั้งค่าแล้ว (เช่น asia-southeast1)
const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION
});

// ใช้โมเดล Gemini 1.5 Flash เพื่อความรวดเร็วและประหยัดค่าใช้จ่าย
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-1.5-flash-001',
});

// Helper: แปลงข้อมูล Forms ใน staticData ให้เป็นข้อความ Text ที่ AI อ่านง่าย
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

    // 1. เตรียม Context (ความรู้เกี่ยวกับฟอร์มต่างๆ) ให้บอท
    const formsInfo = getFormsContext();
    
    // 2. สร้าง Prompt
    const prompt = `
      คุณคือ "พี่ทะเบียนใจดี" (Smart Assistant) ของคณะวิทยาศาสตร์ จุฬาฯ
      หน้าที่ของคุณคือ: แนะนำนิสิตว่าปัญหาที่เขาเจอ ควรใช้ "แบบฟอร์มคำร้อง" ตัวไหน
      
      ข้อมูลแบบฟอร์มที่มีในระบบ:
      ${formsInfo}
      
      ข้อมูลนิสิต: ระดับการศึกษา ${degree_level || 'ไม่ระบุ'}
      คำถามของนิสิต: "${message}"
      
      คำสั่ง:
      1. วิเคราะห์ปัญหาของนิสิต แล้วจับคู่กับแบบฟอร์มที่เหมาะสมที่สุด
      2. ตอบกลับด้วยภาษาที่สุภาพ เป็นกันเอง และเข้าใจง่าย (ภาษาไทย)
      3. ถ้าปัญหาตรงกับฟอร์มไหน ให้ระบุ "รหัสฟอร์ม" (form_code) ให้ชัดเจน เพื่อให้ Frontend สร้างปุ่มกดไปต่อได้
      4. ถ้าไม่แน่ใจ หรือไม่มีฟอร์มที่ตรง ให้แนะนำให้ติดต่อภาควิชาโดยตรง
      
      Output Format (JSON Only):
      {
        "recommended_form": "JTxx" (หรือ null ถ้าไม่มี),
        "reply_message": "ข้อความตอบกลับนิสิต...",
        "confidence": "high/medium/low"
      }
    `;

    // 3. ถาม AI
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const response = await result.response;
    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean JSON (ป้องกันกรณี AI ตอบเกริ่นนำก่อนเริ่ม JSON)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) aiText = jsonMatch[0];

    let aiResponse;
    try {
        aiResponse = JSON.parse(aiText);
    } catch (e) {
        console.error("AI Response Parsing Error:", aiText);
        // Fallback กรณี AI ตอบกลับมาไม่ใช่ JSON หรือ Parse ไม่ได้
        aiResponse = {
            recommended_form: null,
            reply_message: "ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หรือติดต่อภาควิชาโดยตรงครับ",
            confidence: "low"
        };
    }

    res.json({
        data: aiResponse
    });

  } catch (error) {
    console.error('Chat AI Error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

module.exports = router;