import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; // 💡 เพิ่ม Import Axios

import './App.css'
import HomePage from './pages/home';
import Aboutus from './pages/Aboutus';
import FormDetail from './pages/Formdetail';
import Contactus from './pages/Contactus';
import Login from './pages/Login';

// 💡 บังคับให้ Axios ส่ง Cookie (Session) ไปกับทุก API อัตโนมัติ
axios.defaults.withCredentials = true;

const ProtectedRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'ok') {
      return true;
    }
    return localStorage.getItem('isAuth') === 'true';
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('auth') === 'ok') {
      setIsAuthenticated(true);
      localStorage.setItem('isAuth', 'true');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('isAuth', isAuthenticated);
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
        />
        <Route path="/" element={<ProtectedRoute isAuthenticated={isAuthenticated}><HomePage /></ProtectedRoute>} />
        <Route path="/form/:id" element={<ProtectedRoute isAuthenticated={isAuthenticated}><FormDetail /></ProtectedRoute>} />
        <Route path='/aboutus' element={<ProtectedRoute isAuthenticated={isAuthenticated}><Aboutus /></ProtectedRoute>} />
        <Route path='/contactus' element={<ProtectedRoute isAuthenticated={isAuthenticated}><Contactus /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App