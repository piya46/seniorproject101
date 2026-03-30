const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');

const { addFileToSession, deleteFileRecord, getDecryptedSessionFiles } = require('./dbUtils');
const { findFilesByKeyAndForm, sortFilesByUploadedAtDesc, filterFilesForForm, selectLatestFilesByKey } = require('./fileSelection');
const { departments, getFormConfig } = require('../data/staticData');
const { getMaxPdfSourceBytes } = require('./uploadSecurity');
const { getMergedDownloadUrlTtlMs, getMergeTotalSourceBytesLimit } = require('./documentMergeSecurity');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
const TEMP_UPLOAD_DIR = os.tmpdir();

const sanitizeFormCode = (code) => {
    if (!code) return 'general';
    return String(code).replace(/[^a-zA-Z0-9-_]/g, '') || 'general';
};

const cleanupTempFile = async (filePath) => {
    if (!filePath) {
        return;
    }

    await fsp.rm(filePath, { force: true }).catch(() => {});
};

const uploadProcessedFileToGcs = async (blob, filePath, contentType, sessionId) =>
    new Promise((resolve, reject) => {
        const blobStream = blob.createWriteStream({
            resumable: false,
            contentType,
            metadata: { metadata: { originalName: 'secure_upload', uploadedBy: sessionId } }
        });

        blobStream.on('error', reject);
        blobStream.on('finish', resolve);
        fs.createReadStream(filePath).on('error', reject).pipe(blobStream);
    });

const processUploadSanitizeJob = async (job) => {
    const { session_id: sessionId, payload = {} } = job;
    const rawObjectPath = String(payload.raw_gcs_path || '');
    const detectedMime = String(payload.detected_mime || '');
    const detectedExt = String(payload.detected_ext || '').replace(/^\./, '');
    const fileKey = String(payload.file_key || '').trim();
    const safeFormCode = sanitizeFormCode(payload.form_code);

    if (!sessionId || !rawObjectPath || !fileKey || !detectedMime || !detectedExt) {
        const error = new Error('Upload job payload is incomplete.');
        error.statusCode = 400;
        throw error;
    }

    const rawFile = bucket.file(rawObjectPath);
    const [exists] = await rawFile.exists();
    if (!exists) {
        const error = new Error('Queued upload source file is missing.');
        error.statusCode = 404;
        throw error;
    }

    let sourcePath = null;
    let processedPath = null;
    try {
        const sourceExt = detectedExt ? `.${detectedExt}` : '.bin';
        sourcePath = path.join(TEMP_UPLOAD_DIR, `job-source-${uuidv4()}${sourceExt}`);
        await rawFile.download({ destination: sourcePath });

        const sourceStat = await fsp.stat(sourcePath);
        const sourceBytes = Number(sourceStat.size || 0);
        const maxPdfSourceBytes = getMaxPdfSourceBytes();

        let finalMimeType = detectedMime;
        let fileExtension = sourceExt;

        if (['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            processedPath = path.join(TEMP_UPLOAD_DIR, `job-processed-${uuidv4()}.jpg`);
            await sharp(sourcePath).rotate().toFormat('jpeg', { quality: 80 }).toFile(processedPath);
            finalMimeType = 'image/jpeg';
            fileExtension = '.jpg';
        } else if (finalMimeType === 'application/pdf') {
            if (sourceBytes > maxPdfSourceBytes) {
                const error = new Error('PDF file exceeds the maximum allowed size for safe processing.');
                error.statusCode = 413;
                throw error;
            }

            const finalBuffer = await fsp.readFile(sourcePath);
            const pdfDoc = await PDFDocument.load(finalBuffer, { ignoreEncryption: true });
            processedPath = path.join(TEMP_UPLOAD_DIR, `job-processed-${uuidv4()}.pdf`);
            await fsp.writeFile(processedPath, Buffer.from(await pdfDoc.save()));
        } else {
            processedPath = path.join(TEMP_UPLOAD_DIR, `job-processed-${uuidv4()}${fileExtension}`);
            await fsp.copyFile(sourcePath, processedPath);
        }

        const uniqueFileName = `${uuidv4()}${fileExtension}`;
        const gcsPath = `${sessionId}/${safeFormCode}/${uniqueFileName}`;
        const blob = bucket.file(gcsPath);
        await uploadProcessedFileToGcs(blob, processedPath, finalMimeType, sessionId);

        const existingFiles = await getDecryptedSessionFiles(sessionId);
        const obsoleteFiles = sortFilesByUploadedAtDesc(
            findFilesByKeyAndForm(existingFiles, fileKey, safeFormCode)
        );

        for (const obsoleteFile of obsoleteFiles) {
            try {
                await bucket.file(obsoleteFile.gcs_path).delete({ ignoreNotFound: true });
            } catch (_storageDeleteError) {
                // best effort cleanup only
            }
            await deleteFileRecord(sessionId, obsoleteFile.id);
        }

        await addFileToSession(sessionId, {
            file_key: fileKey,
            gcs_path: gcsPath,
            file_type: finalMimeType,
            form_code: safeFormCode
        });

        await rawFile.delete({ ignoreNotFound: true }).catch(() => {});

        return {
            file_key: fileKey,
            form_code: safeFormCode,
            mime_type: finalMimeType,
            gcs_path: gcsPath,
            source_bytes: sourceBytes
        };
    } finally {
        await rawFile.delete({ ignoreNotFound: true }).catch(() => {});
        await cleanupTempFile(sourcePath);
        await cleanupTempFile(processedPath);
    }
};

const processMergeDocumentsJob = async (job) => {
    const { session_id: sessionId, payload = {} } = job;
    const formCode = String(payload.form_code || '').trim();
    const degreeLevel = payload.degree_level || 'bachelor';
    const subType = payload.sub_type ?? null;

    if (!sessionId || !formCode) {
        const error = new Error('Merge job payload is incomplete.');
        error.statusCode = 400;
        throw error;
    }

    const formConfig = getFormConfig(formCode, degreeLevel || 'bachelor', subType);
    if (!formConfig) {
        const error = new Error('Form configuration not found.');
        error.statusCode = 404;
        throw error;
    }

    const allFiles = await getDecryptedSessionFiles(sessionId);
    const requiredKeys = formConfig.required_documents.map((d) => d.key);
    const latestFiles = selectLatestFilesByKey(filterFilesForForm(allFiles, formCode));
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
        const error = new Error('Incomplete documents');
        error.statusCode = 400;
        error.payload = { missing_keys: missingFiles };
        throw error;
    }

    const mergedPdf = await PDFDocument.create();
    let mergedPageCount = 0;
    const mergeFailures = [];
    let totalSourceBytes = 0;
    const mergeTotalSourceBytesLimit = getMergeTotalSourceBytesLimit();

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
            const error = new Error('The total size of source files is too large to merge in a single request.');
            error.statusCode = 413;
            error.payload = {
                total_source_bytes: totalSourceBytes,
                total_source_bytes_limit: mergeTotalSourceBytesLimit
            };
            throw error;
        }

        const [fileBuffer] = await fileRef.download();

        try {
            if (contentType === 'application/pdf') {
                const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
                mergedPageCount += copiedPages.length;
            } else if (['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
                let image = null;
                if (contentType === 'image/jpeg') {
                    image = await mergedPdf.embedJpg(fileBuffer);
                } else if (contentType === 'image/png') {
                    image = await mergedPdf.embedPng(fileBuffer);
                } else {
                    const jpegBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer();
                    image = await mergedPdf.embedJpg(jpegBuffer);
                }

                if (image) {
                    const page = mergedPdf.addPage([595, 842]);
                    const { width, height } = image.scaleToFit(550, 800);
                    page.drawImage(image, {
                        x: (595 - width) / 2,
                        y: (842 - height) / 2,
                        width,
                        height
                    });
                    mergedPageCount += 1;
                }
            } else {
                mergeFailures.push(`Unsupported content type for ${fileRecord.file_key}: ${contentType || 'unknown'}`);
            }
        } catch (_err) {
            mergeFailures.push(`Failed to merge ${fileRecord.file_key}`);
        }
    }

    if (mergedPageCount === 0) {
        const error = new Error('No document pages could be merged. Please re-upload the files and try again.');
        error.statusCode = 400;
        error.payload = { details: mergeFailures };
        throw error;
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedFileName = `${sessionId}/merged/${formCode}_OFFICIAL.pdf`;
    const mergedFile = bucket.file(mergedFileName);
    await mergedFile.save(mergedPdfBytes, { contentType: 'application/pdf', resumable: false });

    const dept = departments.find((d) => d.id === formConfig.department_id) || {};

    return {
        merged_file_name: mergedFileName,
        merged_page_count: mergedPageCount,
        total_source_bytes: totalSourceBytes,
        merged_download_url_ttl_ms: getMergedDownloadUrlTtlMs(),
        instruction: {
            target_email: dept.email || 'ติดต่อคณะฯ',
            email_subject: `ยื่นคำร้อง ${formConfig.name_th}`
        }
    };
};

const processDocumentJob = async (job) => {
    if (job.type === 'upload_sanitize') {
        return processUploadSanitizeJob(job);
    }

    if (job.type === 'merge_documents') {
        return processMergeDocumentsJob(job);
    }

    const error = new Error(`Unsupported document job type: ${job.type}`);
    error.statusCode = 400;
    throw error;
};

module.exports = {
    processDocumentJob,
    processUploadSanitizeJob,
    processMergeDocumentsJob,
    sanitizeFormCode
};
