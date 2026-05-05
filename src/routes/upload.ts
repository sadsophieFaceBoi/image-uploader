import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
]);

/** Resolve and validate that the target path stays within the upload root. */
function resolveUploadPath(...parts: string[]): string {
  const resolved = path.resolve(config.uploadDir, ...parts);
  const root = path.resolve(config.uploadDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}

/** Sanitise a user-supplied folder or filename segment. */
function sanitiseSegment(segment: string): string {
  // Keep only safe characters, then collapse any remaining consecutive dots to one
  const cleaned = segment.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Disallow '..': collapse multiple dots into a single dot
  return cleaned.replace(/\.{2,}/g, '.').replace(/^\.+/, '');
}

function buildStorage(folder: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = resolveUploadPath(folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${uuidv4()}${ext}`;
      cb(null, name);
    },
  });
}

function buildMulter(folder: string) {
  return multer({
    storage: buildStorage(folder),
    limits: { fileSize: config.maxFileSizeBytes },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    },
  });
}

/**
 * POST /upload/:folder
 * Upload an image to the specified folder.
 * Requires bearer token.
 * Returns: { url: string, filename: string }
 */
router.post('/:folder', requireAuth, (req: Request, res: Response) => {
  const folder = sanitiseSegment(req.params.folder);

  const upload = buildMulter(folder);

  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use the "image" field.' });
      return;
    }
    const url = `${config.baseUrl}/images/${folder}/${req.file.filename}`;
    res.status(201).json({ url, filename: req.file.filename, folder });
  });
});

/**
 * PUT /upload/:folder/:filename
 * Replace an existing image with a new upload.
 * The old file is deleted before the new one is stored.
 * Requires bearer token.
 * Returns: { url: string, filename: string }
 */
router.put('/:folder/:filename', requireAuth, (req: Request, res: Response) => {
  const folder = sanitiseSegment(req.params.folder);
  const oldFilename = sanitiseSegment(req.params.filename);

  const upload = buildMulter(folder);

  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use the "image" field.' });
      return;
    }

    // Delete the old file if it exists
    try {
      const oldPath = resolveUploadPath(folder, oldFilename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    } catch {
      // Non-fatal: proceed even if old file cannot be removed
    }

    const url = `${config.baseUrl}/images/${folder}/${req.file.filename}`;
    res.status(200).json({ url, filename: req.file.filename, folder });
  });
});

/**
 * DELETE /upload/:folder/:filename
 * Delete an image.
 * Requires bearer token.
 */
router.delete('/:folder/:filename', requireAuth, (req: Request, res: Response) => {
  const folder = sanitiseSegment(req.params.folder);
  const filename = sanitiseSegment(req.params.filename);

  try {
    const filePath = resolveUploadPath(folder, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    fs.unlinkSync(filePath);
    res.status(200).json({ message: 'File deleted successfully', filename, folder });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Path traversal attempt detected') {
      res.status(400).json({ error: 'Invalid path' });
    } else {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
});

export default router;
