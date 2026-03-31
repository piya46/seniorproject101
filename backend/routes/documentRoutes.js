const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');

const authMiddleware = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { docMergeSchema } = require('../validators/schemas');
const { departments, getFormConfig } = require('../data/staticData');
const { getDecryptedSessionFiles } = require('../utils/dbUtils');
const { filterFilesForForm, selectLatestFilesByKey } = require('../utils/fileSelection');
const { getMergedDownloadUrlTtlMs } = require('../utils/documentMergeSecurity');
const {
  buildDocumentJobResponse,
  DOCUMENT_JOB_TYPES,
  DOCUMENT_JOB_STATUSES,
  createDocumentJob,
  ensureDocumentJobAccess,
  getDocumentJob
} = require('../utils/documentJobs');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
const MAX_JOB_WAIT_TIMEOUT_MS = 25000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.post('/merge', authMiddleware, validate(docMergeSchema), async (req, res) => {
  try {
    const { form_code, degree_level, sub_type } = req.body;
    const sessionId = req.user.session_id;

    if (!form_code) {
      return res.status(400).json({ error: 'Missing form_code' });
    }

    const formConfig = getFormConfig(form_code, degree_level || 'bachelor', sub_type);
    if (!formConfig) {
      return res.status(404).json({ error: 'Form configuration not found.' });
    }

    const allFiles = await getDecryptedSessionFiles(sessionId);
    const requiredKeys = formConfig.required_documents.map((d) => d.key);
    const latestFiles = selectLatestFilesByKey(filterFilesForForm(allFiles, form_code));
    const notReadyFiles = latestFiles.filter((file) => file.file_processing_status !== 'ready');
    if (notReadyFiles.length > 0) {
      return res.status(409).json({
        error: 'Documents not ready',
        message: 'Some uploaded documents are still waiting to be prepared. Please validate documents first.',
        pending_keys: notReadyFiles.map((file) => file.file_key)
      });
    }
    const missingFiles = requiredKeys.filter((key) => !latestFiles.find((file) => file.file_key === key));

    if (missingFiles.length > 0) {
      return res.status(400).json({
        error: 'Incomplete documents',
        missing_keys: missingFiles
      });
    }

    const job = await createDocumentJob({
      type: DOCUMENT_JOB_TYPES.MERGE_DOCUMENTS,
      sessionId,
      requestedBy: {
        email: req.user.email || null,
        session_id: sessionId
      },
      payload: {
        form_code,
        degree_level: degree_level || 'bachelor',
        sub_type: sub_type ?? null
      },
      metadata: {
        required_keys: requiredKeys
      }
    });

    req.log?.audit('document_merge_job_queued', {
      form_code,
      job_id: job.id,
      required_keys_count: requiredKeys.length
    });

    return res.status(202).json({
      status: 'queued',
      job: await buildDocumentJobResponse(job)
    });
  } catch (error) {
    req.log?.error('document_merge_enqueue_error', { message: error.message });
    return res.status(500).json({ error: 'Merge process failed.' });
  }
});

router.get('/jobs/:jobId', authMiddleware, async (req, res) => {
  const waitForChange = String(req.query.wait_for_change || '').trim() === '1';
  const lastStatus = String(req.query.last_status || '').trim();
  const timeoutMs = Math.min(
    Math.max(Number.parseInt(String(req.query.timeout_ms || MAX_JOB_WAIT_TIMEOUT_MS), 10) || MAX_JOB_WAIT_TIMEOUT_MS, 1000),
    MAX_JOB_WAIT_TIMEOUT_MS
  );
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const job = await getDocumentJob(req.params.jobId);
    if (!job || job.type !== DOCUMENT_JOB_TYPES.MERGE_DOCUMENTS) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    if (!ensureDocumentJobAccess(job, req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!waitForChange || !lastStatus || job.status !== lastStatus || Date.now() >= deadline) {
      return res.status(200).json({
        status: 'success',
        job: await buildDocumentJobResponse(job)
      });
    }

    await sleep(1000);
  }
});

router.get('/jobs/:jobId/download', authMiddleware, async (req, res) => {
  const job = await getDocumentJob(req.params.jobId);
  if (!job || job.type !== DOCUMENT_JOB_TYPES.MERGE_DOCUMENTS) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (!ensureDocumentJobAccess(job, req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (job.status !== DOCUMENT_JOB_STATUSES.SUCCEEDED || !job.result?.merged_file_name) {
    return res.status(409).json({
      error: 'Job not ready',
      message: 'Merged document is not ready for download yet.'
    });
  }

  const mergedFile = bucket.file(job.result.merged_file_name);
  const [exists] = await mergedFile.exists();
  if (!exists) {
    return res.status(404).json({
      error: 'Merged file missing',
      message: 'The merged document is no longer available.'
    });
  }

  const [downloadUrl] = await mergedFile.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + getMergedDownloadUrlTtlMs()
  });

  const formConfig = getFormConfig(
    job.payload?.form_code,
    job.payload?.degree_level || 'bachelor',
    job.payload?.sub_type ?? null
  );
  const dept = departments.find((d) => d.id === formConfig?.department_id) || {};

  return res.status(200).json({
    status: 'success',
    download_url: downloadUrl,
    instruction: job.result?.instruction || {
      target_email: dept.email || 'ติดต่อคณะฯ',
      email_subject: formConfig ? `ยื่นคำร้อง ${formConfig.name_th}` : null
    }
  });
});

module.exports = router;
