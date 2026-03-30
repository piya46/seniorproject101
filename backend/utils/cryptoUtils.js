const crypto = require('crypto');
const { wipeBuffer, wipeBufferList } = require('./memorySecurity');

const decodeBase64Pem = (base64Value) => Buffer.from(base64Value, 'base64').toString('utf8').trim();

const normalizePublicMaterial = (value) => {
    if (!value) return { publicKeyPem: value, certificateInfo: null };

    const trimmedValue = String(value).trim();

    if (trimmedValue.includes('BEGIN CERTIFICATE')) {
        const certificate = new crypto.X509Certificate(trimmedValue);
        return {
            publicKeyPem: certificate.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
            certificateInfo: {
                subject: certificate.subject,
                issuer: certificate.issuer,
                validFrom: certificate.validFrom,
                validTo: certificate.validTo
            }
        };
    }

    if (trimmedValue.includes('BEGIN PUBLIC KEY')) {
        return { publicKeyPem: trimmedValue, certificateInfo: null };
    }

    const derivedPublicKey = crypto.createPublicKey(trimmedValue);
    return {
        publicKeyPem: derivedPublicKey.export({ type: 'spki', format: 'pem' }).toString(),
        certificateInfo: null
    };
};

const validateKeyPair = (privateKeyPem, publicKeyPem, label) => {
    const probe = crypto.randomBytes(32);
    let encrypted = null;
    let decrypted = null;

    try {
        encrypted = crypto.publicEncrypt(
            {
                key: publicKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            probe
        );

        decrypted = crypto.privateDecrypt(
            {
                key: privateKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            encrypted
        );

        if (!crypto.timingSafeEqual(probe, decrypted)) {
            throw new Error(`Key validation failed for ${label}: public/private key pair mismatch.`);
        }
    } finally {
        wipeBufferList([probe, encrypted, decrypted]);
    }
};

const buildKeySlot = (label, privateKeyBase64, publicMaterialBase64) => {
    if (!privateKeyBase64 || !publicMaterialBase64) {
        return null;
    }

    const privateKeyPem = decodeBase64Pem(privateKeyBase64);
    const { publicKeyPem, certificateInfo } = normalizePublicMaterial(decodeBase64Pem(publicMaterialBase64));

    validateKeyPair(privateKeyPem, publicKeyPem, label);

    if (certificateInfo?.validTo) {
        const expiryTime = Date.parse(certificateInfo.validTo);
        if (!Number.isNaN(expiryTime) && expiryTime <= Date.now()) {
            throw new Error(`Certificate for ${label} is expired at ${certificateInfo.validTo}.`);
        }
    }

    return {
        label,
        privateKeyPem,
        publicKeyPem,
        certificateInfo
    };
};

const loadKeySlots = () => {
    const currentSlot = buildKeySlot(
        'current',
        process.env.Gb_PRIVATE_KEY_BASE64,
        process.env.Gb_PUBLIC_KEY_BASE64
    );

    const previousSlot = buildKeySlot(
        'previous',
        process.env.Gb_PREVIOUS_PRIVATE_KEY_BASE64,
        process.env.Gb_PREVIOUS_PUBLIC_KEY_BASE64
    );

    return {
        currentSlot,
        allSlots: [currentSlot, previousSlot].filter(Boolean)
    };
};

const tryDecryptWithPrivateKey = (slot, encKey) => {
    const encryptedKeyBuffer = Buffer.from(encKey, 'base64');

    try {
        return crypto.privateDecrypt(
            {
                key: slot.privateKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            encryptedKeyBuffer
        );
    } finally {
        wipeBuffer(encryptedKeyBuffer);
    }
};

let ACTIVE_CRYPTO_PROVIDER = null;

try {
    const { currentSlot, allSlots } = loadKeySlots();

    ACTIVE_CRYPTO_PROVIDER = {
        currentSlot,
        allSlots,
        getPublicKey() {
            return currentSlot?.publicKeyPem || null;
        },
        getKeyStatus() {
            return {
                activeLabel: currentSlot?.label || null,
                rotationEnabled: allSlots.length > 1,
                activeCertificateValidTo: currentSlot?.certificateInfo?.validTo || null
            };
        },
        decryptEnvelopeKey(encKey) {
            let aesKeyBuffer = null;
            let lastDecryptError = null;

            for (const slot of allSlots) {
                try {
                    aesKeyBuffer = tryDecryptWithPrivateKey(slot, encKey);
                    break;
                } catch (error) {
                    lastDecryptError = error;
                }
            }

            if (!aesKeyBuffer) {
                throw lastDecryptError || new Error('No private key could decrypt the payload.');
            }

            return aesKeyBuffer;
        }
    };

    const keyStatus = ACTIVE_CRYPTO_PROVIDER.getKeyStatus();

    if (keyStatus.activeCertificateValidTo) {
        console.log(`🔑 Active public certificate loaded. Valid to: ${keyStatus.activeCertificateValidTo}`);
    }

    if (keyStatus.rotationEnabled) {
        console.log(`🔄 Key rotation enabled with ${ACTIVE_CRYPTO_PROVIDER.allSlots?.length || 0} private key slot(s).`);
    }
} catch (e) {
    console.error('❌ Error loading crypto keys:', e.message);
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

if (!ACTIVE_CRYPTO_PROVIDER?.getPublicKey?.() && process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: Crypto keys are not ready in production.');
    process.exit(1);
}

const decryptEnvelopeKey = (encKey) => {
    if (!ACTIVE_CRYPTO_PROVIDER) {
        throw new Error('Crypto provider is not initialized.');
    }

    return ACTIVE_CRYPTO_PROVIDER.decryptEnvelopeKey(encKey);
};

exports.decryptEnvelopeKey = decryptEnvelopeKey;
exports.getPublicKey = () => ACTIVE_CRYPTO_PROVIDER?.getPublicKey?.() || null;
exports.getKeyStatus = () => ACTIVE_CRYPTO_PROVIDER?.getKeyStatus?.() || {
    activeLabel: null,
    rotationEnabled: false,
    activeCertificateValidTo: null
};

exports.decryptHybridPayload = (encryptedPackage) => {
    let aesKeyBuffer = null;
    let ivBuffer = null;
    let authTagBuffer = null;
    try {
        const { encKey, iv, tag, payload } = encryptedPackage;
        if (!encKey || !iv || !tag || !payload) return null; // Validate structure

        // ขั้นที่ 1: ใช้ Private Key แกะ AES Key ออกมา
        aesKeyBuffer = decryptEnvelopeKey(encKey);
        ivBuffer = Buffer.from(iv, 'base64');
        authTagBuffer = Buffer.from(tag, 'base64');

        // ขั้นที่ 2: ใช้ AES Key แกะข้อมูลจริง
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBuffer, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        
        let decrypted = decipher.update(payload, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return {
            data: JSON.parse(decrypted),
            aesKey: aesKeyBuffer 
        };

    } catch (error) {
        // Log แค่ message พอ อย่า Log error เต็มๆ เพราะอาจมี Sensitive Data
        console.error('Decryption Failed:', error.message);
        wipeBuffer(aesKeyBuffer);
        return null;
    } finally {
        wipeBufferList([ivBuffer, authTagBuffer]);
    }
};

exports.encryptSymmetric = (data, aesKeyBuffer) => {
    let iv = null;
    try {
        iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', aesKeyBuffer, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return {
            payload: encrypted,
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64')
        };
    } catch (error) {
        console.error('Encryption Failed:', error.message);
        throw error;
    } finally {
        wipeBuffer(iv);
    }
};
