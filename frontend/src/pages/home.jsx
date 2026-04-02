import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import React from 'react';
import Navbar from './Navbar'
import Footer from './Footer'
import axios from 'axios'
import { encryptPayload, encryptAndKeepKey, decryptResponse } from './crypto' 
import { ensureAuthenticatedOrRedirect } from '../lib/auth'

export default function Home() {
  const chatUsageCacheKey = 'chat_usage_summary';
  const navigate = useNavigate();
  const [selectedLabel, setSelectedLabel] = useState(sessionStorage.getItem('last_label') || 'ป.ตรี');
  const [degree, setDegree] = useState(sessionStorage.getItem('last_degree') || 'bachelor');
  const [searchTerm, setSearchTerm] = useState(sessionStorage.getItem('last_search') || ''); 
  const [forms, setForms] = useState([]); 
  const [publicKey, setPublicKey] = useState(null);
  const levels = ['ป.ตรี', 'ป.โท', 'ป.เอก'];
  const [selectedForm, setSelectedForm] = useState(() => {
    const savedForm = sessionStorage.getItem('last_selected_form');
    return savedForm ? JSON.parse(savedForm) : null;
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'สวัสดีครับ มีอะไรให้ผมช่วยแนะนำเกี่ยวกับการยื่นคำร้องไหมครับ?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatUsage, setChatUsage] = useState(null);
  const messagesEndRef = useRef(null);
  
  // 💡 เพิ่ม ref สำหรับดักการรันเบิ้ลของ React Strict Mode
  const initRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    const initializeApp = async () => {
      // 💡 ดักไว้ไม่ให้มันทำงาน 2 รอบตอนโหลดหน้าเว็บ
      if (initRef.current) return;
      initRef.current = true;

      try {
        const currentUser = await ensureAuthenticatedOrRedirect();
        if (!currentUser) {
          return;
        }

        let pubKey = sessionStorage.getItem('public_key');
        
        if (pubKey === 'null' || pubKey === 'undefined') {
          pubKey = null;
          sessionStorage.removeItem('public_key');
          sessionStorage.removeItem('is_initialized');
        }

        const isInit = sessionStorage.getItem('is_initialized');

        if (!pubKey || !isInit) {
          const keyRes = await axios.get('/api/v1/auth/public-key');
          pubKey = keyRes.data?.publicKey || keyRes.data?.data?.publicKey || (typeof keyRes.data === 'string' ? keyRes.data : null);
          
          if (pubKey) {
            const encryptedBody = await encryptPayload({}, pubKey);
            await axios.post('/api/v1/session/init', encryptedBody, { withCredentials: true });
            sessionStorage.setItem('public_key', pubKey);
            sessionStorage.setItem('is_initialized', 'true');
          }
        }
        
        setPublicKey(pubKey);
        const cachedChatUsage = sessionStorage.getItem(chatUsageCacheKey);
        if (cachedChatUsage) {
          try {
            setChatUsage(JSON.parse(cachedChatUsage));
          } catch {
            sessionStorage.removeItem(chatUsageCacheKey);
          }
        }

        try {
          const usageRes = await axios.get('/api/v1/chat/usage', { withCredentials: true });
          if (usageRes.data?.ai_usage) {
            setChatUsage(usageRes.data.ai_usage);
            sessionStorage.setItem(chatUsageCacheKey, JSON.stringify(usageRes.data.ai_usage));
          }
        } catch (usageError) {
          console.error('Chat usage bootstrap failed:', usageError);
        }

        fetchForms(degree); 
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    initializeApp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchForms = async (degreeLevel) => {
    const cacheKey = `forms_cache_${degreeLevel}`;
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        setForms(JSON.parse(cachedData));
        return;
      }

      // 💡 หาก API get forms ต้องใช้ Cookie ด้วย แนะนำให้เติม withCredentials: true ในอนาคต
      const res = await axios.get(`/api/v1/forms`, { 
        params: { degree_level: degreeLevel },
        withCredentials: true 
      });
      const fetchedData = res.data.data || [];
      
      sessionStorage.setItem(cacheKey, JSON.stringify(fetchedData));
      setForms(fetchedData);
    } catch (err) {
      console.error("Fetch forms failed:", err);
    }
  };

  const filteredForms = Array.isArray(forms) ? forms.filter(form => 
    form.name_th?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    form.form_code?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const handleDegreeChange = (label) => {
    const nextDegree = label === 'ป.ตรี' ? 'bachelor' : 'graduate';
    sessionStorage.setItem('last_label', label);
    sessionStorage.setItem('last_degree', nextDegree);

    if (degree !== nextDegree) {
      fetchForms(nextDegree);
    }
    setSelectedLabel(label);
    setDegree(nextDegree);
    setSelectedForm(null); 
    sessionStorage.removeItem('last_selected_form'); 
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    sessionStorage.setItem('last_search', text);
  };
  const handleFormClick = (form) => {
    if (form.has_sub_types && form.sub_categories) {
      setSelectedForm(form);
      sessionStorage.setItem('last_selected_form', JSON.stringify(form)); 
    } else {
      navigate(`/form/${form.form_code}`, { 
        state: { 
          name_th: form.name_th,
          degree_level: degree 
        } 
      });
    }
  };

  const handleSubCategoryClick = (subCat) => {
    navigate(`/form/${selectedForm.form_code}`, { 
      state: { 
        name_th: `${selectedForm.name_th} (${subCat.label})`, 
        degree_level: degree,
        sub_type: subCat.value 
      } 
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      if (!publicKey || publicKey === 'null' || publicKey === 'undefined') {
        sessionStorage.removeItem('public_key');
        sessionStorage.removeItem('is_initialized');
        throw new Error("เซสชันความปลอดภัยหมดอายุ กรุณารีเฟรชหน้าเว็บ (F5) เพื่อเชื่อมต่อใหม่ครับ");
      }

      const chatPayload = { message: userMessage };
      const { requestPayload, aesKeyRaw } = await encryptAndKeepKey(chatPayload, publicKey);
      
        const reqConfig = { headers: { 'Content-Type': 'application/json' }, withCredentials: true };
      const res = await axios.post('/api/v1/chat/recommend', requestPayload, reqConfig);
      
      let responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

      let encryptedPkg = null;
      if (responseData.payload && responseData.iv) encryptedPkg = responseData;
      else if (responseData.data && responseData.data.payload && responseData.data.iv) encryptedPkg = responseData.data;

      if (encryptedPkg) {
        const decryptedResult = await decryptResponse(encryptedPkg, aesKeyRaw);
        if (responseData.data && responseData.data.payload) responseData.data = decryptedResult;
        else responseData = decryptedResult;
      }

      const actualData = responseData?.data || responseData;
      const botReply = actualData.reply || actualData.message || actualData || 'ได้รับข้อความแล้ว แต่เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ';
      if (actualData?.ai_usage) {
        setChatUsage(actualData.ai_usage);
        sessionStorage.setItem(chatUsageCacheKey, JSON.stringify(actualData.ai_usage));
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: typeof botReply === 'string' ? botReply : JSON.stringify(botReply) }]);

    } catch (err) {
      console.error("Chat API Error:", err);
      let errMsg = 'ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
      if (err.message) errMsg = err.message; 
      if (err.response?.data?.user_message) errMsg = err.response.data.user_message;
      if (err.response?.data?.data?.daily_limit || err.response?.data?.data?.used_tokens !== undefined) {
        const quotaData = err.response.data.data;
        const dailyLimit = Number(quotaData.daily_limit || 0);
        const usedTokens = Number(quotaData.used_tokens || 0);
        const remainingTokens = Math.max(0, dailyLimit - usedTokens);
        const usedPercent = dailyLimit > 0 ? Math.min(100, Math.max(0, Math.round((usedTokens / dailyLimit) * 100))) : 0;
        setChatUsage({
          daily_limit: dailyLimit,
          used_tokens: usedTokens,
          remaining_tokens: remainingTokens,
          used_percent: usedPercent
        });
        sessionStorage.setItem(chatUsageCacheKey, JSON.stringify({
          daily_limit: dailyLimit,
          used_tokens: usedTokens,
          remaining_tokens: remainingTokens,
          used_percent: usedPercent
        }));
      }
      setChatMessages(prev => [...prev, { sender: 'bot', text: errMsg }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getChatUsageToneClasses = () => {
    const usedPercent = Number(chatUsage?.used_percent || 0);

    if (usedPercent >= 90) {
      return {
        chip: 'bg-[#FFF0E8] text-[#B55A1B]',
        dot: 'bg-[#FF8A3D]',
        color: '#FF8A3D'
      };
    }

    if (usedPercent >= 70) {
      return {
        chip: 'bg-[#FFF6E7] text-[#9A6300]',
        dot: 'bg-[#FFB43B]',
        color: '#FFB43B'
      };
    }

    return {
      chip: 'bg-[#EEF7ED] text-[#2F7A38]',
      dot: 'bg-[#4CAF50]',
      color: '#4CAF50'
    };
  };

  const getChatUsageLabel = () => {
    if (!chatUsage) {
      return 'พร้อมช่วยตอบคำถาม';
    }

    const usedPercent = Number(chatUsage.used_percent || 0);
    if (usedPercent >= 90) {
      return 'โควต้า AI วันนี้ใกล้เต็ม';
    }

    if (usedPercent >= 70) {
      return `เหลือประมาณ ${Math.max(0, 100 - usedPercent)}% วันนี้`;
    }

    return 'AI วันนี้คงเหลือเพียงพอ';
  };

  const getChatUsageEtaLabel = () => {
    if (!chatUsage) {
      return 'พร้อมใช้งาน';
    }

    const usedPercent = Number(chatUsage.used_percent || 0);
    if (usedPercent >= 90) {
      return 'ใกล้เต็ม';
    }

    if (usedPercent >= 70) {
      return 'เหลือจำกัด';
    }

    return 'ปกติ';
  };

  const getChatUsageRemainingPercent = () => {
    if (!chatUsage) {
      return null;
    }

    return Math.max(0, 100 - Number(chatUsage.used_percent || 0));
  };

  const getChatUsageRingStyle = () => {
    const usedPercent = Math.min(100, Math.max(0, Number(chatUsage?.used_percent || 0)));
    const remainingPercent = Math.max(0, 100 - usedPercent);
    const tone = getChatUsageToneClasses();

    return {
      background: `conic-gradient(from 270deg, ${tone.color} 0deg, ${tone.color} ${remainingPercent * 3.6}deg, rgba(255,255,255,0.18) ${remainingPercent * 3.6}deg 360deg)`
    };
  };

  return (
    <div className="page-shell font-sans">
      <Navbar />
      <div className='page-gutter content-wide mt-6 flex flex-col gap-6 md:mt-10 lg:flex-row lg:gap-10 flex-grow'>
        <div className='w-full rounded-md bg-white p-4 outline outline-[#D9D9D9] lg:basis-64 lg:sticky lg:top-10 lg:h-fit'>
          <p className='text-[#999999] text-[15px] pb-3 text-left'>ระดับการศึกษา</p>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:gap-6'>
            {levels.map((level) => (
              <label key={level} className='flex items-center cursor-pointer group'>
                <div className='relative flex items-center justify-center'>
                  <input type="radio" name="degree" 
                    checked={selectedLabel === level}
                    onChange={() => handleDegreeChange(level)}
                    className='sr-only' 
                  />
                  <div className={`w-6 h-6 border-2 rounded-full transition-all duration-200 
                    ${selectedLabel === level ? 'border-[#EA580C]' : 'border-[#999999]'}`}>
                  </div>
                  <div className={`absolute w-4 h-4 bg-[#EA580C] rounded-full transition-transform duration-200 
                    ${selectedLabel === level ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                  </div>
                </div>
                <span className='ml-3 text-[15px] font-bold text-black'>{level}</span>
              </label>
            ))}
          </div>
        </div>

        <div className='min-w-0 flex-1'>
          {!selectedForm ? (
            <>
              <p className='mb-4 text-left text-[22px] font-extrabold text-[#7B542F] sm:text-[25px]'>ค้นหาเอกสารยื่นคำร้อง</p>
              
              <div className="relative group mb-10">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleInputChange} 
                  placeholder="ค้นหาชื่อเอกสารยื่นคำร้อง"
                  className="w-full rounded-xl border border-[#D9D9D9] p-3 pl-5 pr-12 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-[#999999] focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] sm:pl-6 sm:text-lg"
                />
                <button type="button" aria-label="ค้นหาเอกสาร" className="absolute right-4 top-1/2 -translate-y-1/2 cursor-default pr-2">
                    <svg className="h-6 w-6 text-[#999999] hover:text-[#EA580C] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
              </div>
              
              <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {filteredForms.length > 0 ? (
                  filteredForms.map((form) => (
                    <div key={form.form_code} onClick={() => handleFormClick(form)} className="bg-white border border-[#D9D9D9] p-5 rounded-xl shadow-sm hover:shadow-md hover:border-[#EA580C] transition-all cursor-pointer flex flex-col items-center">
                      <div className="flex flex-col h-full w-full">
                        <img src="/file.png" alt="file icon" className="w-24 h-24 mx-auto mt-2 mb-4 opacity-90" data-protect-ui="true" draggable={false} />
                        <h3 className="text-[#7B542F] font-bold text-lg mb-2 line-clamp-2 text-center">{form.name_th}</h3>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white border border-[#D9D9D9] rounded-xl shadow-sm">
                    <p className="text-xl font-bold text-[#999999]">ไม่พบชื่อเอกสาร</p>
                    <p className="text-sm text-[#999999] mt-2">ลองตรวจสอบการสะกด หรือเปลี่ยนคำค้นหาดูอีกครั้ง</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex items-start gap-4 sm:items-center">
                <button onClick={() => {setSelectedForm(null);
                  sessionStorage.removeItem('last_selected_form');}} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#D9D9D9] bg-white text-[#999999] shadow-sm transition-colors hover:border-[#EA580C] hover:text-[#EA580C]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex flex-col">
                  <p className='text-left text-[20px] font-extrabold text-[#7B542F] sm:text-[22px]'>โปรดระบุประเภทของคำร้อง</p>
                </div>
              </div>

              <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 animate-fade-in">
                {selectedForm.sub_categories.map((subCat) => (
                  <div key={subCat.value} onClick={() => handleSubCategoryClick(subCat)} className="bg-white border border-[#D9D9D9] p-5 rounded-xl shadow-sm hover:shadow-md hover:border-[#EA580C] transition-all cursor-pointer flex flex-col items-center">
                    <div className="flex flex-col h-full w-full">
                      <img src="/file.png" alt="file icon" className="w-20 h-20 mx-auto mt-2 mb-4 opacity-80" data-protect-ui="true" draggable={false} />
                      <h3 className="text-[#7B542F] font-bold text-base mb-2 line-clamp-3 text-center leading-relaxed">
                        {subCat.label}
                      </h3>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
      <Footer/>

      <button 
        onClick={() => setIsChatOpen(!isChatOpen)} 
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#FF9D00] shadow-lg transition-transform hover:scale-105 sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
      >
        <img 
          src="/assistant.png" 
          alt="Chatbot" 
          className="w-10 h-10 object-contain" 
          data-protect-ui="true"
          draggable={false}
          onError={(e) => { e.target.src = '/file.png'; }}
        />
      </button>

      {isChatOpen && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[450px] w-[calc(100vw-2rem)] max-w-[350px] flex-col overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-2xl animate-fade-in sm:bottom-28 sm:right-8">
          
          <div className="bg-[#7B542F] text-white p-4 flex justify-between items-center shadow-sm z-10">
            <div className="flex min-w-0 flex-col items-start gap-1">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-bold text-[16px]">ผู้ช่วยยื่นคำร้อง (Bot)</span>
                <div
                  className="relative h-10 w-10 flex-shrink-0 rounded-full"
                  style={getChatUsageRingStyle()}
                  aria-label="สถานะโควต้า AI"
                >
                  <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-[#7B542F] text-[10px] font-bold text-white">
                    {chatUsage ? `${getChatUsageRemainingPercent()}%` : '--'}
                  </div>
                </div>
              </div>
              <p className="pl-5 text-xs text-white/85">
                {chatUsage
                  ? `คงเหลือ ${getChatUsageRemainingPercent()}% ของโควต้า AI วันนี้`
                  : getChatUsageLabel()}
              </p>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-[#FF9D00] transition-colors cursor-pointer">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-4 bg-gray-50/50">
            {chatMessages.map((msg, index) => (
              <div 
                key={index}
                className={`max-w-[85%] p-3 text-[14px] leading-relaxed shadow-sm text-left ${
                  msg.sender === 'user' 
                    ? 'bg-[#FF9D00] text-white self-end rounded-2xl rounded-tr-sm' 
                    : 'bg-white border border-[#D9D9D9] text-black self-start rounded-2xl rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
            ))}
            
            {isChatLoading && (
              <div className="self-start bg-white border border-[#D9D9D9] p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#D9D9D9] bg-white p-3">
            {chatUsage && (
              <p className="mb-2 text-xs text-[#9A7A56]">
                คงเหลือ {getChatUsageRemainingPercent()}% ของโควต้า AI วันนี้ • สถานะ: {getChatUsageEtaLabel()}
              </p>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                placeholder="พิมพ์คำถามที่นี่..." 
                className="flex-grow px-4 py-2 border border-[#D9D9D9] rounded-full text-[14px] focus:outline-none focus:border-[#FF9D00] focus:ring-1 focus:ring-[#FF9D00] transition-all"
              />
              <button 
                type="submit" 
                disabled={isChatLoading || !chatInput.trim()} 
                className="bg-[#7B542F] text-white p-2 w-10 h-10 rounded-full flex items-center justify-center hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  )
}
