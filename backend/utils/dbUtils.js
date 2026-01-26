const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');

const firestore = new Firestore();
const COLLECTION_NAME = 'user_sessions';

// ⚠️ Key ต้องเป็น Hex String ขนาด 64 ตัวอักษร (32 bytes)
const DB_KEY = process.env.DB_ENCRYPTION_KEY 
    ? Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex') 
    : crypto.randomBytes(32); 

// --- Encryption (AES-256-GCM) ---
const encryptData = (text) => {
    if (!text) return text;
    try {
        const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text);
        const iv = crypto.randomBytes(12); // GCM แนะนำ IV 12 bytes
        const cipher = crypto.createCipheriv('aes-256-gcm', DB_KEY, iv);
        
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex'); // Auth Tag สำคัญสำหรับ GCM
        
        // Format: IV:EncryptedData:AuthTag
        return `${iv.toString('hex')}:${encrypted}:${tag}`;
    } catch (error) {
        console.error('Encryption Error:', error);
        return null;
    }
};

const decryptData = (text) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;
    try {
        const parts = text.split(':');
        if (parts.length !== 3) return text; // ถ้า format ไม่ตรง (อาจเป็นข้อมูลเก่า)
        
        const [ivHex, encryptedHex, tagHex] = parts;
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', DB_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        try { return JSON.parse(decrypted); } catch { return decrypted; }
    } catch (err) {
        console.error('❌ DB Decryption Error (Data might be tampered):', err.message);
        return null; 
    }
};

// --- Firestore Operations ---

exports.initSessionRecord = async (sessionId) => {
    try {
        await firestore.collection(COLLECTION_NAME).doc(sessionId).set({
            created_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
            files: [] 
        }, { merge: true });
        console.log(`✅ Firestore: Session initialized [${sessionId}]`);
    } catch (error) {
        console.error('❌ Firestore Init Error:', error);
    }
};

exports.addFileToSession = async (sessionId, fileMeta) => {
    try {
        const docRef = firestore.collection(COLLECTION_NAME).doc(sessionId);
        
        const encryptedFile = {
            file_key: encryptData(fileMeta.file_key),
            gcs_path: encryptData(fileMeta.gcs_path),
            file_type: encryptData(fileMeta.file_type),
            uploaded_at: new Date().toISOString()
        };

        await docRef.update({
            files: Firestore.FieldValue.arrayUnion(encryptedFile),
            last_active: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Firestore Add File Error:', error);
        throw error;
    }
};

exports.getDecryptedSessionFiles = async (sessionId) => {
    try {
        const docRef = firestore.collection(COLLECTION_NAME).doc(sessionId);
        const doc = await docRef.get();

        if (!doc.exists) return [];
        const data = doc.data();

        if (!data.files || !Array.isArray(data.files)) return [];

        return data.files.map(f => ({
            file_key: decryptData(f.file_key),
            gcs_path: decryptData(f.gcs_path),
            file_type: decryptData(f.file_type),
            uploaded_at: f.uploaded_at
        })).filter(f => f.gcs_path !== null); // กรองไฟล์ที่ถอดรหัสไม่ได้ออก
    } catch (error) {
        console.error('❌ Firestore Get Files Error:', error);
        return [];
    }
};