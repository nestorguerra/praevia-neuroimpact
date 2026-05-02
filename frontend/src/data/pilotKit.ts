export const commercialAssets = [
  {
    label: "Deck cliente",
    href: "/pilot-kit/deck-cliente.html",
    meta: "10 slides · reunion CMO/agencia",
    description: "Narrativa publica: problema, tesis, producto, resultado, diferencial, oferta y cierre.",
  },
  {
    label: "Deck interno",
    href: "/pilot-kit/deck-interno.html",
    meta: "10 slides · pricing y operacion",
    description: "Version con riesgos, alcance, coste, gate legal, runbook comercial y siguiente decision.",
  },
  {
    label: "Teaser 18s",
    href: "/pilot-kit/motion-teaser.html",
    meta: "HTML motion · grabable",
    description: "Secuencia corta para LinkedIn, intro de demo o apertura de reunion.",
  },
  {
    label: "One-pager ejecutivo",
    href: "/pilot-kit/one-pager.html",
    meta: "A4 print-first",
    description: "Resumen para enviar despues de la reunion con alcance, valor y proximo paso.",
  },
  {
    label: "Ficha de seguridad",
    href: "/pilot-kit/security-sheet.html",
    meta: "procurement-ready",
    description: "Datos, retencion, segregacion por organizacion, borrado, logs y limitaciones.",
  },
  {
    label: "Contrato piloto",
    href: "/pilot-kit/pilot-contract-template.html",
    meta: "plantilla editable",
    description: "Alcance, entregables, confidencialidad, limites metodologicos y condiciones del piloto.",
  },
  {
    label: "Pack legal",
    href: "/pilot-kit/legal-procurement-pack.html",
    meta: "legal/procurement",
    description: "Clearance TRIBE, DPA, privacidad, terminos, retencion, limites cientificos y checklist procurement.",
  },
];

export const demoScenarios = [
  {
    id: "spot-abc",
    title: "Spot A/B/C",
    objective: "Elegir master creativo y proponer mix recomendado.",
    files: ["spot_a_master.txt", "spot_b_cierre_humano.txt", "spot_c_claim_directo.srt"],
    script: "Subir las tres piezas, lanzar comparativa A/B/C, abrir ranking, mostrar timeline y cerrar con PDF.",
  },
  {
    id: "evento",
    title: "Evento corporativo",
    objective: "Revisar apertura, claim de escenario y cierre de ponencia.",
    files: ["evento_apertura_guion.md", "evento_cierre_claims.txt"],
    script: "Crear proyecto Evento, analizar guion, revisar valles narrativos y convertir recomendaciones en tareas.",
  },
  {
    id: "guion",
    title: "Guion antes de producir",
    objective: "Detectar densidad verbal, falta de anclajes visuales y punto de CTA.",
    files: ["guion_producto_b2b.md"],
    script: "Usar modo guion, explicar que es pretest in silico y exportar recomendaciones por timecode/tramo.",
  },
];

export const meetingFlow = [
  "Abrir landing y explicar la promesa: decidir version antes de producir.",
  "Mostrar deck cliente: problema, tesis, producto y oferta Sprint 10.",
  "Entrar en la app, abrir comparativa A/B/C y ensenar decision recomendada.",
  "Descargar PDF de ejemplo y explicar limites metodologicos con lenguaje sobrio.",
  "Cerrar con alcance: 10 piezas, informe, workshop y reanalisis opcional.",
];

export const sprint10Offer = {
  price: "12.000-20.000 EUR",
  duration: "10 dias habiles",
  scope: ["10 piezas o variantes", "1 comparativa A/B/C principal", "PDF ejecutivo", "Workshop de decision", "Recomendaciones por timecode"],
  exclusions: ["No mide emocion real", "No sustituye brand lift", "No procesa biometria de audiencia", "No incluye compra de medios"],
};
