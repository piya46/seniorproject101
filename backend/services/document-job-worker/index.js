const express = require('express');
const crypto = require('crypto');

const {
  DOCUMENT_JOB_TYPES,
  claimNextDocumentJob,
  markDocumentJobFailed,
  markDocumentJobSucceeded
} = require('../../utils/documentJobs');
const { processDocumentJob } = require('../../utils/documentJobProcessor');
const { updateFileRecord } = require('../../utils/dbUtils');

const app = express();
app.use(express.json({ limit: '256kb' }));

const WORKER_SHARED_SECRET = String(process.env.DOCUMENT_JOB_WORKER_SHARED_SECRET || '').trim();

const ensureWorkerAuth = (req, res, next) => {
  if (!WORKER_SHARED_SECRET) {
    return next();
  }

  const provided = String(req.headers['x-document-worker-auth'] || '').trim();
  const configuredBuffer = Buffer.from(WORKER_SHARED_SECRET);
  const providedBuffer = Buffer.from(provided);

  if (
    !provided ||
    configuredBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(configuredBuffer, providedBuffer)
  ) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Worker authentication failed.'
    });
  }

  return next();
};

const processOneJob = async (workerId) => {
  const job = await claimNextDocumentJob(workerId, [
    DOCUMENT_JOB_TYPES.UPLOAD_SANITIZE,
    DOCUMENT_JOB_TYPES.MERGE_DOCUMENTS
  ]);

  if (!job) {
    return null;
  }

  try {
    const result = await processDocumentJob(job);
    await markDocumentJobSucceeded(job.id, result, {
      worker_id: workerId
    });
    return {
      id: job.id,
      type: job.type,
      status: 'succeeded'
    };
  } catch (error) {
    console.error('document_worker_job_failed', {
      worker_id: workerId,
      job_id: job.id,
      job_type: job.type,
      session_id: job.session_id,
      message: error.message,
      stack: error.stack || null,
      status_code: error.statusCode || 500,
      payload: error.payload || null
    });

    if (job.type === DOCUMENT_JOB_TYPES.UPLOAD_SANITIZE && job.payload?.file_record_id) {
      await updateFileRecord(job.session_id, job.payload.file_record_id, {
        file_processing_status: 'failed',
        processing_job_id: null,
        processing_error: error.message
      });
    }

    await markDocumentJobFailed(job.id, {
      message: error.message,
      status_code: error.statusCode || 500,
      payload: error.payload || null
    }, {
      worker_id: workerId
    });
    return {
      id: job.id,
      type: job.type,
      status: 'failed',
      error: error.message
    };
  }
};

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/process-next', ensureWorkerAuth, async (req, res) => {
  const workerId = String(req.body?.worker_id || process.env.K_SERVICE || `worker-${process.pid}`).trim();

  try {
    const result = await processOneJob(workerId);
    if (!result) {
      return res.status(200).json({
        status: 'idle',
        worker_id: workerId
      });
    }

    return res.status(200).json({
      status: 'processed',
      worker_id: workerId,
      job: result
    });
  } catch (error) {
    console.error('document_worker_process_next_failed', {
      worker_id: workerId,
      message: error.message,
      stack: error.stack || null
    });

    return res.status(500).json({
      error: 'Worker processing failed.',
      message: error.message
    });
  }
});

app.post('/process-batch', ensureWorkerAuth, async (req, res) => {
  const workerId = String(req.body?.worker_id || process.env.K_SERVICE || `worker-${process.pid}`).trim();
  const limit = Math.min(Math.max(Number(req.body?.limit || 5), 1), 20);
  const processed = [];

  try {
    for (let index = 0; index < limit; index += 1) {
      const result = await processOneJob(workerId);
      if (!result) {
        break;
      }

      processed.push(result);
    }

    return res.status(200).json({
      status: processed.length > 0 ? 'processed' : 'idle',
      worker_id: workerId,
      processed_count: processed.length,
      jobs: processed
    });
  } catch (error) {
    console.error('document_worker_process_batch_failed', {
      worker_id: workerId,
      message: error.message,
      stack: error.stack || null
    });

    return res.status(500).json({
      error: 'Worker batch failed.',
      message: error.message
    });
  }
});

app.use((_req, res) => {
  res.status(405).json({ error: 'Method Not Allowed' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Document job worker listening on ${port}`);
});
