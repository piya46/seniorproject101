const DEFAULT_MERGED_DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MERGE_TOTAL_SOURCE_BYTES_LIMIT = 25 * 1024 * 1024;

function parsePositiveIntegerEnv(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMergedDownloadUrlTtlMs() {
  return parsePositiveIntegerEnv(
    process.env.MERGED_DOWNLOAD_URL_TTL_MS,
    DEFAULT_MERGED_DOWNLOAD_URL_TTL_MS
  );
}

function getMergeTotalSourceBytesLimit() {
  return parsePositiveIntegerEnv(
    process.env.MERGE_TOTAL_SOURCE_BYTES_LIMIT,
    DEFAULT_MERGE_TOTAL_SOURCE_BYTES_LIMIT
  );
}

module.exports = {
  DEFAULT_MERGED_DOWNLOAD_URL_TTL_MS,
  DEFAULT_MERGE_TOTAL_SOURCE_BYTES_LIMIT,
  getMergedDownloadUrlTtlMs,
  getMergeTotalSourceBytesLimit,
  parsePositiveIntegerEnv
};
