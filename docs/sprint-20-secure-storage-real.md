# Sprint 20 · Storage seguro real

Objetivo: que los archivos pesados no pasen por el backend. El backend autoriza, el navegador sube directo a R2/S3/MinIO con URL firmada y la API verifica el objeto antes de marcar el asset como validado.

## Flujo implementado

1. El frontend calcula SHA-256, extension, MIME y tamano.
2. `POST /v1/upload-intents` valida formato, peso y pertenencia a organizacion.
3. El backend genera una URL firmada `PUT` S3-compatible con metadata de hash, asset, sesion y organizacion.
4. El frontend sube el binario directamente al storage con `PUT`.
5. `POST /v1/upload-sessions/complete` hace `HEAD Object`, valida tamano/hash metadata y crea `asset_versions`.
6. La API registra el objeto en `storage_objects` con retencion calculada por organizacion.
7. El worker puede descargar por S3 key usando `worker/storage_client.py` o pedir una URL firmada de descarga a `GET /v1/assets/{asset_id}/download-url`.
8. El borrado seguro llama a S3/R2 `DeleteObjects`, marca el manifiesto y deja audit trail en `secure_deletion_requests`.

## Variables necesarias

```env
STORAGE_MODE=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=praevia-neuroimpact-staging
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_CREATE_BUCKET_IF_MISSING=false
```

En local se usa MinIO:

```env
STORAGE_MODE=auto
S3_ENDPOINT=http://localhost:9000
S3_REGION=eu-west-1
S3_BUCKET=neuroimpact-local
S3_ACCESS_KEY_ID=local
S3_SECRET_ACCESS_KEY=localpassword
S3_CREATE_BUCKET_IF_MISSING=true
```

## CORS del bucket

El bucket debe permitir `PUT`, `GET`, `HEAD` desde la URL pública de la app y los headers `Content-Type` y `x-amz-meta-*`.

## Formatos permitidos

- Video: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`
- Audio: `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`
- Texto: `.txt`, `.md`, `.srt`

## Gate

```bash
cd frontend
npm run storage:gate
```

Este gate comprueba que existe servicio S3/R2, validacion de formatos, subida binaria directa, verificacion `HEAD Object`, ruta de descarga, borrado real y manifiesto con RLS.
