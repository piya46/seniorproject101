const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');

const firestore = new Firestore({
    databaseId: 'sessiondd' 
});
const COLLECTION_NAME = 'SESSION';
const SUB_COLLECTION_NAME = 'files';

const getDbKey = (keyBuffer) => {
    if (keyBuffer) return keyBuffer;
    const hex = process.env.DB_ENCRYPTION_KEY;
    if (!hex) throw new Error('DB_ENCRYPTION_KEY is missing.');
    return Buffer.from(hex, 'hex');
};

const encryptData = (text, keyBuffer = null) => {
    if (!text) return text;
    try {
        const key = getDbKey(keyBuffer);
        const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${encrypted}:${tag}`;
    } catch (error) {
        console.error('Encryption Error:', error);
        throw error; 
    }
};

const decryptData = (text, keyBuffer = null) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return null; 
    try {
        const key = getDbKey(keyBuffer);
        const parts = text.split(':');
        if (parts.length !== 3) return null; 
        const [ivHex, encryptedHex, tagHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
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

exports.addFileToSession = async (sessionId, fileMeta) => {
    const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
    const encryptedFile = {
        file_key: encryptData(fileMeta.file_key),
        gcs_path: encryptData(fileMeta.gcs_path),
        file_type: encryptData(fileMeta.file_type),
        form_code: encryptData(fileMeta.form_code), // เพิ่ม field form_code
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
        console.error('❌ Get File By Key Error:', error.message);
        return null;
    }
};

// ✅ NEW: ลบไฟล์จาก DB
exports.deleteFileRecord = async (sessionId, docId) => {
    try {
        await firestore.collection(COLLECTION_NAME).doc(sessionId)
            .collection(SUB_COLLECTION_NAME).doc(docId).delete();
        console.log(`✅ DB Record Deleted: ${docId}`);
    } catch (error) {
        console.error('❌ Delete DB Record Error:', error.message);
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

exports.firestore = firestore;
exports.COLLECTION_NAME = COLLECTION_NAME;
exports.SUB_COLLECTION_NAME = SUB_COLLECTION_NAME;
exports.encryptData = encryptData;
exports.decryptData = decryptData;