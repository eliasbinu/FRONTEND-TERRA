import React, { useEffect, useRef } from 'react';
import { Terminal, Loader2, CheckCircle2 } from 'lucide-react';

export default function LiveAgentTerminal({ logs = [], status = 'active', isComplete = false }) {
  const streamEndRef = useRef(null);
  const completed = isComplete || status === 'complete';

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-panel border border-[#1e293b] rounded-md flex flex-col h-full overflow-hidden font-mono select-none">
      {/* Terminal Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#090d16] border-b border-[#1e293b] gap-2">
        <div className="flex items-center space-x-2.5">
          {/* Glowing Terminal Prompt */}
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-sm bg-[#38bdf8]/10 border border-[#38bdf8]/30 shadow-[0_0_8px_rgba(56,189,248,0.25)]">
            <span className="text-[#38bdf8] font-bold text-xs animate-pulse">&gt;_</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
            AUTONOMOUS AGENT ORCHESTRATION STREAM
          </span>
        </div>

        {/* Dynamic Status Badge */}
        <div>
          {completed ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-sm bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Assessment Finalized</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-sm bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>Ingestion &amp; CV Parsing Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Stream Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#090d16]/70 text-xs select-text">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 font-mono text-xs">
            <span className="animate-pulse">Initializing autonomous agent telemetry socket...</span>
          </div>
        ) : (
          logs.map((log, index) => {
            const formattedTime = log.timestamp?.includes('T')
              ? log.timestamp.split('T')[1].replace('Z', '')
              : log.timestamp || '00:00:00';

            return (
              <div
                key={log.id || `${log.step_name}-${index}`}
                className="flex flex-col sm:flex-row sm:items-start justify-between p-2.5 rounded-sm bg-[#0f172a] border border-[#1e293b] hover:border-slate-700 transition-colors gap-2"
              >
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  {/* Tag: [step_name] in bold */}
                  <span className="font-bold text-[#38bdf8] whitespace-nowrap">
                    [{log.step_name}]
                  </span>

                  {/* Message: telemetry explanation */}
                  <span className="text-slate-200 text-xs leading-relaxed break-words">
                    {log.message}
                  </span>
                </div>

                {/* Right-aligned timestamp in dim text */}
                <span className="text-slate-500 text-[11px] whitespace-nowrap sm:text-right flex-shrink-0 self-start sm:self-auto">
                  {formattedTime}
                </span>
              </div>
            );
          })
        )}
        <div ref={streamEndRef} />
      </div>
    </div>
  );
}
