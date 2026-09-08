import React from 'react';

export default function ProgressBar({
  totalCount,
  processedCount,
  globalProgressPercent,
  isProcessing,
}) {
  if (!isProcessing && processedCount === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4" id="global-progress">
      <div className="flex items-center justify-between text-xs font-mono text-zinc-700 mb-1.5">
        <span>
          {processedCount} / {totalCount} processed
        </span>
        <span className="font-semibold">{globalProgressPercent}%</span>
      </div>

      <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, globalProgressPercent))}%` }}
        />
      </div>
    </div>
  );
}
