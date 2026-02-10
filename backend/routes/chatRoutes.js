const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms, getFormConfig } = require('../data/staticData');
const { saveChatMessage, getChatHistory } = require('../utils/dbUtils');
const { validate } = require('../middlewares/validationMiddleware');

const project = process.env.GCP_PROJECT_ID || "seniorproject101";

// ✅ ใช้ Global Endpoint (Vertex AI จะ Auto-route)
const location = 'us-central1';

const getFormsContext = () => {
  return forms.map(f => {
    let desc = `- รหัส ${f.form_code}: ${f.name_th} (${f.category})`;
    const levels = f.degree_level || ['bachelor'];
    const conditionsSet = new Set();
    levels.forEach(level => {
        const config = getFormConfig(f.form_code, level, null);
        if (config && config.conditions) {
            config.conditions.forEach(c => conditionsSet.add(c));
        }
    });
    if (conditionsSet.size > 0) {
        desc += `\n   ⚠️ เงื่อนไขสำคัญ: ${Array.from(conditionsSet).join(', ')}`;
    }
    if (f.sub_categories) {
      desc += `\n   ตัวเลือกย่อย: ${f.sub_categories.map(s => s.label).join(', ')}`;
    }
    return desc;
  }).join('\n');
};

const formsInfo = getFormsContext();

const SYSTEM_INSTRUCTION = `
คุณคือ "พี่ทะเบียนใจดี" (Registrar Assistant) ของคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย
หน้าที่ของคุณคือแนะนำการยื่นคำร้องให้นิสิตอย่างเป็นกันเอง สุภาพ และช่วยเหลือเต็มที่

ข้อมูลสำหรับอ้างอิง:
${formsInfo}

กฎการตอบคำถาม:
1. ตอบเป็น "ภาษาไทย" เสมอ
2. หากนิสิตถามปัญหา ให้วิเคราะห์ว่าตรงกับฟอร์มไหน แล้วแนะนำรหัสฟอร์ม (เช่น JT41, JT44) ให้ชัดเจน
3. หากมีเงื่อนไขสำคัญ (เช่น ต้องยื่นภายในกี่วัน) ต้องแจ้งเตือนด้วยด้วยความหวังดี
4. ตอบกลับในรูปแบบ JSON เท่านั้น ห้ามตอบเป็นข้อความธรรมดา
   Format: { "reply": "ข้อความตอบกลับนิสิต...", "recommended_form": "รหัสฟอร์ม หรือ null" }
`;

const vertex_ai = new VertexAI({ project: project, location: location });

const model = vertex_ai.getGenerativeModel({
  model: 'gemini-2.5-flash', 
  systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  generationConfig: { 
      responseMimeType: "application/json",
      temperature: 0.4,
  }
});

router.post('/recommend', authMiddleware,validate(chatRecommendSchema), async (req, res) => {
  try {
    const { message, degree_level } = req.body;
    
    // ✅ FIX: เปลี่ยนจาก req.session เป็น req.user
    const sessionId = req.user.session_id;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }
    
    let history = [];
    try {
        history = await getChatHistory(sessionId);
    } catch (err) {
        console.warn("Could not fetch chat history:", err);
    }

    const chat = model.startChat({
        history: history,
    });

    const userMessage = `[ระดับการศึกษา: ${degree_level}] ${message}`;

    // 3. ส่งข้อความไปหา AI
    let result;
    try {
        result = await chat.sendMessage(userMessage);
    } catch (apiError) {
        console.error("Vertex AI API Error:", apiError);
        throw new Error(`AI Service connection failed: ${apiError.message}`);
    }

    const response = await result.response;
    
    // Check Safety Filters
    if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
        throw new Error("AI did not return content (Possible Safety Filter Trigger)");
    }

    const aiText = response.candidates[0].content.parts[0].text;
    const cleanJson = aiText.replace(/```json|```/g, '').trim();
    
    let aiResponse;
    try {
        aiResponse = JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse AI JSON:", cleanJson);
        aiResponse = { reply: cleanJson, recommended_form: null };
    }

    // 4. บันทึกลง Firestore
    try {
        await saveChatMessage(sessionId, 'user', userMessage);
        await saveChatMessage(sessionId, 'model', cleanJson);
    } catch (dbError) {
        console.error("Database save error:", dbError);
    }

    // 5. ส่ง Response
    res.json({
        reply: aiResponse.reply || aiResponse.reply_message || "ระบบกำลังประมวลผลคำตอบครับ",
        recommended_form: aiResponse.recommended_form
    });

  } catch (error) {
    console.error('Chat Processing Error:', error);
    res.status(500).json({ 
        error: 'Chat processing failed', 
        details: error.message,
        reply: "ขออภัย ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" 
    });
  }
});

module.exports = router;