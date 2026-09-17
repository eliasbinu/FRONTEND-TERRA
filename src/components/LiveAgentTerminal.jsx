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
    <div className="bg-[#121212] border border-[#262626] rounded-md flex flex-col h-full overflow-hidden font-mono select-none">
      {/* Terminal Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#18181b] border-b border-[#262626] gap-2">
        <div className="flex items-center space-x-2.5">
          {/* Solid Terminal Prompt */}
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-sm bg-[#14532d] border border-[#16a34a]">
            <span className="text-[#4ade80] font-bold text-xs">&gt;_</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            AUTONOMOUS AGENT ORCHESTRATION STREAM
          </span>
        </div>

        {/* Dynamic Status Badge */}
        <div>
          {completed ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-sm bg-[#14532d] text-[#4ade80] border border-[#16a34a] text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Assessment Finalized</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-sm bg-[#1c1917] text-amber-400 border border-amber-800 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>Ingestion &amp; CV Parsing Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Stream Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#09090b] text-xs select-text">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-500 font-mono text-xs">
            <span>Initializing autonomous agent telemetry socket...</span>
          </div>
        ) : (
          logs.map((log, index) => {
            const formattedTime = log.timestamp?.includes('T')
              ? log.timestamp.split('T')[1].replace('Z', '')
              : log.timestamp || '00:00:00';

            return (
              <div
                key={log.id || `${log.step_name}-${index}`}
                className="flex flex-col sm:flex-row sm:items-start justify-between p-2.5 rounded-sm bg-[#141416] border border-[#27272a] hover:border-zinc-600 transition-colors gap-2"
              >
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  {/* Tag: [step_name] in solid green */}
                  <span className="font-bold text-[#4ade80] whitespace-nowrap">
                    [{log.step_name}]
                  </span>

                  {/* Message: telemetry explanation */}
                  <span className="text-zinc-200 text-xs leading-relaxed break-words">
                    {log.message}
                  </span>
                </div>

                {/* Right-aligned timestamp in dim text */}
                <span className="text-zinc-500 text-[11px] whitespace-nowrap sm:text-right flex-shrink-0 self-start sm:self-auto">
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
