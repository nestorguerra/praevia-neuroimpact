# Gobierno legal y cientifico v0.1

## Principio de producto

PraevIA NeuroImpact Analyzer es un instrumento de pretest neurocognitivo in silico. No mide emociones reales de personas, no lee mentes y no predice compra individual.

La promesa defendible es:

> Ayudar a comparar versiones creativas, detectar tramos debiles y convertir una prediccion neurocognitiva en decisiones editoriales accionables.

## Estado del modelo base

La ficha publica de Hugging Face consultada el 2026-05-01 indica que `facebook/tribev2`:

- Predice respuestas fMRI ante video, audio y texto.
- Devuelve predicciones para un sujeto promedio.
- Usa malla cortical fsaverage5 de aproximadamente 20k vertices.
- No esta desplegado por un Inference Provider.
- Tiene condiciones de uso no comerciales.

Decision Sprint 0:

- Se puede avanzar en prototipo, I+D y demo privada.
- No se debe vender como SaaS comercial abierto hasta resolver permisos comerciales o alternativa tecnica.
- Los documentos de cliente no deben poner el foco en la licencia del modelo; internamente si debe quedar trazado el riesgo.

## Claims prohibidos

No usar:

- "Medimos emocion real".
- "Leemos la mente".
- "Predice compra".
- "Garantiza recuerdo".
- "Garantiza engagement".
- "Manipulacion subconsciente".
- "Verdad neuronal".
- "Respuesta real de tu audiencia".

## Claims permitidos

Usar:

- "Respuesta cerebral predicha".
- "Indicadores neurocognitivos comparativos".
- "Pretest creativo in silico".
- "Hipotesis de mejora editorial".
- "Decision recomendada".
- "Evidencia por timecode".
- "Confianza estimada".
- "Benchmark aplicado".
- "Complemento a metricas reales".

## Privacidad y datos

Version inicial:

- Procesa piezas creativas: video, audio, texto y subtitulos.
- No procesa biometria real de audiencia.
- No procesa webcams, EEG, eye tracking, fMRI real de clientes ni respuestas individuales.
- No infiere emociones individuales de empleados, consumidores o participantes.

## Riesgos principales

| Riesgo | Nivel | Mitigacion |
| --- | --- | --- |
| Uso comercial del modelo base | Alto | Permiso comercial, alternativa propia o pilotos acotados como I+D/consultoria. |
| Claims neuro-magicos | Alto | Guia de lenguaje, guardrails LLM y revision antes de publicar. |
| Privacidad de assets corporativos | Medio/Alto | Storage privado, retencion configurable, borrado seguro, DPA. |
| Sobreinterpretacion cientifica | Alto | Mostrar confianza, benchmark, evidencia y limites en cada informe. |
| Coste GPU fuera de control | Medio | Creditos, duracion maxima, caps por org y admin de usage. |

## Reglas de informe

Cada informe debe incluir:

- ID de informe.
- Cliente/proyecto/run.
- Fecha.
- Version de pipeline/modelo.
- Tipo de benchmark.
- Confianza media.
- Limitaciones metodologicas.
- Recomendaciones maximo 5.
- Timecode o tramo por recomendacion.

## Red line

Si un cliente pide analizar personas reales, biometria, empleados viendo anuncios o reconocimiento emocional individual, eso sale del MVP y requiere revision legal y de privacidad especifica.

