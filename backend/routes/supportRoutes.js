const express = require('express');
const fs = require('fs/promises');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middlewares/authMiddleware');
const { createScopedLimiter } = require('../middlewares/rateLimitMiddleware');
const { sendTechnicalSupportEmail } = require('../utils/emailUtils');
const { isAllowedBrowserOrigin } = require('../utils/browserOrigin');
const { baseLog } = require('../utils/logger');

const router = express.Router();

const supportLimiter = createScopedLimiter('support', {
  max: 10,
  message: {
    status: 'error',
    message: 'Too many technical support requests. Please wait before trying again.'
  }
});

const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
];
const ALLOWED_ATTACHMENT_EXTS = ['jpg', 'png', 'webp', 'pdf'];
const TEMP_UPLOAD_DIR = os.tmpdir();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_UPLOAD_DIR),
    filename: (req, file, cb) =>
      cb(null, `support-${uuidv4()}${path.extname(file.originalname || '') || '.bin'}`)
  }),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_ATTACHMENT_MIMES.includes(file.mimetype)) {
      return cb(new Error('Attachment must be an image (JPEG, PNG, WEBP) or PDF.'));
    }

    cb(null, true);
  }
});

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const sanitizeHeaderLikeString = (value) => sanitizeString(value).replace(/[\r\n]+/g, ' ');

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const checkBrowserOrigin = (req, res, next) => {
  if (!isAllowedBrowserOrigin(req, { requireHeader: true })) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Origin is not allowed for technical support requests.'
    });
  }

  next();
};

const resolveTargetEmail = () => {
  const defaultTarget = sanitizeString(process.env.TECH_SUPPORT_TARGET_EMAIL).toLowerCase();

  if (!defaultTarget) {
    throw new Error(
      'Missing technical support target configuration. Required: TECH_SUPPORT_TARGET_EMAIL'
    );
  }

  return defaultTarget;
};

const detectFileType = async (filePath) => {
  const fileTypeModule = await import('file-type');
  const source = fileTypeModule.default || fileTypeModule;
  const detector = source.fileTypeFromFile || source.fromFile;

  if (!detector) {
    throw new Error('file-type library mismatch');
  }

  return detector(filePath);
};

const cleanupTempFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  await fs.rm(filePath, { force: true }).catch((error) => {
    baseLog('warn', 'temp_cleanup_failed', {
      file_path: filePath,
      message: error.message
    });
  });
};

router.post('/technical-email', supportLimiter, authMiddleware, checkBrowserOrigin, (req, res, next) => {
  upload.single('attachment')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Attachment size must not exceed 2MB.'
        });
      }

      return res.status(400).json({
        error: 'Validation Error',
        message: err.message
      });
    }

    if (err) {
      return res.status(400).json({
        error: 'Validation Error',
        message: err.message
      });
    }

    next();
  });
}, async (req, res) => {
  try {
    const reporterEmail = sanitizeHeaderLikeString(req.body.reporter_email);
    const issueType = sanitizeHeaderLikeString(req.body.issue_type);
    const subject = sanitizeHeaderLikeString(req.body.subject);
    const description = sanitizeString(req.body.description);

    const validationErrors = [];

    if (!reporterEmail) {
      validationErrors.push({ field: 'reporter_email', message: 'Reporter email is required.' });
    } else if (!isValidEmail(reporterEmail)) {
      validationErrors.push({ field: 'reporter_email', message: 'Reporter email is invalid.' });
    }

    let resolvedTargetEmail = null;
    try {
      resolvedTargetEmail = resolveTargetEmail();
    } catch (targetConfigError) {
      console.error('Technical Support Target Config Error:', targetConfigError.message);
      return res.status(500).json({
        error: 'Technical support is not configured',
        message: targetConfigError.message
      });
    }

    if (!isValidEmail(resolvedTargetEmail)) {
      console.error('Technical Support Target Config Error: TECH_SUPPORT_TARGET_EMAIL is invalid.');
      return res.status(500).json({
        error: 'Technical support is not configured',
        message: 'TECH_SUPPORT_TARGET_EMAIL is invalid.'
      });
    }

    if (!issueType) {
      validationErrors.push({ field: 'issue_type', message: 'Issue type is required.' });
    } else if (issueType.length > 100) {
      validationErrors.push({
        field: 'issue_type',
        message: 'Issue type must not exceed 100 characters.'
      });
    }

    if (!subject) {
      validationErrors.push({ field: 'subject', message: 'Subject is required.' });
    } else if (subject.length > 200) {
      validationErrors.push({ field: 'subject', message: 'Subject must not exceed 200 characters.' });
    }

    if (!description) {
      validationErrors.push({ field: 'description', message: 'Description is required.' });
    } else if (description.length > 5000) {
      validationErrors.push({
        field: 'description',
        message: 'Description must not exceed 5000 characters.'
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid data format or missing fields.',
        details: validationErrors
      });
    }

    if (req.file) {
      const detectedType = await detectFileType(req.file.path);

      if (
        !detectedType ||
        !ALLOWED_ATTACHMENT_EXTS.includes(detectedType.ext) ||
        !ALLOWED_ATTACHMENT_MIMES.includes(detectedType.mime)
      ) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Attachment file signature is invalid or file type is not allowed.'
        });
      }
    }

    const mailInfo = await sendTechnicalSupportEmail({
      targetEmail: resolvedTargetEmail,
      reporterEmail,
      issueType,
      subject,
      description,
      attachment: req.file || null
    });

    console.info('Technical support email sent', {
      session_id: req.user?.session_id || null,
      reporter_email: reporterEmail,
      issue_type: issueType,
      attachment: req.file
        ? {
            original_name: req.file.originalname,
            mime_type: req.file.mimetype,
            size: req.file.size
          }
        : null,
      message_id: mailInfo.messageId
    });
    req.log?.audit('technical_support_email_sent', {
      reporter_email: reporterEmail,
      issue_type: issueType,
      message_id: mailInfo.messageId,
      has_attachment: Boolean(req.file)
    });

    return res.status(200).json({
      status: 'success',
      message: 'Technical support email sent successfully.',
      data: {
        reporter_email: reporterEmail,
        issue_type: issueType,
        subject,
        attachment: req.file
          ? {
              original_name: req.file.originalname,
              mime_type: req.file.mimetype,
              size: req.file.size
            }
          : null,
        message_id: mailInfo.messageId
      }
    });
  } catch (error) {
    req.log?.error('technical_support_email_error', { message: error.message });
    return res.status(500).json({
      error: 'Failed to send technical support email',
      message: error.message
    });
  } finally {
    await cleanupTempFile(req.file?.path);
  }
});

module.exports = router;
