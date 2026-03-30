const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');
const { baseLog } = require('./logger');

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-formcheck';
const firestore = new Firestore({
    databaseId: FIRESTORE_DATABASE_ID
});
const COLLECTION_NAME = process.env.FIRESTORE_COLLECTION_NAME || 'SESSION';
const SUB_COLLECTION_NAME = process.env.FIRESTORE_FILES_SUBCOLLECTION || 'files';
const AI_USAGE_COLLECTION_NAME = 'AI_USAGE_DAILY';
const DEFAULT_AI_USAGE_RETENTION_DAYS = 30;
const DEFAULT_DB_KEY_VERSION = 'v1';
const DB_ENCRYPTED_FILE_FIELDS = ['file_key', 'gcs_path', 'file_type', 'form_code'];

const getAiUsageRetentionDays = () => {
    const parsed = Number.parseInt(String(process.env.AI_USAGE_RETENTION_DAYS || DEFAULT_AI_USAGE_RETENTION_DAYS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_USAGE_RETENTION_DAYS;
};

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const buildAiUsageExpireAt = (date = new Date()) => {
    const retentionDays = getAiUsageRetentionDays();
    const expireAt = new Date(date);
    expireAt.setUTCDate(expireAt.getUTCDate() + retentionDays);
    expireAt.setUTCHours(23, 59, 59, 999);
    return expireAt;
};

const appendUniqueString = (values = [], input) => {
    const normalized = String(input || '').trim();
    if (!normalized) {
        return Array.isArray(values) ? values : [];
    }

    const existing = Array.isArray(values) ? values.filter(Boolean).map((value) => String(value)) : [];
    if (existing.includes(normalized)) {
        return existing;
    }

    return [...existing, normalized];
};

const normalizeDbKeyVersion = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return /^v[1-9]\d*$/.test(normalized) ? normalized : DEFAULT_DB_KEY_VERSION;
};

const getCurrentDbKeyVersion = () =>
    normalizeDbKeyVersion(process.env.DB_ENCRYPTION_KEY_VERSION || DEFAULT_DB_KEY_VERSION);

const getDbKeyEnvNameForVersion = (version) =>
    version === DEFAULT_DB_KEY_VERSION ? 'DB_ENCRYPTION_KEY' : `DB_ENCRYPTION_KEY_${version.toUpperCase()}`;

const getDbKeyByVersion = (version, keyBuffer = null) => {
    if (keyBuffer) {
        return keyBuffer;
    }

    const normalizedVersion = normalizeDbKeyVersion(version);
    const envName = getDbKeyEnvNameForVersion(normalizedVersion);
    const hex = process.env[envName] || (normalizedVersion === DEFAULT_DB_KEY_VERSION ? process.env.DB_ENCRYPTION_KEY : '');
    if (!hex) throw new Error(`${envName} is missing.`);
    return Buffer.from(hex, 'hex');
};

const getDbKey = (keyBuffer) => getDbKeyByVersion(getCurrentDbKeyVersion(), keyBuffer);

const serializeEncryptedValue = (keyVersion, ivHex, encryptedHex, tagHex) =>
    `${normalizeDbKeyVersion(keyVersion)}:${ivHex}:${encryptedHex}:${tagHex}`;

const parseEncryptedValue = (text) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return null;

    const parts = text.split(':');

    if (parts.length === 3) {
        const [ivHex, encryptedHex, tagHex] = parts;
        return {
            keyVersion: null,
            ivHex,
            encryptedHex,
            tagHex,
            isLegacyFormat: true
        };
    }

    if (parts.length === 4 && /^v[1-9]\d*$/i.test(parts[0])) {
        const [keyVersion, ivHex, encryptedHex, tagHex] = parts;
        return {
            keyVersion: normalizeDbKeyVersion(keyVersion),
            ivHex,
            encryptedHex,
            tagHex,
            isLegacyFormat: false
        };
    }

    return null;
};

const getEncryptedFieldMigrationState = (value, targetVersion = getCurrentDbKeyVersion()) => {
    if (value === null || typeof value === 'undefined') {
        return {
            hasValue: false,
            isEncrypted: false,
            keyVersion: null,
            needsMigration: false,
            isLegacyFormat: false
        };
    }

    const parsed = parseEncryptedValue(value);
    if (!parsed) {
        return {
            hasValue: true,
            isEncrypted: false,
            keyVersion: null,
            needsMigration: false,
            isLegacyFormat: false
        };
    }

    const normalizedTargetVersion = normalizeDbKeyVersion(targetVersion);
    const effectiveVersion = parsed.isLegacyFormat ? 'legacy' : parsed.keyVersion;

    return {
        hasValue: true,
        isEncrypted: true,
        keyVersion: effectiveVersion,
        needsMigration: parsed.isLegacyFormat || parsed.keyVersion !== normalizedTargetVersion,
        isLegacyFormat: parsed.isLegacyFormat
    };
};

const getSessionFileMigrationPlan = (record = {}, targetVersion = getCurrentDbKeyVersion()) => {
    const normalizedTargetVersion = normalizeDbKeyVersion(targetVersion);
    const fieldStates = {};
    let needsMigration = false;
    let migratableFieldCount = 0;

    for (const fieldName of DB_ENCRYPTED_FILE_FIELDS) {
        const state = getEncryptedFieldMigrationState(record[fieldName], normalizedTargetVersion);
        fieldStates[fieldName] = state;

        if (state.isEncrypted) {
            migratableFieldCount += 1;
        }

        if (state.needsMigration) {
            needsMigration = true;
        }
    }

    return {
        targetVersion: normalizedTargetVersion,
        needsMigration,
        migratableFieldCount,
        fieldStates
    };
};

const reencryptSessionFileRecord = (record = {}, options = {}) => {
    const targetVersion = normalizeDbKeyVersion(options.targetVersion || getCurrentDbKeyVersion());
    const nextRecord = {};

    for (const fieldName of DB_ENCRYPTED_FILE_FIELDS) {
        const value = record[fieldName];

        if (value === null || typeof value === 'undefined') {
            nextRecord[fieldName] = value ?? null;
            continue;
        }

        const decryptedValue = decryptData(value, options.sourceKeyBuffer || null);
        if (decryptedValue === null) {
            throw new Error(`Unable to decrypt field "${fieldName}" during DB encryption migration.`);
        }

        nextRecord[fieldName] = encryptData(decryptedValue, options.targetKeyBuffer || null, {
            keyVersion: targetVersion
        });
    }

    nextRecord.encryption_key_version = targetVersion;
    nextRecord.updated_at = new Date().toISOString();

    return nextRecord;
};

const encryptData = (text, keyBuffer = null, options = {}) => {
    if (!text) return text;
    try {
        const keyVersion = normalizeDbKeyVersion(options.keyVersion || getCurrentDbKeyVersion());
        const key = getDbKeyByVersion(keyVersion, keyBuffer);
        const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');
        return serializeEncryptedValue(keyVersion, iv.toString('hex'), encrypted, tag);
    } catch (error) {
        console.error('Encryption Error:', error);
        throw error; 
    }
};

const decryptData = (text, keyBuffer = null) => {
    const parsed = parseEncryptedValue(text);
    if (!parsed) return null;

    try {
        const key = parsed.isLegacyFormat
            ? getDbKey(keyBuffer)
            : getDbKeyByVersion(parsed.keyVersion, keyBuffer);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(parsed.tagHex, 'hex'));
        let decrypted = decipher.update(parsed.encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        try { return JSON.parse(decrypted); } catch { return decrypted; }
    } catch (err) {
        return null; 
    }
};

exports.initSessionRecord = async (sessionId) => {
    await firestore.collection(COLLECTION_NAME).doc(sessionId).set({
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
    }, { merge: true });
};

exports.revokeSessionRecord = async (sessionId) => {
    if (!sessionId) {
        return;
    }

    try {
        await firestore.collection(COLLECTION_NAME).doc(sessionId).delete();
    } catch (error) {
        console.error('❌ Revoke Session Error:', error.message);
        throw error;
    }
};

exports.addFileToSession = async (sessionId, fileMeta) => {
    const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
    const encryptedFile = {
        file_key: encryptData(fileMeta.file_key),
        gcs_path: encryptData(fileMeta.gcs_path),
        file_type: encryptData(fileMeta.file_type),
        form_code: encryptData(fileMeta.form_code), // เพิ่ม field form_code
        encryption_key_version: getCurrentDbKeyVersion(),
        uploaded_at: new Date().toISOString()
    };
    await filesCollRef.add(encryptedFile);
    await firestore.collection(COLLECTION_NAME).doc(sessionId).update({
        last_active: new Date().toISOString()
    });
};

// ✅ NEW: ค้นหาไฟล์เก่า (ต้อง Decrypt มาเช็คเพราะ Encrypt at App Level)
exports.getFileRecordByKey = async (sessionId, fileKey, formCode) => {
    try {
        const snapshot = await firestore.collection(COLLECTION_NAME).doc(sessionId)
            .collection(SUB_COLLECTION_NAME).get();

        if (snapshot.empty) return null;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const decryptedKey = decryptData(data.file_key);
            const decryptedForm = decryptData(data.form_code); // ค่านี้จะเป็น null สำหรับไฟล์เก่า

            // ✅ FIX: เพิ่มเงื่อนไข !decryptedForm เพื่อรองรับไฟล์เก่า
            if (decryptedKey === fileKey && (decryptedForm === formCode || !decryptedForm || formCode === 'general')) {
                return { 
                    id: doc.id, 
                    gcs_path: decryptData(data.gcs_path) 
                };
            }
        }
        return null;
    } catch (error) {
        baseLog('error', 'db_get_file_by_key_failed', { message: error.message });
        return null;
    }
};

// ✅ NEW: ลบไฟล์จาก DB
exports.deleteFileRecord = async (sessionId, docId) => {
    try {
        await firestore.collection(COLLECTION_NAME).doc(sessionId)
            .collection(SUB_COLLECTION_NAME).doc(docId).delete();
        baseLog('info', 'db_file_record_deleted', {
            doc_id: docId,
            session_id: sessionId
        });
    } catch (error) {
        baseLog('error', 'db_delete_file_record_failed', {
            doc_id: docId,
            session_id: sessionId,
            message: error.message
        });
        throw error;
    }
};

exports.getDecryptedSessionFiles = async (sessionId) => {
    try {
        const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
        const snapshot = await filesCollRef.get();
        if (snapshot.empty) return [];

        const files = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const gcsPathDecrypted = decryptData(data.gcs_path);
            const fileKeyDecrypted = decryptData(data.file_key);
            
            if (gcsPathDecrypted && fileKeyDecrypted) {
                files.push({
                    id: doc.id, 
                    file_key: fileKeyDecrypted,
                    gcs_path: gcsPathDecrypted,
                    file_type: decryptData(data.file_type),
                    form_code: decryptData(data.form_code),
                    uploaded_at: data.uploaded_at
                });
            }
        });
        return files;
    } catch (error) {
        console.error('❌ Firestore Get Files Error:', error);
        return [];
    }
};

// ... (Chat Functions คงเดิม) ...
exports.saveChatMessage = async (sessionId, role, message) => {
    /* Code เดิม */
    try {
        await firestore.collection(COLLECTION_NAME).doc(sessionId).collection('chat_history').add({
            role, parts: [{ text: message }], timestamp: Firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error(e); }
};

exports.getChatHistory = async (sessionId) => {
    /* Code เดิม */
    try {
        const s = await firestore.collection(COLLECTION_NAME).doc(sessionId).collection('chat_history').orderBy('timestamp', 'asc').get();
        return s.docs.map(d => ({ role: d.data().role, parts: d.data().parts }));
    } catch (e) { return []; }
};

exports.checkAndMarkNonce = async (nonce, expireSeconds) => {
    // ใช้ Collection แยกชื่อ 'used_nonces' (เพื่อไม่ให้ปนกับ Session)
    const nonceRef = firestore.collection('used_nonces').doc(nonce);

    try {
        // ใช้ Transaction เพื่อความชัวร์ (Atomic Operation) ป้องกัน Race Condition
        return await firestore.runTransaction(async (t) => {
            const doc = await t.get(nonceRef);
            
            if (doc.exists) {
                // เจอว่ามีอยู่แล้ว = ซ้ำ (Replay Attack!)
                return false; 
            }

            // ถ้ายังไม่มี ให้บันทึกใหม่
            // expire_at ใช้สำหรับทำ TTL (ให้ Google Cloud ลบให้อัตโนมัติ)
            const expireDate = new Date(Date.now() + (expireSeconds * 1000));
            t.set(nonceRef, { 
                created_at: new Date(),
                expire_at: expireDate 
            });
            
            return true; // ผ่าน (Unique)
        });
    } catch (error) {
        console.error('❌ Firestore Nonce Error:', error);
        // กรณี Error ให้ถือว่าไม่ผ่านไว้ก่อนเพื่อความปลอดภัย (Fail Closed)
        return false; 
    }
};

const buildAiUsageDocRef = (usageKey, dateKey) =>
    firestore.collection(AI_USAGE_COLLECTION_NAME).doc(`${dateKey}:${usageKey}`);

exports.getAiUsageForToday = async (usageKey, date = new Date()) => {
    const dateKey = getDateKey(date);

    try {
        const snapshot = await buildAiUsageDocRef(usageKey, dateKey).get();
        if (!snapshot.exists) {
            return {
                date_key: dateKey,
                request_count: 0,
                prompt_tokens: 0,
                candidate_tokens: 0,
                total_tokens: 0
            };
        }

        return snapshot.data() || {};
    } catch (error) {
        console.error('❌ Firestore AI Usage Read Error:', error);
        throw error;
    }
};

exports.listAiUsageByDate = async (date = new Date(), limit = 100) => {
    const dateKey = getDateKey(date);
    const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);

    try {
        const snapshot = await firestore
            .collection(AI_USAGE_COLLECTION_NAME)
            .where('date_key', '==', dateKey)
            .orderBy('total_tokens', 'desc')
            .limit(cappedLimit)
            .get();

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('❌ Firestore AI Usage List Error:', error);
        throw error;
    }
};

exports.recordAiUsageForToday = async ({
    usageKey,
    identityType,
    identityValue,
    sessionId,
    email,
    route,
    model,
    degreeLevel,
    formCode,
    subType,
    caseKey,
    success = true,
    failureReason = null,
    prompt_tokens = 0,
    candidate_tokens = 0,
    total_tokens = 0
}, date = new Date()) => {
    const dateKey = getDateKey(date);
    const docRef = buildAiUsageDocRef(usageKey, dateKey);

    try {
        return await firestore.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(docRef);
            const existing = snapshot.exists ? snapshot.data() || {} : {};
            const nextData = {
                date_key: dateKey,
                usage_key: usageKey,
                identity_type: identityType,
                identity_value: identityValue,
                session_id: sessionId || null,
                email: email || null,
                route: route || existing.route || null,
                model: model || existing.model || null,
                request_count: Number(existing.request_count || 0) + 1,
                success_count: Number(existing.success_count || 0) + (success ? 1 : 0),
                failure_count: Number(existing.failure_count || 0) + (success ? 0 : 1),
                prompt_tokens: Number(existing.prompt_tokens || 0) + Number(prompt_tokens || 0),
                candidate_tokens: Number(existing.candidate_tokens || 0) + Number(candidate_tokens || 0),
                total_tokens: Number(existing.total_tokens || 0) + Number(total_tokens || 0),
                degree_levels: appendUniqueString(existing.degree_levels, degreeLevel),
                form_codes: appendUniqueString(existing.form_codes, formCode),
                sub_types: appendUniqueString(existing.sub_types, subType),
                case_keys: appendUniqueString(existing.case_keys, caseKey),
                last_status: success ? 'success' : 'failure',
                last_failure_reason: success ? null : (failureReason || existing.last_failure_reason || null),
                last_used_at: new Date().toISOString(),
                expire_at: buildAiUsageExpireAt(date)
            };

            if (!snapshot.exists) {
                nextData.created_at = new Date().toISOString();
            } else {
                nextData.created_at = existing.created_at || new Date().toISOString();
            }

            transaction.set(docRef, nextData, { merge: true });
            return nextData;
        });
    } catch (error) {
        console.error('❌ Firestore AI Usage Write Error:', error);
        throw error;
    }
};

exports.firestore = firestore;
exports.COLLECTION_NAME = COLLECTION_NAME;
exports.SUB_COLLECTION_NAME = SUB_COLLECTION_NAME;
exports.AI_USAGE_COLLECTION_NAME = AI_USAGE_COLLECTION_NAME;
exports.getAiUsageRetentionDays = getAiUsageRetentionDays;
exports.getCurrentDbKeyVersion = getCurrentDbKeyVersion;
exports.getDbKeyByVersion = getDbKeyByVersion;
exports.DB_ENCRYPTED_FILE_FIELDS = DB_ENCRYPTED_FILE_FIELDS;
exports.normalizeDbKeyVersion = normalizeDbKeyVersion;
exports.parseEncryptedValue = parseEncryptedValue;
exports.getEncryptedFieldMigrationState = getEncryptedFieldMigrationState;
exports.getSessionFileMigrationPlan = getSessionFileMigrationPlan;
exports.reencryptSessionFileRecord = reencryptSessionFileRecord;
exports.encryptData = encryptData;
exports.decryptData = decryptData;
