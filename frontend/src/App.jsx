import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; // 💡 เพิ่ม Import Axios

import './App.css'
import HomePage from './pages/home';
import Aboutus from './pages/Aboutus';
import FormDetail from './pages/Formdetail';
import Contactus from './pages/Contactus';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';
import CookiePolicy from './pages/CookiePolicy';
import { getAuthenticatedUser, installSessionExpiryInterceptor } from './lib/auth';

// 💡 บังคับให้ Axios ส่ง Cookie (Session) ไปกับทุก API อัตโนมัติ
axios.defaults.withCredentials = true;

const CONSOLE_WARNING_FLAG = '__sciLegalConsoleWarningShown';

const showConsoleLegalWarning = () => {
  if (typeof window === 'undefined' || window[CONSOLE_WARNING_FLAG]) {
    return;
  }

  window[CONSOLE_WARNING_FLAG] = true;

  console.log(
    '%cคำเตือน!',
    'background: #FFF176; color: #C2410C; font-size: 28px; font-weight: 800; padding: 4px 10px;'
  );
  console.log(
    [
      'การเข้าถึง, แก้ไข, คัดลอก, หรือพยายามดึงข้อมูลของระบบโดยไม่ได้รับอนุญาต',
      'อาจเข้าข่ายการละเมิดกฎหมายที่เกี่ยวข้อง, พ.ร.บ.คอมพิวเตอร์,',
      'รวมถึงระเบียบหรือข้อบังคับของมหาวิทยาลัย',
      'หากคุณไม่ได้รับมอบหมายให้ทดสอบหรือดูแลระบบนี้ โปรดอย่าวางโค้ดหรือคำสั่งใด ๆ ใน Console'
    ].join(' ')
  );
};

const ProtectedRoute = ({ authResolved, isAuthenticated, children }) => {
  if (!authResolved) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    installSessionExpiryInterceptor();
  }, []);

  useEffect(() => {
    showConsoleLegalWarning();
  }, []);

  useEffect(() => {
    const handleProtectedAssetContextMenu = (event) => {
      if (event.target?.closest?.('[data-protect-ui="true"]')) {
        event.preventDefault();
      }
    };

    const handleProtectedAssetDragStart = (event) => {
      if (event.target?.closest?.('[data-protect-ui="true"]')) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleProtectedAssetContextMenu);
    document.addEventListener('dragstart', handleProtectedAssetDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleProtectedAssetContextMenu);
      document.removeEventListener('dragstart', handleProtectedAssetDragStart);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      const authenticatedUser = await getAuthenticatedUser();

      if (!isMounted) {
        return;
      }

      setIsAuthenticated(Boolean(authenticatedUser));
      setAuthResolved(true);
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            !authResolved
              ? null
              : isAuthenticated
                ? <Navigate to="/" replace />
                : <Login />
          } 
        />
        <Route
          path="/unauthorized"
          element={
            !authResolved
              ? null
              : isAuthenticated
                ? <Navigate to="/" replace />
                : <Unauthorized />
          }
        />
        <Route path="/privacy" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><PrivacyPolicy /></ProtectedRoute>} />
        <Route path="/terms" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><TermsOfUse /></ProtectedRoute>} />
        <Route path="/cookies" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><CookiePolicy /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><HomePage /></ProtectedRoute>} />
        <Route path="/form/:id" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><FormDetail /></ProtectedRoute>} />
        <Route path='/aboutus' element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><Aboutus /></ProtectedRoute>} />
        <Route path='/contactus' element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><Contactus /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
