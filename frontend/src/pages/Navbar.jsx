import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAuthenticatedUser, logout } from '../lib/auth';

function Navbar({ degreeProps }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  
  // State ควบคุม Dropdown เลือกระดับการศึกษาในมือถือ
  const [isDegreeOpen, setIsDegreeOpen] = useState(false);
  const degreeMenuRef = useRef(null);
  
  const authMenuRef = useRef(null);

  // ดึงค่า props ที่หน้า Home ส่งมาให้
  const { selectedLabel, handleDegreeChange, levels } = degreeProps || {};

  const menuItems = [
    { title: 'หน้าแรก', path: '/' },
    { title: 'เกี่ยวกับเรา', path: '/aboutus' },
    { title: 'แจ้งปัญหา', path: '/contactus' }
  ];

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      const authenticatedUser = await getAuthenticatedUser();
      if (!isMounted) {
        return;
      }
      setCurrentUser(authenticatedUser);
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // ปิดเมนู Profile
      if (authMenuRef.current && !authMenuRef.current.contains(event.target)) {
        setAuthMenuOpen(false);
      }
      // ปิดเมนูเลือกระดับการศึกษา (ฝั่งมือถือ)
      if (degreeMenuRef.current && !degreeMenuRef.current.contains(event.target)) {
        setIsDegreeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const userLabel = currentUser?.display_name || currentUser?.email || 'Profile';
  const userInitial = String(userLabel || 'P').trim().charAt(0).toUpperCase() || 'P';

  const handleMenuItemClick = (itemPath) => {
    setIsOpen(false);
    if (itemPath === '/') {
      sessionStorage.removeItem('last_selected_form');
      if (window.location.pathname === '/') {
        window.location.reload();
      }
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      await logout();
      sessionStorage.clear();
      window.location.assign('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
      setAuthMenuOpen(false);
    }
  };

  return (
    <div>
      <nav className="relative z-50 w-full bg-white px-4 py-4 shadow-md sm:px-5">
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <div className="flex items-center">
            <Link to="/" className="flex items-center" aria-label="ไปหน้าแรก">
              <img
                src="/icon.svg"
                alt="Ai Formcheck"
                className="h-14 w-14 md:h-16 md:w-16 rounded-xl object-contain"
                data-protect-ui="true"
                draggable={false}
              />
            </Link>
          </div>

          {/* =========================================
              ส่วนของปุ่มฝั่ง Mobile (Dropdown ระดับชั้น + Hamburger) 
          ============================================= */}
          <div className="flex items-center gap-2 md:hidden">
            {/* หากมีการส่ง degreeProps มาให้ (อยู่หน้า Home) จะแสดง Dropdown ให้เลือกระดับ */}
            {degreeProps && (
              <div className="relative" ref={degreeMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsDegreeOpen(!isDegreeOpen)}
                  className="flex h-11 items-center justify-between gap-2 rounded-xl border border-[#E7D7C5] bg-[#FFF9F3] px-3 text-[#7B542F] text-[15px] font-bold shadow-sm transition-colors hover:bg-[#FFF1E1]"
                >
                  <span>{selectedLabel}</span>
                  <svg className={`h-4 w-4 transition-transform duration-200 ${isDegreeOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDegreeOpen && (
                  <div className="absolute right-0 top-full mt-2 w-32 rounded-xl border border-[#F0E0CF] bg-white py-2 shadow-xl z-50">
                    {levels.map((level) => (
                      <button
                        key={level}
                        onClick={() => {
                          handleDegreeChange(level);
                          setIsDegreeOpen(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[15px] font-bold transition-colors ${
                          selectedLabel === level ? 'bg-[#FFF7EE] text-[#EA580C]' : 'text-[#7B542F] hover:bg-gray-50'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7D7C5] text-[#7B542F]"
              aria-label="เปิดเมนู"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          {/* =========================================
              Desktop Menu (แสดงเฉพาะในจอคอม/แท็บเล็ต) 
          ============================================= */}
          <div className="hidden w-full md:flex md:w-auto md:flex-row md:items-center gap-4">
            <ul className="flex w-full flex-col gap-2 font-bold md:w-auto md:flex-row md:items-center">
              {menuItems.map((item) => (
                <li key={item.path} className="md:mx-5">
                  <Link
                    to={item.path}
                    className="block rounded-xl px-3 py-2 transition-colors hover:bg-[#FFF7EE] hover:text-orange-500 md:px-0 md:py-0 md:hover:bg-transparent"
                    onClick={() => handleMenuItemClick(item.path)}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="relative md:min-w-[220px]" ref={authMenuRef}>
              <button
                type="button"
                onClick={() => setAuthMenuOpen((prev) => !prev)}
                className="inline-flex w-full items-center justify-between gap-3 rounded-full border border-[#E7D7C5] bg-[#FFF9F3] px-4 py-2 text-left text-[#7B542F] shadow-sm transition-colors hover:bg-[#FFF1E1] md:w-auto md:justify-start"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF9D00] text-sm font-bold text-white">
                  {userInitial}
                </span>
                <span className="max-w-[180px] truncate text-sm font-semibold pr-2">
                  {userLabel}
                </span>
              </button>

              {authMenuOpen && (
                <div className="absolute right-0 z-20 mt-3 w-full min-w-[260px] rounded-2xl border border-[#F0E0CF] bg-white p-4 shadow-xl md:w-72">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#A36A35]">Profile</p>
                  <p className="mt-2 break-all text-sm text-[#777777]">
                    {currentUser?.email || 'ไม่พบข้อมูลอีเมล'}
                  </p>

                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="rounded-full bg-[#7B542F] px-8 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#684626] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* =========================================
          Mobile Menu Drawer & Overlay (แสดงเมื่อกด Hamburger)
      ============================================= */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/50 transition-opacity md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      <div 
        className={`fixed top-0 right-0 z-[70] flex h-full w-[280px] flex-col bg-white pt-10 pb-8 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex justify-center mb-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF9D00] text-2xl font-bold text-white shadow-sm">
            {userInitial}
          </span>
        </div>

        <div className="mb-4 px-6">
          <p className="text-sm font-semibold text-[#777777] break-all">
            {currentUser?.email || 'ไม่พบข้อมูลอีเมล'}
          </p>
        </div>

        <ul className="flex flex-col gap-4 font-bold mb-8 px-6 flex-grow">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="block text-[#2B2B2B] transition-colors hover:text-[#FF9D00]"
                onClick={() => handleMenuItemClick(item.path)}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex justify-center mt-auto px-6">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-full bg-[#7B542F] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#684626] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
          </button>
        </div>
      </div>

      <div className="mx-4 my-4 flex items-start gap-4 rounded-md bg-[#FFCF71]/70 p-4 sm:mx-5 sm:my-5">
        <img src="/warning.png" alt="warning logo" className="mt-0.5 h-6 w-6 flex-shrink-0" data-protect-ui="true" draggable={false} />
        <p className="py-1 text-left text-[13px] leading-6 sm:text-[14px]">
          เว็บไซต์นี้เป็นเว็บไซต์ที่จัดทำโดยนิสิต โดยเป็นเพียงเครื่องมือที่ช่วยให้การจัดเตรียมเอกสารสำหรับการยื่นคำร้องให้ทำได้ง่ายมากขึ้นสำหรับนิสิตคณะวิทยาศาตร์เท่านั้น แต่ไม่สามารถยื่นคำร้องได้จริง และสามารถหาข้อมูลเพิ่มเติมหรือตรวจสอบข้อมูลได้ที่ https://www.reg.chula.ac.th/th/student/forms/
        </p>
      </div>
    </div>
  );
}

export default Navbar;