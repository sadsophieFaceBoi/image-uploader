import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import uploadRouter from './routes/upload';
import imagesRouter from './routes/images';

export function createApp() {
  const app = express();
  const publicDir = path.resolve(__dirname, '..', 'public');
  const testerHtml = path.join(publicDir, 'index.html');

  app.use(express.json());
  app.use('/tester', express.static(publicDir, { redirect: false }));

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

  app.get('/', (_req, res) => {
    res.redirect('/tester');
  });

  app.get('/tester', (_req, res) => {
    res.sendFile(testerHtml);
  });

  // Upload / update / delete routes (rate limited)
  app.use('/upload', uploadLimiter, uploadRouter);

  // Serve uploaded images via explicit API route
  app.use('/images', imagesRouter);

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
