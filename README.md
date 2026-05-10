# image-uploader

A production-ready TypeScript image upload API that runs in a Docker container with a mounted file path.
The actual url used in real life is https://bartsthriftstores.ie/media/products/images
the images are stored in /home/ubuntu/bartsthriftstores/images
Host port is 8008 hehe
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
| `GET` | `/images/list/:folder` | No | List image files in a folder |
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
PUBLIC_IMAGES_PATH=/images
UPLOADS_PATH=/data/images              # host path to store images
PUID=1000                              # Linux user id to own mounted uploads
PGID=1000                              # Linux group id to own mounted uploads
HOST_PORT=3000
MAX_FILE_SIZE_MB=10
```

3. Start the service:

```bash
docker compose up -d
```

## Environment variables

The app automatically loads variables from a local `.env` file.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_SECRET` | ✅ Yes | – | Bearer token for protected routes (set via GitHub secret) |
| `BASE_URL` | No | `http://localhost:3000` | Public base URL prepended to returned image URLs |
| `PUBLIC_IMAGES_PATH` | No | `/images` | Public path prefix used when building returned image URLs |
| `UPLOADS_PATH` | No | `./uploads` | Fallback local upload path and Docker host directory for volume mapping |
| `PUID` | No | `1000` | UID used by the container and init job to own the mounted upload path |
| `PGID` | No | `1000` | GID used by the container and init job to own the mounted upload path |
| `HOST_PORT` | No | `3000` | Host port the container is exposed on |
| `MAX_FILE_SIZE_MB` | No | `10` | Maximum upload size in megabytes |
| `PORT` | No | `3000` | Port the app listens on inside the container |
| `UPLOAD_DIR` | No | `/uploads` | Primary upload path used by the API (supports local or container path) |

## Stable deploy permissions

This project includes a dedicated `init-upload-permissions` service in `docker-compose.yml`.
On every deploy it:

- creates the mounted upload path if needed,
- sets ownership to `PUID:PGID`,
- enforces directory mode `775` and file mode `664`.

The main `image-uploader` service then runs as the same `PUID:PGID` so uploads remain writable across redeploys and host reboots.

Example production values:

```env
UPLOADS_PATH=/home/ubuntu/bartsthriftstores/images
PUID=1000
PGID=1000
HOST_PORT=8008
```

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
