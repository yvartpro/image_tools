import React from 'react';
import { Check, FolderOpen } from 'lucide-react';
import { formatBytes } from '../utils.js';

export default function ResultsSummary({
  summary,
  onOpenFolderViewer,
}) {
  if (!summary) return null;

  const {
    totalCount,
    successCount,
    failedCount,
    totalOriginalBytes,
    totalOptimizedBytes,
    totalSavedBytes,
    totalSavedPercent,
    outputDir,
  } = summary;

  return (
    <div className="bg-white rounded-xl border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" id="results-summary">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
        <div>
          <span className="font-semibold text-zinc-900">
            {successCount} of {totalCount} images optimized
          </span>
          {failedCount > 0 && (
            <span className="text-rose-600 ml-1">({failedCount} failed)</span>
          )}
          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
            {formatBytes(totalOriginalBytes)} → {formatBytes(totalOptimizedBytes)} ({totalSavedPercent}% saved) • saved to {outputDir}
          </div>
        </div>
      </div>

      <button
        type="button"
        id="view-output-files-btn"
        onClick={onOpenFolderViewer}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-colors shrink-0"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span>View Output</span>
      </button>
    </div>
  );
}
