import React, { useState, useEffect } from 'react';
import PlotDrawMap from './components/PlotDrawMap';
import LiveAgentTerminal from './components/LiveAgentTerminal';
import CVResultsDashboard from './components/CVResultsDashboard';
import LandingPage from './components/LandingPage';
import {
  submitAssessment,
  subscribeToAssessment,
  MOCK_ASSESSMENT_RESULT,
} from './services/api';
import { Layers, Terminal, Activity, ArrowRight } from 'lucide-react';

export default function App() {
  const [stage, setStage] = useState('landing'); // 'landing' | 'input' | 'processing' | 'results'
  const [initialQuery, setInitialQuery] = useState('');
  const [logs, setLogs] = useState([]);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize with default preview data on mount (without querying the backend with placeholder IDs)
  useEffect(() => {
    setAssessmentResult(MOCK_ASSESSMENT_RESULT);
  }, []);

  // Handle parcel submission from Stage 1 (PlotDrawMap)
  const handleParcelSubmit = async ({ farmerName, polygon, documents }) => {
    setStage('processing');
    setIsProcessing(true);
    setLogs([]);

    try {
      // 1. Submit POST /api/assess
      const response = await submitAssessment({
        farmerName,
        polygon,
        documentUrls: documents.map((d) => d.file_url),
      });

      // 2. Capture EXACT assessment_id from backend response
      const capturedAssessmentId = response.assessment_id || response.id;
      console.log('[API] Captured real assessment_id from backend:', capturedAssessmentId);

      if (!capturedAssessmentId) {
        throw new Error('Backend did not return an assessment_id');
      }

      // 3. Use capturedAssessmentId for live telemetry and result retrieval
      subscribeToAssessment(
        capturedAssessmentId,
        (newLog) => {
          setLogs((prev) => [...prev, newLog]);
        },
        (statusChange) => {
          if (statusChange === 'complete') {
            setIsProcessing(false);
          }
        },
        (finalResult) => {
          console.log('[API] Final assessment result received for ID:', capturedAssessmentId);
          setAssessmentResult(finalResult);
          setIsProcessing(false);
          // Auto transition to Stage 3 ('results')
          setTimeout(() => {
            setStage('results');
          }, 600);
        }
      );
    } catch (err) {
      console.error('[API] Assessment submission error:', err);
      setIsProcessing(false);
    }
  };

  // If on Landing Page, render full screen sleek landing
  if (stage === 'landing') {
    return (
      <LandingPage
        onStartAnalysis={(query) => {
          setInitialQuery(query || '');
          setStage('input');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100 flex flex-col font-sans">
      {/* 1. Header Bar */}
      <header className="bg-[#121212] border-b border-[#262626] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Branding & Subtitle Badge */}
        <div className="flex items-center space-x-3">
          <div
            onClick={() => setStage('landing')}
            className="flex items-center space-x-2 cursor-pointer hover:opacity-85 transition-opacity"
            title="Return to Landing Page"
          >
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-mono">
              🌱 <span className="text-[#22c55e]">FIN</span>TERRA
            </span>
          </div>
          <span className="text-zinc-600 font-mono text-xs">/</span>
          <span className="px-2 py-0.5 rounded-sm bg-[#18181b] border border-[#27272a] text-[11px] font-mono text-zinc-300">
            Satellite CV Underwriting Engine
          </span>
        </div>

        {/* Navigation buttons for manual stage jumping */}
        <div className="flex items-center space-x-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setStage('landing')}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-sm border bg-[#18181b] text-zinc-400 border-[#27272a] hover:bg-[#222225] hover:text-zinc-200 transition-colors mr-1 cursor-pointer"
            title="Return to Landing Page"
          >
            <span>&larr; Landing</span>
          </button>

          <button
            type="button"
            onClick={() => setStage('input')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm border transition-colors ${
              stage === 'input'
                ? 'bg-[#14532d] text-[#4ade80] border-[#16a34a] font-bold'
                : 'bg-[#18181b] text-zinc-400 border-[#27272a] hover:bg-[#222225] hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>[1. Parcel Input]</span>
          </button>

          <span className="text-zinc-600 px-1">&rarr;</span>

          <button
            type="button"
            onClick={() => setStage('processing')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm border transition-colors ${
              stage === 'processing'
                ? 'bg-[#14532d] text-[#4ade80] border-[#16a34a] font-bold'
                : 'bg-[#18181b] text-zinc-400 border-[#27272a] hover:bg-[#222225] hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>[2. Live Terminal]</span>
            {isProcessing && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] ml-1" />
            )}
          </button>

          <span className="text-zinc-600 px-1">&rarr;</span>

          <button
            type="button"
            onClick={() => setStage('results')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm border transition-colors ${
              stage === 'results'
                ? 'bg-[#14532d] text-[#4ade80] border-[#16a34a] font-bold'
                : 'bg-[#18181b] text-zinc-400 border-[#27272a] hover:bg-[#222225] hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>[3. CV Decision Dashboard]</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workflow Stage Viewport */}
      <main className="flex-1 p-3 overflow-hidden flex flex-col">
        {/* Stage 1: Parcel Input */}
        {stage === 'input' && (
          <div className="flex-1 h-full min-h-[550px]">
            <PlotDrawMap onCompleteSubmit={handleParcelSubmit} initialQuery={initialQuery} />
          </div>
        )}

        {/* Stage 2: Live Processing Stream */}
        {stage === 'processing' && (
          <div className="flex-1 h-full min-h-[550px] flex flex-col space-y-3">
            <div className="flex-1">
              <LiveAgentTerminal
                logs={logs}
                status={isProcessing ? 'active' : 'complete'}
                isComplete={!isProcessing && logs.length >= 5}
              />
            </div>
            {!isProcessing && logs.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStage('results')}
                  className="px-4 py-2 rounded-md bg-[#16a34a] hover:bg-[#15803d] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-colors"
                >
                  <span>Proceed to CV Decision Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stage 3: CV Results & Underwriting Dashboard */}
        {stage === 'results' && (
          <div className="flex-1 h-full min-h-[550px]">
            <CVResultsDashboard data={assessmentResult} />
          </div>
        )}
      </main>
    </div>
  );
}
