import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Ensure global Leaflet and Leaflet Draw are bridged between CDN and ES module
import L from 'leaflet';
if (typeof window !== 'undefined') {
  window.L = L;
  if (window.L && window.L.Draw && !L.Draw) {
    L.Draw = window.L.Draw;
  }
  if (window.L && window.L.Control?.Draw && !L.Control?.Draw) {
    L.Control.Draw = window.L.Control.Draw;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
