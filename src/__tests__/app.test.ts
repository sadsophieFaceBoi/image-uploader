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
  fs.rmSync(tmpDir, { recursive: true, force: true });
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
