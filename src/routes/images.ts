import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const router = Router();

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.tif',
  '.tiff',
]);

function sanitiseSegment(segment: string): string {
  const cleaned = segment.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.replace(/\.{2,}/g, '.').replace(/^\.+/, '');
}

function resolveImagePath(imagePath: string): string {
  const root = path.resolve(config.uploadDir);

  // Normalize to prevent traversal and strip any leading slash.
  const normalized = path.normalize(imagePath).replace(/^([/\\])+/, '');

  if (!normalized || normalized.startsWith('..') || path.isAbsolute(imagePath)) {
    throw new Error('Invalid path');
  }

  // Match express.static behavior of denying dotfiles.
  const segments = normalized.split(path.sep);
  if (segments.some((segment) => segment.startsWith('.'))) {
    throw new Error('Invalid path');
  }

  const fullPath = path.resolve(root, normalized);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error('Invalid path');
  }

  return fullPath;
}

function resolveFolderPath(folder: string): string {
  const root = path.resolve(config.uploadDir);
  const safeFolder = sanitiseSegment(folder);

  if (!safeFolder) {
    throw new Error('Invalid path');
  }

  const fullPath = path.resolve(root, safeFolder);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error('Invalid path');
  }

  return fullPath;
}

/**
 * GET /images/list/:folder
 * Lists image files from a folder under the upload directory.
 */
router.get('/list/:folder', (req: Request, res: Response) => {
  try {
    const folder = sanitiseSegment(req.params.folder);
    const folderPath = resolveFolderPath(folder);

    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    const images = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((filename) => ({
        filename,
        url: `${config.baseUrl}${config.publicImagesPath}/${folder}/${filename}`,
      }));

    res.status(200).json({ folder, count: images.length, images });
  } catch {
    res.status(400).json({ error: 'Invalid folder path' });
  }
});

/**
 * GET /images/*
 * Serves an uploaded image from the configured upload directory.
 * Examples:
 * - /images/a.jpg
 * - /images/folder/a.jpg
 */
router.get('/*', (req: Request, res: Response) => {
  const imagePath = req.params[0];

  if (!imagePath) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const filePath = resolveImagePath(imagePath);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.sendFile(filePath);
  } catch {
    res.status(400).json({ error: 'Invalid image path' });
  }
});

export default router;
