const fs = require('fs/promises');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const {
    getDocumentAvScanAudience,
    getDocumentAvScanMode,
    getDocumentAvScanTimeoutMs,
    getDocumentAvScanUrl,
    isDocumentAvScanEnabled
} = require('./documentAvConfig');

let fetchOverride = null;
let authHeadersOverride = null;

const setDocumentAvFetchForTests = (value) => {
    fetchOverride = value || null;
};

const setDocumentAvAuthHeadersForTests = (value) => {
    authHeadersOverride = value || null;
};

const getFetchImpl = () => {
    if (fetchOverride) {
        return fetchOverride;
    }

    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available for AV scanning.');
    }

    return fetch;
};

const getAuthenticatedHeaders = async (audience) => {
    if (typeof authHeadersOverride === 'function') {
        return authHeadersOverride(audience);
    }

    const normalizedAudience = String(audience || '').trim();
    if (!normalizedAudience) {
        return {};
    }

    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(normalizedAudience);
    return client.getRequestHeaders();
};

const scanDocumentFile = async (filePath, context = {}) => {
    const mode = getDocumentAvScanMode();
    if (!isDocumentAvScanEnabled()) {
        return {
            status: 'skipped',
            mode
        };
    }

    const url = getDocumentAvScanUrl();
    if (!url) {
        const error = new Error('DOCUMENT_AV_SCAN_URL is missing.');
        error.code = 'av_scan_url_missing';
        throw error;
    }

    const fileBuffer = await fs.readFile(filePath);
    const form = new FormData();
    form.set(
        'file',
        new Blob([fileBuffer], { type: String(context.mimeType || 'application/octet-stream') }),
        path.basename(filePath)
    );
    form.set('session_id', String(context.sessionId || ''));
    form.set('job_type', String(context.jobType || ''));
    form.set('file_key', String(context.fileKey || ''));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getDocumentAvScanTimeoutMs());

    try {
        const audience = getDocumentAvScanAudience() || url;
        const authHeaders = await getAuthenticatedHeaders(audience);
        const response = await getFetchImpl()(url, {
            method: 'POST',
            body: form,
            signal: controller.signal,
            headers: authHeaders
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (_error) {
            payload = {};
        }

        if (!response.ok) {
            const error = new Error(payload.message || `AV scan failed with status ${response.status}.`);
            error.code = 'av_scan_failed';
            error.statusCode = 503;
            throw error;
        }

        const clean = payload.clean === true || payload.verdict === 'clean';
        if (!clean) {
            const error = new Error(payload.message || payload.threat_name || 'Malware detected.');
            error.code = 'av_scan_infected';
            error.statusCode = 422;
            error.payload = {
                threat_name: payload.threat_name || null,
                verdict: payload.verdict || 'infected'
            };
            throw error;
        }

        return {
            status: 'clean',
            mode,
            engine: payload.engine || null
        };
    } finally {
        clearTimeout(timeout);
    }
};

module.exports = {
    scanDocumentFile,
    setDocumentAvAuthHeadersForTests,
    setDocumentAvFetchForTests
};
