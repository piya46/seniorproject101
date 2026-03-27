import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Navbar from './Navbar'
import Footer from './Footer'
import { encryptAndKeepKey, decryptResponse } from './crypto' 

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

      const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

      if (responseData?.status !== 'success') {
        throw new Error("Upload failed on server");
      }

      const pathOrKey = responseData?.data?.file_key || docKey;

      setUploadStatuses(prev => ({ ...prev, [index]: { progress: 100, status: 'success' } }));

      setUploadedFiles(prev => {
        const updated = {
          ...prev,
          [index]: {
            name: file.name,
            localUrl: localBlobUrl,
            view_url: `/api/v1/documents/view?path=${pathOrKey}`, 
            gcs_path: pathOrKey 
          }
        };

        const cacheData = Object.keys(updated).reduce((acc, key) => {
          acc[key] = { name: updated[key].name, view_url: updated[key].view_url, gcs_path: updated[key].gcs_path };
          return acc;
        }, {});
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
      const cacheData = Object.keys(newFiles).reduce((acc, key) => {
        acc[key] = { name: newFiles[key].name, view_url: newFiles[key].view_url, gcs_path: newFiles[key].gcs_path };
        return acc;
      }, {});
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
    try {
      if (!publicKey) throw new Error("Public Key is missing. Please refresh.");

      const validatePayload = {
        form_code: formData.form_code || id,
        student_level: degreeLevel,
        sub_type: subType || ""
      };

      const { requestPayload, aesKeyRaw } = await encryptAndKeepKey(validatePayload, publicKey);
      
      const res = await axios.post('/api/v1/validation/check-completeness', requestPayload, reqConfig);
      
      let responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

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
      setIsValidating(false); 
    }
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
        sub_type: subType || null,
        department_id: formData.department_id || "central",
        gcs_paths: Object.values(uploadedFiles).map(file => file.gcs_path).filter(Boolean)
      };

      const { requestPayload, aesKeyRaw } = await encryptAndKeepKey(mergePayload, publicKey);
      
      const res = await axios.post('/api/v1/documents/merge', requestPayload, reqConfig);
      
      let responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      
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
      
      if (responseData?.status === 'error' || mergeData.error) {
         throw new Error(mergeData.user_message || mergeData.message || mergeData.error || "เกิดข้อผิดพลาดจากการรวมไฟล์");
      }

      setMergeResult(mergeData);

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

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <div className="w-full mt-10 px-10 flex-grow">
        <div className="flex justify-start w-full pl-5">
          <button onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/')} className="mb-5 cursor-pointer">
            <img src="/left-arrow.png" alt="ย้อนกลับ" className="w-10 h-10 object-contain" />
          </button>
        </div>
        {/* Step Bar */}
        <div className="w-full max-w-4xl mx-auto mb-12 px-4">
          <div className="flex w-full">
            <div className="flex-1 flex flex-col items-center relative">
              <div className={`absolute top-[18px] left-1/2 w-full h-[8px] -z-10 ${currentStep >= 2 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}></div>
              <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center ${currentStep >= 1 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}>
                {currentStep > 1 ? <CheckIcon /> : <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>}
              </div>
              <span className={`text-base mt-3 font-semibold ${currentStep >= 1 ? 'text-[#7B542F]' : 'text-[#999999]'}`}>เตรียมเอกสาร</span>
            </div>
            <div className="flex-1 flex flex-col items-center relative">
              <div className={`absolute top-[18px] left-1/2 w-full h-[8px] -z-10 ${currentStep >= 3 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}></div>
              <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center ${currentStep >= 2 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}>
                {currentStep > 2 ? <CheckIcon /> : <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>}
              </div>
              <span className={`text-base mt-3 font-semibold ${currentStep >= 2 ? 'text-[#7B542F]' : 'text-[#999999]'}`}>ตรวจความครบถ้วนของเอกสาร</span>
            </div>
            <div className="flex-1 flex flex-col items-center relative">
              <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center ${currentStep >= 3 ? 'bg-[#FF9D00]' : 'bg-[#D9D9D9]'}`}>
                {currentStep > 3 ? <CheckIcon /> : <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>}
              </div>
              <span className={`text-base mt-3 font-semibold ${currentStep >= 3 ? 'text-[#7B542F]' : 'text-[#999999]'}`}>ช่องทางการยื่นคำร้อง</span>
            </div>
          </div>
        </div>

        <div className="w-full px-24">
          <div className="bg-white p-10 rounded-xl shadow-sm border border-[#D9D9D9] w-full">
            <h1 className="text-2xl font-bold ml-4 text-black flex justify-start pb-4">
              {formNameTh || '(ไม่พบชื่อเอกสาร)'} 
            </h1>
            {/* Step 1 */}
            {currentStep === 1 && (
              <>
                <p className='text-[#999999] pt-3 flex justify-start pl-4 ml-7 font-semibold text-lg'>ขั้นตอนการเตรียมเอกสาร</p>
                <div className="pt-4 pl-12 ml-7 mb-8 text-black text-left">
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

                <p className='text-[#999999] pt-3 flex justify-start pl-4 ml-7 font-semibold text-lg'>เตรียมเอกสารดังต่อไปนี้</p>
                <div className="min-h-[150px] pt-4 pl-12 ml-7 text-left">
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
                              <span className={`ml-4 text-lg transition-colors ${checkedDocs[index] ? 'text-black' : 'text-gray-700'}`}>
                                {doc.label} {doc.required !== false && <span className="text-red-500 ml-1">*</span>}
                              </span>
                            </label>
                            
                            <a 
                              href={doc.url || "#"} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="ml-3 mt-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              <img src="/link.png" alt="ดาวน์โหลดเอกสาร" className="w-5 h-5 object-contain" />
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
                <div className="min-h-[250px] pt-8 pl-12 ml-7 pr-12 text-left">
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
                        <div className={'border border-black rounded-xl px-6 py-3 flex items-center w-full bg-white shadow-sm hover:border-[#7B542F] transition-colors relative group'}>
                          <img src="/pdf.png" alt="PDF" className="w-10 h-10 object-contain mr-4" />

                          <div className="flex-grow flex flex-col justify-center overflow-hidden">
                            {uploadStatuses[index]?.status === 'success' ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <a 
                                    href={uploadedFiles[index].localUrl || uploadedFiles[index].view_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-black font-medium truncate cursor-pointer hover:underline"
                                    title="คลิกเพื่อดูเอกสาร"
                                  >
                                    {uploadedFiles[index].name}
                                  </a>
                                  
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
                              <div className="flex items-center mt-2 w-full gap-4 pr-4">
                                <div className="flex-grow bg-[#E5E5E5] h-3 rounded-full overflow-hidden">
                                  <div className="bg-[#7B542F] h-full rounded-full transition-all duration-200" style={{ width: `${uploadStatuses[index].progress}%` }}></div>
                                </div>
                                <span className="text-black font-semibold text-lg w-12 text-right">
                                  {uploadStatuses[index].progress}%
                                </span>
                              </div>
                            )}

                            {uploadStatuses[index]?.status === 'error' && (
                              <p className="text-[#777777] text-base mt-1">
                                Upload failed <span className="text-red-500 font-semibold cursor-pointer hover:underline" onClick={(e) => { e.preventDefault(); handleRetry(index); }}>Try again</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-4 ml-4 z-10">
                            {uploadStatuses[index]?.status === 'error' && (
                              <button onClick={(e) => { e.preventDefault(); handleRetry(index); }} className="cursor-pointer hover:opacity-70 transition-opacity">
                                 <img src="/reload.png" alt="Retry" className="w-8 h-8 object-contain" />
                              </button>
                            )}

                            <button onClick={(e) => { e.preventDefault(); handleRemoveFile(index); }} className="cursor-pointer hover:opacity-70 transition-opacity" title="ลบไฟล์">
                               <img src="/close.png" alt="Close" className="w-6 h-6 object-contain" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative border-2 border-dashed border-[#D9D9D9] rounded-xl py-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#7B542F] transition-colors bg-white">
                          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleFileChange(index, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                          <div className="flex flex-col items-center pointer-events-none">
                            <img src="/upload.png" alt="Upload Icon" className="w-10 h-10 mb-2 object-contain" />
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
                <p className='text-[#999999] pt-3 flex justify-start pl-4 ml-7 font-semibold text-lg'>ช่องทางการยื่นคำร้อง</p>
                <div className="min-h-[250px] pt-8 pl-12 ml-7 text-left">
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
                             <p className="mt-2">หัวข้ออีเมล: {mergeResult.instruction.email_subject_suggestion}</p>
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
        <div className="flex justify-end mt-10 px-24 pb-10">
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
            }} 
            disabled={
              (currentStep === 1 && !isStep1Complete) || 
              (currentStep === 2 && !isStep2Validated && (!isStep2Complete || isValidating)) ||
              (currentStep === 2 && isStep2Validated && !isAllRequiredValid) 
            }
            className={`text-white px-8 py-3 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 ${
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
            ) : 'ถัดไป'}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}