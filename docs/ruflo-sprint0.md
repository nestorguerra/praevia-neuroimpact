# Ruflo Sprint 0

## Estado

Ruflo esta operativo en esta sesion mediante herramientas MCP cargadas por `tool_search`.

Validaciones:

- `swarm_status` disponible.
- `agent_spawn` disponible.
- `coordination_orchestrate` disponible.
- `agent_status` disponible.
- Binario directo validado: `ruflo v3.6.12`.
- Servidor MCP directo validado: 237 herramientas expuestas.

## Agentes registrados

- `sprint0-architecture`
  - Tipo: architect.
  - Dominio: product-architecture.
  - Objetivo: validar arquitectura, entornos, costes y scope Pilot-Ready.

- `sprint0-governance`
  - Tipo: reviewer.
  - Dominio: legal-science-governance.
  - Objetivo: validar claims, limites cientificos, privacidad y gates comerciales.

## Uso previsto

Sprint 0 usa Ruflo para coordinacion y revision. La escritura de documentos queda centralizada en el agente principal para evitar duplicidad y conflictos.

## Nota operativa

Si en una sesion futura el panel MCP de Codex no expone Ruflo de inicio, buscar `ruflo` con discovery de herramientas y cargar el namespace MCP. Una vez cargado, usar `swarm_status`, `agent_spawn` y `coordination_orchestrate`.

Tambien queda un comprobador local:

```bash
node scripts/check-ruflo-mcp.js
```

Resultado esperado:

```json
{
  "ok": true,
  "toolCount": 237
}
```

Durante Sprint 0, despues de crear agentes y lanzar coordinacion, una llamada de cierre de tarea cerro el transporte MCP de esa sesion. El binario y el servidor directo siguen funcionando, asi que la mitigacion es reiniciar/cargar de nuevo el conector si ocurre en una sesion larga.
