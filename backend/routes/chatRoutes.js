const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const authMiddleware = require('../middlewares/authMiddleware');
const { forms, getFormConfig } = require('../data/staticData');

const project = process.env.GCP_PROJECT_ID || "seniorproject101";
const location = process.env.GCP_LOCATION || "us-central1";
const vertex_ai = new VertexAI({ project: project, location: location });

const model = vertex_ai.getGenerativeModel({
  model: 'gemini-2.0-flash-001'
});

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

/**
 * @swagger
 * tags:
 * - name: Chat
 * description: AI Assistant (พี่ทะเบียนใจดี)
 */

/**
 * @swagger
 * /chat/recommend:
 * post:
 * summary: ปรึกษา AI เพื่อแนะนำแบบฟอร์ม
 * tags: [Chat]
 * description: "**⚠️ E2EE Required**"
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - message
 * properties:
 * message:
 * type: string
 * example: "ผมป่วยต้องทำไงครับ"
 * degree_level:
 * type: string
 * enum: [bachelor, graduate]
 * responses:
 * 200:
 * description: คำตอบจาก AI
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * data:
 * type: object
 * properties:
 * recommended_form:
 * type: string
 * example: "JT44"
 * reply_message:
 * type: string
 * 401:
 * description: Unauthorized
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * 500:
 * description: AI Service Error
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 */
router.post('/recommend', authMiddleware, async (req, res) => {
  try {
    const { message, degree_level } = req.body;
    
    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: `
                คุณคือ "พี่ทะเบียนใจดี" (Registrar Assistant) ของคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย
                หน้าที่ของคุณคือแนะนำการยื่นคำร้องให้นิสิต โดยใช้ข้อมูลด้านล่างนี้เท่านั้น:
                
                รายชื่อแบบฟอร์มและเงื่อนไข:
                ${formsInfo}
                
                คำแนะนำ:
                - หากนิสิตถามเรื่องปัญหา (เช่น ลงทะเบียนไม่ทัน, ป่วย, เกรดไม่ออก) ให้วิเคราะห์ว่าตรงกับฟอร์มไหน
                - ต้องตอบ "รหัสฟอร์ม" (เช่น JT41, JT44) ให้ชัดเจนเสมอ
                - หากมีเงื่อนไขเรื่องเวลา (เช่น ต้องยื่นภายใน 30 วัน) ให้แจ้งเตือนนิสิตด้วย
                - ตอบสั้นๆ กระชับ และเป็นกันเอง
                ` }]
            }
        ]
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.candidates[0].content.parts[0].text;

    const match = text.match(/(JT\d{2}|CF)/);
    const recommended_form = match ? match[0] : null;

    res.json({
        data: {
            recommended_form: recommended_form,
            reply_message: text
        }
    });

  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Chat processing failed' });
  }
});

module.exports = router;