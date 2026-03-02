import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CanvasPage from './pages/Canvas';
import Home from './pages/Home';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/canvas" element={<CanvasPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
