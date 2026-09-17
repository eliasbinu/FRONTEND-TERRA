import React, { useState, useEffect, useRef } from 'react';
import {
  Satellite,
  Database,
  FileText,
  Cpu,
  CheckCircle2,
  Loader2,
  Clock,
  AlertCircle,
} from 'lucide-react';

const SOURCE_DEFS = [
  {
    id: 'sentinel',
    name: 'ESA Sentinel-2 MSI STAC',
    provider: 'Copernicus / Planetary Computer',
    metric: '10m Multispectral (B04 Red, B08 NIR)',
    detail: 'Cloud Cover: 0.8% • Tile: S2B_MSIL2A',
    icon: Satellite,
    matcher: /satellite|spectral|stac|sentinel|raster|harvester|ndvi/i,
  },
  {
    id: 'soilgrids',
    name: 'ISRIC SoilGrids 250m API',
    provider: 'Global Soil Data Consortium',
    metric: 'Vertisol Profile (0-30cm Depth)',
    detail: 'Clay: 48% • Organic Carbon: 0.68% • pH: 7.2',
    icon: Database,
    matcher: /soil|isric|vertisol|ph|texture/i,
  },
  {
    id: 'cadastre',
    name: 'Mahabhulekh Land Registry',
    provider: 'Maharashtra Revenue Dept (7/12 OCR)',
    metric: 'Title Deed & Gut No. 142 Extraction',
    detail: 'Owner: Ramesh G. Patil • Area: 1.60 ha',
    icon: FileText,
    matcher: /ocr|7\/12|deed|cadastr|owner|record/i,
  },
  {
    id: 'underwriting',
    name: 'Python Underwriting Engine',
    provider: 'Finterra Autonomous Valuation Model',
    metric: 'Multi-Modal Collateral Synthesis',
    detail: 'AAA Quality Tier • Sanction: ₹1,08,750 @ 7.0%',
    icon: Cpu,
    matcher: /underwriting|valuation|risk|sanction|tier|model/i,
  },
];

export default function LiveAgentTerminal({
  logs = [],
  status = 'active',
  isProcessing = true,
  isComplete = false,
  farmerName = '',
}) {
  const streamEndRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer that increments each second while backend processing is active
  useEffect(() => {
    if (!isProcessing && isComplete) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isProcessing, isComplete]);

  // Auto-scroll to bottom of stream as logs arrive
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Determine synced sources based on real backend logs or overall completion
  const isDone = isComplete || status === 'complete';

  const sourceStatus = SOURCE_DEFS.map((src) => {
    if (isDone) return true;
    return logs.some((l) =>
      src.matcher.test(`${l.step_name || ''} ${l.message || ''} ${l.source || ''}`)
    );
  });

  const syncedCount = isDone ? 4 : sourceStatus.filter(Boolean).length;

  // Calculate dynamic progress: NEVER jump to 100% on a fixed timer; only reach 100% when backend finishes!
  let progress = 15;
  if (isDone) {
    progress = 100;
  } else {
    const logFactor = Math.min(60, logs.length * 15);
    const timeFactor = Math.min(20, elapsedSeconds * 2);
    progress = Math.min(92, 15 + logFactor + timeFactor);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md flex flex-col h-full overflow-hidden select-none shadow-sm">
      {/* 1. Terminal Header */}
      <div className="flex flex-wrap items-center justify-end px-4 py-3 bg-slate-50 border-b border-slate-200 gap-2">
        {/* Dynamic Status Badge (Waiting for real backend) */}
        <div className="flex items-center space-x-2">
          {isDone ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] text-xs sm:text-sm font-black">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#16a34a]" />
              <span>Backend Processing Finalized • Redirecting...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-white text-slate-900 border border-slate-200 text-xs sm:text-sm font-bold shadow-xs">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-[#16a34a]" />
              <span>Processing Ingestion Pipelines • {progress}%</span>
              <span className="text-slate-500 text-xs ml-1 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5" /> {elapsedSeconds}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Multi-Source Pipeline Cards Grid */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2 text-xs uppercase tracking-wider text-slate-700 font-extrabold">
            <span>Orchestrating Distributed Ingestion Pipelines</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-950 font-black">{progress}% Processed</span>
            {farmerName && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-slate-900 font-bold">Target: {farmerName}</span>
              </>
            )}
          </div>
          <span className="text-xs font-bold text-slate-600">
            {syncedCount} of 4 Sources Synchronized
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full h-2 bg-slate-200 rounded-md overflow-hidden mb-3.5">
          <div
            className="h-full bg-[#16a34a] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 4 Source Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SOURCE_DEFS.map((source, index) => {
            const Icon = source.icon;
            const isSourceSynced = isDone || sourceStatus[index];

            return (
              <div
                key={source.id}
                className="p-3 rounded-md border bg-white border-slate-200 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon
                      className={`w-4 h-4 ${
                        isSourceSynced ? 'text-[#16a34a]' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-black text-slate-950 truncate max-w-[150px]">
                      {source.name}
                    </span>
                  </div>

                  {/* Status Pill */}
                  {isSourceSynced ? (
                    <span className="px-2 py-0.5 text-[10px] rounded-md bg-[#dcfce7] text-[#15803d] border border-[#86efac] font-black">
                      SYNCED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-black flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-500" />
                      PULLING
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs text-slate-900 font-bold truncate">
                  {source.metric}
                </div>
                <div className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                  {source.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Streaming Terminal Telemetry Feed */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 bg-white text-xs sm:text-sm select-text">
        {logs.length === 0 ? (
          /* Socket awaiting feed while backend processes */
          <div className="space-y-2.5 p-1">
            <div className="flex items-center space-x-2 text-slate-800 text-xs sm:text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-ping" />
              <span className="text-slate-950 font-black">
                Socket Connected • Listening for Python underwriting pipeline telemetry...
              </span>
            </div>
            <div className="text-slate-700 text-xs sm:text-sm pl-4 border-l-2 border-slate-300 space-y-2 font-medium">
              <p>• Polling backend daemon for multi-spectral reflectance &amp; risk calculation...</p>
              <p>• Querying Copernicus Sentinel-2 MSI STAC (B04 Red, B08 NIR)...</p>
              <p>• Extracting ISRIC SoilGrids 250m profile tensors for target boundary...</p>
              <p>• Parsing Mahabhulekh cadastral records and owner title claims...</p>
              <p className="text-slate-900 font-bold pt-1 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#16a34a]" />
                <span>Backend processing active • {elapsedSeconds}s elapsed. Dashboard will open automatically once finished.</span>
              </p>
            </div>
          </div>
        ) : (
          logs.map((log, index) => {
            const formattedTime = log.timestamp?.includes('T')
              ? log.timestamp.split('T')[1].replace('Z', '')
              : log.timestamp || '00:00:00';

            return (
              <div
                key={log.id || `${log.step_name}-${index}`}
                className={`flex flex-col sm:flex-row sm:items-start justify-between p-3 rounded-md border gap-2.5 ${
                  log.isError
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  {/* Source Label */}
                  {log.source && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-white text-slate-800 border border-slate-300 whitespace-nowrap shadow-2xs">
                      {log.source}
                    </span>
                  )}

                  {/* Step Tag */}
                  <span
                    className={`font-black whitespace-nowrap text-xs sm:text-sm ${
                      log.isError ? 'text-red-700' : 'text-[#15803d]'
                    }`}
                  >
                    {log.step_name}
                  </span>

                  {/* Message */}
                  <span className="text-xs sm:text-sm font-semibold leading-relaxed break-words text-slate-800">
                    {log.message}
                  </span>
                </div>

                {/* Timestamp */}
                <span className="text-slate-500 text-xs font-bold whitespace-nowrap sm:text-right flex-shrink-0 self-start sm:self-auto font-mono">
                  {formattedTime}
                </span>
              </div>
            );
          })
        )}
        <div ref={streamEndRef} />
      </div>

      {/* 4. Bottom Automatic Transition Notice */}
      {isDone && (
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-950 font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
            <span>Processing Finalized • Opening CV Decision Dashboard automatically...</span>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Redirecting...
          </span>
        </div>
      )}
    </div>
  );
}
