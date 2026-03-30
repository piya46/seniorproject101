const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_PDF_SOURCE_BYTES = 5 * 1024 * 1024;

function parsePositiveIntegerEnv(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMaxUploadBytes() {
  return parsePositiveIntegerEnv(process.env.MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES);
}

function getMaxPdfSourceBytes() {
  return parsePositiveIntegerEnv(process.env.MAX_PDF_SOURCE_BYTES, DEFAULT_MAX_PDF_SOURCE_BYTES);
}

module.exports = {
  DEFAULT_MAX_PDF_SOURCE_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
  getMaxPdfSourceBytes,
  getMaxUploadBytes,
  parsePositiveIntegerEnv
};
