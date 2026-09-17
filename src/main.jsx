import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Ensure global Leaflet and Leaflet Draw are bridged between CDN and ES module
import L from 'leaflet';
if (typeof window !== 'undefined') {
  window.type = '';
  window.L = L;
  if (window.L && window.L.Draw && !L.Draw) {
    L.Draw = window.L.Draw;
  }
  if (window.L && window.L.Control?.Draw && !L.Control?.Draw) {
    L.Control.Draw = window.L.Control.Draw;
  }
  if (window.L?.GeometryUtil?.readableArea) {
    const orig = window.L.GeometryUtil.readableArea;
    window.L.GeometryUtil.readableArea = function (area, isMetric, precision) {
      window.type = typeof isMetric;
      return orig.apply(this, arguments);
    };
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
