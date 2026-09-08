import React from 'react';
import { Layers } from 'lucide-react';

export default function Header({ onOpenOutputFolder }) {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30" id="app-header">
      <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center">
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <h1 className="text-base font-semibold text-zinc-900 tracking-tight">
            Image Compressor
          </h1>
        </div>

        {onOpenOutputFolder && (
          <button
            type="button"
            onClick={onOpenOutputFolder}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-2.5 py-1 rounded-md hover:bg-zinc-100 transition-colors"
          >
            Output Folder
          </button>
        )}
      </div>
    </header>
  );
}
