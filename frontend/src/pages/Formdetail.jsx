import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Navbar from './Navbar'
import Footer from './Footer'
import { encryptAndKeepKey, decryptResponse } from './crypto' 
import { ensureAuthenticatedOrRedirect } from '../lib/auth'
import { trackAnalyticsEvent } from '../lib/analytics'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseApiResponse = (data) => (typeof data === 'string' ? JSON.parse(data) : data);

const buildValidationSummaryFromLegacyResults = (legacyResults = {}) => {
  const entries = Object.values(legacyResults || {});
  if (entries.length === 0) {
    return null;
  }

  const invalidCount = entries.filter((entry) => entry?.status !== 'valid').length;
  return {
    decision: invalidCount > 0 ? 'fail' : 'pass',
    summary_th: invalidCount > 0
      ? `ตรวจพบเอกสารที่ต้องแก้ไข ${invalidCount} รายการ`
      : 'เอกสารที่อัปโหลดผ่านการตรวจสอบในรอบนี้'
  };
};

const normalizeValidationResponse = (payload, requiredDocuments = []) => {
  const actualData = payload?.data || payload;
  const docKeys = requiredDocuments.map((doc) => doc.key);

  if (!actualData || typeof actualData !== 'object' || Array.isArray(actualData)) {
    return { summary: null, documentResults: null };
  }

  if (actualData.legacy_document_results && typeof actualData.legacy_document_results === 'object') {
    return {
      summary: actualData.overall_result || buildValidationSummaryFromLegacyResults(actualData.legacy_document_results),
      documentResults: actualData.legacy_document_results
    };
  }

  const isLegacyDocumentMap = Object.keys(actualData).some((key) => docKeys.includes(key));
  if (isLegacyDocumentMap) {
    return {
      summary: buildValidationSummaryFromLegacyResults(actualData),
      documentResults: actualData
    };
  }

  return {
    summary: actualData.overall_result || null,
    documentResults: null
  };
};

const buildCachedUploadedFiles = (files) =>
  Object.keys(files).reduce((acc, key) => {
    acc[key] = {
      name: files[key].name,
      uploaded: Boolean(files[key].uploaded),
      mimeType: files[key].mimeType || null
    };
    return acc;
  }, {});

const waitForJobStatusChange = async (basePath, jobId, lastStatus = '') => {
  const res = await axios.get(`${basePath}/${jobId}`, {
    params: {
      wait_for_change: 1,
      last_status: lastStatus || '',
      timeout_ms: 25000
    },
    validateStatus: (status) => status < 500
  });
  const data = parseApiResponse(res.data);
  return data?.job || null;
};

const pollUploadPreparationJobs = async (jobs, onUpdate) => {
  const pendingJobs = new Map(
    jobs
      .filter((job) => job?.id)
      .map((job) => [job.id, job.status || 'queued'])
  );

  if (typeof onUpdate === 'function') {
    onUpdate(jobs);
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (pendingJobs.size === 0) {
      return;
    }

    const results = await Promise.all(
      Array.from(pendingJobs.entries()).map(async ([jobId, lastStatus]) => {
        const job = await waitForJobStatusChange('/api/v1/upload/jobs', jobId, lastStatus);
        return job;
      })
    );

    pendingJobs.clear();
    if (typeof onUpdate === 'function') {
      onUpdate(results.filter(Boolean));
    }
    for (const job of results) {
      if (!job) {
        throw new Error('ไม่พบสถานะงานเตรียมเอกสาร');
      }

      if (job.status === 'failed') {
        throw new Error(job?.error?.message || 'การเตรียมเอกสารล้มเหลว');
      }

      if (job.status !== 'succeeded' && job.status !== 'partial_failed') {
        pendingJobs.set(job.id, job.status || 'queued');
      }
    }

    if (pendingJobs.size === 0) {
      return results.filter(Boolean);
    }
  }

  throw new Error('การเตรียมเอกสารใช้เวลานานเกินไป กรุณาลองอีกครั้ง');
};

const buildBatchPreparationErrors = (jobs = []) => {
  const nextErrors = {};
  jobs.forEach((job) => {
    const fileResults = Array.isArray(job?.result?.files) ? job.result.files : [];
    fileResults.forEach((fileResult) => {
      if (fileResult?.status === 'failed' && fileResult?.file_key) {
        nextErrors[fileResult.file_key] = {
          status: 'error',
          reason: fileResult.error_message || 'การเตรียมเอกสารล้มเหลว'
        };
      }
    });
  });
  return nextErrors;
};

const getFileIcon = (fileName) => {
  if (!fileName) return "/pdf.png";
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return "/png.png";
  if (lower.endsWith('.jpeg')) return "/JPEG.png";
  if (lower.endsWith('.jpg')) return "/JPG.png";
  return "/pdf.png";
};

export default function Formdetail() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation(); 
  const formNameTh = location.state?.name_th || '';
  const degreeLevel = location.state?.degree_level || 'bachelor';
  const subType = location.state?.sub_type; 
  const uploadedFilesCacheKey = `uploaded_files_${id}_${degreeLevel}_${subType || 'default'}`;
  const [formData, setFormData] = useState(null);
  const [publicKey, setPublicKey] = useState(null); 
  const [currentStep, setCurrentStep] = useState(1);
  const [checkedDocs, setCheckedDocs] = useState({});
  const [uploadStatuses, setUploadStatuses] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationStage, setValidationStage] = useState(null);
  const [showValidationDelayHint, setShowValidationDelayHint] = useState(false);
  const [validationPreparationJobs, setValidationPreparationJobs] = useState([]);
  const [validationResults, setValidationResults] = useState({}); 
  const [validationSummary, setValidationSummary] = useState(null);
  const [isStep2Validated, setIsStep2Validated] = useState(false); 
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [mergeError, setMergeError] = useState(null); 
  const [departments, setDepartments] = useState([]);
  const [showDepartmentDirectory, setShowDepartmentDirectory] = useState(false);

  const reqConfig = { headers: { 'Content-Type': 'application/json' } };

  const [uploadedFiles, setUploadedFiles] = useState(() => {
    const savedFiles = sessionStorage.getItem(uploadedFilesCacheKey);
    if (savedFiles) {
      const parsed = JSON.parse(savedFiles);
      const initialStatuses = {};
      Object.keys(parsed).forEach(key => {
        initialStatuses[key] = { progress: 100, status: 'success' };
      });
      setUploadStatuses(initialStatuses);
      return parsed;
    }
    return {};
  });

  useEffect(() => {
    const fetchDetailAndKey = async () => {
      try {
        const currentUser = await ensureAuthenticatedOrRedirect();
        if (!currentUser) {
          return;
        }

        let pk = sessionStorage.getItem('public_key');
        
        if (!pk) {
           const keyRes = await axios.get('/api/v1/auth/public-key');
           pk = keyRes.data?.publicKey || keyRes.data?.data?.publicKey || (typeof keyRes.data === 'string' ? keyRes.data : null);
           if (pk) sessionStorage.setItem('public_key', pk);
        }
        setPublicKey(pk);

        const apiParams = { degree_level: degreeLevel };
        if (subType) {
          apiParams.sub_type = subType;
        }
        const res = await axios.get(`/api/v1/forms/${id}`, { params: apiParams });
        setFormData(res.data.data || res.data);
      } catch (err) {
        console.error("Fetch API Error:", err);
      }
    };
    fetchDetailAndKey();
  }, [id, degreeLevel, subType, uploadedFilesCacheKey]);

  useEffect(() => {
    if (!isValidating) {
      setShowValidationDelayHint(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowValidationDelayHint(true);
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [isValidating]);

  // เริ่มกระบวนการ Merge อัตโนมัติเมื่อเข้ามาที่ Step 3
  useEffect(() => {
    if (currentStep === 3 && !mergeResult && !isMerging && !mergeError) {
      handleMergeDocuments();
    }
  }, [currentStep]);

  const handleCheck = (index) => {
    setCheckedDocs(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const resetValidationForIndex = (index) => {
    setIsStep2Validated(false);
    setValidationSummary(null);
    setValidationResults(prev => {
      const newResults = { ...prev };
      if (formData?.required_documents?.[index]) {
        delete newResults[formData.required_documents[index].key];
      }
      return newResults;
    });
  };

  const handleFileChange = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExt)) {
      resetValidationForIndex(index);
      setUploadedFiles(prev => ({
        ...prev,
        [index]: { name: file.name, localUrl: null }
      }));
      setUploadStatuses(prev => ({
        ...prev,
        [index]: { status: 'invalid_type' }
      }));
      e.target.value = null; 
      return;
    }

    resetValidationForIndex(index);
    const localBlobUrl = URL.createObjectURL(file);
    setUploadedFiles(prev => ({
      ...prev,
      [index]: { name: file.name, localUrl: localBlobUrl }
    }));
    const docKey = formData.required_documents[index].key;
    startSecureUpload(index, file, localBlobUrl, docKey);
  };

  const startSecureUpload = async (index, file, localBlobUrl, docKey) => {
    setUploadStatuses(prev => ({ ...prev, [index]: { progress: 0, status: 'uploading' } }));
    
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('file_key', docKey);
      uploadData.append('form_code', formData.form_code || id);
      
      const res = await axios.post('/api/v1/upload', uploadData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadStatuses(prev => ({ ...prev, [index]: { progress: percentCompleted, status: 'uploading' } }));
        },
        validateStatus: (status) => status < 500 
      });

      const responseData = parseApiResponse(res.data);

      const legacyUploadData = responseData?.data || responseData;
      if (res.status === 200 && responseData?.status === 'success') {
        const pathOrKey = legacyUploadData?.file_key || docKey;

        setUploadStatuses(prev => ({ ...prev, [index]: { progress: 100, status: 'success' } }));

        setUploadedFiles(prev => {
          const updated = {
            ...prev,
            [index]: {
              name: file.name,
              localUrl: localBlobUrl,
              uploaded: true,
              fileKey: pathOrKey,
              formCode: formData.form_code || id,
              mimeType: file.type || null
            }
          };

          const cacheData = buildCachedUploadedFiles(updated);
          sessionStorage.setItem(uploadedFilesCacheKey, JSON.stringify(cacheData));

          return updated;
        });

        return;
      }

      if (res.status !== 202 || responseData?.status !== 'queued' || !responseData?.job?.id) {
        throw new Error(responseData?.message || responseData?.error || "Upload queueing failed on server");
      }

      const jobId = responseData.job.id;
      setUploadStatuses(prev => ({ ...prev, [index]: { progress: 100, status: 'processing' } }));

      let uploadJob = null;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const jobRes = await axios.get(`/api/v1/upload/jobs/${jobId}`, {
          validateStatus: (status) => status < 500
        });
        const jobData = parseApiResponse(jobRes.data);
        uploadJob = jobData?.job || null;

        if (uploadJob?.status === 'succeeded') {
          break;
        }

        if (uploadJob?.status === 'failed') {
          throw new Error(uploadJob?.error?.message || 'Upload processing failed on server');
        }

        await sleep(1000);
      }

      if (!uploadJob || uploadJob.status !== 'succeeded') {
        throw new Error('Upload processing timed out. Please try again.');
      }

      const uploadResult = uploadJob.result || {};

      setUploadStatuses(prev => ({ ...prev, [index]: { progress: 100, status: 'success' } }));

      setUploadedFiles(prev => {
        const updated = {
          ...prev,
          [index]: {
            name: file.name,
            localUrl: localBlobUrl,
            uploaded: true,
            fileKey: uploadResult.file_key || docKey,
            formCode: uploadResult.form_code || formData.form_code || id,
            mimeType: uploadResult.mime_type || file.type || null
          }
        };

        const cacheData = buildCachedUploadedFiles(updated);
        sessionStorage.setItem(uploadedFilesCacheKey, JSON.stringify(cacheData));

        return updated;
      });

    } catch (err) {
      console.error("Direct Upload Failed:", err.response?.data || err.message);
      setUploadStatuses(prev => ({ ...prev, [index]: { progress: 0, status: 'error' } }));
    }
  };

  const handleRemoveFile = (index) => {
    resetValidationForIndex(index);
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[index];
      const cacheData = buildCachedUploadedFiles(newFiles);
      sessionStorage.setItem(uploadedFilesCacheKey, JSON.stringify(cacheData));
      return newFiles;
    });
    setUploadStatuses(prev => {
      const newStatuses = { ...prev };
      delete newStatuses[index];
      return newStatuses;
    });
  };

  const handleRetry = (index) => {
    const file = uploadedFiles[index];
    if (file && (file.localUrl || uploadStatuses[index]?.status === 'invalid_type')) {
      handleRemoveFile(index);
    }
  };

  const handleValidateDocuments = async () => {
    setIsValidating(true);
    setValidationStage('checking');
    setShowValidationDelayHint(false);
    setValidationPreparationJobs([]);
    setValidationSummary(null);
    trackAnalyticsEvent('validation_started', {
      form_code: formData?.form_code || id,
      degree_level: degreeLevel,
      sub_type: subType || 'default',
      required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0
    }).catch(() => {});
    try {
      if (!publicKey) throw new Error("Public Key is missing. Please refresh.");
      const validatePayload = {
        form_code: formData.form_code || id,
        degree_level: degreeLevel,
        sub_type: subType || ""
      };

      const submitValidationRequest = async (allowPreparationRetry = true) => {
        const { requestPayload, aesKeyRaw } = await encryptAndKeepKey(validatePayload, publicKey);
        const res = await axios.post('/api/v1/validation/check-completeness', requestPayload, reqConfig);
        let responseData = parseApiResponse(res.data);

        let encryptedPkg = null;
        if (responseData.payload && responseData.iv) {
          encryptedPkg = responseData;
        } else if (responseData.data && responseData.data.payload && responseData.data.iv) {
          encryptedPkg = responseData.data;
        }

        if (encryptedPkg) {
          const decryptedResult = await decryptResponse(encryptedPkg, aesKeyRaw);
          if (responseData.data && responseData.data.payload) {
            responseData.data = decryptedResult;
          } else {
            responseData = decryptedResult;
          }
        }

        const actualData = responseData?.data || responseData;

        if (res.status === 202 && actualData?.status === 'queued' && Array.isArray(actualData.jobs) && allowPreparationRetry) {
          setValidationStage('preparing');
          const finalJobs = await pollUploadPreparationJobs(actualData.jobs, setValidationPreparationJobs);
          const partialFailedJobs = finalJobs.filter((job) => job?.status === 'partial_failed');
          if (partialFailedJobs.length > 0) {
            setValidationResults(buildBatchPreparationErrors(partialFailedJobs));
            setValidationSummary({
              decision: 'fail',
              summary_th: 'การเตรียมเอกสารบางรายการไม่สำเร็จ กรุณาตรวจสอบไฟล์ที่ระบบแจ้ง'
            });
            setIsStep2Validated(true);
            return { res, responseData, actualData: 'partial_failed', partialFailed: true };
          }
          setValidationStage('checking');
          setValidationPreparationJobs([]);
          return submitValidationRequest(false);
        }

        return { res, responseData, actualData };
      };

      const { responseData, actualData, partialFailed } = await submitValidationRequest(true);

      if (partialFailed) {
        trackAnalyticsEvent('validation_failed', {
          form_code: formData?.form_code || id,
          degree_level: degreeLevel,
          sub_type: subType || 'default',
          required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0,
          failure_stage: 'preparation_partial'
        }).catch(() => {});
        return;
      }

      const normalizedValidation = normalizeValidationResponse(responseData, formData.required_documents);

      if (normalizedValidation.documentResults) {
        setValidationResults(normalizedValidation.documentResults);
        setValidationSummary(normalizedValidation.summary);

        const hasInvalidDocuments = Object.values(normalizedValidation.documentResults).some(
          (entry) => entry?.status !== 'valid'
        );

        trackAnalyticsEvent(hasInvalidDocuments ? 'validation_failed' : 'validation_succeeded', {
          form_code: formData?.form_code || id,
          degree_level: degreeLevel,
          sub_type: subType || 'default',
          required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0,
          failure_stage: hasInvalidDocuments ? 'validation_rules' : undefined
        }).catch(() => {});
      } else if (responseData?.status === 'success' || actualData === 'success') {
        const successResults = {};
        formData.required_documents.forEach(doc => {
          successResults[doc.key] = { status: 'valid', reason: 'ตรวจสอบสำเร็จ' };
        });
        setValidationResults(successResults);
        setValidationSummary({
          decision: 'pass',
          summary_th: 'เอกสารที่อัปโหลดผ่านการตรวจสอบในรอบนี้'
        });
        trackAnalyticsEvent('validation_succeeded', {
          form_code: formData?.form_code || id,
          degree_level: degreeLevel,
          sub_type: subType || 'default',
          required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0
        }).catch(() => {});
      } else {
        const docKeys = formData.required_documents.map(d => d.key);
        const isDetailedError = typeof actualData === 'object' && actualData !== null && Object.keys(actualData).some(key => docKeys.includes(key));
        
        if (isDetailedError) {
          setValidationResults(actualData);
          setValidationSummary(buildValidationSummaryFromLegacyResults(actualData));
          trackAnalyticsEvent('validation_failed', {
            form_code: formData?.form_code || id,
            degree_level: degreeLevel,
            sub_type: subType || 'default',
            required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0,
            failure_stage: 'validation_rules'
          }).catch(() => {});
        } else {
          const fallbackErrors = {};
          let errorMsg = 'ตรวจสอบไม่ผ่าน (เซิร์ฟเวอร์ไม่ตอบสนองรูปแบบที่ถูกต้อง)';
          
          if (typeof actualData === 'string') {
            errorMsg = actualData;
          } else if (typeof actualData === 'object' && actualData !== null) {
            errorMsg = actualData.user_message || actualData.message || actualData.error || actualData.reason || JSON.stringify(actualData);
          }

          formData.required_documents.forEach(doc => {
            fallbackErrors[doc.key] = { status: 'error', reason: `[API Error]: ${errorMsg}` };
          });
          setValidationResults(fallbackErrors);
          setValidationSummary({
            decision: 'fail',
            summary_th: errorMsg
          });
          trackAnalyticsEvent('validation_failed', {
            form_code: formData?.form_code || id,
            degree_level: degreeLevel,
            sub_type: subType || 'default',
            required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0,
            failure_stage: 'api_error'
          }).catch(() => {});
        }
      }
      
      setIsStep2Validated(true);
    } catch (err) {
      console.error("Validation API Error:", err.response?.data || err.message);
      
      let errMsg = err.message;
      if (err.response && err.response.data) {
        const errData = err.response.data;
        errMsg = errData.user_message || errData.message || errData.error || errData.reason || (typeof errData === 'string' ? errData : errMsg);
      }

      const fallbackErrors = {};
      formData?.required_documents?.forEach(doc => {
        fallbackErrors[doc.key] = { status: 'error', reason: `[Network Error]: ${errMsg}` };
      });
      setValidationResults(fallbackErrors);
      setValidationSummary({
        decision: 'fail',
        summary_th: errMsg
      });
      setIsStep2Validated(true);
      trackAnalyticsEvent('validation_failed', {
        form_code: formData?.form_code || id,
        degree_level: degreeLevel,
        sub_type: subType || 'default',
        required_document_count: Array.isArray(formData?.required_documents) ? formData.required_documents.length : 0,
        failure_stage: 'network_error'
      }).catch(() => {});
    } finally {
      setValidationStage(null);
      setValidationPreparationJobs([]);
      setIsValidating(false); 
    }
  };

  const getValidationStatusLabel = () => {
    if (!isValidating) {
      return '';
    }

    if (validationStage === 'preparing') {
      return 'กำลังเตรียมเอกสารสำหรับการตรวจสอบ...';
    }

    if (validationStage === 'checking') {
      return 'กำลังตรวจสอบความครบถ้วนของเอกสาร...';
    }

    return 'กำลังดำเนินการ...';
  };

  const getValidationQueueSummary = () => {
    if (!isValidating || validationStage !== 'preparing' || validationPreparationJobs.length === 0) {
      return null;
    }

    const queuedJobWithInfo = validationPreparationJobs.find((job) => job?.status === 'queued' && job?.queue_info);
    if (!queuedJobWithInfo?.queue_info) {
      return null;
    }

    return queuedJobWithInfo.queue_info;
  };

  const getQueueTierClasses = (tier) => {
    if (tier === 'short') {
      return {
        badge: 'bg-[#EEF7ED] text-[#2F7A38]',
        dot: 'bg-[#4CAF50]',
      };
    }

    if (tier === 'medium') {
      return {
        badge: 'bg-[#FFF6E7] text-[#9A6300]',
        dot: 'bg-[#FFB43B]',
      };
    }

    if (tier === 'long') {
      return {
        badge: 'bg-[#FFF0E8] text-[#B55A1B]',
        dot: 'bg-[#FF8A3D]',
      };
    }

    return {
      badge: 'bg-[#F7F1EA] text-[#7B542F]',
      dot: 'bg-[#FF9D00]',
    };
  };

  const getEstimatedWaitLabel = (tier, stage = 'preparing') => {
    if (stage === 'checking') {
      return 'ปกติใช้เวลาประมาณ 1-3 นาที';
    }

    if (tier === 'short') {
      return 'คาดว่าใช้เวลาไม่นาน';
    }

    if (tier === 'medium') {
      return 'ปกติใช้เวลาประมาณ 1-3 นาที';
    }

    if (tier === 'long') {
      return 'อาจใช้เวลานานกว่าปกติเล็กน้อย';
    }

    if (stage === 'preparing') {
      return 'ระบบจะเริ่มประมวลผลให้อัตโนมัติเมื่อถึงคิว';
    }

    return 'โปรดรอสักครู่';
  };

  const getPerFileQueueInfo = (docKey) => {
    if (!isValidating || validationResults[docKey]) {
      return null;
    }

    const matchingJob = validationPreparationJobs.find((job) => {
      const fileKey = job?.metadata?.file_key;
      const fileKeys = Array.isArray(job?.metadata?.file_keys) ? job.metadata.file_keys : [];
      return fileKey === docKey || fileKeys.includes(docKey);
    });
    if (matchingJob?.status === 'queued' && matchingJob?.queue_info) {
      return matchingJob.queue_info;
    }

    if (validationStage === 'preparing') {
      return {
        hint_message: 'กำลังเตรียมเอกสาร',
        estimated_wait_tier: null,
      };
    }

    if (validationStage === 'checking') {
      return {
        hint_message: 'กำลังตรวจสอบ',
        estimated_wait_tier: null,
      };
    }

    return null;
  };

  const getPerFileWaitLabel = (docKey) => {
    const queueInfo = getPerFileQueueInfo(docKey);
    if (!queueInfo?.hint_message) {
      return null;
    }

    return getEstimatedWaitLabel(queueInfo.estimated_wait_tier, validationStage);
  };

  const handleMergeDocuments = async () => {
    setIsMerging(true);
    setMergeError(null); 
    setMergeResult(null); 
    trackAnalyticsEvent('merge_started', {
      form_code: formData?.form_code || id,
      degree_level: degreeLevel,
      sub_type: subType || 'default'
    }).catch(() => {});
    try {
      if (!publicKey) throw new Error("Public Key is missing.");

      const mergePayload = {
        form_code: formData.form_code || id,
        degree_level: degreeLevel,
        sub_type: subType || null
      };

      const { requestPayload, aesKeyRaw } = await encryptAndKeepKey(mergePayload, publicKey);
      
      const res = await axios.post('/api/v1/documents/merge', requestPayload, reqConfig);
      
      let responseData = parseApiResponse(res.data);
      
      let encryptedPkg = null;
      if (responseData.payload && responseData.iv) {
        encryptedPkg = responseData;
      } else if (responseData.data && responseData.data.payload && responseData.data.iv) {
        encryptedPkg = responseData.data;
      }

      if (encryptedPkg) {
        const decryptedResult = await decryptResponse(encryptedPkg, aesKeyRaw);
        if (responseData.data && responseData.data.payload) {
          responseData.data = decryptedResult;
        } else {
          responseData = decryptedResult;
        }
      }

      const mergeData = responseData?.data || responseData;

      if (res.status === 200 && responseData?.status !== 'error' && !mergeData?.error) {
        setMergeResult(mergeData);
        trackAnalyticsEvent('merge_succeeded', {
          form_code: formData?.form_code || id,
          degree_level: degreeLevel,
          sub_type: subType || 'default',
          has_download_path: Boolean(mergeData?.download_path),
          has_directory_fallback: mergeData?.instruction?.target_email === 'ไม่มีข้อมูลภาควิชา'
        }).catch(() => {});
        return;
      }
      
      if (res.status !== 202 || mergeData?.status !== 'queued' || !mergeData?.job?.id) {
         throw new Error(mergeData?.user_message || mergeData?.message || mergeData?.error || "เกิดข้อผิดพลาดจากการเริ่มรวมไฟล์");
      }

      const jobId = mergeData.job.id;
      let mergeJob = { id: jobId, status: mergeData.job.status || 'queued' };
      for (let attempt = 0; attempt < 20; attempt += 1) {
        mergeJob = await waitForJobStatusChange('/api/v1/documents/jobs', jobId, mergeJob?.status || 'queued');

        if (mergeJob?.status === 'succeeded') {
          break;
        }

        if (mergeJob?.status === 'failed') {
          throw new Error(mergeJob?.error?.message || 'Document merge failed on server');
        }
      }

      if (!mergeJob || mergeJob.status !== 'succeeded') {
        throw new Error('Document merge timed out. Please try again.');
      }

      const downloadRes = await axios.get(`/api/v1/documents/jobs/${jobId}/download`, {
        validateStatus: (status) => status < 500
      });
      const downloadData = parseApiResponse(downloadRes.data);

      if (downloadRes.status !== 200 || downloadData?.status !== 'success' || !downloadData?.download_path) {
        throw new Error(downloadData?.message || downloadData?.error || 'Merged file is not ready for download');
      }

      setMergeResult({
        ...(mergeJob.result || {}),
        ...downloadData
      });

      trackAnalyticsEvent('merge_succeeded', {
        form_code: formData?.form_code || id,
        degree_level: degreeLevel,
        sub_type: subType || 'default',
        has_download_path: Boolean(downloadData?.download_path),
        has_directory_fallback: downloadData?.instruction?.target_email === 'ไม่มีข้อมูลภาควิชา'
      }).catch(() => {});

    } catch (err) {
      console.error("Merge API Error:", err.response?.data || err.message);
      
      let errMsg = err.message;
      if (err.response && err.response.data) {
        const errData = err.response.data;
        errMsg = errData.user_message || errData.message || errData.error || errData.reason || (typeof errData === 'string' ? errData : errMsg);
      }
      setMergeError(errMsg); 
      trackAnalyticsEvent('merge_failed', {
        form_code: formData?.form_code || id,
        degree_level: degreeLevel,
        sub_type: subType || 'default'
      }).catch(() => {});

    } finally {
      setIsMerging(false);
    }
  };

  const CheckIcon = () => (
    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );

  const requiredDocsIndices = formData?.required_documents
    ?.map((doc, index) => doc.required !== false ? index : -1)
    .filter(index => index !== -1) || [];

  const isStep1Complete = requiredDocsIndices.length === 0 || 
    requiredDocsIndices.every(index => checkedDocs[index]);

  const isStep2Complete = requiredDocsIndices.length === 0 || 
    requiredDocsIndices.every(index => uploadStatuses[index]?.status === 'success');

  const isAllRequiredValid = requiredDocsIndices.length === 0 ||
    requiredDocsIndices.every(index => {
      const docKey = formData?.required_documents[index]?.key;
      return validationResults[docKey]?.status === 'valid';
    });

  const validationQueueSummary = getValidationQueueSummary();

  useEffect(() => {
    if (!formData?.form_code) {
      return;
    }

    trackAnalyticsEvent('form_step_viewed', {
      form_code: formData.form_code || id,
      degree_level: degreeLevel,
      sub_type: subType || 'default',
      step: currentStep
    }).catch(() => {});
  }, [currentStep, formData?.form_code, degreeLevel, subType, id]);

  useEffect(() => {
    if (currentStep !== 3 || departments.length > 0) {
      return;
    }

    const fetchDepartments = async () => {
      try {
        const res = await axios.get('/api/v1/departments', { withCredentials: true });
        setDepartments(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error('Departments API Error:', err);
      }
    };

    fetchDepartments();
  }, [currentStep, departments.length]);

  return (
    <div className="page-shell font-sans">
      <Navbar />
      <div className="page-gutter content-form mt-6 w-full flex-grow lg:mt-10">
        <div className="flex w-full justify-start">
          <button onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/')} className="mb-5 cursor-pointer">
            <img src="/left-arrow.png" alt="ย้อนกลับ" className="h-9 w-9 object-contain sm:h-10 sm:w-10" data-protect-ui="true" draggable={false} />
          </button>
        </div>
        {/* Step Bar */}
        <div className="mx-auto mb-10 w-full max-w-4xl px-2 sm:px-4 lg:mb-12">
          <div className="flex w-full">
            <div className="flex-1 flex flex-col items-center relative">
              <div className={`absolute top-[18px] left-1/2 w-full h-[8px] -z-10 ${currentStep >= 2 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}></div>
              <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center ${currentStep >= 1 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}>
                {currentStep > 1 ? <CheckIcon /> : <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>}
              </div>
              <span className={`mt-3 text-center text-xs font-semibold sm:text-sm lg:text-base ${currentStep >= 1 ? 'text-[#7B542F]' : 'text-[#999999]'}`}>เตรียมเอกสาร</span>
            </div>
            <div className="flex-1 flex flex-col items-center relative">
              <div className={`absolute top-[18px] left-1/2 w-full h-[8px] -z-10 ${currentStep >= 3 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}></div>
              <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center ${currentStep >= 2 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}>
                {currentStep > 2 ? <CheckIcon /> : <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>}
              </div>
              <span className={`mt-3 text-center text-xs font-semibold sm:text-sm lg:text-base ${currentStep >= 2 ? 'text-[#7B542F]' : 'text-[#999999]'}`}>ตรวจความครบถ้วนของเอกสาร</span>
            </div>
            <div className="flex-1 flex flex-col items-center relative">
              <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center ${currentStep >= 3 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}>
                {currentStep > 3 ? <CheckIcon /> : <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>}
              </div>
              <span className={`mt-3 text-center text-xs font-semibold sm:text-sm lg:text-base ${currentStep >= 3 ? 'text-[#7B542F]' : 'text-[#999999]'}`}>ช่องทางการยื่นคำร้อง</span>
            </div>
          </div>
        </div>

        <div className="w-full px-0 sm:px-4 lg:px-10 xl:px-24">
          <div className="w-full rounded-xl border border-[#D9D9D9] bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            <div className="flex w-full items-start justify-between pb-4 sm:ml-2 lg:ml-4 pr-0 sm:pr-4">
              <h1 className="text-xl font-bold text-black sm:text-2xl flex-1">
                {formNameTh || '(ไม่พบชื่อเอกสาร)'} 
              </h1>
              {/* ปุ่มดาวน์โหลดพร้อมปรับสถานะ Loading */}
              {currentStep === 3 && (
                <div className="ml-4 flex flex-shrink-0 flex-col items-end mt-[-4px]">
                  <button
                    onClick={() => {
                      if (mergeResult?.download_path) {
                        window.location.href = mergeResult.download_path;
                      }
                    }}
                    disabled={isMerging || !mergeResult?.download_path}
                    className={`flex h-10 items-center justify-center rounded-full bg-[#7B542F] text-white shadow-sm transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 ${
                      isMerging ? 'w-auto px-4 sm:px-5' : 'w-10 sm:w-12'
                    }`}
                    title="ดาวน์โหลดไฟล์"
                  >
                    {isMerging ? (
                      <>
                        <svg className="mr-2 h-5 w-5 flex-shrink-0 animate-spin text-white sm:h-6 sm:w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="whitespace-nowrap text-sm font-medium sm:text-base">กำลังรวมเอกสารให้สำหรับการดาวน์โหลด</span>
                      </>
                    ) : (
                      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Step 1 */}
            {currentStep === 1 && (
              <>
                <p className='flex justify-start pt-3 text-base font-semibold text-[#999999] sm:ml-4 sm:pl-4 lg:ml-7 lg:text-lg'>ขั้นตอนการเตรียมเอกสาร</p>
                <div className="mb-8 pt-4 text-left text-black sm:ml-4 sm:pl-8 lg:ml-7 lg:pl-12">
                  {formData ? (
                    formData.submission_steps && formData.submission_steps.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {formData.submission_steps.map((step, index) => (
                          <div key={index}>{step}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#999999] italic">ไม่มีข้อมูลขั้นตอนการเตรียมเอกสาร</p>
                    )
                  ) : (
                    <div className="text-[#EA580C]">กำลังโหลดข้อมูล...</div>
                  )}
                </div>

                <p className='flex justify-start pt-3 text-base font-semibold text-[#999999] sm:ml-4 sm:pl-4 lg:ml-7 lg:text-lg'>เตรียมเอกสารดังต่อไปนี้</p>
                <div className="min-h-[150px] pt-4 text-left sm:ml-4 sm:pl-8 lg:ml-7 lg:pl-12">
                  {formData ? (
                    formData.required_documents && formData.required_documents.length > 0 ? (
                      <div className="flex flex-col gap-5">
                        {formData.required_documents.map((doc, index) => (
                          <div key={index} className="flex items-start">
                            <label className="flex items-start cursor-pointer group">
                              <div className="relative flex items-center justify-center mt-1">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 cursor-pointer accent-[#7B542F] rounded-sm border-gray-300"
                                  checked={!!checkedDocs[index]}
                                  onChange={() => handleCheck(index)}
                                />
                              </div>
                              <span className={`ml-4 text-base transition-colors sm:text-lg ${checkedDocs[index] ? 'text-black' : 'text-gray-700'}`}>
                                {doc.label} {doc.required !== false && <span className="text-red-500 ml-1">*</span>}
                              </span>
                            </label>
                            {doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-3 mt-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                                title="เปิดลิงก์เอกสารตัวอย่าง"
                              >
                                <img src="/link.png" alt="เปิดลิงก์เอกสาร" className="w-5 h-5 object-contain" data-protect-ui="true" draggable={false} />
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#999999] italic">ฟอร์มนี้ไม่มีเอกสารที่ต้องเตรียมเพิ่มเติม</p>
                    )
                  ) : (
                    <div className="text-[#EA580C]">กำลังโหลดข้อมูล...</div>
                  )}
                </div>
              </>
            )}
            {/* Step 2 */}
            {currentStep === 2 && (
              <>
                <div className="min-h-[250px] pt-6 text-left sm:ml-4 sm:pl-8 sm:pr-6 lg:ml-7 lg:pl-12 lg:pr-12 lg:pt-8">
                  {validationSummary?.summary_th && (
                    <div className={`mb-6 rounded-2xl border px-4 py-3 sm:px-5 ${validationSummary.decision === 'pass' ? 'border-[#B7DDBB] bg-[#F2FBF3] text-[#256B2A]' : 'border-[#F0C7C2] bg-[#FFF5F3] text-[#A53A2A]'}`}>
                      <p className="text-sm font-semibold sm:text-base">ผลลัพธ์การตรวจสอบ</p>
                      <p className="mt-1 text-sm sm:text-base">{validationSummary.summary_th}</p>
                    </div>
                  )}
                  {formData?.required_documents?.map((doc, index) => (
                    <div key={index} className="mb-8">
                      <div className="mb-3">
                        <p className="text-black font-semibold inline-block">{doc.label} {doc.required !== false && <span className="text-red-500 ml-1">*</span>}</p>
                        
                        {validationResults[doc.key] && validationResults[doc.key].status !== 'valid' && (
                          <ul className="list-disc pl-5 mt-1">
                            <li className="text-red-500 text-sm font-medium">
                              {validationResults[doc.key].reason || 'ตรวจสอบไม่ผ่าน กรุณาลบไฟล์แล้วอัปโหลดใหม่'}
                            </li>
                          </ul>
                        )}
                      </div>
                      
                      {uploadedFiles[index] ? (
                        <div className={'relative group flex w-full items-center rounded-xl border border-black bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#7B542F] sm:px-6'}>
                          
                          <img 
                            src={uploadStatuses[index]?.status === 'invalid_type' ? "/warning.png" : getFileIcon(uploadedFiles[index]?.name)}
                            alt={uploadStatuses[index]?.status === 'invalid_type' ? "Warning Icon" : "File Icon"}
                            className="mr-3 h-10 w-10 min-w-[40px] flex-shrink-0 object-contain sm:mr-4" 
                            data-protect-ui="true" 
                            draggable={false} 
                          />

                          <div className="flex flex-grow flex-col justify-center overflow-hidden">
                            {uploadStatuses[index]?.status === 'success' ? (
                              <>
                                <div className="flex items-center gap-2">
                                  {uploadedFiles[index].localUrl ? (
                                    <a 
                                      href={uploadedFiles[index].localUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-black font-medium truncate cursor-pointer hover:underline"
                                      title="คลิกเพื่อดูเอกสาร"
                                    >
                                      {uploadedFiles[index].name}
                                    </a>
                                  ) : (
                                    <span
                                      className="text-black font-medium truncate"
                                      title="อัปโหลดสำเร็จแล้ว แต่ต้องเลือกไฟล์ใหม่หากต้องการพรีวิวหลังรีเฟรชหน้า"
                                    >
                                      {uploadedFiles[index].name}
                                    </span>
                                  )}
                                  
                                  {validationResults[doc.key]?.status === 'valid' && (
                                    <svg className="w-5 h-5 text-[#22C55E] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="text-black font-semibold text-xl truncate w-full">{uploadedFiles[index].name}</p>
                            )}

                            {uploadStatuses[index]?.status === 'uploading' && (
                              <div className="mt-2 flex w-full items-center gap-3 pr-0 sm:gap-4 sm:pr-4">
                                <div className="flex-grow bg-[#E5E5E5] h-3 rounded-full overflow-hidden">
                                  <div className="bg-[#7B542F] h-full rounded-full transition-all duration-200" style={{ width: `${uploadStatuses[index].progress}%` }}></div>
                                </div>
                                <span className="w-10 text-right text-base font-semibold text-black sm:w-12 sm:text-lg">
                                  {uploadStatuses[index].progress}%
                                </span>
                              </div>
                            )}

                            {uploadStatuses[index]?.status === 'processing' && (
                              <p className="text-[#777777] text-base mt-1">
                                อัปโหลดแล้ว กำลังประมวลผลเอกสาร...
                              </p>
                            )}

                            {uploadStatuses[index]?.status === 'error' && (
                              <p className="text-[#777777] text-base mt-1">
                                Upload failed <span className="text-red-500 font-semibold cursor-pointer hover:underline" onClick={(e) => { e.preventDefault(); handleRetry(index); }}>Try again</span>
                              </p>
                            )}

                            {/* แสดงข้อความ Error สำหรับไฟล์ผิดประเภท */}
                            {uploadStatuses[index]?.status === 'invalid_type' && (
                              <p className="text-[#B91C1C] text-base mt-1 font-medium">
                                ประเภทไฟล์ไม่รองรับ รองรับเฉพาะไฟล์ PDF, PNG, JPG หรือ JPEG
                              </p>
                            )}

                            {getPerFileQueueInfo(doc.key)?.hint_message && uploadStatuses[index]?.status === 'success' && (
                              <div className="mt-2 flex flex-col items-start gap-1">
                                <div
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${getQueueTierClasses(getPerFileQueueInfo(doc.key)?.estimated_wait_tier).badge}`}
                                >
                                  <span
                                    className={`inline-block h-2 w-2 rounded-full animate-pulse ${getQueueTierClasses(getPerFileQueueInfo(doc.key)?.estimated_wait_tier).dot}`}
                                  ></span>
                                  {getPerFileQueueInfo(doc.key).hint_message}
                                </div>
                                {getPerFileWaitLabel(doc.key) && (
                                  <p className="text-sm text-[#999999]">{getPerFileWaitLabel(doc.key)}</p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="z-10 ml-3 flex flex-shrink-0 items-center justify-end gap-3 sm:ml-4 sm:gap-4" style={{ minWidth: "max-content" }}>
                            <button onClick={(e) => { e.preventDefault(); handleRemoveFile(index); }} className="flex h-6 w-6 flex-shrink-0 items-center justify-center cursor-pointer hover:opacity-70 transition-opacity" title="ลบไฟล์">
                               <img src="/close.png" alt="Close" className="h-full w-full flex-shrink-0 object-contain" data-protect-ui="true" draggable={false} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D9D9D9] bg-white py-6 transition-colors hover:border-[#7B542F]">
                          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleFileChange(index, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                          <div className="flex flex-col items-center pointer-events-none">
                            <img src="/upload.png" alt="Upload Icon" className="w-10 h-10 mb-2 object-contain" data-protect-ui="true" draggable={false} />
                            <p className="text-[#7B542F] font-bold text-lg">Click here to upload</p>
                            <p className="text-[#999999] text-sm mt-1">PDF or PNG or JPG or JPEG only (max 5 MB)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Step 3 */}
            {currentStep === 3 && (
              <>
                <p className='flex justify-start pt-3 text-base font-semibold text-[#999999] sm:ml-4 sm:pl-4 lg:ml-7 lg:text-lg'>ช่องทางการยื่นคำร้อง</p>
                <div className="min-h-[250px] pt-6 text-left sm:ml-4 sm:pl-8 lg:ml-7 lg:pl-12 lg:pt-8">
                  <div className="mb-6 text-black">
                    {formData?.submission_steps && formData.submission_steps.length > 0 ? (
                      <p>
                        {/* ตัดตัวเลขและจุดที่นำหน้าข้อความออกด้วย Regex */}
                        {formData.submission_steps[formData.submission_steps.length - 1].replace(/^\d+\.\s*/, '')} หรือส่งไปที่อีเมลภาควิชาที่นิสิตสังกัด
                      </p>
                    ) : (
                      <p>กำลังโหลดข้อมูลช่องทางการยื่นคำร้อง...</p>
                    )}
                  </div>

                  <div className="mt-6 text-black">
                    <p className="mt-2">ส่งอีเมลไปที่: {formData?.instruction?.target_email || mergeResult?.instruction?.target_email || '(ไม่มีข้อมูล)'}</p>
                    <p className="mt-2">หัวข้ออีเมล: {formData?.instruction?.email_subject || mergeResult?.instruction?.email_subject || '(ไม่มีข้อมูล)'}</p>
                    
                    <div className="mt-4 rounded-lg border border-[#E7D8C8] bg-[#FFF8F1] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[#7B542F]">รายชื่ออีเมลภาควิชา</p>
                          <p className="mt-1 text-sm text-[#7B542F]">คุณสามารถตรวจสอบอีเมลภาควิชาทั้งหมดด้านล่างเพื่อเลือกติดต่อด้วยตนเองได้</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDepartmentDirectory((prev) => !prev)}
                          className="rounded-md border border-[#D9B58A] px-4 py-2 text-sm font-semibold text-[#7B542F] transition-colors hover:bg-[#F8E7D2]"
                        >
                          {showDepartmentDirectory ? 'ซ่อนรายชื่อภาควิชา' : 'ดูรายชื่อภาควิชาทั้งหมด'}
                        </button>
                      </div>

                      {showDepartmentDirectory && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {departments.length > 0 ? (
                            departments.map((department) => (
                              <div key={department.id} className="rounded-md border border-[#F0E0CF] bg-white px-4 py-3">
                                <p className="font-medium text-black">{department.name_th}</p>
                                <p className="mt-1 text-sm text-[#7B542F]">
                                  {department.email || 'ไม่มีอีเมลติดต่อ'}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#7B542F]">กำลังโหลดข้อมูลรายชื่อภาควิชา...</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {mergeError && (
                    <div className="mt-6 text-red-500 font-medium bg-red-50 p-3 rounded-md border border-red-200 w-fit">
                      <p>❌ {mergeError}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-8 flex justify-end px-0 pb-8 sm:px-4 lg:mt-10 lg:px-24 lg:pb-10">
          <div className="flex w-full flex-col items-end gap-3 sm:w-auto">
            <button 
              onClick={() => {
                if (currentStep === 1) setCurrentStep(2);
                else if (currentStep === 2) {
                  if (!isStep2Validated) {
                    handleValidateDocuments();
                  } 
                  else if (isAllRequiredValid) {
                    setCurrentStep(3);
                  }
                }
                else if (currentStep === 3) {
                  navigate('/');
                }
              }} 
              disabled={
                (currentStep === 1 && !isStep1Complete) || 
                (currentStep === 2 && !isStep2Validated && (!isStep2Complete || isValidating)) ||
                (currentStep === 2 && isStep2Validated && !isAllRequiredValid) 
              }
              className={`flex w-auto items-center justify-center gap-2 rounded-lg px-8 py-3 font-bold text-white shadow-md transition-colors ${
                (currentStep === 1 && !isStep1Complete) || 
                (currentStep === 2 && !isStep2Validated && (!isStep2Complete || isValidating)) ||
                (currentStep === 2 && isStep2Validated && !isAllRequiredValid)
                  ? 'bg-[#D9D9D9] cursor-not-allowed' 
                  : 'bg-[#7B542F] cursor-pointer hover:bg-orange-600'
              }`}
            >
              {currentStep === 2 && !isStep2Validated ? (
                isValidating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังตรวจสอบ...
                  </>
                ) : 'ตรวจสอบ'
              ) : currentStep === 3 ? 'เสร็จสิ้น' : 'ถัดไป'}
            </button>

            {currentStep === 2 && !isStep2Validated && isValidating && (
              <div className="w-full text-right sm:w-auto">
                <p className="text-sm font-medium text-[#7B542F]">{getValidationStatusLabel()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
