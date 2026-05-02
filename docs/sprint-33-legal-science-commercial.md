# Sprint 33 · Legal, ciencia y comercial

Objetivo: dejar el producto preparado para revisiones de legal, procurement y equipos cientificos/compliance sin improvisar respuestas.

## Estado de aceptacion

Estado actual: pack listo para revision legal, no para firma automatica.

El producto puede ensenarse a legal/procurement con:

- Decision sobre permiso comercial de TRIBE v2 y alternativas.
- DPA base.
- Politica de privacidad.
- Terminos de servicio.
- Politica de retencion.
- Plantilla de contrato piloto.
- Documento de limites cientificos.
- Revision de claims landing/app/PDF.
- Checklist procurement.
- Ficha de seguridad.

## Gate comercial/legal

```bash
cd frontend
npm run legal:gate
```

El gate valida:

- existencia de todos los documentos del pack.
- que el pilot kit incluye `legal-procurement-pack.html`.
- que las superficies publicas/comerciales no contienen claims prohibidos.
- que el backend conserva guardrails para reescritura de claims.
- que `demo:gate`, `production:gate` y `ci:gate` ejecutan la revision legal/comercial estatica.

## Decision TRIBE v2

No se debe vender una modalidad SaaS comercial basada en TRIBE v2 hasta que exista autorizacion comercial expresa o una alternativa tecnica con derechos comerciales claros.

Permitido antes de resolverlo:

- demo interna.
- I+D.
- pruebas con dataset demo.
- piloto solo si legal aprueba el marco contractual y el alcance no explota comercialmente el modelo sin permiso.

No permitido:

- anunciar el producto como SaaS comercial abierto basado en TRIBE v2.
- vender analisis automatizados recurrentes sin autorizacion o alternativa.
- sublicenciar, revender o empaquetar el modelo como funcionalidad comercial sin permiso.

## Documentos Sprint 33

- [Clearance TRIBE y alternativas](legal-tribe-commercial-clearance.md)
- [DPA template](legal-dpa-template.md)
- [Politica de privacidad](legal-privacy-policy.md)
- [Terminos de servicio](legal-terms-of-service.md)
- [Politica de retencion](legal-data-retention-policy.md)
- [Limites cientificos](legal-scientific-limits.md)
- [Checklist procurement](legal-procurement-checklist.md)
- [Revision de claims](legal-claims-review.md)
- [Ficha de seguridad](commercial-security-sheet.md)
- [Contrato piloto](commercial-pilot-contract-template.md)

## Red lines comerciales

- No prometer emocion real, compra, ROI, recuerdo o conducta.
- No procesar biometria real, webcam, EEG, eye tracking o respuestas individuales.
- No usar assets del cliente para entrenar modelos sin autorizacion expresa.
- No decir que un score aislado decide por si solo. Siempre debe ir con confianza, benchmark, evidencia y accion.

## Criterio de salida

Para marcar Sprint 33 como listo:

- `npm run legal:gate` pasa.
- el pack legal esta incluido en el pilot kit.
- legal externo revisa y adapta DPA, terminos, privacidad y contrato piloto.
- la decision TRIBE queda resuelta antes de vender SaaS comercial recurrente.
