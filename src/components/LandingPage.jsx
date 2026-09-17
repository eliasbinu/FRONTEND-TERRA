import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import logoImg from '../assets/finterra-logo.png';

export default function LandingPage({ onStartAnalysis }) {
  return (
    <div className="relative min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Fullscreen Ambient Background Logo */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <img
          src={logoImg}
          alt="Finterra Logo Background"
          className="w-full h-full object-cover object-center opacity-15 select-none pointer-events-none scale-105"
        />
        {/* Subtle radial vignette so center text is crystal clear */}
        <div className="absolute inset-0 bg-radial from-transparent via-white/40 to-[#f8fafc]/90 pointer-events-none" />
      </div>

      {/* 2. Center Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
        {/* Prominent Website Name - High Contrast & Stands Out */}
        <div className="mb-6">
          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-widest text-slate-900 uppercase drop-shadow-sm">
            FIN<span className="text-[#16a34a]">TERRA</span>
          </h1>
        </div>

        {/* Sleek Minimalistic Start Analysis Action Box */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onStartAnalysis && onStartAnalysis('')}
            className="px-10 py-4 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm sm:text-base font-extrabold uppercase tracking-wider rounded-lg flex items-center space-x-3 transition-colors cursor-pointer border border-[#15803d] shadow-md shadow-green-900/15"
          >
            <span>Start Analysis</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </main>

      {/* 3. Minimalist Footer */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-slate-200 bg-white/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 font-mono font-semibold">
        <div className="flex items-center space-x-3">
          <span>&copy; 2026 FINTERRA TECHNOLOGIES</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-700">RURAL AGRI-LENDING PLATFORM</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-800">
          <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
          <span>7/12 OCR &amp; SATELLITE CADASTRE VERIFIED</span>
        </div>
      </footer>
    </div>
  );
}
