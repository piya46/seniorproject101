const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
// ✅ เพิ่ม Rate Limiter ป้องกันการยิงถล่ม
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { getFormConfig } = require('../data/staticData'); 
const { getDecryptedSessionFiles, updateFileRecord } = require('../utils/dbUtils');
const { assertAiWithinDailyLimit, recordAiUsage } = require('../utils/aiUsageUtils');
const { filterFilesForForm, selectLatestFilesByKey } = require('../utils/fileSelection');
const { validationCheckSchema } = require('../validators/schemas');
const {
  buildDocumentJobResponse,
  DOCUMENT_JOB_STATUSES,
  DOCUMENT_JOB_TYPES,
  createDocumentJob,
  getDocumentJob,
  sanitizeDocumentJobForResponse
} = require('../utils/documentJobs');

const ensureFilesPreparedForValidation = async ({ files, sessionId, user, req }) => {
  const queuedJobs = [];

  for (const file of files) {
    if (file.file_processing_status === 'ready' && file.gcs_path) {
      continue;
    }

    let existingJob = null;
    if (file.processing_job_id) {
      existingJob = await getDocumentJob(file.processing_job_id);
    }

    if (
      existingJob &&
      (existingJob.status === DOCUMENT_JOB_STATUSES.QUEUED || existingJob.status === DOCUMENT_JOB_STATUSES.PROCESSING)
    ) {
      queuedJobs.push(await buildDocumentJobResponse(existingJob));
      continue;
    }

    if (!file.raw_gcs_path || !file.detected_mime || !file.detected_ext) {
      return {
        statusCode: 400,
        payload: {
          status: 'error',
          message: `Uploaded file "${file.file_key}" is incomplete and cannot be prepared for validation.`
        }
      };
    }

    const job = await createDocumentJob({
      type: DOCUMENT_JOB_TYPES.UPLOAD_SANITIZE,
      sessionId,
      requestedBy: {
        email: user.email || null,
        session_id: sessionId
      },
      payload: {
        file_record_id: file.id,
        file_key: file.file_key,
        form_code: file.form_code,
        raw_gcs_path: file.raw_gcs_path,
        detected_mime: file.detected_mime,
        detected_ext: file.detected_ext,
        source_bytes: file.source_bytes || null
      },
      metadata: {
        source_bytes: file.source_bytes || null,
        file_key: file.file_key,
        form_code: file.form_code
      }
    });

    await updateFileRecord(sessionId, file.id, {
      file_processing_status: 'processing',
      processing_job_id: job.id,
      processing_error: null
    });

    req.log?.audit('validation_file_processing_queued', {
      file_key: file.file_key,
      form_code: file.form_code,
      job_id: job.id
    });

    queuedJobs.push(await buildDocumentJobResponse(job));
  }

  if (queuedJobs.length > 0) {
    return {
      statusCode: 202,
      payload: {
        status: 'queued',
        message: 'Documents are being prepared for validation.',
        jobs: queuedJobs
      }
    };
  }

  return null;
};

// ✅ เพิ่ม strictLimiter ใน Route
router.post('/check-completeness', authMiddleware, strictLimiter, validate(validationCheckSchema), async (req, res) => {
  let usageRecorded = false;

  try {
    const { form_code, degree_level, sub_type, case_key } = req.body;
    const sessionId = req.user.session_id;
    await assertAiWithinDailyLimit(req.user);

    // 1. ดึงไฟล์จาก Firestore (Decrypt อัตโนมัติจาก Utility)
    const allFiles = await getDecryptedSessionFiles(sessionId);
    
    if (!allFiles || allFiles.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No uploaded files found.' });
    }

   // ✅ OPTIMIZATION: ไม่ต้องวนลูปหาล่าสุดแล้ว เพราะ Upload Route ลบตัวเก่าให้แล้ว
    // กรองเอาเฉพาะไฟล์ของ Form นี้ หรือไฟล์ General (เช่น บัตร ปชช.)
    const userFiles = filterFilesForForm(allFiles, form_code);

    if (userFiles.length === 0) {
        return res.status(400).json({ error: 'No relevant files found for this form.' });
    }

    const latestUserFiles = selectLatestFilesByKey(userFiles);

    const preparationResult = await ensureFilesPreparedForValidation({
      files: latestUserFiles,
      sessionId,
      user: req.user,
      req
    });

    if (preparationResult) {
      return res.status(preparationResult.statusCode).json(preparationResult.payload);
    }

    req.log?.info('validation_started', {
      form_code,
      file_count: latestUserFiles.length
    });

    

    // ดึง Config ของฟอร์มเพื่อดูว่าต้องตรวจอะไรบ้าง
    const formConfig = getFormConfig(form_code, degree_level, sub_type);
    
    if (!formConfig) {
        return res.status(404).json({ 
            status: 'error', 
            message: `Form Code "${form_code}" not found` 
        });
    }

    const selectedCaseRule = Array.isArray(formConfig.case_rules) && case_key
      ? formConfig.case_rules.find((rule) => rule.key === case_key)
      : null;

    if (case_key && !selectedCaseRule) {
      return res.status(400).json({
        status: 'error',
        message: `Case Key "${case_key}" not found for form "${form_code}".`
      });
    }

    // สร้าง Map เกณฑ์การตรวจรายไฟล์
    const criteriaMap = {};
    if (formConfig.required_documents) {
        formConfig.required_documents.forEach(doc => {
            criteriaMap[doc.key] = doc.validation_criteria || "ตรวจสอบว่าเป็นเอกสารที่ถูกต้อง ชัดเจน และสมบูรณ์";
        });
    }

    const caseRuleText = selectedCaseRule
      ? `
    กรณีที่ผู้ใช้เลือกตรวจ:
    - case_key: "${selectedCaseRule.key}"
    - ชื่อกรณี: "${selectedCaseRule.label || selectedCaseRule.key}"
    - คำอธิบายเพิ่มเติม: "${selectedCaseRule.note || 'ไม่มี'}"
    ${Array.isArray(selectedCaseRule.approval_requirements) && selectedCaseRule.approval_requirements.length > 0
      ? `- ข้อกำหนดเรื่องการลงนาม/ความเห็น:\n${selectedCaseRule.approval_requirements.map((item) => `  - ${item}`).join('\n')}`
      : ''}
    `
      : Array.isArray(formConfig.case_rules) && formConfig.case_rules.length > 0
        ? `
    ฟอร์มนี้มีกรณีย่อย (case rules) ดังนี้:
    ${formConfig.case_rules.map((rule) => `- ${rule.key}: ${rule.label || rule.key}${rule.note ? ` (${rule.note})` : ''}`).join('\n')}
    หากเอกสารหรือรายละเอียดในคำร้องบ่งชี้ชัดว่าเป็นกรณีใด ให้ใช้กรณีนั้นเป็นบริบทในการตรวจ
    `
        : '';

    const approvalRequirementText = Array.isArray(formConfig.approval_requirements) && formConfig.approval_requirements.length > 0
      ? `
    ข้อกำหนดเรื่องการลงนาม/ความเห็นที่ควรปรากฏในเอกสาร:
    ${formConfig.approval_requirements.map((item) => `- ${item}`).join('\n')}
    `
      : '';

    const requiredFieldHintText = Array.isArray(formConfig.required_fields_hint) && formConfig.required_fields_hint.length > 0
      ? `
    รายละเอียดที่ควรมีใน main form หรือคำร้อง:
    ${formConfig.required_fields_hint.map((item) => `- ${item}`).join('\n')}
    `
      : '';

    const project = process.env.GCP_PROJECT_ID || 'ai-formcheck';
    const location = process.env.AI_LOCATION || 'us-central1';
    const bucketName = process.env.GCS_BUCKET_NAME;

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const vertex_ai = new VertexAI({ project: project, location: location });

    // ⚠️ แก้ไข: ใช้โมเดลที่มีอยู่จริง (Gemini 1.5 Flash หรือ Pro)
    // 'gemini-2.5-pro' ยังไม่มีให้บริการ ณ ปัจจุบัน
    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-2.5-pro', // แนะนำใช้ตัวนี้เพราะเร็วและราคาประหยัด หรือ 'gemini-1.5-pro-001' ถ้าต้องการความละเอียดสูง
      generationConfig: { responseMimeType: "application/json" }
    });

    // 2. เตรียมข้อมูลไฟล์ส่งให้ AI
    const fileProcessingPromises = latestUserFiles.map(async (file) => {
        const gcsFile = bucket.file(file.gcs_path);
        
        const [exists] = await gcsFile.exists();
        if (!exists) {
            req.log?.warn('validation_gcs_file_missing', { gcs_path: file.gcs_path });
            return null;
        }
        
        const [metadata] = await gcsFile.getMetadata();
        
        // [FIX 3 - Step A] โหลดไฟล์เป็น Buffer แล้วแปลงเป็น Base64
        const [fileBuffer] = await gcsFile.download();
        const base64Data = fileBuffer.toString('base64');
        
        const specificRule = criteriaMap[file.file_key] || "ตรวจสอบความถูกต้องสมบูรณ์ตามมาตรฐานราชการ";

        return {
            fileKey: file.file_key,
            // [FIX 3 - Step B] ส่งโครงสร้างให้ถูกต้องตาม SDK (part -> inlineData)
            part: {
                inlineData: {
                    mimeType: metadata.contentType,
                    data: base64Data
                }
            },
            ruleDescription: `[เอกสารรหัส: "${file.file_key}"] \n   -> เกณฑ์การตรวจ: "${specificRule}"`
        };
    });

    const processedResults = await Promise.all(fileProcessingPromises);
    const validFiles = processedResults.filter(f => f !== null);

    if (validFiles.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid files available for validation (Files might be missing).' });
    }

    // ⚠️ แก้ไข: ดึงข้อมูลจาก property 'part' ที่ถูกต้อง
    // เดิม: const fileParts = validFiles.map(f => f.inlinePart); <- ผิด เพราะข้างบน return { part: ... }
    const fileParts = validFiles.map(f => f.part);
    const promptRules = validFiles.map(f => f.ruleDescription).join('\n\n');
    
    // ✅ PROMPT ฉบับสมบูรณ์: เพิ่ม Cross-Check, Persona และแนวทางการตอบ
    const promptText = `
    คุณคือ "เจ้าหน้าที่ทะเบียนผู้เชี่ยวชาญ" (Senior Registrar Officer) ของคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย
    หน้าที่ของคุณคือ: ตรวจสอบความถูกต้องและสอดคล้องของเอกสารประกอบคำร้องรหัส "${form_code}" อย่างละเอียดที่สุด

    ระดับการศึกษา: "${degree_level || 'bachelor'}"
    ${sub_type ? `ประเภทย่อยของคำร้อง: "${sub_type}"` : ''}

    รายการเอกสารที่ได้รับและเกณฑ์การตรวจ:
    ${promptRules}

    ${approvalRequirementText}
    ${requiredFieldHintText}
    ${caseRuleText}
    
    🛑 ขั้นตอนการตรวจสอบ (Think Step-by-Step):
    
    1. **Individual Check (ตรวจความสมบูรณ์รายใบ):**
       - **Visual Scan:** ภาพชัดเจนไหม? เอกสารเอียงหรือตัดขอบจนข้อความหายหรือไม่?
       - **Validity Check:** เป็นเอกสารประเภทที่ถูกต้องหรือไม่ (เช่น ให้ส่งสำเนาบัตรประชาชน แต่ส่งรูปเซลฟี่มาถือว่าผิด)
       - **Completeness:** มีลายเซ็นครบถ้วนหรือไม่? (โดยเฉพาะลายเซ็นผู้ปกครองและนิสิต)

    2. **Cross-Check (ตรวจความสอดคล้องข้ามเอกสาร):** **(สำคัญมาก!)**
       - **ชื่อ-นามสกุล:** ต้องสะกดตรงกันทุกใบ (เทียบชื่อในแบบฟอร์ม กับ บัตรประชาชน/บัตรนิสิต/ใบรับรองแพทย์)
       - **รหัสนิสิต:** ตัวเลขต้องตรงกันทุกจุด
       - **วันที่:** หากเป็นใบรับรองแพทย์ วันที่ต้องสอดคล้องกับวันที่ระบุขอลาป่วยในแบบฟอร์ม
       - **ความสมเหตุสมผล:** หากคำร้องระบุสาเหตุ A แต่หลักฐานระบุสาเหตุ B ถือว่าขัดแย้ง

    3. **ข้อกำหนดสำคัญของคีย์ในผลลัพธ์:**
       - ต้องใช้ "เอกสารรหัส" ตามที่ระบบให้ไว้เท่านั้น เช่น "request_form", "supporting_document"
       - ห้ามใช้ชื่อไฟล์จริง, UUID, นามสกุลไฟล์, หรือข้อความอื่นมาเป็น key เด็ดขาด
       - ผลลัพธ์ต้องมี key ครบตรงกับเอกสารที่ได้รับทุกใบ

    รูปแบบการตอบกลับ (JSON Format เท่านั้น):
    {
      "document_key_from_system": {
        "status": "valid" หรือ "invalid",
        "reason": "อธิบายเหตุผลภาษาไทยอย่างสุภาพ ทางการ และชัดเจน (สามารถอธิบายยาวได้หากจำเป็น)",
        "confidence": "high" หรือ "medium" หรือ "low"
      }
    }

    แนวทางการเขียนเหตุผล (Reasoning Guidelines):
    - **กรณีผ่าน:** "เอกสารครบถ้วนสมบูรณ์ (พบลายเซ็นครบถ้วน และชื่อ-นามสกุลตรงกับฐานข้อมูล)"
    - **กรณีไม่ผ่าน (เอกสารไม่สมบูรณ์):** ระบุจุดที่ขาดให้ชัด เช่น "ไม่พบส่วนลายเซ็นของผู้ปกครองที่มุมขวาล่าง กรุณาตรวจสอบว่าอัปโหลดไฟล์ฉบับที่มีลายเซ็นแล้วหรือไม่"
    - **กรณีไม่ผ่าน (ข้อมูลขัดแย้ง):** "ชื่อผู้ยื่นคำร้องในแบบฟอร์ม (นาย ก.) ไม่ตรงกับชื่อในใบรับรองแพทย์ (นาย ข.) กรุณาตรวจสอบเอกสารอีกครั้ง"
    - **กรณีไม่ผ่าน (ภาพไม่ชัด):** "ภาพถ่ายเอกสารมืดหรือเบลอจนไม่สามารถอ่านรายละเอียดสำคัญ (เช่น รหัสนิสิต) ได้ กรุณาถ่ายใหม่"
    - หากฟอร์มนี้มี case rule หรือข้อกำหนดการลงนาม ให้ใช้เป็นส่วนหนึ่งของเกณฑ์การประเมินด้วย
    - ใช้ภาษาไทยแบบกึ่งทางการที่เข้าใจง่าย และเป็นมิตรแต่เด็ดขาดในความถูกต้อง
    `;

    const contents = [{
        role: 'user',
        parts: [{ text: promptText }, ...fileParts]
    }];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    
    // ตรวจสอบ Safety Filter ก่อนเข้าถึงเนื้อหา
    if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
         throw new Error("AI blocked the response (Safety Filter).");
    }

    let aiText = response.candidates[0].content.parts[0].text;
    
    // Clean JSON String (เผื่อ AI เผลอใส่ Markdown backticks มา)
    aiText = aiText.replace(/```json|```/g, '').trim();

    try {
      const usageSnapshot = await recordAiUsage({
        user: req.user,
        route: req.path,
        model: 'gemini-2.5-pro',
        usageMetadata: response.usageMetadata || {},
        degreeLevel: degree_level,
        formCode: form_code,
        subType: sub_type,
        caseKey: case_key,
        success: true
      });
      usageRecorded = true;

      req.log?.audit('ai_usage_recorded', {
        ai_route: req.path,
        model: 'gemini-2.5-pro',
        total_tokens: usageSnapshot.total_tokens,
        request_count: usageSnapshot.request_count
      });
    } catch (usageError) {
      req.log?.warn('ai_usage_record_failed', { message: usageError.message });
    }

    const parsedResult = JSON.parse(aiText);
    const expectedFileKeys = validFiles.map((file) => file.fileKey).filter(Boolean);
    const parsedEntries = parsedResult && typeof parsedResult === 'object' && !Array.isArray(parsedResult)
      ? Object.entries(parsedResult)
      : [];

    const normalizeValidationEntry = (entry = {}) => ({
      status: entry?.status === 'valid' ? 'valid' : 'invalid',
      reason: typeof entry?.reason === 'string' && entry.reason.trim()
        ? entry.reason.trim()
        : 'เอกสารไม่ผ่านการตรวจสอบ กรุณาตรวจสอบและอัปโหลดใหม่อีกครั้ง',
      confidence: ['high', 'medium', 'low'].includes(entry?.confidence) ? entry.confidence : 'medium'
    });

    const normalizedResult = expectedFileKeys.reduce((accumulator, fileKey, index) => {
      const directMatch = Object.prototype.hasOwnProperty.call(parsedResult || {}, fileKey)
        ? parsedResult[fileKey]
        : null;
      const fallbackEntry = parsedEntries[index]?.[1] || {};
      accumulator[fileKey] = normalizeValidationEntry(directMatch || fallbackEntry);
      return accumulator;
    }, {});

    res.json(normalizedResult);

  } catch (error) {
    if (error.statusCode && error.payload) {
        req.log?.warn('validation_ai_limit_blocked', error.payload.data || {});
        return res.status(error.statusCode).json(error.payload);
    }

    if (!usageRecorded) {
        try {
            await recordAiUsage({
                user: req.user,
                route: req.path,
                model: 'gemini-2.5-pro',
                degreeLevel: req.body?.degree_level || null,
                formCode: req.body?.form_code || null,
                subType: req.body?.sub_type || null,
                caseKey: req.body?.case_key || null,
                success: false,
                failureReason: error.message
            });
            usageRecorded = true;
        } catch (usageError) {
            req.log?.warn('ai_usage_record_failed', { message: usageError.message });
        }
    }

    req.log?.error('ai_validation_error', { message: error.message });
    
    // จัดการ Error ให้ Frontend เข้าใจง่าย
    if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Resource Not Found', details: error.message });
    }
    
    // กรณี Gemini มีปัญหา หรือ Quota เต็ม
    res.status(500).json({ 
        error: 'Validation Process Failed', 
        details: process.env.NODE_ENV === 'development' ? error.message : 'AI Service is temporarily unavailable. Please try again later.' 
    });
  }
});

module.exports = router;
