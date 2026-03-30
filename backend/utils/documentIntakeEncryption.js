const crypto = require('crypto');
const fsp = require('fs/promises');

const DOCUMENT_INTAKE_KEY_ENV = 'DOCUMENT_INTAKE_ENCRYPTION_KEY';

const getDocumentIntakeEncryptionKey = () => {
    const hex = String(process.env[DOCUMENT_INTAKE_KEY_ENV] || '').trim();
    if (!hex) {
        throw new Error(`${DOCUMENT_INTAKE_KEY_ENV} is missing.`);
    }

    if (!/^[0-9a-f]{64}$/i.test(hex)) {
        throw new Error(`${DOCUMENT_INTAKE_KEY_ENV} must be a 64-character hex string.`);
    }

    return Buffer.from(hex, 'hex');
};

const encryptDocumentIntakeToFile = async (sourcePath, encryptedPath) => {
    const key = getDocumentIntakeEncryptionKey();
    const iv = crypto.randomBytes(12);
    const inputBuffer = await fsp.readFile(sourcePath);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encryptedBuffer = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    await fsp.writeFile(encryptedPath, encryptedBuffer);

    key.fill(0);

    return {
        iv_base64: iv.toString('base64'),
        tag_base64: authTag.toString('base64')
    };
};

const decryptDocumentIntakeToFile = async (encryptedPath, outputPath, metadata) => {
    const key = getDocumentIntakeEncryptionKey();
    const iv = Buffer.from(String(metadata?.iv_base64 || ''), 'base64');
    const authTag = Buffer.from(String(metadata?.tag_base64 || ''), 'base64');
    const encryptedBuffer = await fsp.readFile(encryptedPath);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    await fsp.writeFile(outputPath, decryptedBuffer);

    key.fill(0);
    iv.fill(0);
    authTag.fill(0);
};

module.exports = {
    DOCUMENT_INTAKE_KEY_ENV,
    encryptDocumentIntakeToFile,
    decryptDocumentIntakeToFile
};
