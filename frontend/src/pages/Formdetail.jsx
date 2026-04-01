import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Navbar from './Navbar'
import Footer from './Footer'
import { encryptAndKeepKey, decryptResponse } from './crypto' 
import { ensureAuthenticatedOrRedirect } from '../lib/auth'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseApiResponse = (data) => (typeof data === 'string' ? JSON.parse(data) : data);

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

export default function Formdetail() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation(); 
  const formNameTh = location.state?.name_th || '';
  const degreeLevel = location.state?.degree_level || 'bachelor';
  const subType = location.state?.sub_type; 
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
  const [isStep2Validated, setIsStep2Validated] = useState(false); 
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [mergeError, setMergeError] = useState(null); 

  const reqConfig = { headers: { 'Content-Type': 'application/json' } };

  const [uploadedFiles, setUploadedFiles] = useState(() => {
    const savedFiles = sessionStorage.getItem(`uploaded_files_${id}`);
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
  }, [id, degreeLevel, subType]);

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

  const handleCheck = (index) => {
    setCheckedDocs(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const resetValidationForIndex = (index) => {
    setIsStep2Validated(false);
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
          sessionStorage.setItem(`uploaded_files_${id}`, JSON.stringify(cacheData));

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
        sessionStorage.setItem(`uploaded_files_${id}`, JSON.stringify(cacheData));

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
      sessionStorage.setItem(`uploaded_files_${id}`, JSON.stringify(cacheData));
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
    if (file && file.localUrl) {
      handleRemoveFile(index);
    }
  };

  const handleValidateDocuments = async () => {
    setIsValidating(true);
    setValidationStage('checking');
    setShowValidationDelayHint(false);
    setValidationPreparationJobs([]);
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
        return;
      }

      if (responseData?.status === 'success' || actualData === 'success') {
        const successResults = {};
        formData.required_documents.forEach(doc => {
          successResults[doc.key] = { status: 'valid', reason: 'ตรวจสอบสำเร็จ' };
        });
        setValidationResults(successResults);
      } else {
        const docKeys = formData.required_documents.map(d => d.key);
        const isDetailedError = typeof actualData === 'object' && actualData !== null && Object.keys(actualData).some(key => docKeys.includes(key));
        
        if (isDetailedError) {
          setValidationResults(actualData);
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
      setIsStep2Validated(true);
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
    try {
      if (!publicKey) throw new Error("Public Key is missing.");

      // 💡 อัปเดตข้อมูล payload ให้ตรงกับตัวอย่างที่แจ้งมา
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

      if (downloadRes.status !== 200 || downloadData?.status !== 'success' || !downloadData?.download_url) {
        throw new Error(downloadData?.message || downloadData?.error || 'Merged file is not ready for download');
      }

      setMergeResult({
        ...(mergeJob.result || {}),
        ...downloadData
      });

    } catch (err) {
      console.error("Merge API Error:", err.response?.data || err.message);
      
      let errMsg = err.message;
      if (err.response && err.response.data) {
        const errData = err.response.data;
        errMsg = errData.user_message || errData.message || errData.error || errData.reason || (typeof errData === 'string' ? errData : errMsg);
      }
      setMergeError(errMsg); 

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
            <h1 className="flex justify-start pb-4 text-xl font-bold text-black sm:ml-2 sm:text-2xl lg:ml-4">
              {formNameTh || '(ไม่พบชื่อเอกสาร)'} 
            </h1>
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
                            
                            <a 
                              href={doc.url || "#"} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="ml-3 mt-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              <img src="/link.png" alt="ดาวน์โหลดเอกสาร" className="w-5 h-5 object-contain" data-protect-ui="true" draggable={false} />
                            </a>
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
                          <img src="/pdf.png" alt="PDF" className="mr-3 h-10 w-10 object-contain sm:mr-4" data-protect-ui="true" draggable={false} />

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

                          <div className="z-10 ml-3 flex items-center gap-3 sm:ml-4 sm:gap-4">
                            {uploadStatuses[index]?.status === 'error' && (
                              <button onClick={(e) => { e.preventDefault(); handleRetry(index); }} className="cursor-pointer hover:opacity-70 transition-opacity">
                                 <img src="/reload.png" alt="Retry" className="w-8 h-8 object-contain" data-protect-ui="true" draggable={false} />
                              </button>
                            )}

                            <button onClick={(e) => { e.preventDefault(); handleRemoveFile(index); }} className="cursor-pointer hover:opacity-70 transition-opacity" title="ลบไฟล์">
                               <img src="/close.png" alt="Close" className="w-6 h-6 object-contain" data-protect-ui="true" draggable={false} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D9D9D9] bg-white py-6 transition-colors hover:border-[#7B542F]">
                          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleFileChange(index, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                          <div className="flex flex-col items-center pointer-events-none">
                            <img src="/upload.png" alt="Upload Icon" className="w-10 h-10 mb-2 object-contain" data-protect-ui="true" draggable={false} />
                            <p className="text-[#7B542F] font-bold text-lg">Click here to upload</p>
                            <p className="text-[#999999] text-sm mt-1">PDF or PNG or JPG only (max 5 MB)</p>
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
                  <div className="mb-6">
                    <ul className="list-disc pl-5 space-y-2 text-black">
                      {formData?.submission_steps ? (
                        formData.submission_steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))
                      ) : (
                        <li>กำลังโหลดข้อมูลช่องทางการยื่นคำร้อง...</li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-6">
                    <button 
                      onClick={handleMergeDocuments} 
                      className="text-[#EA580C] font-semibold underline cursor-pointer"
                    >
                      {isMerging ? 'กำลังรวมไฟล์...' : 'รวมไฟล์และดูช่องทางการส่ง'}
                    </button>
                    
                    {/* 💡 แสดงผล Error ที่เกิดขึ้นบน UI */}
                    {mergeError && (
                      <div className="mt-4 text-red-500 font-medium bg-red-50 p-3 rounded-md border border-red-200 w-fit">
                        <p>❌ {mergeError}</p>
                      </div>
                    )}
                    
                    {mergeResult && (
                      <div className="mt-4 text-black">
                        {mergeResult.download_url && (
                           <p>ลิงก์ดาวน์โหลด: <a href={mergeResult.download_url} target="_blank" rel="noopener noreferrer" className="text-[#EA580C] underline">คลิกที่นี่</a></p>
                        )}
                        {mergeResult.instruction && (
                           <>
                             <p className="mt-2">ส่งอีเมลไปที่: {mergeResult.instruction.target_email}</p>
                             <p className="mt-2">หัวข้ออีเมล: {mergeResult.instruction.email_subject}</p>
                           </>
                        )}
                      </div>
                    )}
                  </div>
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
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-8 py-3 font-bold text-white shadow-md transition-colors sm:w-auto ${
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
                {validationQueueSummary?.hint_message && (
                  <div className="mt-2 flex flex-col items-end gap-1">
                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium bg-[#F9F7F3] text-[#7B542F]">
                      <span
                        className={`inline-block h-2 w-2 rounded-full animate-pulse ${getQueueTierClasses(validationQueueSummary?.estimated_wait_tier).dot}`}
                      ></span>
                      {validationQueueSummary.hint_message}
                    </div>
                    <p className="text-sm text-[#999999]">
                      {getEstimatedWaitLabel(validationQueueSummary?.estimated_wait_tier, validationStage)}
                    </p>
                  </div>
                )}
                {showValidationDelayHint && (
                  <p className="mt-1 text-sm text-[#999999]">ใช้เวลานานกว่าปกติเล็กน้อย กรุณารอสักครู่</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
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
