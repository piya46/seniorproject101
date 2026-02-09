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
        // 🔥 CRITICAL FIX: ห้ามสุ่ม Key ใหม่เด็ดขาด ถ้าไม่มี Key ต้องหยุดทำงานทันที
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
        throw error; // ควร throw เพื่อให้รู้ว่า save ไม่สำเร็จ
    }
};

const decryptData = (text, keyBuffer = null) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;
    try {
        const key = getDbKey(keyBuffer);
        const parts = text.split(':');
        
        if (parts.length !== 3) return text; 
        
        const [ivHex, encryptedHex, tagHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        try { return JSON.parse(decrypted); } catch { return decrypted; }
    } catch (err) {
        console.error('Decryption Failed (Possible Key Mismatch or Tampering):', err.message);
        return null; 
    }
};

// ... (Export ส่วนอื่นๆ เหมือนเดิม) ...
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
        
        // Encrypt Sensitive Data
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

// ... (ส่วน getDecryptedSessionFiles และ Chat เหมือนเดิม) ...
exports.getDecryptedSessionFiles = async (sessionId) => {
    try {
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
        return files.filter(f => f.gcs_path !== null);
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