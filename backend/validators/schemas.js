const { z } = require('zod');

// ✅ Base Schema: ทุก Request ที่เข้ารหัสต้องมี 2 field นี้เสมอ (จาก Security Middleware)
const secureBase = z.object({
    _ts: z.number({ required_error: "Missing timestamp (_ts)" }),
    nonce: z.string({ required_error: "Missing nonce" }).min(1)
});

// 1. Session Init Schema
exports.sessionInitSchema = secureBase; // ไม่ต้องการ field อื่นเพิ่ม

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

// 4. Validation Check Schema
exports.validationCheckSchema = secureBase.extend({
    form_code: z.string().min(1, "Form Code is required").regex(/^[a-zA-Z0-9-_]+$/, "Invalid Form Code format"),
    degree_level: z.enum(['bachelor', 'graduate']).optional().default('bachelor'),
    sub_type: z.string().optional().nullable()
});
