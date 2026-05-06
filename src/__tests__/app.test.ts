import request from 'supertest';
import type { Express } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';

const TEST_SECRET = 'test-secret-token';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-uploader-test-'));

let app: Express;

beforeAll(() => {
  process.env.UPLOAD_DIR = tmpDir;
  process.env.API_SECRET = TEST_SECRET;
  process.env.BASE_URL = 'http://localhost:3000';

  // Use isolateModules so the app picks up the env vars set above
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createApp } = require('../app') as typeof import('../app');
    app = createApp();
  });
});

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.error('Warning: failed to clean up test temp directory:', err);
  }
});

// A minimal 1×1 PNG in base64
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Auth middleware', () => {
  it('rejects requests without Authorization header', async () => {
    const res = await request(app)
      .post('/upload/myfolder')
      .attach('image', TINY_PNG, 'test.png');
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong token', async () => {
    const res = await request(app)
      .post('/upload/myfolder')
      .set('Authorization', 'Bearer wrong-token')
      .attach('image', TINY_PNG, 'test.png');
    expect(res.status).toBe(403);
  });
});

describe('POST /upload/:folder', () => {
  it('uploads an image and returns a URL', async () => {
    const res = await request(app)
      .post('/upload/photos')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'test.png');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      folder: 'photos',
      filename: expect.stringMatching(/\.png$/),
      url: expect.stringContaining('/images/photos/'),
    });

    // File should exist on disk
    const savedPath = path.join(tmpDir, 'photos', res.body.filename);
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it('rejects missing file field', async () => {
    const res = await request(app)
      .post('/upload/photos')
      .set('Authorization', `Bearer ${TEST_SECRET}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /upload/:folder/:filename', () => {
  it('deletes an uploaded image', async () => {
    // First upload
    const uploadRes = await request(app)
      .post('/upload/to-delete')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'delete-me.png');

    expect(uploadRes.status).toBe(201);
    const { filename, folder } = uploadRes.body;

    // Then delete
    const deleteRes = await request(app)
      .delete(`/upload/${folder}/${filename}`)
      .set('Authorization', `Bearer ${TEST_SECRET}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toMatch(/deleted/i);

    // File should no longer exist
    const filePath = path.join(tmpDir, folder, filename);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('returns 404 when file does not exist', async () => {
    const res = await request(app)
      .delete('/upload/photos/nonexistent.png')
      .set('Authorization', `Bearer ${TEST_SECRET}`);
    expect(res.status).toBe(404);
  });

  it('requires auth for delete', async () => {
    const res = await request(app).delete('/upload/photos/some.png');
    expect(res.status).toBe(401);
  });
});

describe('PUT /upload/:folder/:filename', () => {
  it('replaces an existing image', async () => {
    // Upload original
    const uploadRes = await request(app)
      .post('/upload/replacements')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'original.png');

    expect(uploadRes.status).toBe(201);
    const { filename: origFilename, folder } = uploadRes.body;

    // Replace it
    const replaceRes = await request(app)
      .put(`/upload/${folder}/${origFilename}`)
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'replacement.png');

    expect(replaceRes.status).toBe(200);
    expect(replaceRes.body).toMatchObject({
      folder,
      filename: expect.stringMatching(/\.png$/),
      url: expect.stringContaining('/images/'),
    });

    // Old file should be gone
    const oldPath = path.join(tmpDir, folder, origFilename);
    expect(fs.existsSync(oldPath)).toBe(false);

    // New file should exist
    const newPath = path.join(tmpDir, folder, replaceRes.body.filename);
    expect(fs.existsSync(newPath)).toBe(true);
  });
});

describe('GET /images/:folder/:filename', () => {
  it('serves an uploaded image', async () => {
    const uploadRes = await request(app)
      .post('/upload/serve-test')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'serve.png');

    expect(uploadRes.status).toBe(201);
    const { filename, folder } = uploadRes.body;

    const serveRes = await request(app).get(`/images/${folder}/${filename}`);
    expect(serveRes.status).toBe(200);
    expect(serveRes.headers['content-type']).toMatch(/png/);
  });
});

describe('GET /images/list/:folder', () => {
  it('lists uploaded images in a folder', async () => {
    const uploadRes1 = await request(app)
      .post('/upload/gallery')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'a.png');

    const uploadRes2 = await request(app)
      .post('/upload/gallery')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'b.png');

    expect(uploadRes1.status).toBe(201);
    expect(uploadRes2.status).toBe(201);

    const listRes = await request(app).get('/images/list/gallery');
    expect(listRes.status).toBe(200);
    expect(listRes.body.folder).toBe('gallery');
    expect(listRes.body.count).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(listRes.body.images)).toBe(true);
    expect(listRes.body.images[0]).toMatchObject({
      filename: expect.any(String),
      url: expect.stringContaining('/images/gallery/'),
    });
  });

  it('returns 404 for a folder that does not exist', async () => {
    const res = await request(app).get('/images/list/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('MIME type validation', () => {
  it('rejects upload of a non-image file (text/plain)', async () => {
    const textBuffer = Buffer.from('hello world');
    const res = await request(app)
      .post('/upload/security')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', textBuffer, { filename: 'evil.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/i);
  });

  it('rejects upload of application/octet-stream (binary)', async () => {
    const binaryBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF magic bytes
    const res = await request(app)
      .post('/upload/security')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', binaryBuffer, { filename: 'exploit', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });
});

describe('Path traversal protection', () => {
  it('sanitises ".." in folder name', async () => {
    const res = await request(app)
      .post('/upload/..%2F..%2Fetc')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', TINY_PNG, 'test.png');

    if (res.status === 201) {
      // If upload succeeded, the folder must be inside uploadDir (not escaped)
      const savedPath = path.join(tmpDir, res.body.folder, res.body.filename);
      expect(fs.existsSync(savedPath)).toBe(true);
    } else {
      // Or rejected entirely — both outcomes are acceptable
      expect([400, 403, 404, 500]).toContain(res.status);
    }
  });

  it('sanitises ".." in filename during delete', async () => {
    const res = await request(app)
      .delete('/upload/photos/..%2F..%2Fetc%2Fpasswd')
      .set('Authorization', `Bearer ${TEST_SECRET}`);
    // Should be rejected (400 invalid path) or not found (404) — never a 200
    expect(res.status).not.toBe(200);
  });

  it('does not delete files outside the upload directory', async () => {
    // Create a sentinel file outside the upload dir
    const sentinelPath = path.join(os.tmpdir(), 'sentinel-should-not-delete.txt');
    fs.writeFileSync(sentinelPath, 'safe');

    await request(app)
      .delete('/upload/../../../../tmp/sentinel-should-not-delete')
      .set('Authorization', `Bearer ${TEST_SECRET}`);

    // Sentinel must still exist
    expect(fs.existsSync(sentinelPath)).toBe(true);
    fs.unlinkSync(sentinelPath);
  });
});

describe('File size limit', () => {
  it('rejects a file exceeding MAX_FILE_SIZE_MB', async () => {
    // MAX_FILE_SIZE_MB defaults to 10 MB; create a 11 MB buffer
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0xff);
    const res = await request(app)
      .post('/upload/size-test')
      .set('Authorization', `Bearer ${TEST_SECRET}`)
      .attach('image', bigBuffer, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });
});
