# Sprint 13 · Kit comercial y piloto Sprint 10

## Estado

Implementado a nivel repo/local como v1.0 Pilot-Ready comercial.

## Entregables

- Landing final con formulario de demo funcional.
- Endpoint backend para solicitudes de demo: `POST /v1/marketing/demo-requests`.
- Persistencia local fallback para leads cuando la API no esta disponible.
- Ruta publica `/pilot-kit`.
- Deck cliente HTML exportable.
- Deck interno HTML exportable.
- Teaser motion 18s en HTML.
- One-pager ejecutivo.
- Ficha de seguridad.
- Plantilla de contrato piloto.
- Demo dataset limpio: Spot A/B/C, Evento y Guion.
- Scripts de export y gate comercial.

## Rutas

- `/`: landing comercial.
- `/pilot-kit`: indice del kit de piloto.
- `/pilot-kit/deck-cliente.html`: deck para cliente.
- `/pilot-kit/deck-interno.html`: deck interno.
- `/pilot-kit/motion-teaser.html`: teaser 18s.
- `/pilot-kit/one-pager.html`: one-pager A4.
- `/pilot-kit/security-sheet.html`: ficha de seguridad.
- `/pilot-kit/pilot-contract-template.html`: contrato piloto base.

## Scripts

- `npm run pilot:kit`: exporta PDFs y poster del teaser.
- `npm run commercial:gate`: valida formulario, kit, assets estaticos y export comercial.
- `npm run production:gate`: incluye el gate comercial dentro de la puerta completa.

## Criterio de aceptacion

Una reunion con CMO/agencia puede recorrer:

1. Landing.
2. Deck cliente.
3. Demo app A/B/C.
4. Informe PDF.
5. Ficha de seguridad.
6. One-pager.
7. Propuesta Sprint 10.
8. Plantilla de contrato piloto.

## Pendiente para produccion publica real

- Conectar formulario a CRM/email.
- Publicar dominio real.
- Revisar contrato con legal.
- Exportar teaser a MP4/WebM si se necesita para LinkedIn.
- Cargar ejemplos reales anonimizados cuando existan pilotos.
