const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { PDFDocument } = require('pdf-lib');
const { departments } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

router.post('/merge', authMiddleware, async (req, res) => {
  try {
    const { form_code, department_id, gcs_paths } = req.body;
    const sessionId = req.session.session_id;

    // 1. Create new PDF
    const mergedPdf = await PDFDocument.create();

    // 2. Loop & Merge
    for (const path of gcs_paths) {
      const fileRef = bucket.file(path);
      const [fileBuffer] = await fileRef.download();
      const [metadata] = await fileRef.getMetadata();
      const contentType = metadata.contentType;

      if (contentType === 'application/pdf') {
        const pdf = await PDFDocument.load(fileBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));

      } else if (['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
        let image;
        try {
            if (contentType === 'image/jpeg') {
              image = await mergedPdf.embedJpg(fileBuffer);
            } else if (contentType === 'image/png') {
              image = await mergedPdf.embedPng(fileBuffer);
            } else {
               console.warn(`Skipping unsupported image format: ${contentType}`);
               continue; 
            }
        } catch (imgError) {
            console.error(`Error embedding image ${path}:`, imgError);
            continue;
        }

        // Add page with original image dimensions
        const page = mergedPdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
    }

    // 3. Save & Upload
    const mergedPdfBytes = await mergedPdf.save();
    const mergedFileName = `${sessionId}/merged_${form_code}.pdf`;
    const mergedFile = bucket.file(mergedFileName);
    
    await mergedFile.save(mergedPdfBytes, {
      contentType: 'application/pdf',
      resumable: false
    });

    // 4. Generate Signed URL
    const [downloadUrl] = await mergedFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    const dept = departments.find(d => d.id === department_id);
    const targetEmail = dept ? dept.email : 'N/A';

    res.json({
      download_url: downloadUrl,
      instruction: {
        step_1: "ดาวน์โหลดไฟล์เอกสาร PDF ฉบับรวมที่ระบบสร้างให้",
        step_2: "ตรวจสอบความถูกต้องของเอกสารอีกครั้งด้วยตนเอง",
        step_3: "ส่งไฟล์ทางอีเมลไปยังภาควิชาของท่าน",
        target_email: targetEmail,
        email_subject_suggestion: `ส่งคำร้อง ${form_code} - [รหัสนิสิต] [ชื่อ-นามสกุล]`
      }
    });

  } catch (error) {
    console.error('Merge Error:', error);
    res.status(500).json({ error: 'Failed to merge documents', details: error.message });
  }
});

module.exports = router;