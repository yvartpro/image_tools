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

  // POST /api/generate-samples - Helper to create a few high-res demo images for instant testing
  app.post('/api/generate-samples', async (req, res) => {
    try {
      const sampleDir = path.resolve(baseDir, 'samples');
      fileService.ensureDirectoryExists(sampleDir);

      // Generate 3 sample images with sharp (different resolutions)
      const samples = [
        {
          name: 'nature-landscape-1920x1080.png',
          width: 1920,
          height: 1080,
          svg: `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e3a8a"/>
                <stop offset="50%" stop-color="#0284c7"/>
                <stop offset="100%" stop-color="#38bdf8"/>
              </linearGradient>
            </defs>
            <rect width="1920" height="1080" fill="url(#g1)"/>
            <circle cx="960" cy="540" r="300" fill="#f59e0b" opacity="0.8"/>
            <text x="960" y="560" font-size="72" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">Nature Landscape (1920x1080)</text>
          </svg>`,
        },
        {
          name: 'product-photo-1400x900.jpg',
          width: 1400,
          height: 900,
          svg: `<svg width="1400" height="900" xmlns="http://www.w3.org/2000/svg">
            <rect width="1400" height="900" fill="#0f172a"/>
            <rect x="200" y="150" width="1000" height="600" rx="40" fill="#334155"/>
            <text x="700" y="470" font-size="54" font-family="sans-serif" font-weight="bold" fill="#38bdf8" text-anchor="middle">Studio Product Showcase (1400x900)</text>
          </svg>`,
        },
        {
          name: 'small-icon-480x320.png',
          width: 480,
          height: 320,
          svg: `<svg width="480" height="320" xmlns="http://www.w3.org/2000/svg">
            <rect width="480" height="320" fill="#15803d"/>
            <text x="240" y="170" font-size="28" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">Small Asset (480x320)</text>
          </svg>`,
        },
      ];

      const sampleFiles = [];
      for (const sample of samples) {
        const filePath = path.join(sampleDir, sample.name);
        const buffer = await (await import('sharp')).default(Buffer.from(sample.svg))
          [sample.name.endsWith('.jpg') ? 'jpeg' : 'png']({ quality: 95 })
          .toBuffer();
        await fs.promises.writeFile(filePath, buffer);
        sampleFiles.push({
          name: sample.name,
          size: buffer.length,
          dataUrl: `data:image/${sample.name.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${buffer.toString('base64')}`,
        });
      }

      res.json({ samples: sampleFiles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return { fileService, imageProcessor, activeJobs };
}
