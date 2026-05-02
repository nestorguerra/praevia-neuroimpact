# Revision de claims

## Regla

Ningun texto comercial, pantalla de app o informe PDF debe presentar NeuroImpact Analyzer como una herramienta que mide emociones reales, lee mentes o garantiza resultados de negocio.

## Superficies revisadas

- Landing.
- Formulario de demo.
- App privada.
- Dashboard.
- PDF.
- Deck.
- One-pager.
- Ficha de seguridad.
- Contrato piloto.
- Pilot kit.

## Claims permitidos

- respuesta cerebral predicha.
- indicadores neurocognitivos comparativos.
- pretest creativo in silico.
- hipotesis de mejora editorial.
- decision recomendada.
- evidencia por timecode.
- confianza estimada.
- benchmark aplicado.
- complemento a metricas reales.

## Claims bloqueados

- medimos emociones reales.
- sabemos lo que siente tu audiencia.
- leemos la mente.
- garantizamos compra.
- garantizamos recuerdo.
- predice conversion.
- predice ROI.
- manipulacion subconsciente.
- verdad neuronal.
- neuro-impacto garantizado.

## Reglas de QA

El gate `legal:gate` debe fallar si encuentra claims bloqueados en:

- `frontend/src`
- `frontend/public/pilot-kit`
- `reporting`

Excepciones permitidas:

- guias internas de claims.
- tests de guardrails.
- codigo que contiene patrones prohibidos para reescribirlos.

## Copy de seguridad recomendado

Texto corto para PDF:

> Este informe resume una prediccion neurocognitiva in silico para apoyar decisiones editoriales. No mide respuestas reales de audiencia ni garantiza resultados comerciales.
