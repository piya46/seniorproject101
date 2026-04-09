const express = require('express');
const router = express.Router();
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
// ✅ เพิ่ม Rate Limiter ป้องกันการยิงถล่ม
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { getFormConfig } = require('../data/staticData'); 
const { resolveAcademicCalendarContext } = require('../data/academicCalendar');
const { getDecryptedSessionFiles, updateFileRecord } = require('../utils/dbUtils');
const { AI_USAGE_SCOPES, assertAiWithinDailyLimit, recordAiUsage } = require('../utils/aiUsageUtils');
const { filterFilesForForm, selectLatestFilesByKey } = require('../utils/fileSelection');
const { validationCheckSchema, aiValidationResultSchema } = require('../validators/schemas');
const {
  buildDocumentJobResponse,
  DOCUMENT_JOB_STATUSES,
  DOCUMENT_JOB_TYPES,
  createDocumentJob,
  getDocumentJob
} = require('../utils/documentJobs');

const ensureFilesPreparedForValidation = async ({ files, sessionId, user, req }) => {
  const queuedJobs = [];
  const filesNeedingPreparation = [];

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
      if (!queuedJobs.some((job) => job.id === existingJob.id)) {
        queuedJobs.push(await buildDocumentJobResponse(existingJob));
      }
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

    filesNeedingPreparation.push(file);
  }

  if (filesNeedingPreparation.length > 0) {
    const batchFormCode = String(filesNeedingPreparation[0]?.form_code || '').trim();
    const job = await createDocumentJob({
      type: DOCUMENT_JOB_TYPES.PREPARE_SESSION_DOCUMENTS,
      sessionId,
      requestedBy: {
        email: user.email || null,
        session_id: sessionId
      },
      payload: {
        form_code: batchFormCode,
        files: filesNeedingPreparation.map((file) => ({
          file_key: file.file_key,
          form_code: file.form_code,
          source_file_record_id: file.id,
          raw_gcs_path: file.raw_gcs_path,
          detected_mime: file.detected_mime,
          detected_ext: file.detected_ext,
          source_bytes: file.source_bytes || null
        }))
      },
      metadata: {
        form_code: batchFormCode,
        file_keys: filesNeedingPreparation.map((file) => file.file_key),
        file_count: filesNeedingPreparation.length
      }
    });

    for (const file of filesNeedingPreparation) {
      await updateFileRecord(sessionId, file.id, {
        file_processing_status: 'processing',
        processing_job_id: job.id,
        processing_error: null
      });
    }

    req.log?.audit('validation_file_processing_batch_queued', {
      form_code: batchFormCode,
      file_keys: filesNeedingPreparation.map((file) => file.file_key),
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

const parseIsoDate = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const diffInCalendarDays = (startDate, endDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
};

const getBangkokDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

const addCalendarDays = (date, days) => {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addBusinessDays = (date, days) => {
  const result = startOfDay(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
};

const getTermFromCalendar = (academicCalendarContext, semester) => {
  if (!academicCalendarContext || !Array.isArray(academicCalendarContext.terms)) {
    return null;
  }

  return academicCalendarContext.terms.find((term) => term.term_code === semester) || null;
};

const extractSubmissionContextFromMainForm = ({ files }) => {
  const mainFormFile = Array.isArray(files)
    ? files.find((file) => file?.file_key === 'main_form')
    : null;

  if (!mainFormFile) {
    return {};
  }

  // Hook สำหรับต่อยอด OCR / field extraction จากไฟล์คำร้องหลักในรอบถัดไป
  // ตอนนี้ยังไม่เดาค่าจากชื่อไฟล์หรือ metadata เพื่อหลีกเลี่ยง false positives
  return {};
};

const buildEffectiveSubmissionContext = ({
  submissionContext,
  extractedSubmissionContext
}) => {
  const normalized = {
    ...(extractedSubmissionContext || {}),
    ...(submissionContext || {})
  };

  if (!normalized.submission_date) {
    normalized.submission_date = getBangkokDateString();
  }

  return normalized;
};

const evaluateTimingRule = ({ timingRule, submissionContext, academicCalendarContext }) => {
  if (!timingRule?.enabled) {
    return {
      status: 'not_applicable',
      reason_th: 'ฟอร์มนี้ยังไม่มีเงื่อนไขเวลาที่ต้องใช้ประกอบการสรุปผลในรอบนี้',
      missing_context: [],
      human_review_required: false
    };
  }

  const requiredRuntimeFields = Array.isArray(timingRule.required_runtime_fields)
    ? timingRule.required_runtime_fields
    : [];
  const missingRuntimeContext = requiredRuntimeFields.filter((field) => {
    const value = submissionContext?.[field];
    return value === undefined || value === null || value === '';
  });

  if (missingRuntimeContext.length > 0) {
    return {
      status: 'unknown',
      reason_th: `ยังประเมินเงื่อนไขเวลาไม่ได้ เนื่องจากขาดข้อมูล ${missingRuntimeContext.join(', ')}`,
      missing_context: missingRuntimeContext,
      human_review_required: true
    };
  }

  const submissionDate = parseIsoDate(submissionContext?.submission_date);
  if (!submissionDate) {
    return {
      status: 'unknown',
      reason_th: 'ยังประเมินเงื่อนไขเวลาไม่ได้ เนื่องจาก submission_date ไม่ถูกต้องหรือไม่มีข้อมูล',
      missing_context: ['submission_date'],
      human_review_required: true
    };
  }

  const { submission_window: submissionWindow } = timingRule;
  if (!submissionWindow?.type) {
    return {
      status: 'needs_human_review',
      reason_th: 'มีกฎเวลาแล้ว แต่ยังไม่มีรูปแบบการคำนวณที่แน่ชัด',
      missing_context: [],
      human_review_required: true
    };
  }

  if (submissionWindow.type === 'within_days_after_event') {
    const anchorDate = parseIsoDate(submissionContext?.[submissionWindow.anchor_event]);
    if (!anchorDate) {
      return {
        status: 'unknown',
        reason_th: `ยังประเมินเงื่อนไขเวลาไม่ได้ เนื่องจากไม่มี ${submissionWindow.anchor_event}`,
        missing_context: [submissionWindow.anchor_event],
        human_review_required: true
      };
    }

    const deadline = submissionWindow.business_days
      ? addBusinessDays(anchorDate, submissionWindow.value)
      : addCalendarDays(anchorDate, submissionWindow.value);

    return {
      status: submissionDate <= deadline ? 'pass' : 'fail',
      reason_th: submissionDate <= deadline
        ? `ยื่นภายในระยะเวลาที่กำหนด โดยครบกำหนดวันที่ ${deadline.toISOString().slice(0, 10)}`
        : `ยื่นเกินระยะเวลาที่กำหนด ซึ่งครบกำหนดวันที่ ${deadline.toISOString().slice(0, 10)}`,
      missing_context: [],
      human_review_required: false,
      compared_fields: {
        submission_date: submissionContext?.submission_date || null,
        [submissionWindow.anchor_event]: submissionContext?.[submissionWindow.anchor_event] || null,
        deadline_date: deadline.toISOString().slice(0, 10)
      }
    };
  }

  if (submissionWindow.type === 'within_weeks_after_term_start') {
    const term = getTermFromCalendar(academicCalendarContext, submissionContext?.semester);
    const termStartDate = parseIsoDate(term?.start_date);
    if (!termStartDate) {
      return {
        status: 'unknown',
        reason_th: 'ยังประเมินเงื่อนไขเวลาไม่ได้ เนื่องจากไม่มีวันเปิดภาคการศึกษาใน academic calendar',
        missing_context: ['term_start_date'],
        human_review_required: true
      };
    }

    const deadline = addCalendarDays(termStartDate, (submissionWindow.value * 7) - 1);
    return {
      status: submissionDate <= deadline ? 'pass' : 'fail',
      reason_th: submissionDate <= deadline
        ? `ยื่นภายใน ${submissionWindow.value} สัปดาห์แรกของภาคการศึกษา`
        : `ยื่นเกินช่วง ${submissionWindow.value} สัปดาห์แรกของภาคการศึกษา`,
      missing_context: [],
      human_review_required: false,
      compared_fields: {
        submission_date: submissionContext?.submission_date || null,
        term_start_date: term?.start_date || null,
        deadline_date: deadline.toISOString().slice(0, 10)
      }
    };
  }

  if (submissionWindow.type === 'custom') {
    const term = getTermFromCalendar(academicCalendarContext, submissionContext?.semester);
    const isRegisteredCurrentTerm = submissionContext?.is_registered_current_term;

    if (isRegisteredCurrentTerm === false) {
      const termStartDate = parseIsoDate(term?.start_date);
      if (!termStartDate) {
        return {
          status: 'unknown',
          reason_th: 'ไม่มีวันเปิดภาคการศึกษาสำหรับตรวจกรณียังไม่ลงทะเบียน',
          missing_context: ['term_start_date'],
          human_review_required: true
        };
      }

      const deadline = addCalendarDays(termStartDate, 13);
      return {
        status: submissionDate <= deadline ? 'pass' : 'fail',
        reason_th: submissionDate <= deadline
          ? 'ยื่นอยู่ภายใน 2 สัปดาห์หลังเปิดภาคการศึกษาตามเกณฑ์'
          : 'ยื่นเกิน 2 สัปดาห์หลังเปิดภาคการศึกษาตามเกณฑ์',
        missing_context: [],
        human_review_required: false,
        compared_fields: {
          submission_date: submissionContext?.submission_date || null,
          term_start_date: term?.start_date || null,
          deadline_date: deadline.toISOString().slice(0, 10)
        }
      };
    }

    if (isRegisteredCurrentTerm === true) {
      const finalEndDate = parseIsoDate(term?.periods?.final?.end_date);
      if (!finalEndDate) {
        return {
          status: 'unknown',
          reason_th: 'ไม่มีวันสิ้นสุดสอบปลายภาคสำหรับตรวจกรณีลงทะเบียนแล้ว',
          missing_context: ['final_exam_end_date'],
          human_review_required: true
        };
      }

      return {
        status: submissionDate <= finalEndDate ? 'pass' : 'fail',
        reason_th: submissionDate <= finalEndDate
          ? 'ยื่นก่อนสิ้นสุดช่วงสอบปลายภาคตามเกณฑ์'
          : 'ยื่นหลังช่วงสอบปลายภาคตามเกณฑ์',
        missing_context: [],
        human_review_required: false,
        compared_fields: {
          submission_date: submissionContext?.submission_date || null,
          final_exam_end_date: term?.periods?.final?.end_date || null
        }
      };
    }

    return {
      status: 'needs_human_review',
      reason_th: 'กฎเวลาประเภทนี้ยังต้องอาศัยข้อมูลเพิ่มเติมหรือการพิจารณาโดยเจ้าหน้าที่',
      missing_context: ['is_registered_current_term'],
      human_review_required: true
    };
  }

  return {
    status: 'needs_human_review',
    reason_th: 'รูปแบบกฎเวลานี้ยังไม่ได้รับการรองรับโดยตัวประเมินอัตโนมัติ',
    missing_context: [],
    human_review_required: true
  };
};

const normalizeValidationEntry = (entry = {}) => ({
  status: entry?.status === 'valid' ? 'valid' : 'invalid',
  reason: typeof entry?.reason === 'string' && entry.reason.trim()
    ? entry.reason.trim()
    : 'เอกสารไม่ผ่านการตรวจสอบ กรุณาตรวจสอบและอัปโหลดใหม่อีกครั้ง',
  confidence: ['high', 'medium', 'low'].includes(entry?.confidence) ? entry.confidence : 'medium'
});

const normalizeExtractedSubmissionContext = (rawContext = {}) => {
  const normalized = {};

  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return normalized;
  }

  if (Number.isInteger(rawContext.academic_year)) {
    normalized.academic_year = rawContext.academic_year;
  }

  if (['semester_1', 'semester_2', 'summer'].includes(rawContext.semester)) {
    normalized.semester = rawContext.semester;
  }

  ['exam_date', 'grade_announcement_date', 'planned_payment_date'].forEach((field) => {
    if (typeof rawContext[field] === 'string' && rawContext[field].trim()) {
      normalized[field] = rawContext[field].trim();
    }
  });

  if (typeof rawContext.is_registered_current_term === 'boolean') {
    normalized.is_registered_current_term = rawContext.is_registered_current_term;
  }

  return normalized;
};

const buildLegacyValidationResults = (parsedResult, expectedFileKeys = []) => {
  const documentResults = parsedResult?.document_results && typeof parsedResult.document_results === 'object'
    ? parsedResult.document_results
    : parsedResult;
  const parsedEntries = documentResults && typeof documentResults === 'object' && !Array.isArray(documentResults)
    ? Object.entries(documentResults)
    : [];

  return expectedFileKeys.reduce((accumulator, fileKey, index) => {
    const directMatch = Object.prototype.hasOwnProperty.call(documentResults || {}, fileKey)
      ? documentResults[fileKey]
      : null;
    const fallbackEntry = parsedEntries[index]?.[1] || {};
    accumulator[fileKey] = normalizeValidationEntry(directMatch || fallbackEntry);
    return accumulator;
  }, {});
};

const buildStructuredValidationResult = ({
  formCode,
  subType,
  legacyDocumentResults,
  aiValidationContext,
  submissionContext,
  academicCalendarContext
}) => {
  const documentEntries = Object.entries(legacyDocumentResults || {});
  const invalidEntries = documentEntries.filter(([, entry]) => entry?.status !== 'valid');
  const timingRule = aiValidationContext?.timing_rule || null;
  const timingCheck = evaluateTimingRule({
    timingRule,
    submissionContext,
    academicCalendarContext
  });
  const hasDocumentIssues = invalidEntries.length > 0;
  const hasTimingFailure = timingCheck?.status === 'fail';
  const decision = hasDocumentIssues || hasTimingFailure ? 'fail' : 'pass';
  const summaryTh = hasDocumentIssues
    ? `ตรวจพบเอกสารที่ต้องแก้ไข ${invalidEntries.length} รายการ`
    : hasTimingFailure
      ? 'เอกสารถูกต้อง แต่ไม่ผ่านเงื่อนไขช่วงเวลาตามที่กำหนด'
      : 'เอกสารที่ระบบตรวจสอบผ่านตามเกณฑ์ที่กำหนด';

  const missingItems = invalidEntries.map(([fileKey]) => fileKey);
  const timingMissingContext = Array.isArray(timingCheck?.missing_context)
    ? timingCheck.missing_context
    : [];

  const structuredResult = {
    status: 'success',
    validator_version: 'ai-doc-validator-v1',
    form_code: formCode,
    sub_type: subType || null,
    overall_result: {
      decision,
      confidence: decision === 'fail' ? 0.82 : 0.9,
      summary_th: summaryTh
    },
    checks: {
      document_completeness: {
        status: invalidEntries.length > 0 ? 'fail' : 'pass',
        reason_th: invalidEntries.length > 0
          ? `เอกสารที่ควรตรวจทานเพิ่มเติม: ${missingItems.join(', ')}`
          : 'เอกสารที่อัปโหลดผ่านการตรวจสอบความครบถ้วนในรอบนี้',
        missing_items: missingItems,
        warnings: []
      },
      timing_eligibility: timingCheck
    },
    extracted_context: {
      academic_year: submissionContext?.academic_year ?? null,
      semester: submissionContext?.semester ?? null,
      submission_date: submissionContext?.submission_date ?? null,
      exam_date: submissionContext?.exam_date ?? null,
      grade_announcement_date: submissionContext?.grade_announcement_date ?? null
    },
    missing_runtime_context: timingMissingContext,
    recommendations: invalidEntries.length > 0
      ? ['กรุณาตรวจสอบเอกสารที่ระบบระบุว่าไม่ผ่าน แล้วอัปโหลดใหม่อีกครั้ง']
      : [],
    raw_policy_refs: {
      timing_rule_used: timingRule?.human_readable_rule || null,
      required_documents_keys: Object.keys(legacyDocumentResults || {}),
      academic_calendar_source: academicCalendarContext?.source || null
    },
    legacy_document_results: legacyDocumentResults
  };

  return aiValidationResultSchema.parse(structuredResult);
};

// ✅ เพิ่ม strictLimiter ใน Route
router.post('/check-completeness', authMiddleware, strictLimiter, validate(validationCheckSchema), async (req, res) => {
  let usageRecorded = false;

  try {
    const {
      form_code,
      degree_level,
      sub_type,
      case_key,
      submission_context,
      academic_calendar_context
    } = req.body;
    const sessionId = req.user.session_id;
    await assertAiWithinDailyLimit(req.user, {
      scope: AI_USAGE_SCOPES.VALIDATION_CHECK_COMPLETENESS
    });

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

    const aiValidationContext = formConfig.ai_validation_context || null;
    const aiTimingRuleText = aiValidationContext?.timing_rule?.enabled
      ? `
    กฎเวลา/ช่วงภาคการศึกษาที่ AI ต้องใช้ประกอบการตรวจ:
    - related_terms: ${JSON.stringify(aiValidationContext.timing_rule.related_terms || ['any'])}
    - related_periods: ${JSON.stringify(aiValidationContext.timing_rule.related_periods || ['general'])}
    - human_readable_rule: "${aiValidationContext.timing_rule.human_readable_rule || ''}"
    - required_runtime_fields: ${JSON.stringify(aiValidationContext.timing_rule.required_runtime_fields || [])}
    - เมื่อไม่มีข้อมูลเวลาเพียงพอ: "${aiValidationContext.timing_rule.when_context_missing || 'needs_human_review'}"
    `
      : '';

    const aiValidationDimensionText = Array.isArray(aiValidationContext?.validation_dimensions) && aiValidationContext.validation_dimensions.length > 0
      ? `
    มิติที่ AI ควรตรวจสำหรับฟอร์มนี้:
    ${aiValidationContext.validation_dimensions
      .filter((dimension) => dimension && dimension.enabled)
      .map((dimension) => `- ${dimension.key}: ${dimension.description}`)
      .join('\n')}
    `
      : '';

    const submissionContextText = submission_context
      ? `
    ข้อมูล runtime จากผู้ใช้/ระบบสำหรับตรวจเงื่อนไขเวลา:
    ${JSON.stringify(submission_context, null, 2)}
    `
      : '';

    const academicCalendarText = academic_calendar_context
      ? `
    ปฏิทินการศึกษาที่ระบบส่งมา:
    ${JSON.stringify(academic_calendar_context, null, 2)}
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
    ${aiTimingRuleText}
    ${aiValidationDimensionText}
    ${submissionContextText}
    ${academicCalendarText}
    
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

    2.1 **Timing Check (ตรวจช่วงเวลาและปฏิทินการศึกษา):**
       - ถ้ามี `submission_context` หรือ `academic_calendar_context` ให้ใช้ข้อมูลดังกล่าวเป็นหลัก
       - ห้ามอนุมานช่วงเวลาเพียงจากคำว่า "ปีการศึกษา" อย่างเดียว
       - ถ้าข้อมูลเวลาไม่พอ ให้พิจารณาแบบระมัดระวังและสะท้อนข้อจำกัดไว้ในเหตุผลของไฟล์ที่เกี่ยวข้อง

    3. **ข้อกำหนดสำคัญของคีย์ในผลลัพธ์:**
       - ต้องใช้ "เอกสารรหัส" ตามที่ระบบให้ไว้เท่านั้น เช่น "request_form", "supporting_document"
       - ห้ามใช้ชื่อไฟล์จริง, UUID, นามสกุลไฟล์, หรือข้อความอื่นมาเป็น key เด็ดขาด
       - ผลลัพธ์ต้องมี key ครบตรงกับเอกสารที่ได้รับทุกใบ

    รูปแบบการตอบกลับ (JSON Format เท่านั้น):
    {
      "document_results": {
        "document_key_from_system": {
          "status": "valid" หรือ "invalid",
          "reason": "อธิบายเหตุผลภาษาไทยอย่างสุภาพ ทางการ และชัดเจน (สามารถอธิบายยาวได้หากจำเป็น)",
          "confidence": "high" หรือ "medium" หรือ "low"
        }
      },
      "extracted_submission_context": {
        "academic_year": "ตัวเลขปีการศึกษา เช่น 2568 หรือ null",
        "semester": "\"semester_1\" หรือ \"semester_2\" หรือ \"summer\" หรือ null",
        "exam_date": "YYYY-MM-DD หรือ null",
        "grade_announcement_date": "YYYY-MM-DD หรือ null",
        "planned_payment_date": "YYYY-MM-DD หรือ null",
        "is_registered_current_term": "true / false / null",
        "notes": ["ข้อสังเกตเพิ่มเติมถ้ามี"]
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
        scope: AI_USAGE_SCOPES.VALIDATION_CHECK_COMPLETENESS,
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
    const normalizedResult = buildLegacyValidationResults(parsedResult, expectedFileKeys);
    const extractedSubmissionContext = extractSubmissionContextFromMainForm({
      files: latestUserFiles
    });
    const extractedSubmissionContextFromAi = normalizeExtractedSubmissionContext(
      parsedResult?.extracted_submission_context
    );
    const effectiveSubmissionContext = buildEffectiveSubmissionContext({
      submissionContext: submission_context,
      extractedSubmissionContext: {
        ...extractedSubmissionContext,
        ...extractedSubmissionContextFromAi
      }
    });
    const resolvedAcademicCalendarContext = resolveAcademicCalendarContext({
      academicYear: effectiveSubmissionContext?.academic_year,
      explicitCalendarContext: academic_calendar_context
    });
    const structuredResult = buildStructuredValidationResult({
      formCode: form_code,
      subType: sub_type,
      legacyDocumentResults: normalizedResult,
      aiValidationContext,
      submissionContext: effectiveSubmissionContext,
      academicCalendarContext: resolvedAcademicCalendarContext
    });

    res.json(structuredResult);

  } catch (error) {
    if (error.statusCode && error.payload) {
        req.log?.warn('validation_ai_limit_blocked', error.payload.data || {});
        return res.status(error.statusCode).json(error.payload);
    }

    if (!usageRecorded) {
        try {
            await recordAiUsage({
                user: req.user,
                scope: AI_USAGE_SCOPES.VALIDATION_CHECK_COMPLETENESS,
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
