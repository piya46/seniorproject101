const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { PDFDocument } = require('pdf-lib');
const { departments } = require('../data/staticData');
const authMiddleware = require('../middlewares/authMiddleware');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// 7.1 POST /documents/merge
router.post('/merge', authMiddleware, async (req, res) => {
  try {
    const { form_code, department_id, gcs_paths } = req.body;
    const sessionId = req.session.session_id;

    // 1. สร้าง PDF Doc ใหม่
    const mergedPdf = await PDFDocument.create();

    // 2. Loop ดาวน์โหลดไฟล์และรวม
    for (const path of gcs_paths) {
      // ดาวน์โหลดไฟล์จาก GCS เข้า Memory
      const [fileBuffer] = await bucket.file(path).download();
      
      // Load PDF
      const pdf = await PDFDocument.load(fileBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      // เพิ่มหน้าเข้าไปใน Doc ใหม่
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // 3. Save PDF ที่รวมเสร็จแล้ว
    const mergedPdfBytes = await mergedPdf.save();
    
    // 4. Upload กลับขึ้น GCS
    const mergedFileName = `${sessionId}/merged_${form_code}.pdf`;
    const mergedFile = bucket.file(mergedFileName);
    
    await mergedFile.save(mergedPdfBytes, {
      contentType: 'application/pdf',
      resumable: false
    });

    // 5. สร้าง Public URL หรือ Signed URL สำหรับดาวน์โหลด (อายุ 1 ชม.)
    const [downloadUrl] = await mergedFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });

    // 6. หาข้อมูล Department เพื่อสร้างคำแนะนำ
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
    res.status(500).json({ error: 'Failed to merge documents' });
  }
});

module.exports = router;