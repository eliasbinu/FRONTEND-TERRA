import React, { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import logoImg from '../assets/finterra-logo.png';

export default function LandingPage({ onStartAnalysis }) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (onStartAnalysis) {
      onStartAnalysis(prompt.trim());
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#080d0a] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Background Logo - Clearly visible with very low transparency */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img
          src={logoImg}
          alt="Finterra Logo Background"
          className="w-[520px] h-[520px] sm:w-[620px] sm:h-[620px] md:w-[760px] md:h-[760px] object-contain opacity-90 select-none pointer-events-none"
        />
      </div>

      {/* 2. Top Minimalist Status Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-[#1c2a20] bg-[#0a100d]">
        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
          <span className="text-zinc-400 uppercase tracking-wider font-semibold">
            FINTERRA CADASTRAL CORE
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">v1.0-PROD</span>
        </div>

        <div className="hidden sm:flex items-center space-x-3 font-mono text-[11px] text-zinc-400">
          <span className="px-2 py-0.5 rounded-sm bg-[#121a14] border border-[#1e2f24] text-[#4ade80]">
            SENTINEL-2 MSI ONLINE
          </span>
          <span className="px-2 py-0.5 rounded-sm bg-[#121a14] border border-[#1e2f24] text-zinc-300">
            10m/px STAC
          </span>
        </div>
      </header>

      {/* 3. Center Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
        {/* Prominent Website Name */}
        <div className="mb-4">
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-mono font-black tracking-widest text-white uppercase drop-shadow-sm">
            FIN<span className="text-[#22c55e]">TERRA</span>
          </h1>

          <p className="mt-3 text-sm sm:text-base font-mono text-zinc-300 max-w-xl mx-auto leading-relaxed">
            Multi-spectral satellite computer vision and algorithmic collateral valuation for rural credit.
          </p>
        </div>

        {/* Sleek Minimalistic Input Prompt */}
        <div className="w-full max-w-xl mt-4">
          <form
            onSubmit={handleSubmit}
            className="w-full bg-[#0e1410] border-2 border-[#1e2f23] focus-within:border-[#22c55e] rounded-md p-1.5 flex items-center space-x-2 transition-colors shadow-none"
          >
            {/* Terminal prompt symbol */}
            <div className="pl-3 pr-1 text-[#22c55e] font-mono font-bold text-base select-none">
              &gt;_
            </div>

            {/* Input prompt field */}
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Start analysis..."
              className="flex-1 bg-transparent text-white font-mono text-xs sm:text-sm placeholder:text-zinc-500 focus:outline-none px-1"
              autoFocus
            />

            {/* Solid color sleek button */}
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-mono text-xs font-bold uppercase tracking-wider rounded-sm flex items-center space-x-2 transition-colors flex-shrink-0 cursor-pointer"
            >
              <span>Start Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </main>

      {/* 4. Minimalist Footer */}
      <footer className="relative z-10 w-full px-6 py-3 border-t border-[#1c2a20] bg-[#0a100d] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-zinc-400">
        <div className="flex items-center space-x-3">
          <span>&copy; 2026 FINTERRA TECHNOLOGIES</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">RURAL AGRI-LENDING PLATFORM</span>
        </div>
        <div className="flex items-center space-x-2 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
          <span>7/12 OCR &amp; SATELLITE CADASTRE VERIFIED</span>
        </div>
      </footer>
    </div>
  );
}
