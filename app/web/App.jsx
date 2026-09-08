import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header.jsx';
import ImageDropzone from './components/ImageDropzone.jsx';
import ProcessingControls from './components/ProcessingControls.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import ImageList from './components/ImageList.jsx';
import ResultsSummary from './components/ResultsSummary.jsx';
import OutputFolderViewer from './components/OutputFolderViewer.jsx';
import { getImageDimensions } from './utils.js';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [images, setImages] = useState([]);
  const [targetWidth, setTargetWidth] = useState(720);
  const [outputDir, setOutputDir] = useState('./images');
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState({
    totalCount: 0,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    globalProgressPercent: 0,
    totalOriginalBytes: 0,
    totalOptimizedBytes: 0,
  });
  const [resultsSummary, setResultsSummary] = useState(null);
  const [showFolderViewer, setShowFolderViewer] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  const eventSourceRef = useRef(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handle files selected or dropped
  const handleFilesSelected = useCallback(async (newFiles) => {
    setGlobalError(null);
    setResultsSummary(null);

    const processedItems = await Promise.all(
      newFiles.map(async (file, idx) => {
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        let dimensions = { width: null, height: null };
        try {
          dimensions = await getImageDimensions(file);
        } catch {
          // ignore client inspection failures
        }

        return {
          id: `file-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          dimensions,
          previewUrl,
          status: 'waiting',
          progress: 0,
          statusText: 'Waiting',
          result: null,
          error: null,
        };
      })
    );

    setImages((prev) => [...prev, ...processedItems]);
  }, []);
  
  // Remove individual image
  const handleRemoveImage = (id) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  // Clear batch
  const handleClearBatch = () => {
    if (isProcessing) return;
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setImages([]);
    setResultsSummary(null);
    setGlobalError(null);
    setGlobalProgress({
      totalCount: 0,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      globalProgressPercent: 0,
      totalOriginalBytes: 0,
      totalOptimizedBytes: 0,
    });
  };

  // Start image compression
  const handleCompress = async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setGlobalError(null);
    setResultsSummary(null);

    setImages((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'waiting',
        progress: 0,
        result: null,
        error: null,
      }))
    );

    const initialTotalBytes = images.reduce((sum, img) => sum + img.size, 0);
    setGlobalProgress({
      totalCount: images.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      globalProgressPercent: 0,
      totalOriginalBytes: initialTotalBytes,
      totalOptimizedBytes: 0,
    });

    try {
      const formData = new FormData();
      images.forEach((item) => {
        formData.append('images', item.file);
      });
      formData.append('targetWidth', targetWidth.toString());
      formData.append('outputDir', outputDir);
      formData.append('quality', '80');

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const { jobId } = await res.json();
      connectToSse(jobId);
    } catch (error) {
      console.error('Compression failed:', error);
      setGlobalError(error.message || 'Failed to start image compression.');
      setIsProcessing(false);
    }
  };

  // SSE event listener
  const connectToSse = (jobId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/process/${jobId}/events`);
    eventSourceRef.current = sse;

    sse.addEventListener('image_started', (e) => {
      const data = JSON.parse(e.data);
      setImages((prev) =>
        prev.map((item) =>
          item.name === data.filename
            ? { ...item, status: 'processing', progress: data.progress || 10 }
            : item
        )
      );
    });

    sse.addEventListener('image_progress', (e) => {
      const data = JSON.parse(e.data);
      setImages((prev) =>
        prev.map((item) =>
          item.name === data.filename
            ? { ...item, progress: data.progress }
            : item
        )
      );
    });

    sse.addEventListener('image_completed', (e) => {
      const data = JSON.parse(e.data);
      setImages((prev) =>
        prev.map((item) =>
          item.name === data.filename
            ? {
                ...item,
                status: 'completed',
                progress: 100,
                result: data.result,
              }
            : item
        )
      );

      setGlobalProgress((prev) => ({
        ...prev,
        processedCount: data.processedCount,
        successCount: data.successCount,
        failedCount: data.failedCount,
        globalProgressPercent: data.globalProgressPercent,
        totalOptimizedBytes: prev.totalOptimizedBytes + (data.result?.optimizedSize || 0),
      }));
    });

    sse.addEventListener('image_failed', (e) => {
      const data = JSON.parse(e.data);
      setImages((prev) =>
        prev.map((item) =>
          item.name === data.filename
            ? {
                ...item,
                status: 'failed',
                progress: 100,
                error: data.error,
              }
            : item
        )
      );

      setGlobalProgress((prev) => ({
        ...prev,
        processedCount: data.processedCount,
        successCount: data.successCount,
        failedCount: data.failedCount,
        globalProgressPercent: data.globalProgressPercent,
      }));
    });

    sse.addEventListener('processing_completed', (e) => {
      const data = JSON.parse(e.data);
      setIsProcessing(false);
      setResultsSummary(data);
      sse.close();
      eventSourceRef.current = null;
    });

    sse.onerror = () => {
      pollJobStatus(jobId);
    };
  };

  const pollJobStatus = async (jobId) => {
    try {
      const res = await fetch(`/api/process/${jobId}/status`);
      if (res.ok) {
        const summary = await res.json();
        if (summary.status === 'completed') {
          setIsProcessing(false);
          setResultsSummary(summary);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-16">
      <Header onOpenOutputFolder={() => setShowFolderViewer(true)} />

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        {globalError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-rose-500 hover:text-rose-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <ImageDropzone
          onFilesSelected={handleFilesSelected}
          isProcessing={isProcessing}
          totalFiles={images.length}
        />

        <ProcessingControls
          targetWidth={targetWidth}
          setTargetWidth={setTargetWidth}
          outputDir={outputDir}
          setOutputDir={setOutputDir}
          onCompress={handleCompress}
          onClear={handleClearBatch}
          isProcessing={isProcessing}
          totalImages={images.length}
          completedImages={globalProgress.processedCount}
        />

        {(isProcessing || globalProgress.processedCount > 0) && (
          <ProgressBar
            totalCount={globalProgress.totalCount}
            processedCount={globalProgress.processedCount}
            globalProgressPercent={globalProgress.globalProgressPercent}
            isProcessing={isProcessing}
          />
        )}

        {resultsSummary && (
          <ResultsSummary
            summary={resultsSummary}
            onOpenFolderViewer={() => setShowFolderViewer(true)}
          />
        )}

        {images.length > 0 && (
          <ImageList
            images={images}
            onRemoveImage={handleRemoveImage}
            isProcessing={isProcessing}
            targetWidth={targetWidth}
          />
        )}
      </main>

      <OutputFolderViewer
        isOpen={showFolderViewer}
        onClose={() => setShowFolderViewer(false)}
        outputDir={outputDir}
      />
    </div>
  );
}
