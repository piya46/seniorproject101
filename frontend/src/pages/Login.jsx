import React from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { trackAnalyticsEvent } from '../lib/analytics';

const APP_NAME = 'ระบบช่วยเหลือการยื่นคำร้องสำหรับนิสิต';

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,216,181,0.42),_transparent_34%),linear-gradient(180deg,#FFF9F2_0%,#F9ECDD_46%,#FCF8F3_100%)] text-[#3C2A1C]">
      <header className="border-b border-[#E8D8C4]/80 bg-white/75 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-[#F0E0CF]">
            <img
              src="/icon.svg"
              alt={APP_NAME}
              className="h-12 w-12 rounded-xl object-contain"
              data-protect-ui="true"
              draggable={false}
            />
            <div>
              <h1 className="text-sm font-extrabold text-[#7B542F] sm:text-base">
                {APP_NAME}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[30px] border border-[#E7D7C5] bg-white/92 px-6 py-8 shadow-[0_24px_60px_rgba(123,84,47,0.08)] sm:px-8 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A36A35]">
              Welcome
            </p>
            <h2 className="mt-3 max-w-xl text-[28px] font-extrabold leading-tight text-[#6F4722] sm:text-[40px]">
              ระบบช่วยเหลือการยื่นคำร้องสำหรับนิสิต
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-8 text-[#62574B] sm:text-base">
              ใช้สำหรับช่วยค้นหาแบบคำร้องที่เกี่ยวข้อง ดูข้อมูลเบื้องต้น และเตรียมความพร้อมก่อนดำเนินการยื่นคำร้อง
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#EADBC9] bg-[#FFF9F3] px-4 py-4 text-sm leading-7 text-[#5C5146]">
                ค้นหาแบบคำร้องได้สะดวก
              </div>
              <div className="rounded-2xl border border-[#EADBC9] bg-[#FFF9F3] px-4 py-4 text-sm leading-7 text-[#5C5146]">
                ดูข้อมูลก่อนเริ่มดำเนินการ
              </div>
              <div className="rounded-2xl border border-[#EADBC9] bg-[#FFF9F3] px-4 py-4 text-sm leading-7 text-[#5C5146]">
                ใช้ผู้ช่วยแนะนำภายในระบบ
              </div>
            </div>
          </article>

          <div className="rounded-[30px] border border-[#6E4B2A] bg-[linear-gradient(180deg,#8A5D33_0%,#7B542F_100%)] px-6 py-8 text-white shadow-[0_24px_60px_rgba(91,57,26,0.18)] sm:px-8 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F5D8B5]">
              Sign In
            </p>
            <h3 className="mt-3 text-[28px] font-extrabold leading-tight">
              ลงชื่อเข้าใช้ด้วยบัญชีจุฬา
            </h3>
            <p className="mt-4 text-sm leading-7 text-[#FFF0DE]">
              หน้านี้เปิดให้ผู้ใช้ทั่วไปอ่านข้อมูลได้ สำหรับการใช้งานภายใน กรุณาลงชื่อเข้าใช้ด้วยบัญชีจุฬาที่ได้รับสิทธิ์
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
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-white/40 bg-white px-5 py-3 text-base font-bold text-[#5E3D22] shadow-sm transition-colors hover:bg-[#FFF5EA]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 4 1.5l2.7-2.6C17 2.9 14.8 2 12 2 6.9 2 2.8 6.3 2.8 11.8S6.9 21.6 12 21.6c6.9 0 8.6-5 8.6-7.5 0-.5-.1-.9-.1-1.3H12Z" />
                  <path fill="#34A853" d="M2.8 11.8c0 1.8.6 3.5 1.7 4.9l3.1-2.4c-.4-.7-.7-1.6-.7-2.5s.2-1.7.7-2.5L4.5 6.9c-1.1 1.4-1.7 3.1-1.7 4.9Z" />
                  <path fill="#FBBC05" d="M12 21.6c2.8 0 5.1-.9 6.8-2.5l-3.3-2.7c-.9.6-2 .9-3.5.9-2.6 0-4.7-1.8-5.5-4.2l-3.2 2.4c1.7 3.6 5 6.1 8.7 6.1Z" />
                  <path fill="#4285F4" d="M18.8 19.1c1.9-1.8 2.8-4.4 2.8-7.3 0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.5-1.1 2.8-2.2 3.6l3.5 1.1Z" />
                </svg>
              </span>
              ลงชื่อเข้าใช้ด้วยบัญชีจุฬา
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 px-4 py-4 text-sm leading-7 text-[#FFF0DE]">
              กรุณาลงชื่อเข้าใช้ด้วยบัญชีจุฬาฯ
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl rounded-[24px] border border-[#E7D7C5] bg-white/90 px-6 py-6 shadow-sm">
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
