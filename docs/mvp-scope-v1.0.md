# Alcance MVP v1.0 Pilot-Ready

## Objetivo

Llegar a un producto usable en pilotos corporativos controlados, no a un SaaS masivo.

## Usuarios

- Owner de organizacion.
- Admin.
- Analyst.
- Viewer.
- Client viewer externo en fase posterior.

## Jerarquia de producto

```text
Organizacion
  Workspace
    Proyecto
      Experimento
        Asset
        Run
        Informe
```

## Tipos de experimento v1

- Analisis individual.
- Comparativa A/B.
- Comparativa A/B/C.
- Guion.
- Evento.

## Formatos soportados

Video:

- `.mp4`
- `.avi`
- `.mov`
- `.mkv`
- `.webm`

Audio:

- `.mp3`
- `.wav`
- `.flac`
- `.ogg`
- `.m4a`

Texto:

- `.txt`
- `.md`
- `.srt`

## Flujo MVP

1. Login.
2. Workspace.
3. Crear proyecto.
4. Elegir tipo de experimento.
5. Subir assets.
6. Health check.
7. Estimar creditos.
8. Lanzar run.
9. Ver progreso.
10. Ver dashboard.
11. Generar PDF.
12. Descargar o compartir internamente.

## Dashboard v1

Debe abrir con una decision recomendada, no con una grafica.

Vistas:

- Resumen.
- Timeline.
- Modalidades.
- Comparativa.
- Recomendaciones.
- Informe.

## Scores v1

- Neural Response Index.
- Visual Salience.
- Narrative Clarity.
- Multimodal Coherence.
- Semantic Load.
- Social Cueing.
- Scene Immersion.
- Action Readiness.
- Temporal Momentum.

Regla obligatoria: ningun score aparece solo. Siempre debe incluir confianza, benchmark/evidencia disponible y accion recomendada.

## PDF v1

Templates:

- Ejecutivo: 3-5 paginas.
- Creativo: 6-15 paginas.
- Tecnico: anexo opcional.

El template base es `design/source/report.html`.

## Definicion de terminado

Una feature no esta terminada si solo funciona. Tambien debe cumplir:

- Marca PraevIA/NeuroImpact correcta.
- Tokens visuales.
- Decision o siguiente accion.
- Confianza y evidencia.
- Timecode donde aplique.
- Lenguaje permitido.
- Accesibilidad basica.
- Coste/creditos visible cuando aplique.
- Smoke test.

