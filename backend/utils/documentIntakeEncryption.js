const crypto = require('crypto');
const fsp = require('fs/promises');
const { wipeBufferList } = require('./memorySecurity');

const KMS_KEY_NAME_ENV = 'DOCUMENT_INTAKE_KMS_KEY_NAME';

let kmsClientOverride = null;

const loadKmsClient = () => {
    if (kmsClientOverride) {
        return kmsClientOverride;
    }

    const { KeyManagementServiceClient } = require('@google-cloud/kms');
    return new KeyManagementServiceClient();
};

const setKmsClientForTests = (client) => {
    kmsClientOverride = client || null;
};

const getDocumentIntakeKmsKeyName = () => {
    const name = String(process.env[KMS_KEY_NAME_ENV] || '').trim();
    if (!name) {
        throw new Error(`${KMS_KEY_NAME_ENV} is missing.`);
    }

    return name;
};

const generateDocumentIntakeDek = () => crypto.randomBytes(32);

const wrapDekWithKms = async (dekBuffer) => {
    const client = loadKmsClient();
    const [response] = await client.encrypt({
        name: getDocumentIntakeKmsKeyName(),
        plaintext: dekBuffer
    });

    return Buffer.from(response.ciphertext);
};

const unwrapDekWithKms = async (wrappedDekBuffer) => {
    const client = loadKmsClient();
    const [response] = await client.decrypt({
        name: getDocumentIntakeKmsKeyName(),
        ciphertext: wrappedDekBuffer
    });

    return Buffer.from(response.plaintext);
};

const encryptDocumentIntakeToFile = async (sourcePath, encryptedPath) => {
    const dek = generateDocumentIntakeDek();
    const iv = crypto.randomBytes(12);
    const inputBuffer = await fsp.readFile(sourcePath);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const encryptedBuffer = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const wrappedDek = await wrapDekWithKms(dek);
    await fsp.writeFile(encryptedPath, encryptedBuffer);

    wipeBufferList([dek]);

    return {
        iv_base64: iv.toString('base64'),
        tag_base64: authTag.toString('base64'),
        wrapped_dek_base64: wrappedDek.toString('base64')
    };
};

const decryptDocumentIntakeToFile = async (encryptedPath, outputPath, metadata) => {
    const iv = Buffer.from(String(metadata?.iv_base64 || ''), 'base64');
    const authTag = Buffer.from(String(metadata?.tag_base64 || ''), 'base64');
    const wrappedDek = Buffer.from(String(metadata?.wrapped_dek_base64 || ''), 'base64');
    const dek = await unwrapDekWithKms(wrappedDek);
    const encryptedBuffer = await fsp.readFile(encryptedPath);
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    await fsp.writeFile(outputPath, decryptedBuffer);

    wipeBufferList([dek, iv, authTag, wrappedDek]);
};

module.exports = {
    KMS_KEY_NAME_ENV,
    encryptDocumentIntakeToFile,
    decryptDocumentIntakeToFile,
    setKmsClientForTests
};
