import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAuthenticatedUser, logout } from '../lib/auth';

function Navbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const authMenuRef = useRef(null);

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
      if (authMenuRef.current && !authMenuRef.current.contains(event.target)) {
        setAuthMenuOpen(false);
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
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-200">
              <span className="text-xs text-gray-500">Logo</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7D7C5] text-[#7B542F] md:hidden"
            aria-label="เปิดเมนู"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className={`${isOpen ? 'flex' : 'hidden'} w-full flex-col gap-4 md:flex md:w-auto md:flex-row md:items-center`}>
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
                <span className="max-w-[180px] truncate text-sm font-semibold">
                  {userLabel}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#A36A35]">
                  Profile
                </span>
              </button>

              {authMenuOpen && (
                <div className="absolute right-0 z-20 mt-3 w-full min-w-[260px] rounded-2xl border border-[#F0E0CF] bg-white p-4 shadow-xl md:w-72">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#A36A35]">Profile</p>
                  <p className="mt-2 truncate text-base font-bold text-[#2B2B2B]">
                    {currentUser?.display_name || 'ผู้ใช้งาน'}
                  </p>
                  <p className="mt-1 break-all text-sm text-[#777777]">
                    {currentUser?.email || 'ไม่พบข้อมูลอีเมล'}
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMenuOpen(false);
                        navigate('/');
                      }}
                      className="flex-1 rounded-full border border-[#E7D7C5] px-4 py-2 text-sm font-semibold text-[#7B542F] transition-colors hover:bg-[#FFF9F3]"
                    >
                      ไปหน้าแรก
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex-1 rounded-full bg-[#7B542F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#684626] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoggingOut ? 'กำลังออกจากระบบ...' : 'Logout'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-4 my-4 flex items-start gap-4 rounded-md bg-[#FFCF71]/70 p-4 sm:mx-5 sm:my-5">
        <img src="/warning.png" alt="warning logo" className="mt-0.5 h-6 w-6 flex-shrink-0" />
        <p className="py-1 text-left text-[13px] leading-6 sm:text-[14px]">
          เป็นเว็บไซต์ที่จัดทำโดยนิสิต โดยเป็นเพียงเครื่องมือที่ช่วยให้การจัดเตรียมเอกสารยื่นคำร้องทำได้ง่ายมากขึ้นสำหรับนิสิตคณะวิทยาศาตร์เท่านั้น ไม่สามารถยื่นคำร้องได้จริง
        </p>
      </div>
    </div>
  );
}

export default Navbar;
