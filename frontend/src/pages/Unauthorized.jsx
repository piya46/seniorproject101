import React from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trackAnalyticsEvent } from '../lib/analytics';

export default function Unauthorized() {
  useEffect(() => {
   trackAnalyticsEvent('unauthorized_viewed').catch(() => {});
  }, []);

   const handleChangeAccount = () => {
     const returnTo = encodeURIComponent(window.location.origin);
     window.location.href = `/auth/login?return_to=${returnTo}`;
   };

  return (
     <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,216,181,0.42),_transparent_34%),linear-gradient(180deg,#FFF9F2_0%,#F9ECDD_46%,#FCF8F3_100%)] px-4 text-[#3C2A1C]">
      <div className="relative z-10 mx-4 flex w-full max-w-[460px] flex-col items-center rounded-[24px] border border-[#6E4B2A] bg-[linear-gradient(180deg,#8A5D33_0%,#7B542F_100%)] px-6 py-8 text-white shadow-[0_24px_60px_rgba(91,57,26,0.18)] p-7 shadow-2xl sm:p-10">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
          <img src="/warning.png" alt="คำเตือน" className="h-8 w-8 object-contain" data-protect-ui="true" draggable={false}/>
        </div>

         <h1 className="text-center text-[24px] font-bold text-white sm:text-[28px]"> บัญชีนี้ไม่มีสิทธิ์ใช้งานระบบ </h1>
        
        <p className="mt-3 text-center text-sm leading-7 text-[#FFF0DE] sm:text-[15px]">
          ระบบนี้เปิดให้ใช้งานสำหรับกลุ่มผู้ใช้ที่ได้รับสิทธิ์เท่านั้น
          หากคุณลงชื่อเข้าใช้ด้วยบัญชีไม่ถูกต้อง กรุณาเปลี่ยนบัญชีแล้วลองใหม่อีกครั้ง
        </p>

        <div className="mt-6 w-full rounded-2xl border border-[#F3C6A4] bg-white/10 px-4 py-4 text-left">
          <p className="text-sm font-semibold text-[#FFF2E7]">สิ่งที่คุณทำต่อได้</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#FFF0DE]">
            <li>เปลี่ยนไปใช้บัญชีมหาวิทยาลัยที่มีสิทธิ์ใช้งาน</li>
            <li>กลับไปหน้าเข้าสู่ระบบ</li>
            <li>หากคิดว่าเป็นความผิดพลาด ให้ติดต่อผู้ดูแลระบบหรือเจ้าหน้าที่ที่เกี่ยวข้อง</li>
          </ul>
        </div>

        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleChangeAccount}
            className="flex-1 rounded-full border border-white/40 bg-white px-5 py-3 text-base font-bold text-[#5E3D22] transition-colors hover:bg-[#FFF5EA]"
          >
            เปลี่ยนบัญชี
          </button>

          <Link to="/login"
            className="flex-1 rounded-full bg-[#F9ECDD] px-5 py-3 text-center text-base font-bold text-[#3C2A1C] transition-colors hover:bg-[#F3E1C7]"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}