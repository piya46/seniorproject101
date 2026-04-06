import React from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { trackAnalyticsEvent } from '../lib/analytics';

const APP_NAME = 'Form Check';

export default function Login() {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('auth_error');
  const returnToParam = searchParams.get('return_to');

  const handleGoogleLogin = () => {
    trackAnalyticsEvent('login_started', {
      provider: 'google'
    }).catch(() => {});
    const returnTo = encodeURIComponent(returnToParam || window.location.origin);
    window.location.href = `/auth/login?return_to=${returnTo}`;
  };

  if (authError === 'unauthorized_account') {
    return <Navigate to="/unauthorized" replace />;
  }

  const errorMessage = authError === 'unauthorized_account'
    ? 'คุณไม่มีสิทธิ์ในการใช้งานระบบ กรุณาเปลี่ยนบัญชีเพื่อเข้าสู่ระบบ'
    : authError === 'login_failed'
      ? 'ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
      : '';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FFF8F1_0%,#F7E7D2_48%,#FCF8F3_100%)] text-[#3C2A1C]">
      <header className="border-b border-[#E8D8C4] bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/icon.svg"
              alt={APP_NAME}
              className="h-12 w-12 rounded-xl object-contain"
              data-protect-ui="true"
              draggable={false}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                Science Faculty Student Registry
              </p>
              <h1 className="text-sm font-extrabold text-[#7B542F] sm:text-base">
                {APP_NAME}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <section className="mx-auto w-full max-w-3xl">
          <div className="rounded-[28px] border border-[#6E4B2A] bg-[#7B542F] px-6 py-8 text-white shadow-sm sm:px-8 sm:py-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5D8B5]">
              Sign In
            </p>
            <h3 className="mt-3 text-[28px] font-extrabold leading-tight">
              เข้าสู่ระบบเพื่อใช้งานแบบคำร้องและผู้ช่วยแนะนำ
            </h3>
            <p className="mt-4 text-sm leading-7 text-[#FFF0DE]">
              หน้านี้เปิดให้อ่านข้อมูลได้สาธารณะ ส่วนการใช้งานภายในระบบต้องเข้าสู่ระบบด้วยบัญชี Google ที่ได้รับสิทธิ์
            </p>

            {errorMessage ? (
              <div className="mt-6 rounded-3xl border border-[#F3C6A4] bg-white/10 px-4 py-4">
                <p className="text-sm font-semibold leading-6 text-[#FFF2E7]">
                  {errorMessage}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-white/30 bg-white px-5 py-3 text-base font-bold text-[#5E3D22] shadow-sm transition-colors hover:bg-[#FFF5EA]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 4 1.5l2.7-2.6C17 2.9 14.8 2 12 2 6.9 2 2.8 6.3 2.8 11.8S6.9 21.6 12 21.6c6.9 0 8.6-5 8.6-7.5 0-.5-.1-.9-.1-1.3H12Z" />
                  <path fill="#34A853" d="M2.8 11.8c0 1.8.6 3.5 1.7 4.9l3.1-2.4c-.4-.7-.7-1.6-.7-2.5s.2-1.7.7-2.5L4.5 6.9c-1.1 1.4-1.7 3.1-1.7 4.9Z" />
                  <path fill="#FBBC05" d="M12 21.6c2.8 0 5.1-.9 6.8-2.5l-3.3-2.7c-.9.6-2 .9-3.5.9-2.6 0-4.7-1.8-5.5-4.2l-3.2 2.4c1.7 3.6 5 6.1 8.7 6.1Z" />
                  <path fill="#4285F4" d="M18.8 19.1c1.9-1.8 2.8-4.4 2.8-7.3 0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.5-1.1 2.8-2.2 3.6l3.5 1.1Z" />
                </svg>
              </span>
              Sign in with Google
            </button>

            <p className="mt-4 text-xs leading-6 text-[#F8E7D4]">
              ระบบจะพาคุณไปยืนยันตัวตนกับ Google ก่อนกลับมายังแอปนี้
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#E7D7C5] bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                Policies
              </p>
              <p className="mt-2 text-sm leading-7 text-[#5C5146]">
                รายละเอียดเพิ่มเติมเกี่ยวกับการใช้งานข้อมูลและข้อกำหนดของระบบ
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm sm:items-end">
              <Link to="/privacy" className="font-semibold text-[#7B542F] underline underline-offset-2">
                นโยบายความเป็นส่วนตัว
              </Link>
              <Link to="/terms" className="font-semibold text-[#7B542F] underline underline-offset-2">
                ข้อกำหนดการใช้งาน
              </Link>
              <Link to="/cookies" className="font-semibold text-[#7B542F] underline underline-offset-2">
                นโยบายการใช้คุกกี้
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
