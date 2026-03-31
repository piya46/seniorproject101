import React, { useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import axios from 'axios';
import { useEffect } from 'react';
import { ensureAuthenticatedOrRedirect } from '../lib/auth';

function Contactus() {
  const [formData, setFormData] = useState({
    email: '',
    issueType: '',
    subject: '',
    details: '',
  });
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State สำหรับควบคุม Popup (Modal)
  const [popup, setPopup] = useState({
    isOpen: false,
    type: 'success',
    message: ''
  });

  const showPopup = (type, message) => {
    setPopup({ isOpen: true, type, message });
  };
  const closePopup = () => {
    setPopup({ isOpen: false, type: 'success', message: '' });
  };

  useEffect(() => {
    ensureAuthenticatedOrRedirect();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // ตรวจสอบขนาดไฟล์เบื้องต้นว่าไม่เกิน 2MB ก่อนเก็บลง state
      if (selectedFile.size > 2 * 1024 * 1024) {
        showPopup('error', 'ขนาดไฟล์ต้องไม่เกิน 2MB');
        e.target.value = null; // เคลียร์ไฟล์ออก
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleRemoveFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
    const fileInput = document.getElementById('support-file-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.issueType || !formData.subject || !formData.details) {
      showPopup('error', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (file && file.size > 2 * 1024 * 1024) {
      showPopup('error', 'ขนาดไฟล์ต้องไม่เกิน 2MB');
      return;
    }

    setIsSubmitting(true);

    try {
      // สร้าง FormData ตามโครงสร้างที่ API กำหนด (multipart/form-data)
      const uploadData = new FormData();
      uploadData.append('reporter_email', formData.email);
      uploadData.append('issue_type', formData.issueType);
      uploadData.append('subject', formData.subject);
      uploadData.append('description', formData.details);
      
      if (file) {
        uploadData.append('attachment', file);
      }

      // ส่งคำขอไปยัง API พร้อมแนบ session cookie
      await axios.post('/api/v1/support/technical-email', uploadData, {
        headers: { 
          'Content-Type': 'multipart/form-data' 
        },
        withCredentials: true // จำเป็นสำหรับ Security Rules (Session Cookie)
      });

      showPopup('success', 'ส่งข้อมูลแจ้งปัญหาสำเร็จ ทีมงานจะรีบตรวจสอบโดยเร็ว');
      
      // ล้างค่าฟอร์มหลังกดส่งสำเร็จ
      setFormData({ email: '', issueType: '', subject: '', details: '' });
      setFile(null);

    } catch (err) {
      console.error("Support API Error:", err);
      showPopup('error', 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้งหรือลองใหม่ในภายหลัง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell font-sans">
      <Navbar />
      
      <div className="page-gutter content-reading mt-10 mb-16 flex-grow flex flex-col items-center">
        <div className="w-full">
          <h1 className="text-[28px] font-extrabold text-[#7B542F] mb-6 text-left">
            แจ้งปัญหาการใช้งาน
          </h1>

          <form onSubmit={handleSubmit} className="w-full">
            
            <div className="bg-white border border-[#D9D9D9] p-8 md:p-12 rounded-xl shadow-sm w-full flex flex-col gap-6 text-left text-black">
              
              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm">Email สำหรับติดต่อกลับ</label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="border border-[#D9D9D9] rounded-lg p-2.5 focus:outline-none focus:border-[#7B542F] transition-colors"
                  required
                />
              </div>

              {/* Radio Group: ประเภทปัญหา */}
              <div className="flex flex-col gap-3">
                <label className="font-bold text-sm text-black decoration-2">ประเภทของปัญหา</label>
                <div className="flex flex-col gap-3 ml-4 mt-1">
                  
                  {/* Option 1 */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="issueType" 
                        value="รายละเอียดข้อมูลผิด"
                        checked={formData.issueType === 'รายละเอียดข้อมูลผิด'}
                        onChange={handleInputChange}
                        className="sr-only"
                        required
                      />
                      <div className={`w-5 h-5 border-2 rounded-full transition-all duration-200 
                        ${formData.issueType === 'รายละเอียดข้อมูลผิด' ? 'border-[#FF9D00]' : 'border-[#999999]'}`}>
                      </div>
                      <div className={`absolute w-3 h-3 bg-[#FF9D00] rounded-full transition-transform duration-200 
                        ${formData.issueType === 'รายละเอียดข้อมูลผิด' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                      </div>
                    </div>
                    <span className="text-sm">รายละเอียดข้อมูลผิด</span>
                  </label>

                  {/* Option 2 */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="issueType" 
                        value="เว็บไซต์มีปัญหา"
                        checked={formData.issueType === 'เว็บไซต์มีปัญหา'}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 border-2 rounded-full transition-all duration-200 
                        ${formData.issueType === 'เว็บไซต์มีปัญหา' ? 'border-[#FF9D00]' : 'border-[#999999]'}`}>
                      </div>
                      <div className={`absolute w-3 h-3 bg-[#FF9D00] rounded-full transition-transform duration-200 
                        ${formData.issueType === 'เว็บไซต์มีปัญหา' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                      </div>
                    </div>
                    <span className="text-sm">เว็บไซต์มีปัญหา</span>
                  </label>

                  {/* Option 3 */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="issueType" 
                        value="ข้อเสนอแนะ"
                        checked={formData.issueType === 'ข้อเสนอแนะ'}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 border-2 rounded-full transition-all duration-200 
                        ${formData.issueType === 'ข้อเสนอแนะ' ? 'border-[#FF9D00]' : 'border-[#999999]'}`}>
                      </div>
                      <div className={`absolute w-3 h-3 bg-[#FF9D00] rounded-full transition-transform duration-200 
                        ${formData.issueType === 'ข้อเสนอแนะ' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                      </div>
                    </div>
                    <span className="text-sm">ข้อเสนอแนะ</span>
                  </label>

                </div>
              </div>

              {/* หัวข้อเรื่อง */}
              <div className="flex flex-col gap-2 mt-2">
                <label className="font-bold text-sm">หัวข้อเรื่อง</label>
                <input 
                  type="text" 
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="border border-[#D9D9D9] rounded-lg p-2.5 focus:outline-none focus:border-[#7B542F] transition-colors"
                  required
                />
              </div>

              {/* รายละเอียด */}
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm">รายละเอียด</label>
                <textarea 
                  name="details"
                  value={formData.details}
                  onChange={handleInputChange}
                  rows="5"
                  className="border border-[#D9D9D9] rounded-lg p-3 resize-none focus:outline-none focus:border-[#7B542F] transition-colors"
                  required
                ></textarea>
              </div>

              {/* อัปโหลดเอกสาร */}
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm">เอกสารประกอบ (Optional)</label>
                <div className="relative border-2 border-dashed border-[#D9D9D9] rounded-xl py-8 mt-1 flex flex-col items-center justify-center cursor-pointer hover:border-[#7B542F] transition-colors bg-white">
                  
                  {/* เพิ่ม ID ให้ input file เพื่อให้เคลียร์ค่าได้ */}
                  <input 
                    type="file" 
                    id="support-file-input"
                    accept=".pdf,.png,.jpg,.jpeg,.webp" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {/* 💡 ปุ่มลบไฟล์ที่จะแสดงก็ต่อเมื่อมีไฟล์แล้ว */}
                  {file && (
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="absolute top-3 right-3 z-10 p-1 cursor-pointer"
                      title="ลบไฟล์"
                    >
                      <img src="/close.png" alt="Remove File" className="w-5 h-5 object-contain" />
                    </button>
                  )}

                  <div className="flex flex-col items-center pointer-events-none">
                    {file ? (
                      <>
                        <img src="/pdf.png" alt="File" className="w-10 h-10 mb-2 object-contain" onError={(e) => {e.target.src = '/file.png'}} />
                        <p className="text-[#7B542F] font-bold text-base truncate max-w-[200px]">{file.name}</p>
                        <p className="text-[#999999] text-xs mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
                      </>
                    ) : (
                      <>
                        <img src="/upload.png" alt="Upload Icon" className="w-8 h-8 mb-3 object-contain" />
                        <p className="text-[#7B542F] font-bold text-base">Click here to upload</p>
                        <p className="text-[#999999] text-xs mt-1">PDF, PNG, JPG, WEBP only (max 2 MB)</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end mt-8">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`flex items-center justify-center bg-[#7B542F] text-white px-12 py-3 rounded-md font-bold text-sm shadow-md transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-700'}`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังส่งข้อมูล...
                  </>
                ) : 'ตกลง'}
              </button>
            </div>

          </form>
        </div>
      </div>

      <Footer />

      {/* 💡 Popup Modal แจ้งเตือน */}
      {popup.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 transition-opacity">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center text-center transform scale-100 transition-transform">
            
            {/* ไอคอนตามประเภท (Success/Error) */}
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-500 shadow-sm">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500 shadow-sm">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            
            <h2 className={`text-xl font-bold mb-2 ${popup.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {popup.type === 'success' ? 'สำเร็จ' : 'แจ้งเตือน'}
            </h2>
            
            <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
              {popup.message}
            </p>
            
            <button
              onClick={closePopup}
              className={`px-8 py-2.5 rounded-lg font-bold text-white transition-colors w-full shadow-sm ${
                popup.type === 'success' 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Contactus;
