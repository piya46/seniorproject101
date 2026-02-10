const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');

const firestore = new Firestore({
    databaseId: 'sessiondd' 
});
const COLLECTION_NAME = 'SESSION';
const SUB_COLLECTION_NAME = 'files';

// Helper: ดึง Key
const getDbKey = (keyBuffer) => {
    if (keyBuffer) return keyBuffer;
    
    const hex = process.env.DB_ENCRYPTION_KEY;
    if (!hex) {
        console.error('❌ FATAL ERROR: DB_ENCRYPTION_KEY is missing in environment variables.');
        throw new Error('DB_ENCRYPTION_KEY is missing. Cannot encrypt/decrypt data safely.');
    }
    return Buffer.from(hex, 'hex');
};

// --- Encryption (AES-256-GCM) ---
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
    // ✅ FIX: ถ้าข้อมูลไม่ใช่ Format ที่ถูกต้อง ให้ return null ทันที (เดิม return text อาจทำ JSON.parse พัง)
    if (!text || typeof text !== 'string' || !text.includes(':')) return null; 

    try {
        const key = getDbKey(keyBuffer);
        const parts = text.split(':');
        
        // ✅ FIX: ตรวจสอบจำนวนส่วนประกอบให้ครบ 3 ส่วน (IV:Data:Tag)
        if (parts.length !== 3) return null; 
        
        const [ivHex, encryptedHex, tagHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        try { return JSON.parse(decrypted); } catch { return decrypted; }
    } catch (err) {
        // Log แค่ว่า Decrypt พลาด แต่อย่าพ่น Error Stack ออกไปถ้าไม่จำเป็น
        console.error('Decryption Failed (Key mismatch or Data tampering):', err.message);
        return null; // ✅ FIX: คืนค่า null เพื่อบอกว่าอ่านไม่ได้
    }
};

// ... (ส่วน Exports อื่นๆ คงเดิม ไม่ต้องแก้) ...
exports.initSessionRecord = async (sessionId) => {
    try {
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
        const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
        
        const encryptedFile = {
            file_key: encryptData(fileMeta.file_key),
            gcs_path: encryptData(fileMeta.gcs_path),
            file_type: encryptData(fileMeta.file_type),
            uploaded_at: new Date().toISOString()
        };

        await filesCollRef.add(encryptedFile);
        
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
        const filesCollRef = firestore.collection(COLLECTION_NAME).doc(sessionId).collection(SUB_COLLECTION_NAME);
        const snapshot = await filesCollRef.get();

        if (snapshot.empty) return [];

        const files = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // ใช้ decryptData ตัวใหม่ที่ปลอดภัยขึ้น
            const gcsPathDecrypted = decryptData(data.gcs_path);

            // ถ้า Decrypt ไม่ได้ (เป็น null) แสดงว่าไฟล์เสีย หรือ Key ผิด -> ให้ข้ามไป
            if (gcsPathDecrypted) {
                files.push({
                    id: doc.id, 
                    file_key: decryptData(data.file_key),
                    gcs_path: gcsPathDecrypted,
                    file_type: decryptData(data.file_type),
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

exports.firestore = firestore;
exports.COLLECTION_NAME = COLLECTION_NAME;
exports.SUB_COLLECTION_NAME = SUB_COLLECTION_NAME;
exports.encryptData = encryptData;
exports.decryptData = decryptData;