import React, { useState, useEffect } from 'react';
import PlotDrawMap from './components/PlotDrawMap';
import LiveAgentTerminal from './components/LiveAgentTerminal';
import CVResultsDashboard from './components/CVResultsDashboard';
import {
  USE_MOCK,
  submitAssessment,
  subscribeToAssessment,
  MOCK_ASSESSMENT_RESULT,
} from './services/api';
import { Layers, Terminal, Activity, ArrowRight } from 'lucide-react';

export default function App() {
  const [stage, setStage] = useState('input'); // 'input' | 'processing' | 'results'
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

  return (
    <div className="min-h-screen bg-canvas text-slate-100 flex flex-col font-sans">
      {/* 1. Header Bar */}
      <header className="bg-panel border-b border-[#1e293b] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Branding & Subtitle Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-1.5 font-mono">
              🌱 AgriCred
            </span>
          </div>
          <span className="text-slate-600 font-mono text-xs">/</span>
          <span className="px-2 py-0.5 rounded-sm bg-[#090d16] border border-[#1e293b] text-[11px] font-mono text-slate-300">
            Satellite CV Underwriting Engine
          </span>
        </div>

        {/* Navigation buttons for manual stage jumping */}
        <div className="flex items-center space-x-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setStage('input')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm border transition-colors ${
              stage === 'input'
                ? 'bg-[#1e293b] text-[#38bdf8] border-[#38bdf8] font-bold'
                : 'bg-[#090d16] text-slate-400 border-[#1e293b] hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>[1. Parcel Input]</span>
          </button>

          <span className="text-slate-600 px-1">&rarr;</span>

          <button
            type="button"
            onClick={() => setStage('processing')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm border transition-colors ${
              stage === 'processing'
                ? 'bg-[#1e293b] text-[#38bdf8] border-[#38bdf8] font-bold'
                : 'bg-[#090d16] text-slate-400 border-[#1e293b] hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>[2. Live Terminal]</span>
            {isProcessing && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse ml-1" />
            )}
          </button>

          <span className="text-slate-600 px-1">&rarr;</span>

          <button
            type="button"
            onClick={() => setStage('results')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm border transition-colors ${
              stage === 'results'
                ? 'bg-[#1e293b] text-[#10b981] border-[#10b981] font-bold'
                : 'bg-[#090d16] text-slate-400 border-[#1e293b] hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>[3. CV Decision Dashboard]</span>
          </button>
        </div>

        {/* Status Tag */}
        <div className="flex items-center">
          <span className="px-2.5 py-1 rounded-sm bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 text-xs font-mono font-semibold">
            {USE_MOCK ? 'MODE: SIMULATED MOCK' : 'MODE: LIVE (172.17.211.69:8000)'}
          </span>
        </div>
      </header>

      {/* 2. Main Workflow Stage Viewport */}
      <main className="flex-1 p-3 overflow-hidden flex flex-col">
        {/* Stage 1: Parcel Input */}
        {stage === 'input' && (
          <div className="flex-1 h-full min-h-[550px]">
            <PlotDrawMap onCompleteSubmit={handleParcelSubmit} />
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
                  className="px-4 py-2 rounded-md bg-[#10b981] hover:bg-[#059669] text-[#090d16] font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-colors"
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
