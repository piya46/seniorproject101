const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { PDFDocument } = require('pdf-lib');
const { departments, getFormConfig } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');
const { getDecryptedSessionFiles } = require('../utils/dbUtils');
const { filterFilesForForm, selectLatestFilesByKey } = require('../utils/fileSelection');
const { validate } = require('../middlewares/validationMiddleware');
const { docMergeSchema } = require('../validators/schemas');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

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

    for (const fileRecord of filesToMerge) {
      const fileRef = bucket.file(fileRecord.gcs_path);
      const [exists] = await fileRef.exists();
      if (!exists) continue; // ข้ามถ้าไฟล์หาย (Edge Case)

      const [fileBuffer] = await fileRef.download();
      const [metadata] = await fileRef.getMetadata();
      const contentType = metadata.contentType;

      try {
        if (contentType === 'application/pdf') {
            const pdf = await PDFDocument.load(fileBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        } else if (['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
            let image;
            if (contentType === 'image/jpeg') image = await mergedPdf.embedJpg(fileBuffer);
            else if (contentType === 'image/png') image = await mergedPdf.embedPng(fileBuffer);
            
            if (image) {
                // Resize to fit A4
                const page = mergedPdf.addPage([595, 842]);
                const { width, height } = image.scaleToFit(550, 800);
                page.drawImage(image, { 
                    x: (595 - width) / 2, y: (842 - height) / 2, width, height 
                });
            }
        }
      } catch (err) { console.warn('Merge skip:', err); }
    }

    // 5. Save & Return URL
    const mergedPdfBytes = await mergedPdf.save();
    const mergedFileName = `${sessionId}/merged/${form_code}_OFFICIAL.pdf`;
    const mergedFile = bucket.file(mergedFileName);
    
    await mergedFile.save(mergedPdfBytes, { contentType: 'application/pdf', resumable: false });

    const [downloadUrl] = await mergedFile.getSignedUrl({
      version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000, 
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

  } catch (error) {
    console.error('Merge Error:', error);
    res.status(500).json({ error: 'Merge process failed.' });
  }
});

module.exports = router;
