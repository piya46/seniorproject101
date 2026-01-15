// backend/utils/cryptoUtils.js
const crypto = require('crypto');

let PRIVATE_KEY, PUBLIC_KEY;

// 1. โหลด Key จาก Environment Variable (ซึ่งมาจาก Secret Manager)
if (process.env.Gb_PRIVATE_KEY_BASE64 && process.env.Gb_PUBLIC_KEY_BASE64) {
    try {
        PRIVATE_KEY = Buffer.from(process.env.Gb_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
        PUBLIC_KEY = Buffer.from(process.env.Gb_PUBLIC_KEY_BASE64, 'base64').toString('utf8');
    } catch (e) {
        console.error("❌ Error loading keys from Env:", e.message);
    }
} else {
    if (process.env.NODE_ENV === 'production') {
        console.error("❌ CRITICAL: Missing Keys in Production!");
        process.exit(1);
    }
}

exports.getPublicKey = () => PUBLIC_KEY;

// 2. ถอดรหัส (Hybrid Decrypt: RSA Unwrap Key -> AES Decrypt Data)
exports.decryptHybridPayload = (encryptedPackage) => {
    try {
        const { encKey, iv, tag, payload } = encryptedPackage;

        // ขั้นที่ 1: ใช้ Private Key แกะ AES Key ออกมา
        const aesKeyBuffer = crypto.privateDecrypt(
            {
                key: PRIVATE_KEY,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(encKey, 'base64')
        );

        // ขั้นที่ 2: ใช้ AES Key แกะข้อมูลจริง
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBuffer, Buffer.from(iv, 'base64'));
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        
        let decrypted = decipher.update(payload, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return {
            data: JSON.parse(decrypted),
            aesKey: aesKeyBuffer // ส่งคืนเพื่อใช้เข้ารหัสขากลับ (Session Key)
        };

    } catch (error) {
        console.error('Decryption Failed:', error.message);
        return null;
    }
};

// 3. เข้ารหัส (Symmetric Encrypt: AES)
exports.encryptSymmetric = (data, aesKeyBuffer) => {
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', aesKeyBuffer, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return {
            payload: encrypted,
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64')
        };
    } catch (error) {
        console.error('Encryption Failed:', error);
        throw error;
    }
};