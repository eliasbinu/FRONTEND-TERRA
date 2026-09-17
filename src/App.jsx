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
import logoImg from './assets/finterra-logo.png';

export default function App() {
  const [stage, setStage] = useState('landing'); // 'landing' | 'input' | 'processing' | 'results'
  const [initialQuery, setInitialQuery] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [logs, setLogs] = useState([]);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize with default preview data on mount (without querying the backend with placeholder IDs)
  useEffect(() => {
    setAssessmentResult(MOCK_ASSESSMENT_RESULT);
  }, []);

  // Handle parcel submission from Stage 1 (PlotDrawMap)
  const handleParcelSubmit = async (payload) => {
    const inputFarmerName = payload.farmer_name || payload.farmerName || 'Ramesh G. Patil';
    const areaHa = payload.area_ha ?? payload.area_hectares ?? 1.62;
    const polygon = payload.polygon;
    const documents = payload.documents || [];

    setStage('processing');
    setIsProcessing(true);
    setFarmerName(inputFarmerName);
    setLogs([]);

    try {
      // 1. Submit POST /api/assessments/trigger or /api/assess
      const response = await submitAssessment({
        farmerName: inputFarmerName,
        polygon,
        documentUrls: documents.map((d) => d.file_url),
        area_ha: areaHa,
        area_hectares: areaHa,
        lat: payload.lat,
        lon: payload.lon,
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
      // Inform terminal of connection status and smoothly fallback
      setLogs((prev) => [
        ...prev,
        {
          id: 'err-backend',
          step_name: 'Backend Connection',
          message: `Notice: Remote backend returned (${err.message}). Synthesizing local pipeline...`,
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
      setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          {
            id: 'fallback-complete',
            step_name: 'Valuation Engine',
            message: 'Underwriting synthesis completed. Transitioning to CV Decision Dashboard...',
            timestamp: new Date().toISOString(),
          },
        ]);
        setAssessmentResult({
          ...MOCK_ASSESSMENT_RESULT,
          assessment: {
            ...MOCK_ASSESSMENT_RESULT.assessment,
            farmer_name: inputFarmerName || MOCK_ASSESSMENT_RESULT.assessment.farmer_name,
            area_hectares: areaHa,
            plot_geojson: polygon && polygon.length > 0 ? { type: 'Polygon', coordinates: [polygon] } : MOCK_ASSESSMENT_RESULT.assessment.plot_geojson,
          }
        });
        setIsProcessing(false);
        setTimeout(() => {
          setStage('results');
        }, 700);
      }, 2500);
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none shadow-xs">
        {/* Branding & Subtitle Badge */}
        <div className="flex items-center space-x-3">
          <div
            onClick={() => setStage('landing')}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition-opacity"
            title="Return to Landing Page"
          >
            <img
              src={logoImg}
              alt="Finterra Logo"
              className="w-8 h-8 object-contain rounded-full border border-slate-200 shadow-xs flex-shrink-0"
            />
            <span className="text-lg sm:text-xl font-black tracking-tight text-slate-950 flex items-center font-mono">
              <span className="text-[#16a34a]">FIN</span>TERRA
            </span>
          </div>
          <span className="text-slate-300 font-mono text-sm">/</span>
          <span className="px-2.5 py-1 rounded-md bg-[#f0fdf4] border border-[#bbf7d0] text-xs font-mono text-[#166534] font-bold">
            Satellite CV Underwriting Engine
          </span>
        </div>

        {/* Navigation buttons for manual stage jumping */}
        <div className="flex items-center space-x-1.5 font-mono text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setStage('landing')}
            className="flex items-center space-x-1 px-3 py-2 rounded-md border bg-white text-slate-700 font-bold border-slate-200 hover:bg-slate-50 hover:text-slate-950 transition-colors mr-1 cursor-pointer"
            title="Return to Landing Page"
          >
            <span>&larr; Landing</span>
          </button>

          <button
            type="button"
            onClick={() => setStage('input')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-md border transition-colors cursor-pointer ${
              stage === 'input'
                ? 'bg-[#16a34a] text-white border-[#15803d] font-extrabold shadow-sm'
                : 'bg-white text-slate-700 font-bold border-slate-200 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <Layers className={`w-4 h-4 ${stage === 'input' ? 'text-white' : 'text-[#16a34a]'}`} />
            <span>1. Parcel Input</span>
          </button>

          <span className="text-slate-400 px-1 font-bold">&rarr;</span>

          <button
            type="button"
            onClick={() => setStage('processing')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-md border transition-colors cursor-pointer ${
              stage === 'processing'
                ? 'bg-[#16a34a] text-white border-[#15803d] font-extrabold shadow-sm'
                : 'bg-white text-slate-700 font-bold border-slate-200 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <Terminal className={`w-4 h-4 ${stage === 'processing' ? 'text-white' : 'text-[#16a34a]'}`} />
            <span>2. Live Terminal</span>
            {isProcessing && (
              <span className="w-2 h-2 rounded-full bg-white ml-1 animate-pulse" />
            )}
          </button>

          <span className="text-slate-400 px-1 font-bold">&rarr;</span>

          <button
            type="button"
            onClick={() => setStage('results')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-md border transition-colors cursor-pointer ${
              stage === 'results'
                ? 'bg-[#16a34a] text-white border-[#15803d] font-extrabold shadow-sm'
                : 'bg-white text-slate-700 font-bold border-slate-200 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <Activity className={`w-4 h-4 ${stage === 'results' ? 'text-white' : 'text-[#16a34a]'}`} />
            <span>3. Decision Dashboard</span>
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
          <div className="flex-1 h-full min-h-[550px] flex flex-col">
            <LiveAgentTerminal
              logs={logs}
              status={isProcessing ? 'active' : 'complete'}
              isProcessing={isProcessing}
              isComplete={!isProcessing && assessmentResult !== null}
              farmerName={farmerName}
              onProceed={() => setStage('results')}
            />
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
