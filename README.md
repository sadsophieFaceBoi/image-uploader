# image-uploader

A production-ready TypeScript image upload API that runs in a Docker container with a mounted file path.

## Features

- Upload images to named folders on the server
- Returns a public image URL after upload
- Replace existing images (PUT)
- Delete images (DELETE)
- Write / update / delete routes protected by a bearer token secret
- Static file serving for uploaded images
- Docker Compose with mounted volume and environment-based configuration

## API

All protected routes require an `Authorization: Bearer <API_SECRET>` header.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/upload/:folder` | ✅ Yes | Upload an image; returns `{ url, filename, folder }` |
| `PUT` | `/upload/:folder/:filename` | ✅ Yes | Replace an image; returns `{ url, filename, folder }` |
| `DELETE` | `/upload/:folder/:filename` | ✅ Yes | Delete an image |
| `GET` | `/images/:folder/:filename` | No | Serve an uploaded image |

### Upload an image

```bash
curl -X POST https://your-server/upload/photos \
  -H "Authorization: Bearer $API_SECRET" \
  -F "image=@/path/to/photo.jpg"
```

Response:
```json
{
  "url": "https://your-server/images/photos/550e8400-e29b-41d4-a716-446655440000.jpg",
  "filename": "550e8400-e29b-41d4-a716-446655440000.jpg",
  "folder": "photos"
}
```

### Delete an image

```bash
curl -X DELETE https://your-server/upload/photos/550e8400-e29b-41d4-a716-446655440000.jpg \
  -H "Authorization: Bearer $API_SECRET"
```

## Running with Docker Compose

1. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

2. Edit `.env`:

```env
API_SECRET=your-strong-random-secret   # e.g. openssl rand -hex 32
BASE_URL=https://images.example.com
UPLOADS_PATH=/data/images              # host path to store images
HOST_PORT=3000
MAX_FILE_SIZE_MB=10
```

3. Start the service:

```bash
docker compose up -d
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_SECRET` | ✅ Yes | – | Bearer token for protected routes (set via GitHub secret) |
| `BASE_URL` | No | `http://localhost:3000` | Public base URL prepended to returned image URLs |
| `UPLOADS_PATH` | No | `./uploads` | Host directory mounted into the container |
| `HOST_PORT` | No | `3000` | Host port the container is exposed on |
| `MAX_FILE_SIZE_MB` | No | `10` | Maximum upload size in megabytes |
| `PORT` | No | `3000` | Port the app listens on inside the container |
| `UPLOAD_DIR` | No | `/uploads` | Path inside the container where files are stored |

## Development

```bash
npm install
npm run dev      # ts-node-dev watch mode
npm run build    # compile TypeScript
npm run lint     # ESLint
npm test         # Jest
```

## Supported image types

`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `image/bmp`, `image/tiff`
