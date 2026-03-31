const crypto = require('crypto');
const { firestore } = require('./dbUtils');
const { getDocumentJobProcessingTimeoutMs, getDocumentJobRetentionDays } = require('./documentJobConfig');

const DOCUMENT_JOBS_COLLECTION = process.env.DOCUMENT_JOBS_COLLECTION || 'DOCUMENT_JOBS';
const DOCUMENT_JOB_STATUSES = Object.freeze({
    QUEUED: 'queued',
    PROCESSING: 'processing',
    SUCCEEDED: 'succeeded',
    PARTIAL_FAILED: 'partial_failed',
    FAILED: 'failed'
});
const DOCUMENT_JOB_TYPES = Object.freeze({
    UPLOAD_SANITIZE: 'upload_sanitize',
    MERGE_DOCUMENTS: 'merge_documents',
    PREPARE_SESSION_DOCUMENTS: 'prepare_session_documents'
});

const buildJobExpireAt = (date = new Date()) => {
    const expireAt = new Date(date);
    expireAt.setUTCDate(expireAt.getUTCDate() + getDocumentJobRetentionDays());
    expireAt.setUTCHours(23, 59, 59, 999);
    return expireAt;
};

const createDocumentJobId = () => `job_${crypto.randomBytes(16).toString('hex')}`;

const getDocumentJobsCollection = () => firestore.collection(DOCUMENT_JOBS_COLLECTION);

const buildAheadCountBucket = (count) => {
    if (count <= 0) {
        return '0';
    }

    if (count <= 3) {
        return '1-3';
    }

    if (count <= 10) {
        return '4-10';
    }

    return '10+';
};

const buildEstimatedWaitTier = (count) => {
    if (count <= 0) {
        return 'none';
    }

    if (count <= 3) {
        return 'short';
    }

    if (count <= 10) {
        return 'medium';
    }

    return 'long';
};

const buildQueueHintMessage = (count) => {
    if (count <= 0) {
        return 'งานของคุณกำลังจะเริ่มประมวลผล';
    }

    const bucket = buildAheadCountBucket(count);
    return `ระบบกำลังจัดเตรียมเอกสาร มีผู้รอก่อนหน้า ${bucket} คิว`;
};

const buildQueueInfo = (aheadCount) => ({
    is_queued: true,
    ahead_count_bucket: buildAheadCountBucket(aheadCount),
    hint_message: buildQueueHintMessage(aheadCount),
    estimated_wait_tier: buildEstimatedWaitTier(aheadCount)
});

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

const getQueuedJobsAheadCount = async (job) => {
    if (!job || job.status !== DOCUMENT_JOB_STATUSES.QUEUED || !job.created_at) {
        return null;
    }

    const snapshot = await getDocumentJobsCollection()
        .where('status', '==', DOCUMENT_JOB_STATUSES.QUEUED)
        .where('created_at', '<', job.created_at)
        .orderBy('created_at', 'asc')
        .limit(11)
        .get();

    return snapshot.size;
};

const buildDocumentJobResponse = async (job) => {
    const sanitizedJob = sanitizeDocumentJobForResponse(job);
    if (!sanitizedJob || sanitizedJob.status !== DOCUMENT_JOB_STATUSES.QUEUED) {
        return sanitizedJob;
    }

    try {
        const aheadCount = await getQueuedJobsAheadCount(job);
        if (aheadCount === null) {
            return sanitizedJob;
        }

        return {
            ...sanitizedJob,
            queue_info: buildQueueInfo(aheadCount)
        };
    } catch (error) {
        console.error('document_job_queue_info_failed', {
            job_id: sanitizedJob.id,
            session_id: sanitizedJob.session_id,
            message: error?.message || 'Unknown queue_info error.'
        });
        return sanitizedJob;
    }
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
        .limit(25)
        .get();

    const candidateDocs = snapshot.docs
        .filter((doc) => cappedTypes.includes(String(doc.get('type') || '')))
        .sort((left, right) => {
            const leftCreatedAt = String(left.get('created_at') || '');
            const rightCreatedAt = String(right.get('created_at') || '');
            return leftCreatedAt.localeCompare(rightCreatedAt);
        });

    for (const doc of candidateDocs) {
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

const markDocumentJobCompleted = async ({
    jobId,
    status,
    result = null,
    metadata = {},
    error = null
}) => {
    const completedAt = new Date().toISOString();
    await getDocumentJobsCollection().doc(jobId).set({
        status,
        result,
        error,
        metadata,
        completed_at: completedAt,
        updated_at: completedAt,
        expire_at: buildJobExpireAt()
    }, { merge: true });
};

const markDocumentJobSucceeded = async (jobId, result, metadata = {}) =>
    markDocumentJobCompleted({
        jobId,
        status: DOCUMENT_JOB_STATUSES.SUCCEEDED,
        result: result || null,
        metadata,
        error: null
    });

const markDocumentJobPartialFailed = async (jobId, result, metadata = {}, errorPayload = null) =>
    markDocumentJobCompleted({
        jobId,
        status: DOCUMENT_JOB_STATUSES.PARTIAL_FAILED,
        result: result || null,
        metadata,
        error: errorPayload || { message: 'Job partially failed.' }
    });

const markDocumentJobFailed = async (jobId, errorPayload, metadata = {}) => {
    await markDocumentJobCompleted({
        jobId,
        status: DOCUMENT_JOB_STATUSES.FAILED,
        result: null,
        metadata,
        error: errorPayload || { message: 'Job failed.' }
    });
};

module.exports = {
    DOCUMENT_JOBS_COLLECTION,
    DOCUMENT_JOB_STATUSES,
    DOCUMENT_JOB_TYPES,
    buildAheadCountBucket,
    buildQueueInfo,
    buildDocumentJobResponse,
    sanitizeDocumentJobForResponse,
    createDocumentJob,
    getDocumentJob,
    ensureDocumentJobAccess,
    claimNextDocumentJob,
    markDocumentJobCompleted,
    markDocumentJobSucceeded,
    markDocumentJobPartialFailed,
    markDocumentJobFailed
};
