# Sprint 1 · Design System + Design Hub + Landing

Fecha: 2026-05-01

## Objetivo

Convertir los assets PraevIA en una base real de producto: frontend con bundler, tokens compartidos, componentes React, landing comercial y Design Hub servible.

## Entregables implementados

- App React + Vite + TypeScript en `frontend/`.
- Tokens PraevIA integrados en `frontend/src/styles/tokens.css`.
- Estilos productivos en `frontend/src/styles/app.css`.
- Logo/lockup PraevIA convertido a componente React.
- Componentes UI base:
  - Button / LinkButton.
  - Input.
  - Badge.
  - Card.
  - ScoreCard.
  - TimelinePanel.
  - DataTable.
  - Tabs.
  - Avatar.
  - UploadRow.
- Landing comercial en `/`.
- Preview de app/sistema visual en `/app`.
- Design Hub original servido desde `/design-hub/index.html`.
- Assets originales disponibles en `frontend/public/design-hub/`.

## Decisiones tecnicas

- Se mantiene React + Vite para MVP.
- Se usa `@rollup/wasm-node` via `overrides` para evitar el fallo de firma del binario nativo de Rollup en este entorno macOS/Codex.
- El Design Hub se sirve como estatico para conservar los entregables originales sin reescribirlos todavia.
- La landing nueva usa codigo React y componentes reales; no es HTML pegado.

## Rutas locales

- Landing: `http://localhost:5173/`
- Preview app: `http://localhost:5173/app`
- Design Hub: `http://localhost:5173/design-hub/index.html`
- Prototipo original: `http://localhost:5173/design-hub/prototype.html`
- Informe original: `http://localhost:5173/design-hub/report.html`

## QA realizado

- `npm install`: OK.
- `npm run build`: OK.
- Smoke test Playwright rutas criticas: OK.
- Desktop 1366x768 sin overflow horizontal.
- Mobile 390x844 sin overflow horizontal.
- Screenshots capturados:
  - landing nueva.
  - landing referencia.
  - preview app.
  - Design Hub.
  - landing mobile.

## Pendiente Sprint 1 si queremos endurecer

- Publicar GitHub Pages cuando exista repo remoto/dominio.
- Extraer tokens a paquete compartido cuando creemos `packages/ui`.
- Anadir visual regression a CI.
- Convertir `logo.jsx` y `animations.jsx` originales a modulos productivos completos.
- Sustituir dependencia remota de Google Fonts si un cliente exige entorno cerrado.

