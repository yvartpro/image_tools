import React, { useState, useEffect } from 'react';
import { X, Folder, Eye, RefreshCw, ExternalLink } from 'lucide-react';
import { formatBytes } from '../utils.js';

export default function OutputFolderViewer({
  isOpen,
  onClose,
  outputDir = './images',
}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/output-files?outputDir=${encodeURIComponent(outputDir)}`);
      if (!res.ok) throw new Error('Failed to load output files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, outputDir]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" id="output-folder-modal">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-mono font-medium text-zinc-800">{outputDir}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchFiles}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 text-xs">
          {loading && files.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              Loading...
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700">
              {error}
            </div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              No files in {outputDir}
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden">
              {files.map((file) => (
                <div
                  key={file.filename}
                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src={`/api/images/${encodeURIComponent(file.filename)}?outputDir=${encodeURIComponent(outputDir)}`}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-zinc-900 truncate">
                        {file.filename}
                      </p>
                      <span className="font-mono text-[11px] text-zinc-500">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewImage(previewImage === file.filename ? null : file.filename)}
                      className="px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <a
                      href={`/api/images/${encodeURIComponent(file.filename)}?outputDir=${encodeURIComponent(outputDir)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                      title="Open WebP raw"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {previewImage && (
            <div className="mt-3 p-3 bg-zinc-900 rounded-lg text-center">
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-zinc-800 text-[11px] text-zinc-400 font-mono">
                <span className="truncate">{previewImage}</span>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <img
                src={`/api/images/${encodeURIComponent(previewImage)}?outputDir=${encodeURIComponent(outputDir)}`}
                alt={previewImage}
                className="max-h-56 mx-auto object-contain rounded"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
