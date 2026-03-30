import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; // 💡 เพิ่ม Import Axios

import './App.css'
import HomePage from './pages/home';
import Aboutus from './pages/Aboutus';
import FormDetail from './pages/Formdetail';
import Contactus from './pages/Contactus';
import Login from './pages/Login';
import { getAuthenticatedUser } from './lib/auth';

// 💡 บังคับให้ Axios ส่ง Cookie (Session) ไปกับทุก API อัตโนมัติ
axios.defaults.withCredentials = true;

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
        <Route path="/" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><HomePage /></ProtectedRoute>} />
        <Route path="/form/:id" element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><FormDetail /></ProtectedRoute>} />
        <Route path='/aboutus' element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><Aboutus /></ProtectedRoute>} />
        <Route path='/contactus' element={<ProtectedRoute authResolved={authResolved} isAuthenticated={isAuthenticated}><Contactus /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
