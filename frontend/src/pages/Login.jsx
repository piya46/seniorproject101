import React from 'react';

export default function Login() {
  const handleGoogleLogin = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `/auth/login?return_to=${returnTo}`;
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: "url('/chula.jpg')" }} 
    >
      {/* เพิ่ม Overlay สีดำจางๆ ให้รูปพื้นหลังดูไม่กลืนกับกล่อง (ถ้าไม่ชอบลบ div นี้ออกได้ครับ) */}
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="bg-white rounded-[20px] p-10 shadow-2xl w-full max-w-[420px] mx-4 relative z-10 flex flex-col items-center">
        <h2 className="text-[24px] font-bold text-center text-[#7B542F] mb-2">Welcome</h2>
        <p className="text-sm text-gray-500 mb-8 text-center">
          เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
        </p>

        {/* ปุ่ม Google Login */}
        <button 
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-4 border-2 border-gray-200 text-gray-700 font-bold text-lg py-3 px-6 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm w-full cursor-pointer"
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
