const { z } = require('zod');

// ✅ Base Schema: ทุก Request ที่เข้ารหัสต้องมี 2 field นี้เสมอ (จาก Security Middleware)
const secureBase = z.object({
    _ts: z.number({ required_error: "Missing timestamp (_ts)" }),
    nonce: z.string({ required_error: "Missing nonce" }).min(1)
});

// 1. Session Init Schema
exports.sessionInitSchema = secureBase; // ไม่ต้องการ field อื่นเพิ่ม

// 1.1 Profile Details Schema
exports.profileDetailsSchema = secureBase.extend({
    include_sensitive_personal_data: z.boolean().optional().default(true)
});

// 2. Chat Recommend Schema
exports.chatRecommendSchema = secureBase.extend({
    message: z.string().min(1, "Message is required").max(1000, "Message is too long"),
    degree_level: z.enum(['bachelor', 'graduate']).optional().default('bachelor')
});

// 3. Document Merge Schema
exports.docMergeSchema = secureBase.extend({
    form_code: z.string().min(1, "Form Code is required").regex(/^[a-zA-Z0-9-_]+$/, "Invalid Form Code format"),
    degree_level: z.string().optional(),
    sub_type: z.string().optional().nullable()
});

const aiDecisionSchema = z.enum(['pass', 'fail', 'needs_human_review']);
const aiCheckStatusSchema = z.enum(['pass', 'fail', 'needs_human_review', 'unknown', 'not_applicable']);

exports.academicCalendarContextSchema = z.object({
    academic_year: z.number().int().positive(),
    terms: z.array(z.object({
        term_code: z.enum(['semester_1', 'semester_2', 'summer']),
        start_date: z.string().min(1),
        end_date: z.string().min(1),
        periods: z.record(z.string(), z.object({
            start_date: z.string().min(1),
            end_date: z.string().min(1)
        })).optional().default({})
    })).default([])
});

exports.aiValidationRuntimeContextSchema = z.object({
    submission_date: z.string().min(1).optional(),
    academic_year: z.number().int().positive().optional(),
    semester: z.enum(['semester_1', 'semester_2', 'summer']).optional(),
    exam_date: z.string().min(1).optional().nullable(),
    grade_announcement_date: z.string().min(1).optional().nullable(),
    planned_payment_date: z.string().min(1).optional().nullable(),
    is_registered_current_term: z.boolean().optional()
}).passthrough();

// 4. Validation Check Schema
exports.validationCheckSchema = secureBase.extend({
    form_code: z.string().min(1, "Form Code is required").regex(/^[a-zA-Z0-9-_]+$/, "Invalid Form Code format"),
    degree_level: z.enum(['bachelor', 'graduate']).optional().default('bachelor'),
    sub_type: z.string().optional().nullable(),
    case_key: z.string().optional().nullable(),
    submission_context: exports.aiValidationRuntimeContextSchema.optional(),
    academic_calendar_context: exports.academicCalendarContextSchema.optional()
});

const aiValidationCheckDetailSchema = z.object({
    status: aiCheckStatusSchema,
    reason_th: z.string().nullable().default(null),
    missing_items: z.array(z.string()).optional().default([]),
    warnings: z.array(z.string()).optional().default([]),
    missing_context: z.array(z.string()).optional().default([]),
    human_review_required: z.boolean().optional().default(false),
    selected_case_key: z.string().optional(),
    compared_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    confidence: z.number().min(0).max(1).optional()
}).passthrough();

exports.aiValidationResultSchema = z.object({
    status: z.literal('success'),
    validator_version: z.string().min(1),
    form_code: z.string().min(1),
    sub_type: z.string().nullable().optional(),
    overall_result: z.object({
        decision: aiDecisionSchema,
        confidence: z.number().min(0).max(1),
        summary_th: z.string().min(1)
    }),
    checks: z.object({
        document_completeness: aiValidationCheckDetailSchema.optional(),
        timing_eligibility: aiValidationCheckDetailSchema.optional(),
        approval_path: aiValidationCheckDetailSchema.optional(),
        case_selection: aiValidationCheckDetailSchema.optional(),
        reason_quality: aiValidationCheckDetailSchema.optional()
    }).passthrough(),
    extracted_context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
    missing_runtime_context: z.array(z.string()).optional().default([]),
    recommendations: z.array(z.string()).optional().default([]),
    raw_policy_refs: z.object({
        timing_rule_used: z.string().nullable().optional(),
        academic_calendar_source: z.string().nullable().optional(),
        required_documents_keys: z.array(z.string()).optional().default([])
    }).optional().default({}),
    legacy_document_results: z.record(z.string(), z.object({
        status: z.enum(['valid', 'invalid', 'error']).optional().default('invalid'),
        reason: z.string().optional().default(''),
        confidence: z.enum(['high', 'medium', 'low']).optional().default('medium')
    })).optional().default({})
});
