import express from 'express';
import app from './api/app.ts';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Ensure unmatched or unhandled /api requests return JSON, not Vite's SPA index.html
    app.use('/api', (req, res) => {
      res.status(404).json({
        error: `API rotası bulunamadı: ${req.method} ${req.originalUrl || req.url}`,
      });
    });
    app.use(vite.middlewares);
  } else {
    app.use('/api', (req, res) => {
      res.status(404).json({
        error: `API rotası bulunamadı: ${req.method} ${req.originalUrl || req.url}`,
      });
    });
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TestMatrix AI] Server listening at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
