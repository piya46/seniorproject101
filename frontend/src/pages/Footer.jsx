import React from "react"
import { Link } from 'react-router-dom';

function Footer() {
    const openCookieSettings = () => {
        window.dispatchEvent(new CustomEvent('open-cookie-settings'));
    };

    return(
        <footer className='mt-16 flex w-full flex-col bg-[#7B542F] px-4 py-8 text-white sm:mt-20 sm:px-8 sm:py-10'>
            <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='max-w-xl'>
                        <p className='text-lg font-bold'>Form Check</p>
                        <p className='mt-2 text-sm leading-7 text-[#F6EBDD]'>
                            ระบบช่วยจัดเตรียมเอกสารและคำร้องสำหรับการใช้งานภายในขอบเขตที่ระบบรองรับ
                            โดยผู้ใช้ควรตรวจสอบข้อมูลก่อนนำไปใช้งานจริงทุกครั้ง
                        </p>
                    </div>

                    <div className='flex flex-col gap-2 text-sm sm:items-end'>
                        <p className='font-semibold text-[#F5D8B5]'>นโยบายและข้อกำหนด</p>
                        <Link to="/privacy" className='transition-colors hover:text-[#FFD9A3]'>
                            นโยบายความเป็นส่วนตัว
                        </Link>
                        <Link to="/terms" className='transition-colors hover:text-[#FFD9A3]'>
                            ข้อกำหนดการใช้งาน
                        </Link>
                        <Link to="/cookies" className='transition-colors hover:text-[#FFD9A3]'>
                            นโยบายการใช้คุกกี้
                        </Link>
                        <button
                            type="button"
                            onClick={openCookieSettings}
                            className='text-left transition-colors hover:text-[#FFD9A3] sm:text-right'
                        >
                            ตั้งค่าคุกกี้
                        </button>
                    </div>
                </div>

                <div className='h-px w-full bg-white/15'></div>

                <div className='flex flex-col gap-2 text-xs text-[#F6EBDD] sm:flex-row sm:items-center sm:justify-between'>
                    <p>เว็บไซต์นี้เป็นเครื่องมือช่วยเตรียมเอกสารเท่านั้น ไม่ใช่ช่องทางยื่นคำร้องอย่างเป็นทางการ</p>
                    <p>© {new Date().getFullYear()} Form Check</p>
                </div>
            </div>
        </footer>
    )
}

export default Footer
