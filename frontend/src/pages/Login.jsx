import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { trackAnalyticsEvent } from '../lib/analytics';

export default function Login() {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('auth_error');

  const handleGoogleLogin = () => {
    trackAnalyticsEvent('login_started', {
      provider: 'google'
    }).catch(() => {});
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `/auth/login?return_to=${returnTo}`;
  };

  if (authError === 'unauthorized_account') {
    return <Navigate to="/unauthorized" replace />;
  }

  const errorMessage = authError === 'unauthorized_account'
    ? 'คุณไม่มีสิทธิ์ในการใช้งานระบบกรุณาเปลี่ยนบัญชีลงชื่อเข้าใช้งาน'
    : authError === 'login_failed'
      ? 'ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
      : '';

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-[#7B542F] px-4"
    >
      {/* เพิ่ม Overlay สีดำจางๆ ให้รูปพื้นหลังดูไม่กลืนกับกล่อง (ถ้าไม่ชอบลบ div นี้ออกได้ครับ) */}
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="relative z-10 mx-4 flex w-full max-w-[420px] flex-col items-center rounded-[20px] bg-white p-7 shadow-2xl sm:p-10">
        <h2 className="mb-2 text-center text-[22px] font-bold text-[#7B542F] sm:text-[24px]">Welcome</h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
        </p>

        {errorMessage ? (
          <div className="mb-6 w-full rounded-2xl border border-[#F3C6A4] bg-[#FFF6EF] px-4 py-4 text-center shadow-sm">
            <p className="text-sm font-semibold leading-6 text-[#9A4E19]">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <button 
          onClick={handleGoogleLogin}
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border-2 border-gray-200 px-5 py-3 text-base font-bold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 sm:gap-4 sm:px-6 sm:text-lg"
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Google Icon" 
            className="w-6 h-6"
            data-protect-ui="true"
            draggable={false}
          />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}