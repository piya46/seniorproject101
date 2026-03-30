const DEFAULT_DOCUMENT_JOB_RETENTION_DAYS = 7;
const DEFAULT_DOCUMENT_JOB_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

const getDocumentJobRetentionDays = () => {
    const parsed = Number.parseInt(String(process.env.DOCUMENT_JOB_RETENTION_DAYS || DEFAULT_DOCUMENT_JOB_RETENTION_DAYS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DOCUMENT_JOB_RETENTION_DAYS;
};

const getDocumentJobProcessingTimeoutMs = () => {
    const parsed = Number.parseInt(String(process.env.DOCUMENT_JOB_PROCESSING_TIMEOUT_MS || DEFAULT_DOCUMENT_JOB_PROCESSING_TIMEOUT_MS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DOCUMENT_JOB_PROCESSING_TIMEOUT_MS;
};

module.exports = {
    getDocumentJobRetentionDays,
    getDocumentJobProcessingTimeoutMs
};
