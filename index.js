import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupApiRoutes } from './app/server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const HOST = '0.0.0.0';

// Ensure default images directory exists
const defaultImagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(defaultImagesDir)) {
  fs.mkdirSync(defaultImagesDir, { recursive: true });
}

async function startServer() {
  const app = express();

  // Basic request logging in dev
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API ${req.method}] ${req.url}`);
    }
    next();
  });

  // Setup JSON and urlencoded parsers for non-multipart requests
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Mount API & image processing routes FIRST
  setupApiRoutes(app, __dirname);

  // 2. Setup frontend serving (Vite in development, dist in production)
  const isProduction = process.env.NODE_ENV === 'production';
  const distDir = path.join(__dirname, 'dist');

  if (isProduction && fs.existsSync(distDir)) {
    console.log('[App] Running in production mode, serving built assets from dist/');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.log('[App] Running in development mode with Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const { default: viteConfig } = await import('./vite.js');

    const vite = await createViteServer({
      ...viteConfig,
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`  Local Image Compression Tool running at http://${HOST}:${PORT}`);
    console.log(`  Images destination folder: ./images`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
