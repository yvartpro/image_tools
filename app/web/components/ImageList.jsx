import React from 'react';
import {
  Check,
  X,
  Loader2,
  Trash2,
  FileImage,
} from 'lucide-react';
import { formatBytes } from '../utils.js';

export default function ImageList({
  images,
  onRemoveImage,
  isProcessing,
  targetWidth,
}) {
  if (!images || images.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden" id="image-list">
      <div className="divide-y divide-zinc-100 max-h-[480px] overflow-y-auto">
        {images.map((item) => {
          const {
            id,
            name,
            size,
            previewUrl,
            status = 'waiting',
            progress = 0,
            result,
            error,
          } = item;

          return (
            <div
              key={id}
              id={`image-item-${id}`}
              className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-md bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <FileImage className="w-4 h-4 text-zinc-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium font-mono text-zinc-900 truncate" title={name}>
                    {name}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
                    <span>{formatBytes(size)}</span>

                    {result && (
                      <>
                        <span>→</span>
                        <span className="text-emerald-600 font-semibold">
                          {formatBytes(result.optimizedSize)} (-{result.percentSaved}%)
                        </span>
                      </>
                    )}

                    {error && (
                      <span className="text-rose-600 font-sans">{error}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2 shrink-0">
                {status === 'processing' && (
                  <div className="flex items-center gap-1.5 text-blue-600 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{progress}%</span>
                  </div>
                )}

                {status === 'completed' && (
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </span>
                )}

                {status === 'failed' && (
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center" title={error}>
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </span>
                )}

                {!isProcessing && status === 'waiting' && (
                  <button
                    type="button"
                    onClick={() => onRemoveImage(id)}
                    className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
