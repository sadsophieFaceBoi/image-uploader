export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  uploadDir: process.env.UPLOAD_DIR ?? '/uploads',
  baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  apiSecret: process.env.API_SECRET ?? '',
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024,
};
