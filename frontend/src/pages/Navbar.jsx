import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

function Navbar() {
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false);
    const menuItems = [
        { title: 'หน้าแรก', path: '/' },
        { title: 'เกี่ยวกับเรา', path: '/aboutus' },
        { title: 'แจ้งปัญหา', path: '/contactus' }
    ];

    return(
        <div>
            <nav className="w-full shadow-md p-5 relative z-50 bg-white">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center">
                        {/* คุณสามารถใส่ tag <img /> หรือข้อความ Logo ตรงนี้ได้ */}
                        <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center">
                            <span className="text-xs text-gray-500">Logo</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center">
                        <ul className="flex font-bold">
                            {menuItems.map((item) => (
                                <li key={item.path} className="mx-5">
                                    <Link 
                                        to={item.path} 
                                        className="hover:text-orange-500 transition-colors"
                                        onClick={() => {
                                            // ถ้ากดเมนู "หน้าแรก" ให้ล้างค่าฟอร์มที่จำไว้
                                            if (item.path === '/') {
                                                sessionStorage.removeItem('last_selected_form');
                                                // ถ้าตอนนี้อยู่หน้าแรกอยู่แล้ว ให้บังคับรีเฟรชเพื่อกลับไปหน้าเลือก จท.
                                                if (window.location.pathname === '/') {
                                                    window.location.reload();
                                                }
                                            }
                                        }}
                                    >
                                        {item.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </nav>

            <div className="flex items-center bg-[#FFCF71]/70 ml-5 my-5 mr-5 p-4 rounded-md">
                <img src="/warning.png" alt="warning logo" className="w-6 h-6 ml-3 flex-shrink-0 "/>
                <p className="ml-5 py-1 text-[14px] text-left">
                    เป็นเว็บไซต์ที่จัดทำโดยนิสิต โดยเป็นเพียงเครื่องมือที่ช่วยให้การจัดเตรียมเอกสารยื่นคำร้องทำได้ง่ายมากขึ้นสำหรับนิสิตคณะวิทยาศาตร์เท่านั้น ไม่สามารถยื่นคำร้องได้จริง
                </p>
            </div>
        </div>
    )
}

export default Navbar