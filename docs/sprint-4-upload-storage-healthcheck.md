# Sprint 4 · Upload, storage seguro y Asset Health Check

Fecha: 2026-05-01

## Objetivo

Permitir que un usuario asocie archivos reales de video, audio o texto a un experimento, valide su estado antes de analizar y vea el consumo estimado de creditos.

## Implementado

### Frontend

- Ruta privada `/app/upload`.
- Selector de proyecto/experimento.
- Flujo A/B/C con tres slots maximos.
- Drag & drop y selector de archivos.
- Formatos soportados:
  - Video: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`.
  - Audio: `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`.
  - Texto: `.txt`, `.md`, `.srt`.
- Validacion local:
  - tipo de archivo.
  - extension.
  - peso.
  - limites por tipo.
  - hash SHA-256.
  - duracion cuando el navegador puede leerla.
  - resolucion de video cuando el navegador puede leerla.
  - subtitulos SRT detectados.
  - idioma probable para texto.
- Preview basica:
  - video con reproductor HTML.
  - audio con reproductor HTML.
  - texto con resumen de palabras/subtitulos.
- Lista de assets asociados con progreso, estado, slot A/B/C y hash corto.
- Health Check por asset.
- Estimacion de creditos antes de lanzar analisis.
- Persistencia local por organizacion y experimento para demo.

### DB

Migracion preparada:

`backend/supabase/migrations/0003_assets_upload_sessions.sql`

Incluye:

- `assets`
- `asset_versions`
- `upload_sessions`
- enums `asset_kind` y `asset_status`.
- indices basicos.
- RLS por organizacion.

### Backend

Contrato inicial FastAPI preparado en:

- `backend/app/routes/uploads.py`
- `backend/app/schemas/uploads.py`

Endpoints base:

- `POST /v1/upload-intents`
- `POST /v1/upload-sessions/complete`

El backend valida limites de peso por tipo. Desde Sprint 20 el modo DB puede devolver URL firmada real S3/R2/MinIO; el mock queda solo como fallback local cuando `STORAGE_MODE=mock` o no hay credenciales.

## Seguridad

- El contrato de producto queda preparado para presigned upload URLs.
- El navegador calcula hash SHA-256 antes de asociar el asset.
- La base de datos queda modelada para separar asset, version y sesion de upload.
- Los limites de tamano se validan en frontend y backend.
- La UI ya comunica destino R2/S3 por entorno, hash y metodo de subida.

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Entrada a `/app/upload`.
3. Seleccion de experimento `Banco Atlas / Hipotecas Q2 · A/B/C`.
4. Generacion de tres videos `.webm` de prueba.
5. Upload de `spot_A.webm`, `spot_B.webm`, `spot_C.webm`.
6. Confirmacion de tres slots A/B/C ocupados.
7. Confirmacion de health check visible para la version activa y metadata asociada a los tres assets.
8. Confirmacion de estimacion de `3 creditos`.
9. Confirmacion de boton `Lanzar analisis` habilitado.

## QA

- `npm run build`: OK.
- `python3 -m compileall app`: OK.
- Playwright flujo Sprint 4: OK.
- Desktop 1440px: OK.
- Mobile 390px sin overflow horizontal: OK.
- Ruflo MCP check: OK.

Capturas temporales:

- `/tmp/praevia-neuroimpact-qa/sprint4-upload.png`
- `/tmp/praevia-neuroimpact-qa/sprint4-mobile.png`

## Limitaciones

- En produccion hay que configurar credenciales reales de Cloudflare R2/S3 y CORS del bucket.
- La UI ya hace `PUT` directo contra la URL firmada cuando `is_mock=false`.
- FPS y presencia exacta de audio en video quedan como `Pendiente ffprobe`; se completara en Sprint 5 con worker CPU.
- Los previews de video/audio usan `objectURL` de navegador y solo estan disponibles durante la sesion actual.
- Los assets persisten en `localStorage` hasta conectar API/DB real.
