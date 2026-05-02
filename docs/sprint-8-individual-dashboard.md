# Sprint 8 · Dashboard individual y visualizacion accionable

Fecha: 2026-05-01

## Objetivo

Hacer que un resultado individual se entienda y se pueda usar sin perfil tecnico.

La vista no empieza por mapas cerebrales ni por datos crudos. Empieza por una decision recomendada, evidencia, timeline y acciones editoriales.

## Implementado

### Frontend

Nueva ruta privada:

- `/app/results`
- `/app/results?experimentId={experiment_id}&resultId={result_id}`

Archivos principales:

- `frontend/src/pages/ResultsPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/scoring/ScoringPanel.tsx`
- `frontend/src/styles/app.css`

El panel de scoring de Sprint 7 ahora incluye enlace directo a `Abrir dashboard`.

### App shell

Se anade navegacion lateral:

- Insights -> Resultados.

La ruta mantiene el contexto de organizacion, experimento, run y resultado desde localStorage demo.

## UX implementada

### Decision recomendada

Bloque superior con:

- decision recomendada.
- NRI.
- score fuerte.
- score debil.
- confianza.

Reglas v0.1:

- NRI >= 72: avanzar con ajustes.
- NRI 55-71: revisar montaje.
- NRI < 55: no usar como master.

### Tabs funcionales

Tabs Sprint 8:

- Resumen.
- Timeline.
- Modalidades.
- Recomendaciones.
- Informe.

### Resumen

Incluye:

- nueve score cards editoriales.
- timeline accionable.
- recomendaciones priorizadas.

### Timeline interactivo

El timeline permite seleccionar puntos temporales y muestra:

- timecode corregido a estimulo.
- respuesta normalizada.
- tiempo BOLD original.
- lectura editorial del punto seleccionado.
- marcadores Peak / Valley / Neutral.

### Modalidades

Diagnostico por capa:

- Video.
- Audio.
- Texto.
- Social.
- Narrativa.
- Accion.

Tambien incluye tablas de:

- redes funcionales.
- regiones/ROIs.

### Recomendaciones

Maximo cinco acciones, cada una con:

- orden de prioridad.
- timecode o scope global.
- capa.
- confianza.
- impacto estimado.
- accion editorial concreta.

### Informe / export

Export basico:

- JSON.
- CSV.

El PDF ejecutivo/creativo queda para Sprint 9.

## Demo de aceptacion

Flujo probado con Playwright:

1. Registro local.
2. Upload de asset `.txt`.
3. Preparar inputs TRIBE.
4. Lanzar TRIBE mock contractual.
5. Calcular scoring.
6. Abrir dashboard.
7. Revisar decision recomendada.
8. Cambiar a Modalidades.
9. Cambiar a Informe.
10. Exportar JSON.
11. Exportar CSV.

Resultados del test:

```json
{
  "desktop": {
    "title": "Revisar montaje",
    "scoreCards": 9,
    "timelinePoints": 12,
    "recommendations": 5,
    "tabs": 5,
    "overflow": false
  },
  "modalities": {
    "modalityRows": 6,
    "networkRows": 12
  },
  "downloads": [
    "sprint8_script.txt-dashboard.json",
    "sprint8_script.txt-dashboard.csv"
  ],
  "mobile": {
    "overflow": false
  }
}
```

Capturas temporales:

- `/tmp/praevia-neuroimpact-qa/sprint8-dashboard.png`
- `/tmp/praevia-neuroimpact-qa/sprint8-mobile.png`

## QA

- `npm run build`: OK.
- Playwright flujo end-to-end Sprint 8: OK.
- Desktop 1366 x 768: OK, sin overflow horizontal.
- Mobile 390px: OK, sin overflow horizontal.
- Export JSON: OK.
- Export CSV: OK.

## Limitaciones

- El dashboard consume scoring v0.1 de Sprint 7, todavia demo/contractual.
- El PDF real no esta incluido; empieza en Sprint 9.
- Las recomendaciones son deterministas, sin LLM.
- Las ROIs siguen siendo proxy hasta atlas definitivo.
- El scoring comercial serio sigue pendiente del gate Sprint 6: TRIBE real en GPU con assets reales.

## Criterio de aceptacion

Cumplido para MVP interno: un usuario no tecnico puede abrir un resultado individual y entender:

- que esta bien.
- que esta flojo.
- donde cambiar.
- por que cambiarlo.
- que exportar para revision interna.
