import React, { useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

const PRESETS = [1024, 720, 540, 360];

export default function ProcessingControls({
  targetWidth,
  setTargetWidth,
  outputDir,
  setOutputDir,
  onCompress,
  onClear,
  isProcessing,
  totalImages,
  completedImages,
}) {
  const [isCustom, setIsCustom] = useState(!PRESETS.includes(targetWidth));
  const [customInput, setCustomInput] = useState(targetWidth.toString());

  const handleSelectPreset = (val) => {
    setIsCustom(false);
    setTargetWidth(val);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    const num = parseInt(customInput, 10);
    if (!isNaN(num) && num > 0) setTargetWidth(num);
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0 && num <= 8000) {
      setTargetWidth(num);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4" id="processing-controls">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Resolution & Output */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-700">Max Width:</span>
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => {
              const active = !isCustom && targetWidth === p;
              return (
                <button
                  key={p}
                  type="button"
                  id={`preset-${p}`}
                  onClick={() => handleSelectPreset(p)}
                  disabled={isProcessing}
                  className={`px-2.5 py-1 text-xs rounded-md border font-mono transition-colors ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {p}px
                </button>
              );
            })}

            <button
              type="button"
              id="custom-preset-btn"
              onClick={handleCustomToggle}
              disabled={isProcessing}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                isCustom
                  ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              Custom
            </button>

            {isCustom && (
              <div className="relative inline-flex items-center">
                <input
                  type="number"
                  id="custom-width-input"
                  min="16"
                  max="8000"
                  value={customInput}
                  onChange={handleCustomChange}
                  disabled={isProcessing}
                  placeholder="Width"
                  className="w-20 px-2 py-1 text-xs font-mono border border-zinc-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                />
                <span className="ml-1 text-xs font-mono text-zinc-400">px</span>
              </div>
            )}
          </div>

          <div className="hidden sm:block h-4 w-px bg-zinc-200" />

          {/* Folder input */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Folder:</span>
            <input
              type="text"
              id="output-dir-input"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              disabled={isProcessing}
              className="w-28 sm:w-32 px-2 py-1 text-xs font-mono border border-zinc-200 rounded-md bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
              placeholder="./images"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {totalImages > 0 && (
            <button
              type="button"
              id="clear-batch-btn"
              onClick={onClear}
              disabled={isProcessing}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 rounded-md hover:bg-zinc-100 transition-colors"
              title="Clear images"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            id="compress-batch-btn"
            onClick={onCompress}
            disabled={isProcessing || totalImages === 0}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isProcessing
                ? 'bg-zinc-400 text-white cursor-wait'
                : totalImages === 0
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{completedImages}/{totalImages}</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Compress</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
