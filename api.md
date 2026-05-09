# Image Uploader API Reference

This document is the authoritative API contract for clients (including AI agents) consuming this service.

## 1) Overview

- Service purpose: upload, replace, delete, list, and serve image files.
- API style: JSON over HTTP for metadata operations, binary file response for image serving.
- Auth model: Bearer token on write routes only.
- Runtime framework: Express.

## 2) Base URL and URL Construction

Use your deployed server origin as base URL, for example:

- `http://localhost:3000` (local)
- `https://your-domain.com` (production)

Returned image URLs are constructed as:

`{BASE_URL}{PUBLIC_IMAGES_PATH}/{folder}/{filename}`

Defaults:
- `BASE_URL`: `http://localhost:3000`
- `PUBLIC_IMAGES_PATH`: `/images`

So by default a returned URL looks like:
- `http://localhost:3000/images/my-folder/my-file.png`

## 3) Authentication

### Header

Protected routes require:

`Authorization: Bearer <API_SECRET>`

### Protected routes

- `POST /upload/:folder`
- `PUT /upload/:folder/:filename`
- `DELETE /upload/:folder/:filename`

### Auth errors

- `401` when header is missing or malformed:
  - `{"error":"Unauthorized: missing or malformed Authorization header"}`
- `403` when token is wrong:
  - `{"error":"Forbidden: invalid token"}`
- `500` when server is misconfigured (no API secret set):
  - `{"error":"Server misconfiguration: API_SECRET is not set"}`

## 4) Rate Limiting

Routes under `/upload` are rate-limited:

- Window: 60 seconds
- Limit: 60 requests per IP
- On limit exceeded:
  - status: `429`
  - body: `{"error":"Too many requests, please try again later."}`

## 5) File and Path Rules

### 5.1 Allowed upload MIME types

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `image/svg+xml`
- `image/bmp`
- `image/tiff`

If MIME type is unsupported:
- `400` with `{"error":"Unsupported file type: <mime>"}`.

### 5.2 Upload field name

Multipart form field name must be exactly:
- `image`

If missing:
- `400` with `{"error":"No file uploaded. Use the \"image\" field."}`

### 5.3 Max file size

Configured by `MAX_FILE_SIZE_MB` (default `10` MB).

Oversized files return `400` (multer validation error).

### 5.4 Folder and filename sanitization

User-provided path segments (`:folder`, `:filename`) are sanitized before use:

- Any char not matching `[a-zA-Z0-9._-]` becomes `_`
- Consecutive dots are collapsed (`..` -> `.`)
- Leading dots are removed

This means input may be transformed. Clients should always trust returned `folder`/`filename` values over requested ones.

## 6) Endpoints

### 6.1 Health Check

#### `GET /health`

No auth required.

#### Success
- `200`
- `{"status":"ok"}`

---

### 6.2 Upload Image

#### `POST /upload/:folder`

Protected route.

#### Path params
- `folder` (string): target folder under upload root (sanitized).

#### Request
- Content-Type: `multipart/form-data`
- Field: `image` (file)

#### Success
- `201`
- Body:
```json
{
  "url": "https://example.com/images/photos/550e8400-e29b-41d4-a716-446655440000.png",
  "filename": "550e8400-e29b-41d4-a716-446655440000.png",
  "folder": "photos"
}
```

#### Errors
- `400` invalid upload (missing file, invalid MIME, size limit, multipart error)
- `401` missing/malformed auth
- `403` invalid token
- `429` rate limit exceeded

---

### 6.3 Replace Existing Image

#### `PUT /upload/:folder/:filename`

Protected route.

Uploads a new image and attempts to delete the old file.

#### Path params
- `folder` (string): folder name (sanitized)
- `filename` (string): old file to replace (sanitized)

#### Request
- Content-Type: `multipart/form-data`
- Field: `image` (file)

#### Success
- `200`
- Body:
```json
{
  "url": "https://example.com/images/photos/new-generated-name.png",
  "filename": "new-generated-name.png",
  "folder": "photos"
}
```

#### Notes
- Returned `filename` is always a new generated UUID-based filename (plus extension).
- Deleting the old file is best-effort; replace can still succeed if old-file deletion fails.

#### Errors
- `400` invalid upload data
- `401` missing/malformed auth
- `403` invalid token
- `429` rate limit exceeded

---

### 6.4 Delete Image

#### `DELETE /upload/:folder/:filename`

Protected route.

#### Path params
- `folder` (string): folder name (sanitized)
- `filename` (string): file name (sanitized)

#### Success
- `200`
- Body:
```json
{
  "message": "File deleted successfully",
  "filename": "abc.png",
  "folder": "photos"
}
```

#### Errors
- `404` file not found:
  - `{"error":"File not found"}`
- `400` invalid path:
  - `{"error":"Invalid path"}`
- `500` deletion failure:
  - `{"error":"Failed to delete file"}`
- `401` missing/malformed auth
- `403` invalid token
- `429` rate limit exceeded

---

### 6.5 List Images in Folder

#### `GET /images/list/:folder`

No auth required.

#### Path params
- `folder` (string): folder name (sanitized)

#### Success
- `200`
- Body:
```json
{
  "folder": "gallery",
  "count": 2,
  "images": [
    {
      "filename": "a.png",
      "url": "https://example.com/images/gallery/a.png"
    },
    {
      "filename": "b.jpg",
      "url": "https://example.com/images/gallery/b.jpg"
    }
  ]
}
```

#### Behavior
- Lists files in that folder only (non-recursive).
- Includes only recognized image extensions:
  - `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.tif`, `.tiff`
- Sorted by filename ascending.

#### Errors
- `404` folder missing or not a directory:
  - `{"error":"Folder not found"}`
- `400` invalid folder path:
  - `{"error":"Invalid folder path"}`

---

### 6.6 Serve Image File

#### `GET /images/*`

No auth required.

This serves a file directly from the upload directory.

Examples:
- `/images/photos/a.png`
- `/images/a.png`

#### Success
- `200`
- Response body: binary image content
- `Content-Type`: inferred by file extension/content

#### Errors
- `404` missing path:
  - `{"error":"Not found"}`
- `404` file not found:
  - `{"error":"Image not found"}`
- `400` invalid path:
  - `{"error":"Invalid image path"}`

## 7) Global Fallback

Any unmatched route returns:

- `404`
- `{"error":"Not found"}`

## 8) cURL Examples

### 8.1 Upload

```bash
curl -X POST "https://your-server/upload/photos" \
  -H "Authorization: Bearer $API_SECRET" \
  -F "image=@/absolute/path/to/photo.png"
```

### 8.2 Replace

```bash
curl -X PUT "https://your-server/upload/photos/old-file.png" \
  -H "Authorization: Bearer $API_SECRET" \
  -F "image=@/absolute/path/to/new-photo.png"
```

### 8.3 Delete

```bash
curl -X DELETE "https://your-server/upload/photos/file-to-delete.png" \
  -H "Authorization: Bearer $API_SECRET"
```

### 8.4 List

```bash
curl "https://your-server/images/list/photos"
```

### 8.5 Serve

```bash
curl -O "https://your-server/images/photos/example.png"
```

## 9) AI Agent Integration Checklist

When building agent workflows against this API:

1. Always include Bearer auth on all `/upload` routes.
2. For uploads/replacements, send multipart form-data with field name `image`.
3. Treat returned `folder` and `filename` as canonical values.
4. Persist and reuse returned `url` where possible.
5. Handle `400/401/403/404/429/500` explicitly.
6. Implement retries with backoff for `429` and transient `5xx`.
7. Do not assume original upload filename is preserved; server generates UUID filenames.
