// backend/utils/dbUtils.js
const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');

// เริ่มต้น Firestore Client
const firestore = new Firestore();
const COLLECTION_NAME = 'user_sessions';

// ⚠️ KEY สำหรับเข้ารหัส Database (AES-256-CBC)
// ต้องตั้งค่า DB_ENCRYPTION_KEY ใน .env หรือ Secret Manager เป็น Hex String (64 chars)
const DB_KEY = process.env.DB_ENCRYPTION_KEY 
    ? Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex') 
    : crypto.randomBytes(32); 

// --- Helper Functions: เข้ารหัส/ถอดรหัสข้อมูลก่อนลง DB ---

const encryptData = (text) => {
    if (!text) return text;
    // แปลงข้อมูลเป็น String (รองรับทั้ง Object และ Text)
    const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text);
    
    const iv = crypto.randomBytes(16); // สร้าง IV ใหม่ทุกครั้งเพื่อความปลอดภัยสูงสุด
    const cipher = crypto.createCipheriv('aes-256-cbc', DB_KEY, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // คืนค่าในรูปแบบ "IV:EncryptedData"
    return iv.toString('hex') + ':' + encrypted;
};

const decryptData = (text) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', DB_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        // พยายามแปลงกลับเป็น JSON ถ้าทำได้
        try { return JSON.parse(decrypted); } catch { return decrypted; }
    } catch (err) {
        console.error('❌ DB Decryption Error:', err.message);
        return null; // ถ้าถอดไม่ออก (เช่น Key ผิด) ให้คืนค่า null
    }
};

// --- Firestore Operations ---

// 1. สร้าง Session Record ใหม่เมื่อ User เริ่มใช้งาน
exports.initSessionRecord = async (sessionId) => {
    try {
        const docRef = firestore.collection(COLLECTION_NAME).doc(sessionId);
        await docRef.set({
            created_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
            files: [] // เริ่มต้นเป็น Array ว่าง
        }, { merge: true });
        console.log(`✅ Firestore: Session initialized [${sessionId}]`);
    } catch (error) {
        console.error('❌ Firestore Init Error:', error);
    }
};

// 2. เพิ่มไฟล์เข้า Session (Encrypt ข้อมูลก่อนเก็บ)
exports.addFileToSession = async (sessionId, fileMeta) => {
    try {
        const docRef = firestore.collection(COLLECTION_NAME).doc(sessionId);
        
        // เข้ารหัส Metadata ของไฟล์ทั้งหมด
        const encryptedFile = {
            file_key: encryptData(fileMeta.file_key),     // ชื่อประเภทเอกสาร (เช่น "transcript")
            gcs_path: encryptData(fileMeta.gcs_path),     // Path บน Cloud Storage
            file_type: encryptData(fileMeta.file_type),   // Mime Type
            uploaded_at: new Date().toISOString()
        };

        await docRef.update({
            files: Firestore.FieldValue.arrayUnion(encryptedFile),
            last_active: new Date().toISOString()
        });
        console.log(`🔒 Firestore: File added securely to session [${sessionId}]`);
    } catch (error) {
        console.error('❌ Firestore Add File Error:', error);
        throw error;
    }
};

// 3. ดึงรายการไฟล์ของ Session (Decrypt ข้อมูลเพื่อนำไปใช้)
exports.getDecryptedSessionFiles = async (sessionId) => {
    try {
        const docRef = firestore.collection(COLLECTION_NAME).doc(sessionId);
        const doc = await docRef.get();

        if (!doc.exists) return [];
        const data = doc.data();

        if (!data.files || !Array.isArray(data.files)) return [];

        // วนลูปถอดรหัสไฟล์ทีละรายการ
        return data.files.map(f => ({
            file_key: decryptData(f.file_key),
            gcs_path: decryptData(f.gcs_path),
            file_type: decryptData(f.file_type),
            uploaded_at: f.uploaded_at
        }));
    } catch (error) {
        console.error('❌ Firestore Get Files Error:', error);
        return [];
    }
};