import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import uploadRouter from './routes/upload';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Rate limiter for upload/delete endpoints: max 60 requests per minute per IP
  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Upload / update / delete routes (rate limited)
  app.use('/upload', uploadLimiter, uploadRouter);

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
