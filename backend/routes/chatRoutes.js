const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms, getFormConfig } = require('../data/staticData');
// Import ฟังก์ชันใหม่สำหรับจัดการประวัติแชท
const { saveChatMessage, getChatHistory } = require('../utils/dbUtils');

const project = process.env.GCP_PROJECT_ID || "seniorproject101";
const location = process.env.GCP_LOCATION || "us-central1";

// สร้าง Context ข้อมูลฟอร์มสำหรับส่งให้ AI
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

// กำหนด System Instruction (บุคลิกของ AI)
const SYSTEM_INSTRUCTION = `
คุณคือ "พี่ทะเบียนใจดี" (Registrar Assistant) ของคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย
หน้าที่ของคุณคือแนะนำการยื่นคำร้องให้นิสิตอย่างเป็นกันเอง สุภาพ และช่วยเหลือเต็มที่

ข้อมูลสำหรับอ้างอิง:
${formsInfo}

กฎการตอบคำถาม:
1. ตอบเป็น "ภาษาไทย" เสมอ โดยใช้สรรพนามแทนตัวว่า "พี่" และแทนนิสิตว่า "เรา" หรือ "น้อง"
2. หากนิสิตถามปัญหา ให้วิเคราะห์ว่าตรงกับฟอร์มไหน แล้วแนะนำรหัสฟอร์ม (เช่น JT41, JT44) ให้ชัดเจน
3. หากมีเงื่อนไขสำคัญ (เช่น ต้องยื่นภายในกี่วัน) ต้องแจ้งเตือนด้วยด้วยความหวังดี
4. ตอบกลับในรูปแบบ JSON เท่านั้น ห้ามตอบเป็นข้อความธรรมดา
   Format: { "reply": "ข้อความตอบกลับนิสิต...", "recommended_form": "รหัสฟอร์ม หรือ null" }
`;

const vertex_ai = new VertexAI({ project: project, location: location });
const model = vertex_ai.getGenerativeModel({
  model: 'gemini-2.5-pro', // ใช้รุ่นนี้เพื่อให้รองรับ systemInstruction และ chat history ได้ดี
  systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  generationConfig: { responseMimeType: "application/json" }
});

router.post('/recommend', authMiddleware, async (req, res) => {
  try {
    const { message, degree_level } = req.body;
    const sessionId = req.session.session_id;
    
    // 1. ดึงประวัติการคุยเก่าจาก Firestore
    const history = await getChatHistory(sessionId);

    // 2. เริ่ม Chat Session (ใส่ประวัติเก่าเข้าไปด้วย)
    const chat = model.startChat({
        history: history,
    });

    // 3. เตรียมข้อความฝั่งผู้ใช้
    const userMessage = `[ระดับการศึกษา: ${degree_level}] ${message}`;

    // 4. ส่งข้อความไปหา AI
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiText = response.candidates[0].content.parts[0].text;
    
    // Clean JSON (เผื่อมี backticks ติดมา)
    const cleanJson = aiText.replace(/```json|```/g, '').trim();
    let aiResponse;
    try {
        aiResponse = JSON.parse(cleanJson);
    } catch (e) {
        // Fallback กรณี AI ตอบมาไม่ใช่ JSON เป๊ะๆ
        aiResponse = { reply: aiText, recommended_form: null };
    }

    // 5. บันทึกลง Firestore (บันทึกทั้ง User Message และ AI Response เพื่อให้จำได้ในรอบหน้า)
    await saveChatMessage(sessionId, 'user', userMessage);
    await saveChatMessage(sessionId, 'model', cleanJson); // บันทึก JSON กลับไปเพื่อให้ AI คง Context เดิม

    // 6. ส่ง Response กลับไปที่ Frontend (แบบ Flat Structure แก้ปัญหา Nested Data)
    // Frontend รอรับ: res.data.reply
    res.json({
        reply: aiResponse.reply || aiResponse.reply_message,
        recommended_form: aiResponse.recommended_form
    });

  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Chat processing failed', details: error.message });
  }
});

module.exports = router;