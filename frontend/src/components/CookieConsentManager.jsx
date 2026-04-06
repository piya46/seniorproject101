import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCookieConsent,
  hasCookieConsentDecision,
  initializeAnalyticsIfConsented,
  saveCookieConsent
} from '../lib/analytics';

function CookieSettingsModal({ consent, onClose, onSave, onToggleAnalytics }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-4">
      <div className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#E7D7C5] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
              Cookie Preferences
            </p>
            <h2 className="mt-2 text-[24px] font-extrabold text-[#7B542F]">
              การตั้งค่าคุกกี้
            </h2>
            <p className="mt-2 max-w-[420px] text-sm leading-7 text-[#6F6F6F]">
              คุณสามารถเลือกได้ว่าจะอนุญาตให้ระบบใช้คุกกี้เพื่อการวิเคราะห์หรือไม่ โดยคุกกี้ที่จำเป็นต่อการทำงานและความปลอดภัยของระบบจะเปิดใช้งานอยู่เสมอ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#8D6A4A] transition-colors hover:bg-[#FFF3E5]"
            aria-label="ปิดการตั้งค่าคุกกี้"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-[#E7D7C5] bg-[#FFF9F3] px-5 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-[#7B542F]">คุกกี้ที่จำเป็นต่อการทำงาน</p>
                <p className="mt-1 text-sm leading-6 text-[#6F6F6F]">
                  ใช้เพื่อให้ระบบทำงานได้อย่างถูกต้อง เช่น การรักษาสถานะการเข้าสู่ระบบ การป้องกันคำขอที่ไม่พึงประสงค์ และความปลอดภัยของการใช้งาน คุกกี้ประเภทนี้ไม่สามารถปิดได้
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-[#E2F5E5] px-3 py-1 text-xs font-semibold text-[#2E7D32]">
                เปิดเสมอ
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E7D7C5] bg-white px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-[#7B542F]">คุกกี้เพื่อการวิเคราะห์</p>
                <p className="mt-1 text-sm leading-6 text-[#6F6F6F]">
                  ใช้เพื่อช่วยให้ระบบเข้าใจภาพรวมการใช้งาน เช่น หน้าที่มีการใช้งานสูง เส้นทางการใช้งาน และจุดที่ผู้ใช้ออกจากขั้นตอนสำคัญ เพื่อปรับปรุงประสบการณ์ใช้งานของระบบในอนาคต โดยจะเริ่มทำงานเมื่อคุณให้ความยินยอมเท่านั้น
                </p>
                <p className="mt-2 text-xs leading-6 text-[#8D6A4A]">
                  คุณสามารถเปลี่ยนแปลงการตั้งค่านี้ได้ภายหลังจากเมนูตั้งค่าคุกกี้ที่ส่วนท้ายของเว็บไซต์
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={consent.analytics}
                onClick={onToggleAnalytics}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors ${
                  consent.analytics ? 'bg-[#4CAF50]' : 'bg-[#D8C3AB]'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                    consent.analytics ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#FAF7F3] px-4 py-4 text-sm leading-7 text-[#6F6F6F]">
          โปรดอ่านรายละเอียดเพิ่มเติมได้ที่{' '}
          <Link to="/privacy" onClick={onClose} className="font-semibold text-[#7B542F] underline underline-offset-2">
            นโยบายความเป็นส่วนตัว
          </Link>{' '}
          ,{' '}
          <Link to="/cookies" onClick={onClose} className="font-semibold text-[#7B542F] underline underline-offset-2">
            นโยบายการใช้คุกกี้
          </Link>{' '}
          และ{' '}
          <Link to="/terms" onClick={onClose} className="font-semibold text-[#7B542F] underline underline-offset-2">
            ข้อกำหนดการใช้งาน
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#E7D7C5] px-5 py-3 text-sm font-semibold text-[#7B542F] transition-colors hover:bg-[#FFF9F3]"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-full bg-[#7B542F] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#684626]"
          >
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieConsentManager() {
  const [consent, setConsent] = useState(() => getCookieConsent());
  const [showBanner, setShowBanner] = useState(() => !hasCookieConsentDecision());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initializeAnalyticsIfConsented().catch((error) => {
      console.error('Analytics initialization skipped:', error);
    });
  }, []);

  useEffect(() => {
    const handleOpenCookieSettings = () => {
      setConsent(getCookieConsent());
      setShowSettings(true);
    };

    const handleConsentUpdated = (event) => {
      const nextConsent = event.detail || getCookieConsent();
      setConsent(nextConsent);
      if (nextConsent.analytics) {
        initializeAnalyticsIfConsented().catch((error) => {
          console.error('Analytics initialization failed:', error);
        });
      }
    };

    window.addEventListener('open-cookie-settings', handleOpenCookieSettings);
    window.addEventListener('cookie-consent-updated', handleConsentUpdated);

    return () => {
      window.removeEventListener('open-cookie-settings', handleOpenCookieSettings);
      window.removeEventListener('cookie-consent-updated', handleConsentUpdated);
    };
  }, []);

  const acceptNecessaryOnly = () => {
    const nextConsent = saveCookieConsent({ analytics: false });
    setConsent(nextConsent);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAnalytics = async () => {
    const nextConsent = saveCookieConsent({ analytics: true });
    setConsent(nextConsent);
    setShowBanner(false);
    setShowSettings(false);
    try {
      await initializeAnalyticsIfConsented();
    } catch (error) {
      console.error('Analytics initialization failed:', error);
    }
  };

  const saveSettings = async () => {
    const nextConsent = saveCookieConsent({ analytics: consent.analytics });
    setConsent(nextConsent);
    setShowBanner(false);
    setShowSettings(false);

    if (nextConsent.analytics) {
      try {
        await initializeAnalyticsIfConsented();
      } catch (error) {
        console.error('Analytics initialization failed:', error);
      }
    }
  };

  return (
    <>
      {showBanner ? (
        <div className="fixed bottom-4 left-4 right-4 z-[110] flex justify-center">
          <div className="w-full max-w-5xl rounded-[28px] border border-[#E7D7C5] bg-white px-5 py-5 shadow-2xl sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                  Cookie Notice
                </p>
                <h2 className="mt-2 text-[22px] font-extrabold text-[#7B542F]">
                  ระบบใช้คุกกี้ที่จำเป็น และอาจใช้คุกกี้เพื่อการวิเคราะห์เมื่อได้รับความยินยอม
                </h2>
                <p className="mt-2 text-sm leading-7 text-[#6F6F6F]">
                  คุกกี้ที่จำเป็นช่วยให้ระบบทำงานได้อย่างถูกต้องและปลอดภัย ส่วนคุกกี้เพื่อการวิเคราะห์จะใช้เพื่อช่วยให้เราเข้าใจภาพรวมการใช้งานและปรับปรุงประสบการณ์ของผู้ใช้ โดยจะเปิดใช้งานก็ต่อเมื่อคุณให้ความยินยอม
                </p>
                <p className="mt-2 text-xs leading-6 text-[#8D6A4A]">
                  การเลือกของคุณจะไม่กระทบต่อสิทธิในการใช้งานส่วนที่จำเป็นของระบบ และคุณสามารถเปลี่ยนแปลงการตั้งค่าได้ในภายหลัง
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setConsent(getCookieConsent());
                    setShowSettings(true);
                  }}
                  className="rounded-full border border-[#E7D7C5] px-5 py-3 text-sm font-semibold text-[#7B542F] transition-colors hover:bg-[#FFF9F3]"
                >
                  ตั้งค่าคุกกี้
                </button>
                <button
                  type="button"
                  onClick={acceptNecessaryOnly}
                  className="rounded-full border border-[#E7D7C5] px-5 py-3 text-sm font-semibold text-[#7B542F] transition-colors hover:bg-[#FFF9F3]"
                >
                  ใช้เฉพาะคุกกี้ที่จำเป็น
                </button>
                <button
                  type="button"
                  onClick={acceptAnalytics}
                  className="rounded-full bg-[#7B542F] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#684626]"
                >
                  ยอมรับทั้งหมด
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-[#F1E6DA] pt-4 text-xs leading-6 text-[#8D6A4A]">
              ดูรายละเอียดเพิ่มเติมได้ที่{' '}
              <Link to="/privacy" className="font-semibold text-[#7B542F] underline underline-offset-2">
                นโยบายความเป็นส่วนตัว
              </Link>{' '}
              ,{' '}
              <Link to="/cookies" className="font-semibold text-[#7B542F] underline underline-offset-2">
                นโยบายการใช้คุกกี้
              </Link>{' '}
              และ{' '}
              <Link to="/terms" className="font-semibold text-[#7B542F] underline underline-offset-2">
                ข้อกำหนดการใช้งาน
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {showSettings ? (
        <CookieSettingsModal
          consent={consent}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onToggleAnalytics={() => setConsent((prev) => ({ ...prev, analytics: !prev.analytics }))}
        />
      ) : null}
    </>
  );
}