# Mapa de fuente de diseno

Assets copiados desde `/Users/nestorguerra/Downloads/PraevIA` a `design/source/`.

## Fuentes principales

| Archivo | Rol | Accion de migracion |
| --- | --- | --- |
| `tokens.css` | Fuente visual unica | Importar en frontend/reporting; evitar colores hardcoded. |
| `logo.jsx` | Logo y lockups PraevIA | Convertir a modulo React/TSX. |
| `identity.html` | Reglas de marca | Extraer do/don't y usos light/dark. |
| `ui-system.html` | Componentes UI | Migrar a `frontend/src/components/ui`. |
| `prototype.html` | Flujo UX de app privada | Convertir a rutas y componentes reales. |
| `prototype-styles.css` | Estilos del prototipo | Reutilizar patrones, limpiar dependencias. |
| `landing.html` | Landing comercial | Convertir a landing estatica/publica. |
| `report.html` | Informe PDF print-first | Base del renderer Playwright. |
| `deck.html` | Deck comercial | Mantener como activo de ventas y migrar si hace falta. |
| `deck-stage.js` | Navegacion del deck | Reutilizar para version comercial. |
| `motion.html` | Teaser animado | Mantener como demo/motion asset. |
| `animations.jsx` | Animaciones teaser | Convertir si se integra en app/landing. |
| `brief.html` | Brief de diseno/producto | Extraer principios y microcopy. |
| `index.html` | Design Hub | Publicar como hub estatico. |
| `uploads/NeuroImpact_Analyzer_Informe_Estrategico_v2.pdf` | Informe estrategico | Referencia de producto, mercado y modelo de negocio. |

## Decisiones visuales congeladas

- INK para aplicacion privada.
- PAPER para informes y documentos imprimibles.
- SIGNAL para comparativas y eventos.
- Amber: marca, version A, CTA.
- Cyan: version B/comparativa.
- Violet: version C/narrativa.
- Lime: peak/positivo.
- Coral: valley/warning.
- Newsreader: titulares/editorial.
- Geist: interfaz.
- JetBrains Mono: datos, timecodes, scores.

## Riesgos de migracion

- Los HTML usan CDN/React/Babel en navegador.
- Las fuentes dependen de Google Fonts.
- Los datos estan hardcodeados.
- Los assets multimedia son placeholders.
- Los componentes no estan modularizados.

## Decision Sprint 0

No redisenar desde cero. Sprint 1 debe migrar el sistema existente a una app real con bundler, componentes y tokens compartidos.

