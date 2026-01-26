const { firestore, COLLECTION_NAME, SUB_COLLECTION_NAME, decryptData, encryptData } = require('../utils/dbUtils');

// วิธีใช้: node scripts/rotateDbKey.js <OLD_KEY_HEX> <NEW_KEY_HEX>
const oldKeyHex = process.argv[2];
const newKeyHex = process.argv[3];

if (!oldKeyHex || !newKeyHex || oldKeyHex.length !== 64 || newKeyHex.length !== 64) {
    console.error("Usage: node rotateDbKey.js <OLD_KEY_64_HEX> <NEW_KEY_64_HEX>");
    process.exit(1);
}

const oldKey = Buffer.from(oldKeyHex, 'hex');
const newKey = Buffer.from(newKeyHex, 'hex');

const rotateKeys = async () => {
    console.log("🚀 Starting Key Rotation Process...");
    
    const sessionsSnapshot = await firestore.collection(COLLECTION_NAME).get();
    let count = 0;

    for (const sessionDoc of sessionsSnapshot.docs) {
        const filesRef = sessionDoc.ref.collection(SUB_COLLECTION_NAME);
        const filesSnapshot = await filesRef.get();

        if (filesSnapshot.empty) continue;

        const batch = firestore.batch();

        filesSnapshot.forEach(doc => {
            const data = doc.data();
            
            // 1. Decrypt with OLD Key
            const rawKey = decryptData(data.file_key, oldKey);
            const rawPath = decryptData(data.gcs_path, oldKey);
            const rawType = decryptData(data.file_type, oldKey);

            if (rawKey === null || rawPath === null) {
                console.warn(`⚠️ Skipped doc ${doc.id}: Cannot decrypt with old key.`);
                return;
            }

            // 2. Encrypt with NEW Key
            const newData = {
                file_key: encryptData(rawKey, newKey),
                gcs_path: encryptData(rawPath, newKey),
                file_type: encryptData(rawType, newKey),
                updated_at: new Date().toISOString() // Stamp rotation time
            };

            batch.update(doc.ref, newData);
        });

        await batch.commit();
        count += filesSnapshot.size;
        console.log(`✅ Rotated ${filesSnapshot.size} files in session ${sessionDoc.id}`);
    }

    console.log(`🎉 Rotation Complete! Processed ${count} files.`);
    console.log("⚠️  Don't forget to update DB_ENCRYPTION_KEY in your .env or Secret Manager now!");
};

rotateKeys().catch(console.error);