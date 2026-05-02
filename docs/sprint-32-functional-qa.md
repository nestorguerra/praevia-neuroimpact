# Sprint 32 · QA funcional completa

Objetivo: probar NeuroImpact Analyzer como lo probaria un cliente real, desde registro hasta borrado seguro, sin tocar consola para completar el flujo.

## Comando principal

```bash
cd frontend
npm run qa:functional
```

El gate abre el navegador, recorre la app privada y escribe el manifiesto:

```text
/tmp/praevia-neuroimpact-qa/sprint32-functional-checklist.json
```

Tambien guarda artefactos de prueba como PDF, export mensual y captura final del Admin.

## Checklist cubierto

- Registro.
- Login.
- Recuperacion de password.
- Crear organizacion.
- Crear workspace.
- Crear proyecto.
- Crear experimento individual.
- Crear A/B/C.
- Upload de video.
- Upload de audio.
- Upload de texto.
- Health check.
- Preprocesamiento.
- TRIBE real o, en modo local, flujo TRIBE simulado marcado como `simulated`.
- Scoring.
- Dashboard.
- PDF.
- Comparativa.
- Admin coste.
- Borrado seguro.
- Share link.
- Benchmark.
- KPI externo.
- Export uso.

## Modo real estricto

Para declarar Sprint 32 listo para produccion, ejecuta:

```bash
cd frontend
QA_REAL_MODE=true \
APP_QA_URL=https://staging.neuroimpact.praevia.ai \
API_SMOKE_URL=https://api-staging.neuroimpact.praevia.ai \
READINESS_TOKEN=... \
npm run qa:functional
```

En `QA_REAL_MODE=true` el script falla si:

- El backend no responde.
- `/ready/dependencies?strict=true&require_remote_worker=true` no confirma DB, storage y worker.
- La app usa sesion local en vez de Supabase Auth.
- El run TRIBE devuelve `local_mock`.
- El checklist tiene cualquier item pendiente, fallido o simulado.

El manifiesto estricto se guarda separado para no pisar la prueba local:

```text
/tmp/praevia-neuroimpact-qa/sprint32-functional-checklist-real.json
```

## Datos de prueba

Por defecto se generan fixtures pequeños. Para QA con material de cliente o assets reales controlados:

```bash
QA_VIDEO_PATH=/ruta/video.mp4 \
QA_AUDIO_PATH=/ruta/audio.wav \
QA_TEXT_PATH=/ruta/guion.txt \
npm run qa:functional
```

Si no hay `QA_VIDEO_PATH`, el script intenta generar un MP4 corto con `ffmpeg`. En modo real, si no hay video real ni `ffmpeg`, el gate falla.

## Gate estatico

```bash
cd frontend
npm run qa:functional:gate
```

Este gate confirma que el checklist ejecutable existe, cubre todos los flujos de Sprint 32, tiene modo real estricto y esta conectado a `demo:gate` y `production:gate`.

## Criterio de aceptacion

Sprint 32 queda aceptado cuando el manifiesto muestra:

- `ok: true`
- `productionReady: true`
- todos los items en `passed`
- ningun item `pending`, `failed` o `simulated`

En modo local puede pasar como prueba de producto/demo, pero no como produccion real si `tribe_real` aparece `simulated`.
