import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * ProcessingJob manages a bulk image compression task, executes conversions,
 * isolates individual image failures, and streams real-time updates over SSE.
 */
export class ProcessingJob extends EventEmitter {
  constructor({ id, items, targetWidth, outputDir, quality, imageProcessor }) {
    super();
    this.id = id || crypto.randomUUID();
    this.imageProcessor = imageProcessor;
    this.targetWidth = parseInt(targetWidth, 10) || 720;
    this.outputDir = outputDir;
    this.quality = parseInt(quality, 10) || 80;
    this.status = 'idle'; // 'idle' | 'processing' | 'completed' | 'failed'
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;

    this.items = items.map((file, index) => ({
      id: `img-${index}-${Date.now()}`,
      originalFilename: file.originalname || file.name || `image-${index}`,
      originalSize: file.size || (file.buffer ? file.buffer.length : 0),
      buffer: file.buffer,
      status: 'waiting', // 'waiting' | 'processing' | 'completed' | 'failed'
      progress: 0,
      statusText: 'Waiting',
      result: null,
      error: null,
    }));

    this.totalCount = this.items.length;
    this.processedCount = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.clients = new Set();
    this.isProcessing = false;
  }

  /**
   * Registers a client response stream for Server-Sent Events.
   */
  addClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });

    // Send immediate snapshot of current job state
    this.sendSseEvent(res, 'job_snapshot', this.getSummary());
  }

  /**
   * Broadcasts an event to all connected SSE clients.
   */
  broadcast(eventType, data) {
    const payload = JSON.stringify(data);
    for (const res of this.clients) {
      this.sendSseEvent(res, eventType, data);
    }
    this.emit(eventType, data);
  }

  sendSseEvent(res, eventType, data) {
    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.clients.delete(res);
    }
  }

  /**
   * Serializes current job state for client consumption (excluding heavy raw buffers).
   */
  getSummary() {
    const totalOriginalBytes = this.items.reduce((sum, item) => sum + (item.originalSize || 0), 0);
    const totalOptimizedBytes = this.items.reduce((sum, item) => sum + (item.result ? item.result.optimizedSize : 0), 0);
    const globalProgressPercent = this.totalCount > 0 ? Math.round((this.processedCount / this.totalCount) * 100) : 0;

    return {
      id: this.id,
      status: this.status,
      targetWidth: this.targetWidth,
      outputDir: this.outputDir,
      quality: this.quality,
      totalCount: this.totalCount,
      processedCount: this.processedCount,
      successCount: this.successCount,
      failedCount: this.failedCount,
      globalProgressPercent,
      totalOriginalBytes,
      totalOptimizedBytes,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      items: this.items.map(item => ({
        id: item.id,
        originalFilename: item.originalFilename,
        originalSize: item.originalSize,
        status: item.status,
        progress: item.progress,
        statusText: item.statusText,
        result: item.result,
        error: item.error,
      })),
    };
  }

  /**
   * Starts bulk image processing with controlled concurrency.
   */
  async start() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.status = 'processing';
    this.startedAt = Date.now();

    this.broadcast('processing_started', {
      jobId: this.id,
      totalCount: this.totalCount,
      targetWidth: this.targetWidth,
      outputDir: this.outputDir,
      items: this.getSummary().items,
    });

    // Concurrency limit: process 2 images at a time for optimal CPU/memory balance
    const concurrency = Math.min(3, this.items.length) || 1;
    let index = 0;

    const worker = async () => {
      while (index < this.items.length) {
        const currentIndex = index++;
        const item = this.items[currentIndex];
        await this.processSingleItem(item);
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    this.status = 'completed';
    this.completedAt = Date.now();
    this.isProcessing = false;

    const summary = this.getSummary();
    const totalSavedBytes = Math.max(0, summary.totalOriginalBytes - summary.totalOptimizedBytes);
    const totalSavedPercent = summary.totalOriginalBytes > 0
      ? Math.round((totalSavedBytes / summary.totalOriginalBytes) * 100)
      : 0;

    this.broadcast('processing_completed', {
      ...summary,
      totalSavedBytes,
      totalSavedPercent,
      totalDurationMs: this.completedAt - this.startedAt,
    });
  }

  /**
   * Processes a single item in the batch with complete error isolation.
   */
  async processSingleItem(item) {
    item.status = 'processing';
    item.progress = 10;
    item.statusText = 'Starting...';

    this.broadcast('image_started', {
      jobId: this.id,
      itemId: item.id,
      filename: item.originalFilename,
      progress: 10,
    });

    try {
      if (!item.buffer || item.buffer.length === 0) {
        throw new Error('Image data buffer is empty or corrupt.');
      }

      const onProgress = (percent, text) => {
        item.progress = percent;
        item.statusText = text;
        this.broadcast('image_progress', {
          jobId: this.id,
          itemId: item.id,
          filename: item.originalFilename,
          progress: percent,
          statusText: text,
        });
      };

      const result = await this.imageProcessor.processImage({
        buffer: item.buffer,
        originalFilename: item.originalFilename,
        targetWidth: this.targetWidth,
        outputDir: this.outputDir,
        quality: this.quality,
        onProgress,
      });

      // Free the raw buffer from memory now that processing is done
      item.buffer = null;
      item.status = 'completed';
      item.progress = 100;
      item.statusText = 'Done';
      item.result = result;

      this.processedCount += 1;
      this.successCount += 1;

      const globalProgressPercent = Math.round((this.processedCount / this.totalCount) * 100);

      this.broadcast('image_completed', {
        jobId: this.id,
        itemId: item.id,
        filename: item.originalFilename,
        result,
        processedCount: this.processedCount,
        successCount: this.successCount,
        failedCount: this.failedCount,
        totalCount: this.totalCount,
        globalProgressPercent,
      });
    } catch (error) {
      // Free buffer on error too
      item.buffer = null;
      item.status = 'failed';
      item.progress = 100;
      item.statusText = 'Failed';
      item.error = error.message || 'Processing failed';

      this.processedCount += 1;
      this.failedCount += 1;

      const globalProgressPercent = Math.round((this.processedCount / this.totalCount) * 100);

      this.broadcast('image_failed', {
        jobId: this.id,
        itemId: item.id,
        filename: item.originalFilename,
        error: item.error,
        processedCount: this.processedCount,
        successCount: this.successCount,
        failedCount: this.failedCount,
        totalCount: this.totalCount,
        globalProgressPercent,
      });
    }
  }
}
