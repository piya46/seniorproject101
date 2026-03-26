const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const TEMP_FILE_PREFIXES = ['upload-', 'decrypted-', 'processed-', 'support-'];
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const getTempCleanupMaxAgeMs = () => {
    const rawValue = String(process.env.TEMP_FILE_MAX_AGE_MS || '').trim();
    const parsedValue = Number.parseInt(rawValue, 10);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
    }

    return DEFAULT_MAX_AGE_MS;
};

const isManagedTempFile = (entryName) =>
    TEMP_FILE_PREFIXES.some((prefix) => entryName.startsWith(prefix));

const cleanupStaleTempFilesOnStartup = async () => {
    const tempDir = os.tmpdir();
    const cutoffTime = Date.now() - getTempCleanupMaxAgeMs();
    let scannedFiles = 0;
    let removedFiles = 0;

    const entries = await fs.readdir(tempDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile() || !isManagedTempFile(entry.name)) {
            continue;
        }

        scannedFiles += 1;
        const filePath = path.join(tempDir, entry.name);

        try {
            const stats = await fs.stat(filePath);
            if (stats.mtimeMs < cutoffTime) {
                await fs.rm(filePath, { force: true });
                removedFiles += 1;
            }
        } catch (error) {
            console.warn(`⚠️ Failed to inspect or remove temp file ${filePath}:`, error.message);
        }
    }

    return {
        tempDir,
        scannedFiles,
        removedFiles,
        maxAgeMs: getTempCleanupMaxAgeMs()
    };
};

module.exports = {
    TEMP_FILE_PREFIXES,
    cleanupStaleTempFilesOnStartup,
    getTempCleanupMaxAgeMs
};
