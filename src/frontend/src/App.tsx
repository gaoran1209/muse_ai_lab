import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CanvasPage from './pages/Canvas';
import Dashboard from './pages/Dashboard';
import LandDetailPage from './pages/LandDetail';
import LandPage from './pages/Land';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/canvas/:projectId" element={<CanvasPage />} />
        <Route path="/canvas" element={<Navigate to="/" replace />} />
        <Route path="/land" element={<LandPage />} />
        <Route path="/land/:contentId" element={<LandDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
