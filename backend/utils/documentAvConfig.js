const DEFAULT_AV_SCAN_MODE = 'off';
const DEFAULT_AV_SCAN_TIMEOUT_MS = 30000;

const normalizeAvScanMode = (value) => {
    const normalized = String(value || DEFAULT_AV_SCAN_MODE).trim().toLowerCase();
    return ['off', 'log-only', 'required'].includes(normalized) ? normalized : DEFAULT_AV_SCAN_MODE;
};

const getDocumentAvScanMode = () => normalizeAvScanMode(process.env.DOCUMENT_AV_SCAN_MODE);

const isDocumentAvScanEnabled = () => getDocumentAvScanMode() !== 'off';

const getDocumentAvScanUrl = () => String(process.env.DOCUMENT_AV_SCAN_URL || '').trim();

const getDocumentAvScanAudience = () => String(process.env.DOCUMENT_AV_SCAN_AUDIENCE || '').trim();

const getDocumentAvScanTimeoutMs = () => {
    const parsed = Number.parseInt(String(process.env.DOCUMENT_AV_SCAN_TIMEOUT_MS || DEFAULT_AV_SCAN_TIMEOUT_MS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AV_SCAN_TIMEOUT_MS;
};

module.exports = {
    DEFAULT_AV_SCAN_MODE,
    DEFAULT_AV_SCAN_TIMEOUT_MS,
    getDocumentAvScanMode,
    getDocumentAvScanTimeoutMs,
    getDocumentAvScanAudience,
    getDocumentAvScanUrl,
    isDocumentAvScanEnabled,
    normalizeAvScanMode
};
