import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { FileService } from './FileService.js';
import { ImageProcessor } from './ImageProcessor.js';
import { ProcessingJob } from './ProcessingJob.js';

export function setupApiRoutes(app, baseDir = process.cwd()) {
  const fileService = new FileService(baseDir);
  const imageProcessor = new ImageProcessor(fileService);
  const activeJobs = new Map();

  // Configure Multer for memory storage (max 150 files, 50MB per file)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 150,
    },
  });

  // GET /api/config - Returns presets and configuration
  app.get('/api/config', (req, res) => {
    res.json({
      defaultOutputDir: './images',
      presets: [1024, 720, 540, 360],
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'avif', 'svg'],
      qualityDefault: 80,
    });
  });

  // POST /api/process - Initiates a bulk compression job
  app.post('/api/process', upload.array('images', 150), (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided. Please select at least one image.' });
      }

      const targetWidth = parseInt(req.body.targetWidth, 10);
      if (isNaN(targetWidth) || targetWidth <= 0) {
        return res.status(400).json({ error: 'Invalid target resolution width. Must be a positive number.' });
      }

      const requestedOutputDir = req.body.outputDir || './images';
      const outputDir = fileService.resolveSafeOutputDir(requestedOutputDir);
      fileService.ensureDirectoryExists(outputDir);

      const quality = parseInt(req.body.quality, 10) || 80;

      const job = new ProcessingJob({
        items: files,
        targetWidth,
        outputDir,
        quality,
        imageProcessor,
      });

      activeJobs.set(job.id, job);

      // Clean up memory after 1 hour
      setTimeout(() => {
        activeJobs.delete(job.id);
      }, 3600 * 1000);

      // Start processing immediately in background
      job.start().catch((err) => {
        console.error(`[Job ${job.id}] Error during processing:`, err);
      });

      res.status(202).json({
        jobId: job.id,
        totalCount: job.totalCount,
        targetWidth: job.targetWidth,
        outputDir: job.outputDir,
        status: job.status,
      });
    } catch (error) {
      console.error('Error starting processing job:', error);
      res.status(500).json({ error: error.message || 'Internal server error while starting compression.' });
    }
  });

  // GET /api/process/:id/events - Server-Sent Events stream for live progress
  app.get('/api/process/:id/events', (req, res) => {
    const job = activeJobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Processing job not found.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    job.addClient(res);

    // Keep-alive heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  // GET /api/process/:id/status - Snapshot status check
  app.get('/api/process/:id/status', (req, res) => {
    const job = activeJobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Processing job not found.' });
    }
    res.json(job.getSummary());
  });

  // GET /api/output-files - List generated WebP files in output folder
  app.get('/api/output-files', (req, res) => {
    try {
      const requestedDir = req.query.outputDir || './images';
      const outputDir = fileService.resolveSafeOutputDir(requestedDir);
      const files = fileService.listOutputFiles(outputDir);
      res.json({ outputDir, files });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to list output files' });
    }
  });

  // GET /api/images/:filename - Serve generated WebP image from output directory
  app.get('/api/images/:filename', (req, res) => {
    try {
      const requestedDir = req.query.outputDir || './images';
      const outputDir = fileService.resolveSafeOutputDir(requestedDir);
      const filePath = fileService.getSafeFilePath(outputDir, req.params.filename);

      if (!filePath) {
        return res.status(404).send('Image file not found.');
      }

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.status(500).send('Error reading image: ' + error.message);
    }
  });

  return { fileService, imageProcessor, activeJobs };
}
