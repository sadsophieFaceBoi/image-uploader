import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiSecret) {
    res.status(500).json({ error: 'Server misconfiguration: API_SECRET is not set' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  // Use constant-time comparison to prevent timing attacks
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(config.apiSecret);
  const lengthsMatch = tokenBuf.length === secretBuf.length;
  // Always compare buffers of equal length to keep timing consistent
  const paddedToken = Buffer.concat([tokenBuf, Buffer.alloc(Math.max(0, secretBuf.length - tokenBuf.length))]);
  const paddedSecret = Buffer.concat([secretBuf, Buffer.alloc(Math.max(0, tokenBuf.length - secretBuf.length))]);
  const tokensMatch = crypto.timingSafeEqual(paddedToken, paddedSecret);

  if (!lengthsMatch || !tokensMatch) {
    res.status(403).json({ error: 'Forbidden: invalid token' });
    return;
  }

  next();
}
