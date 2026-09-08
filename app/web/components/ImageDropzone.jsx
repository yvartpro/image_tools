import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, FolderPlus, Sparkles } from 'lucide-react';

export default function ImageDropzone({ onFilesSelected, onLoadSamples, isProcessing, totalFiles }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isProcessing) return;

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|tiff?|avif|svg)$/i.test(file.name)
      );
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <div
        id="image-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isProcessing
            ? 'opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-200'
            : isDragOver
            ? 'border-emerald-500 bg-emerald-50/50'
            : 'border-zinc-300 hover:border-zinc-400 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          multiple
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.tiff,.avif,.svg"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
            <UploadCloud className="w-5 h-5" />
          </div>

          <p className="text-sm font-medium text-zinc-800">
            Drop images here, or <span className="text-emerald-600 underline underline-offset-2">browse</span>
          </p>

          <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              id="choose-files-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Select Files
            </button>

            {onLoadSamples && (
              <button
                type="button"
                id="load-samples-btn"
                onClick={onLoadSamples}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                Sample Images
              </button>
            )}
          </div>
        </div>

        {totalFiles > 0 && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs font-mono font-medium">
              <ImageIcon className="w-3 h-3 text-zinc-500" />
              {totalFiles}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
