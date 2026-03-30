const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { departments, getFormConfig } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');
const { getDecryptedSessionFiles } = require('../utils/dbUtils');
const { filterFilesForForm, selectLatestFilesByKey } = require('../utils/fileSelection');
const { validate } = require('../middlewares/validationMiddleware');
const { docMergeSchema } = require('../validators/schemas');
const {
  getMergedDownloadUrlTtlMs,
  getMergeTotalSourceBytesLimit
} = require('../utils/documentMergeSecurity');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
const mergedDownloadUrlTtlMs = getMergedDownloadUrlTtlMs();
const mergeTotalSourceBytesLimit = getMergeTotalSourceBytesLimit();

router.post('/merge', authMiddleware, validate(docMergeSchema), async (req, res) => {
  try {
    const { form_code, degree_level, sub_type } = req.body;
    // ✅ ใช้ req.user
    const sessionId = req.user.session_id;

    if (!form_code) return res.status(400).json({ error: "Missing form_code" });

    // 1. ดึงกฎ (Config)
    const formConfig = getFormConfig(form_code, degree_level || 'bachelor', sub_type);
    if (!formConfig) return res.status(404).json({ error: "Form configuration not found." });

    // 2. ดึงไฟล์ทั้งหมดจาก DB
    const allFiles = await getDecryptedSessionFiles(sessionId);

    // 3. Match & Sort (จัดระเบียบไฟล์ตามกฎ)
    const requiredKeys = formConfig.required_documents.map(d => d.key);
    const latestFiles = selectLatestFilesByKey(filterFilesForForm(allFiles, form_code));
    const filesToMerge = [];
    const missingFiles = [];

    for (const key of requiredKeys) {
        const latestFile = latestFiles.find((file) => file.file_key === key);

        if (!latestFile) {
            missingFiles.push(key);
        } else {
            filesToMerge.push(latestFile);
        }
    }

    if (missingFiles.length > 0) {
        return res.status(400).json({ 
            error: "Incomplete documents", 
            missing_keys: missingFiles 
        });
    }

    // 4. Merge PDF
    const mergedPdf = await PDFDocument.create();
    let mergedPageCount = 0;
    const mergeFailures = [];
    let totalSourceBytes = 0;

    for (const fileRecord of filesToMerge) {
      const fileRef = bucket.file(fileRecord.gcs_path);
      const [exists] = await fileRef.exists();
      if (!exists) {
        mergeFailures.push(`Missing file in storage: ${fileRecord.file_key}`);
        continue;
      }

      const [metadata] = await fileRef.getMetadata();
      const contentType = metadata.contentType || fileRecord.file_type;
      const fileSize = Number.parseInt(String(metadata.size || '0'), 10);

      if (Number.isFinite(fileSize) && fileSize > 0) {
        totalSourceBytes += fileSize;
      }

      if (totalSourceBytes > mergeTotalSourceBytesLimit) {
        req.log?.warn('document_merge_source_limit_exceeded', {
          form_code,
          total_source_bytes: totalSourceBytes,
          total_source_bytes_limit: mergeTotalSourceBytesLimit
        });
        return res.status(413).json({
          error: 'Merge input too large',
          message: 'The total size of source files is too large to merge in a single request.',
          data: {
            total_source_bytes: totalSourceBytes,
            total_source_bytes_limit: mergeTotalSourceBytesLimit
          }
        });
      }

      const [fileBuffer] = await fileRef.download();

      try {
        if (contentType === 'application/pdf') {
            const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            mergedPageCount += copiedPages.length;
        } else if (['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
            let image;
            if (contentType === 'image/jpeg') {
              image = await mergedPdf.embedJpg(fileBuffer);
            } else if (contentType === 'image/png') {
              image = await mergedPdf.embedPng(fileBuffer);
            } else if (contentType === 'image/webp') {
              const jpegBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer();
              image = await mergedPdf.embedJpg(jpegBuffer);
            }
            
            if (image) {
                // Resize to fit A4
                const page = mergedPdf.addPage([595, 842]);
                const { width, height } = image.scaleToFit(550, 800);
                page.drawImage(image, { 
                    x: (595 - width) / 2, y: (842 - height) / 2, width, height 
                });
                mergedPageCount += 1;
            }
        } else {
            mergeFailures.push(`Unsupported content type for ${fileRecord.file_key}: ${contentType || 'unknown'}`);
        }
      } catch (err) {
        console.warn(`Merge skip for ${fileRecord.file_key}:`, err);
        mergeFailures.push(`Failed to merge ${fileRecord.file_key}`);
      }
    }

    if (mergedPageCount === 0) {
      return res.status(400).json({
        error: 'Merge validation failed.',
        message: 'No document pages could be merged. Please re-upload the files and try again.',
        details: mergeFailures
      });
    }

    // 5. Save & Return URL
    const mergedPdfBytes = await mergedPdf.save();
    const mergedFileName = `${sessionId}/merged/${form_code}_OFFICIAL.pdf`;
    const mergedFile = bucket.file(mergedFileName);
    
    await mergedFile.save(mergedPdfBytes, { contentType: 'application/pdf', resumable: false });

    const [downloadUrl] = await mergedFile.getSignedUrl({
      version: 'v4', action: 'read', expires: Date.now() + mergedDownloadUrlTtlMs,
    });

    const dept = departments.find(d => d.id === formConfig.department_id) || {}; 

    res.json({
      status: 'success',
      download_url: downloadUrl,
      instruction: {
        target_email: dept.email || "ติดต่อคณะฯ",
        email_subject: `ยื่นคำร้อง ${formConfig.name_th}`
      }
    });
    req.log?.audit('documents_merged', {
      form_code,
      merged_page_count: mergedPageCount,
      merged_file_name: mergedFileName,
      total_source_bytes: totalSourceBytes,
      merged_download_url_ttl_ms: mergedDownloadUrlTtlMs
    });

  } catch (error) {
    req.log?.error('document_merge_error', { message: error.message });
    res.status(500).json({ error: 'Merge process failed.' });
  }
});

module.exports = router;
