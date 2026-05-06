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
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(config.apiSecret);

  // Lengths must match before calling timingSafeEqual (which requires equal-length buffers).
  // Returning early on a length mismatch leaks some timing info, but this is unavoidable
  // without a fixed-length token scheme and is standard practice.
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    res.status(403).json({ error: 'Forbidden: invalid token' });
    return;
  }

  next();
}
