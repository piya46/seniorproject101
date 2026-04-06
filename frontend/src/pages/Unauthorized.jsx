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
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#7B542F] px-4"
    >
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="relative z-10 mx-4 flex w-full max-w-[460px] flex-col items-center rounded-[24px] bg-white p-7 shadow-2xl sm:p-10">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF4E8] text-[#C96C18] shadow-sm">
          <img
            src="/warning.png"
            alt="คำเตือน"
            className="h-8 w-8 object-contain"
            data-protect-ui="true"
            draggable={false}
          />
        </div>

        <h1 className="text-center text-[24px] font-bold text-[#7B542F] sm:text-[28px]">
          บัญชีนี้ไม่มีสิทธิ์ใช้งานระบบ
        </h1>
        <p className="mt-3 text-center text-sm leading-7 text-[#6F6F6F] sm:text-[15px]">
          ระบบนี้เปิดให้ใช้งานสำหรับกลุ่มผู้ใช้ที่ได้รับสิทธิ์เท่านั้น
          หากคุณลงชื่อเข้าใช้ด้วยบัญชีไม่ถูกต้อง กรุณาเปลี่ยนบัญชีแล้วลองใหม่อีกครั้ง
        </p>

        <div className="mt-6 w-full rounded-2xl border border-[#F3D6BA] bg-[#FFF7EF] px-4 py-4 text-left">
          <p className="text-sm font-semibold text-[#9A4E19]">สิ่งที่คุณทำต่อได้</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#7B542F]">
            <li>เปลี่ยนไปใช้บัญชีมหาวิทยาลัยที่มีสิทธิ์ใช้งาน</li>
            <li>กลับไปหน้าเข้าสู่ระบบ</li>
            <li>หากคิดว่าเป็นความผิดพลาด ให้ติดต่อผู้ดูแลระบบหรือเจ้าหน้าที่ที่เกี่ยวข้อง</li>
          </ul>
        </div>

        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleChangeAccount}
            className="flex-1 rounded-full bg-[#7B542F] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[#684626]"
          >
            เปลี่ยนบัญชี
          </button>
          <Link
            to="/login"
            className="flex-1 rounded-full border border-[#E7D7C5] px-5 py-3 text-center text-base font-bold text-[#7B542F] transition-colors hover:bg-[#FFF9F3]"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
