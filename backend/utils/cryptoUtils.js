const crypto = require('crypto');
const { wipeBuffer, wipeBufferList } = require('./memorySecurity');
const { getPfsV2Curve, getPfsV2HandshakeTtlMs, isPfsV2Enabled } = require('./pfsV2Config');

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
let ACTIVE_PFS_V2_HANDSHAKE = null;

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

const getSigningPublicKey = () => ACTIVE_CRYPTO_PROVIDER?.getPublicKey?.() || null;

const buildPfsV2Transcript = ({
    protocolVersion,
    curve,
    keyId,
    serverEphemeralPublicKey,
    expiresAt
}) => JSON.stringify({
    protocol_version: protocolVersion,
    curve,
    key_id: keyId,
    server_ephemeral_public_key: serverEphemeralPublicKey,
    expires_at: expiresAt
});

const signPfsV2Transcript = (transcript) => {
    if (!ACTIVE_CRYPTO_PROVIDER?.currentSlot?.privateKeyPem) {
        throw new Error('Active signing key is unavailable.');
    }

    return crypto.sign(
        'sha256',
        Buffer.from(transcript, 'utf8'),
        {
            key: ACTIVE_CRYPTO_PROVIDER.currentSlot.privateKeyPem,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
        }
    ).toString('base64');
};

const createPfsV2Handshake = () => {
    if (!isPfsV2Enabled()) {
        throw new Error('PFS v2 is disabled.');
    }

    if (!ACTIVE_CRYPTO_PROVIDER?.currentSlot?.privateKeyPem) {
        throw new Error('Crypto provider is not initialized.');
    }

    const curve = getPfsV2Curve();
    const ttlMs = getPfsV2HandshakeTtlMs();
    const { privateKey, publicKey } = crypto.generateKeyPairSync(curve);
    const expiresAtMs = Date.now() + ttlMs;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    const keyId = `pfs-${ACTIVE_CRYPTO_PROVIDER.currentSlot.label || 'current'}-${expiresAtMs}`;
    const transcript = buildPfsV2Transcript({
        protocolVersion: 'v2',
        curve,
        keyId,
        serverEphemeralPublicKey: publicKeyDer,
        expiresAt
    });
    const signature = signPfsV2Transcript(transcript);

    return {
        protocol_version: 'v2',
        curve,
        key_id: keyId,
        server_ephemeral_public_key: publicKeyDer,
        server_ephemeral_expires_at: expiresAt,
        signature,
        signing_public_key: getSigningPublicKey(),
        transcript,
        privateKey
    };
};

const getPfsV2Handshake = () => {
    if (!isPfsV2Enabled()) {
        return null;
    }

    const now = Date.now();
    const expiresAtMs = ACTIVE_PFS_V2_HANDSHAKE?.expiresAtMs || 0;
    if (ACTIVE_PFS_V2_HANDSHAKE && expiresAtMs > now + 1000) {
        return ACTIVE_PFS_V2_HANDSHAKE.payload;
    }

    const nextHandshake = createPfsV2Handshake();
    ACTIVE_PFS_V2_HANDSHAKE = {
        expiresAtMs: Date.parse(nextHandshake.server_ephemeral_expires_at),
        payload: {
            protocol_version: nextHandshake.protocol_version,
            curve: nextHandshake.curve,
            key_id: nextHandshake.key_id,
            server_ephemeral_public_key: nextHandshake.server_ephemeral_public_key,
            server_ephemeral_expires_at: nextHandshake.server_ephemeral_expires_at,
            signature: nextHandshake.signature,
            signing_public_key: nextHandshake.signing_public_key
        },
        privateKey: nextHandshake.privateKey
    };

    return ACTIVE_PFS_V2_HANDSHAKE.payload;
};

const decodeSpkiPublicKey = (publicKeyBase64) =>
    crypto.createPublicKey({
        key: Buffer.from(publicKeyBase64, 'base64'),
        format: 'der',
        type: 'spki'
    });

const buildPfsV2InfoContext = (info = {}) => JSON.stringify({
    protocol_version: 'v2',
    method: String(info.method || '').toUpperCase(),
    path: String(info.path || ''),
    nonce: String(info.nonce || ''),
    timestamp: Number(info.timestamp || 0),
    session_id: String(info.sessionId || '')
});

const derivePfsV2SessionKeys = ({
    clientEphemeralPublicKey,
    serverKeyId,
    requestContext = {}
}) => {
    if (!isPfsV2Enabled()) {
        throw new Error('PFS v2 is disabled.');
    }

    if (!ACTIVE_PFS_V2_HANDSHAKE?.privateKey || !ACTIVE_PFS_V2_HANDSHAKE?.payload) {
        throw new Error('No active PFS v2 handshake is available.');
    }

    if (serverKeyId !== ACTIVE_PFS_V2_HANDSHAKE.payload.key_id) {
        throw new Error('Unknown or expired PFS v2 server key id.');
    }

    const clientPublicKey = decodeSpkiPublicKey(clientEphemeralPublicKey);
    const sharedSecret = crypto.diffieHellman({
        privateKey: ACTIVE_PFS_V2_HANDSHAKE.privateKey,
        publicKey: clientPublicKey
    });
    const transcriptContext = buildPfsV2InfoContext(requestContext);
    const requestKey = crypto.hkdfSync(
        'sha256',
        sharedSecret,
        Buffer.from(serverKeyId, 'utf8'),
        Buffer.from(`request:${transcriptContext}`, 'utf8'),
        32
    );
    const responseKey = crypto.hkdfSync(
        'sha256',
        sharedSecret,
        Buffer.from(serverKeyId, 'utf8'),
        Buffer.from(`response:${transcriptContext}`, 'utf8'),
        32
    );

    wipeBuffer(sharedSecret);

    return {
        requestKey: Buffer.from(requestKey),
        responseKey: Buffer.from(responseKey)
    };
};

const getPfsV2Status = () => ({
    enabled: isPfsV2Enabled(),
    curve: getPfsV2Curve(),
    handshake_ttl_ms: getPfsV2HandshakeTtlMs(),
    cached_key_id: ACTIVE_PFS_V2_HANDSHAKE?.payload?.key_id || null,
    cached_key_expires_at: ACTIVE_PFS_V2_HANDSHAKE?.payload?.server_ephemeral_expires_at || null
});

exports.decryptEnvelopeKey = decryptEnvelopeKey;
exports.getPublicKey = () => ACTIVE_CRYPTO_PROVIDER?.getPublicKey?.() || null;
exports.getSigningPublicKey = getSigningPublicKey;
exports.getKeyStatus = () => ACTIVE_CRYPTO_PROVIDER?.getKeyStatus?.() || {
    activeLabel: null,
    rotationEnabled: false,
    activeCertificateValidTo: null
};
exports.getPfsV2Handshake = getPfsV2Handshake;
exports.getPfsV2Status = getPfsV2Status;
exports.derivePfsV2SessionKeys = derivePfsV2SessionKeys;

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
