const crypto = require('crypto');
const { firestore } = require('./dbUtils');
const { getDocumentJobProcessingTimeoutMs, getDocumentJobRetentionDays } = require('./documentJobConfig');

const DOCUMENT_JOBS_COLLECTION = process.env.DOCUMENT_JOBS_COLLECTION || 'DOCUMENT_JOBS';
const DOCUMENT_JOB_STATUSES = Object.freeze({
    QUEUED: 'queued',
    PROCESSING: 'processing',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed'
});
const DOCUMENT_JOB_TYPES = Object.freeze({
    UPLOAD_SANITIZE: 'upload_sanitize',
    MERGE_DOCUMENTS: 'merge_documents'
});

const buildJobExpireAt = (date = new Date()) => {
    const expireAt = new Date(date);
    expireAt.setUTCDate(expireAt.getUTCDate() + getDocumentJobRetentionDays());
    expireAt.setUTCHours(23, 59, 59, 999);
    return expireAt;
};

const createDocumentJobId = () => `job_${crypto.randomBytes(16).toString('hex')}`;

const getDocumentJobsCollection = () => firestore.collection(DOCUMENT_JOBS_COLLECTION);

const sanitizeDocumentJobForResponse = (job) => {
    if (!job) {
        return null;
    }

    return {
        id: job.id,
        type: job.type,
        status: job.status,
        session_id: job.session_id,
        created_at: job.created_at || null,
        updated_at: job.updated_at || null,
        started_at: job.started_at || null,
        completed_at: job.completed_at || null,
        error: job.error || null,
        result: job.result || null,
        metadata: job.metadata || null
    };
};

const createDocumentJob = async ({ type, sessionId, requestedBy, payload, metadata = {} }) => {
    const id = createDocumentJobId();
    const now = new Date().toISOString();
    const record = {
        type,
        status: DOCUMENT_JOB_STATUSES.QUEUED,
        session_id: sessionId,
        requested_by_email: String(requestedBy?.email || '').trim().toLowerCase() || null,
        requested_by_identity: requestedBy || null,
        payload: payload || {},
        metadata,
        result: null,
        error: null,
        attempts: 0,
        created_at: now,
        updated_at: now,
        expire_at: buildJobExpireAt()
    };

    await getDocumentJobsCollection().doc(id).set(record);
    return {
        id,
        ...record
    };
};

const getDocumentJob = async (jobId) => {
    const snapshot = await getDocumentJobsCollection().doc(jobId).get();
    if (!snapshot.exists) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
};

const ensureDocumentJobAccess = (job, user) => {
    if (!job || !user) {
        return false;
    }

    return String(job.session_id || '') === String(user.session_id || '');
};

const claimNextDocumentJob = async (workerId, allowedTypes = Object.values(DOCUMENT_JOB_TYPES)) => {
    const cappedTypes = Array.isArray(allowedTypes) && allowedTypes.length > 0
        ? allowedTypes
        : Object.values(DOCUMENT_JOB_TYPES);

    const snapshot = await getDocumentJobsCollection()
        .where('status', '==', DOCUMENT_JOB_STATUSES.QUEUED)
        .where('type', 'in', cappedTypes.slice(0, 10))
        .orderBy('created_at', 'asc')
        .limit(10)
        .get();

    for (const doc of snapshot.docs) {
        const claimed = await firestore.runTransaction(async (transaction) => {
            const fresh = await transaction.get(doc.ref);
            if (!fresh.exists) {
                return null;
            }

            const data = fresh.data() || {};
            if (data.status !== DOCUMENT_JOB_STATUSES.QUEUED) {
                return null;
            }

            const startedAt = new Date().toISOString();
            transaction.set(doc.ref, {
                status: DOCUMENT_JOB_STATUSES.PROCESSING,
                started_at: startedAt,
                updated_at: startedAt,
                worker_id: workerId,
                attempts: Number(data.attempts || 0) + 1,
                processing_deadline_at: new Date(Date.now() + getDocumentJobProcessingTimeoutMs()).toISOString()
            }, { merge: true });

            return {
                id: fresh.id,
                ...data,
                status: DOCUMENT_JOB_STATUSES.PROCESSING,
                started_at: startedAt,
                updated_at: startedAt,
                worker_id: workerId,
                attempts: Number(data.attempts || 0) + 1
            };
        });

        if (claimed) {
            return claimed;
        }
    }

    return null;
};

const markDocumentJobSucceeded = async (jobId, result, metadata = {}) => {
    const completedAt = new Date().toISOString();
    await getDocumentJobsCollection().doc(jobId).set({
        status: DOCUMENT_JOB_STATUSES.SUCCEEDED,
        result: result || null,
        error: null,
        metadata,
        completed_at: completedAt,
        updated_at: completedAt,
        expire_at: buildJobExpireAt()
    }, { merge: true });
};

const markDocumentJobFailed = async (jobId, errorPayload, metadata = {}) => {
    const completedAt = new Date().toISOString();
    await getDocumentJobsCollection().doc(jobId).set({
        status: DOCUMENT_JOB_STATUSES.FAILED,
        error: errorPayload || { message: 'Job failed.' },
        metadata,
        completed_at: completedAt,
        updated_at: completedAt,
        expire_at: buildJobExpireAt()
    }, { merge: true });
};

module.exports = {
    DOCUMENT_JOBS_COLLECTION,
    DOCUMENT_JOB_STATUSES,
    DOCUMENT_JOB_TYPES,
    sanitizeDocumentJobForResponse,
    createDocumentJob,
    getDocumentJob,
    ensureDocumentJobAccess,
    claimNextDocumentJob,
    markDocumentJobSucceeded,
    markDocumentJobFailed
};
