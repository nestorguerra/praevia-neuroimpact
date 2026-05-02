#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function has(relativePath, ...patterns) {
  if (!existsSync(path.join(root, relativePath))) return false;
  const source = read(relativePath);
  return patterns.every((pattern) => pattern.test(source));
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|html|md|mjs|css)$/.test(entry)) files.push(full);
  }
  return files;
}

const requiredDocs = [
  "docs/sprint-33-legal-science-commercial.md",
  "docs/legal-tribe-commercial-clearance.md",
  "docs/legal-dpa-template.md",
  "docs/legal-privacy-policy.md",
  "docs/legal-terms-of-service.md",
  "docs/legal-data-retention-policy.md",
  "docs/legal-scientific-limits.md",
  "docs/legal-procurement-checklist.md",
  "docs/legal-claims-review.md",
  "docs/commercial-pilot-contract-template.md",
  "docs/commercial-security-sheet.md",
];

const publicSurfaceRoots = [
  "frontend/src",
  "frontend/public/pilot-kit",
  "reporting",
];

const allowedClaimFiles = new Set([
  path.join(root, "frontend/public/pilot-kit/legal-procurement-pack.html"),
]);

const prohibitedPatterns = [
  /\bmedimos emociones reales\b/i,
  /\bsabemos lo que siente tu audiencia\b/i,
  /\bleemos la mente\b/i,
  /\bgarantizamos (compra|recuerdo|conversion|conversión|engagement)\b/i,
  /\bpredice (compra|conversion|conversión|ROI|roi)\b/i,
  /\bmanipulacion subconsciente\b/i,
  /\bmanipulación subconsciente\b/i,
  /\bverdad neuronal\b/i,
  /\bneuro-impacto garantizado\b/i,
];

function findPublicClaimViolations() {
  const files = publicSurfaceRoots.flatMap((relative) => walk(path.join(root, relative)));
  const violations = [];
  for (const file of files) {
    if (allowedClaimFiles.has(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const pattern of prohibitedPatterns) {
      const match = source.match(pattern);
      if (match) {
        violations.push({
          file: path.relative(root, file),
          pattern: String(pattern),
          match: match[0],
        });
      }
    }
  }
  return violations;
}

const newLegalDocs = requiredDocs.filter((file) => file.startsWith("docs/legal-") || file.includes("sprint-33"));

const checks = [
  ["required_docs_exist", requiredDocs.every((file) => existsSync(path.join(root, file)))],
  ["tribe_clearance_has_gate_and_alternatives", has("docs/legal-tribe-commercial-clearance.md", /autorizacion comercial/, /alternativa tecnica/, /No se debe vender/, /Plan B/)],
  ["dpa_has_processor_security_subprocessors", has("docs/legal-dpa-template.md", /encargado/, /Subprocesadores/, /Seguridad/, /No se usaran assets/) ],
  ["privacy_terms_retention_exist", has("docs/legal-privacy-policy.md", /Datos recogidos/, /No hacemos/, /Conservacion/) && has("docs/legal-terms-of-service.md", /Uso prohibido/, /Naturaleza de los resultados/) && has("docs/legal-data-retention-policy.md", /Borrado seguro/, /Cierre de piloto/) ],
  ["scientific_limits_are_explicit", has("docs/legal-scientific-limits.md", /no garantiza/i, /No sustituye/, /timecode/, /Hipotesis/i) ],
  ["procurement_checklist_complete", has("docs/legal-procurement-checklist.md", /Clearance TRIBE/, /RLS/, /Retencion/, /Facturacion manual beta/) ],
  ["claims_review_exists", has("docs/legal-claims-review.md", /Claims permitidos/, /Claims bloqueados/, /legal:gate/) ],
  ["pilot_kit_legal_pack_exists", has("frontend/public/pilot-kit/legal-procurement-pack.html", /Legal, ciencia y procurement/, /DPA/, /Retencion/, /Limites cientificos/) ],
  ["commercial_assets_link_legal_pack", has("frontend/src/data/pilotKit.ts", /Pack legal/, /legal-procurement-pack\.html/) ],
  ["export_pilot_kit_generates_legal_pdf", has("scripts/export-pilot-kit.mjs", /legal-procurement-pack\.html/, /sprint33-legal-procurement-pack\.pdf/) ],
  ["commercial_gate_checks_legal_pack", has("scripts/commercial-gate.mjs", /legal-procurement-pack\.html/, /assetLinkCount < 7/) ],
  ["guardrails_keep_claim_rewrite", has("backend/app/services/guardrails.py", /PROHIBITED_CLAIMS/, /medimos emociones/, /leemos la mente/, /predice/) ],
  ["new_legal_docs_do_not_name_restricted_license", newLegalDocs.every((file) => !/CC BY|BY-NC/i.test(read(file)))],
];

const violations = findPublicClaimViolations();
checks.push(["public_surfaces_have_no_blocked_claims", violations.length === 0]);
checks.push(["package_exposes_legal_gate", has("frontend/package.json", /legal:gate/)]);
checks.push(["demo_and_production_run_legal_gate", has("scripts/demo-gate.mjs", /legal-commercial-gate\.mjs/) && has("scripts/production-gate.mjs", /legal-commercial-gate\.mjs/)]);
checks.push(["ci_gate_knows_legal_gate", has("scripts/cicd-strict-gate.mjs", /legal_commercial_gate_exists/)]);
checks.push(["readme_links_sprint33", has("README.md", /Sprint 33 .*Legal, ciencia y comercial/, /legal:gate/)]);

const result = {
  ok: checks.every(([, ok]) => ok),
  checks: Object.fromEntries(checks),
  violations,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
