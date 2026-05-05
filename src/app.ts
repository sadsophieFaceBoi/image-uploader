import express from 'express';
import path from 'path';
import { config } from './config';
import uploadRouter from './routes/upload';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Upload / update / delete routes
  app.use('/upload', uploadRouter);

  // Serve uploaded images statically
  app.use('/images', express.static(path.resolve(config.uploadDir), {
    index: false,
    dotfiles: 'deny',
  }));

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
