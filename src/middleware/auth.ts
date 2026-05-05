import { Request, Response, NextFunction } from 'express';
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
  if (token !== config.apiSecret) {
    res.status(403).json({ error: 'Forbidden: invalid token' });
    return;
  }

  next();
}
