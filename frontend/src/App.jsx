import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './App.css'
import HomePage from './pages/home';
import Aboutus from './pages/Aboutus';
import FormDetail from './pages/Formdetail';
import Contactus from './pages/Contactus';

function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/form/:id" element={<FormDetail />} />
        <Route path='/aboutus' element={<Aboutus />} />
        <Route path='/contactus' element={<Contactus />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
