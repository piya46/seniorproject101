const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');

const firestore = new Firestore();
const COLLECTION_NAME = 'user_sessions';
const SUB_COLLECTION_NAME = 'files';

// Helper: ดึง Key จาก Argument (สำหรับ Rotation) หรือ Env
const getDbKey = (keyBuffer) => {
    if (keyBuffer) return keyBuffer;
    
    // Default จาก Env
    const hex = process.env.DB_ENCRYPTION_KEY;
    if (!hex) {
        // Fallback (ไม่ควรเกิดขึ้นใน Prod)
        return crypto.randomBytes(32);
    }
    return Buffer.from(hex, 'hex');
};

// --- Encryption (AES-256-GCM) ---
// GCM มี Integrity Check ป้องกันการแอบแก้ไขข้อมูลใน DB
const encryptData = (text, keyBuffer = null) => {
    if (!text) return text;
    try {
        const key = getDbKey(keyBuffer);
        const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text);
        
        // IV 12 bytes สำหรับ GCM
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex'); // Auth Tag สำคัญมาก
        
        // Format: IV:EncryptedData:AuthTag
        return `${iv.toString('hex')}:${encrypted}:${tag}`;
    } catch (error) {
        console.error('Encryption Error:', error);
        return null;
    }
};

const decryptData = (text, keyBuffer = null) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;
    try {
        const key = getDbKey(keyBuffer);
        const parts = text.split(':');
        
        // ต้องมี 3 ส่วน: IV, Data, Tag
        if (parts.length !== 3) return text; 
        
        const [ivHex, encryptedHex, tagHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        try { return JSON.parse(decrypted); } catch { return decrypted; }
    } catch (err) {
        // ถ้า Key ผิด หรือข้อมูลถูกแก้ไข (Tag mismatch) จะเข้า catch นี้
        return null; 
    }
};

// --- Firestore Operations ---

exports.initSessionRecord = async (sessionId) => {
    try {
        // สร้าง Parent Document
        await firestore.collection(COLLECTION_NAME).doc(sessionId).set({
            created_at: new Date().toISOString(),
            last_active: new Date().toISOString()
        }, { merge: true });
        console.log(`✅ Firestore: Session initialized [${sessionId}]`);
    } catch (error) {
        console.error('❌ Firestore Init Error:', error);
    }
};

exports.addFileToSession = async (sessionId, fileMeta) => {
    try {
        // ✅ เก็บลง Subcollection 'files' แทน Array เพื่อรองรับไฟล์จำนวนมาก
        const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
        
        const encryptedFile = {
            file_key: encryptData(fileMeta.file_key),
            gcs_path: encryptData(fileMeta.gcs_path),
            file_type: encryptData(fileMeta.file_type),
            uploaded_at: new Date().toISOString()
        };

        await filesCollRef.add(encryptedFile);
        
        // Update last_active ที่ตัวแม่
        await firestore.collection(COLLECTION_NAME).doc(sessionId).update({
            last_active: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Firestore Add File Error:', error);
        throw error;
    }
};

exports.getDecryptedSessionFiles = async (sessionId) => {
    try {
        // ✅ Query จาก Subcollection
        const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
        const snapshot = await filesCollRef.get();

        if (snapshot.empty) return [];

        const files = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            files.push({
                id: doc.id, 
                file_key: decryptData(data.file_key),
                gcs_path: decryptData(data.gcs_path),
                file_type: decryptData(data.file_type),
                uploaded_at: data.uploaded_at
            });
        });

        // กรองเอาเฉพาะไฟล์ที่ถอดรหัสได้สำเร็จ (เผื่อ Key เก่าหลงเหลือ)
        return files.filter(f => f.gcs_path !== null);
    } catch (error) {
        console.error('❌ Firestore Get Files Error:', error);
        return [];
    }
};

// ✅ เพิ่มฟังก์ชัน: บันทึกข้อความแชทลง Firestore
exports.saveChatMessage = async (sessionId, role, message) => {
    try {
        const chatRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection('chat_history');
        await chatRef.add({
            role: role, 
            parts: [{ text: message }],
            timestamp: Firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Save Chat Error:', error);
    }
};

// ✅ เพิ่มฟังก์ชัน: ดึงประวัติการแชท (เรียงตามเวลา)
exports.getChatHistory = async (sessionId) => {
    try {
        const chatRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection('chat_history');
        const snapshot = await chatRef.orderBy('timestamp', 'asc').get();
        
        if (snapshot.empty) return [];

        return snapshot.docs.map(doc => ({
            role: doc.data().role,
            parts: doc.data().parts
        }));
    } catch (error) {
        console.error('Get History Error:', error);
        return [];
    }
};

// Export objects for Rotation Script
exports.firestore = firestore;
exports.COLLECTION_NAME = COLLECTION_NAME;
exports.SUB_COLLECTION_NAME = SUB_COLLECTION_NAME;
exports.encryptData = encryptData;
exports.decryptData = decryptData;