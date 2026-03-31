import React from 'react';

export default function Login() {
  const handleGoogleLogin = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `/auth/login?return_to=${returnTo}`;
  };

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: "url('/chula.jpg')" }} 
    >
      {/* เพิ่ม Overlay สีดำจางๆ ให้รูปพื้นหลังดูไม่กลืนกับกล่อง (ถ้าไม่ชอบลบ div นี้ออกได้ครับ) */}
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="relative z-10 mx-4 flex w-full max-w-[420px] flex-col items-center rounded-[20px] bg-white p-7 shadow-2xl sm:p-10">
        <h2 className="mb-2 text-center text-[22px] font-bold text-[#7B542F] sm:text-[24px]">Welcome</h2>
        <p className="text-sm text-gray-500 mb-8 text-center">
          เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
        </p>

        {/* ปุ่ม Google Login */}
        <button 
          onClick={handleGoogleLogin}
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border-2 border-gray-200 px-5 py-3 text-base font-bold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 sm:gap-4 sm:px-6 sm:text-lg"
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Google Icon" 
            className="w-6 h-6" 
          />
          Sign in with Google
        </button>

      </div>
    </div>
  );
}
