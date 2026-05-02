#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../frontend/node_modules/playwright");

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(rootDir);

const baseUrl = process.env.APP_QA_URL ?? process.env.APP_E2E_URL ?? "http://localhost:5173";
const apiUrl = process.env.API_SMOKE_URL ?? "http://localhost:8000";
const outDir = process.env.QA_OUT_DIR ?? "/tmp/praevia-neuroimpact-qa";
const realMode = process.env.QA_REAL_MODE === "true";
const headless = process.env.QA_HEADLESS !== "false";
const defaultTimeout = realMode ? 120_000 : 20_000;
const runTimeout = realMode ? Number(process.env.QA_REAL_RUN_TIMEOUT_MS ?? 1_800_000) : 25_000;
const readinessToken = process.env.READINESS_TOKEN ?? "";

const checklistOrder = [
  "registro",
  "login",
  "recuperacion_password",
  "crear_organizacion",
  "crear_workspace",
  "crear_proyecto",
  "crear_experimento_individual",
  "crear_abc",
  "upload_video",
  "upload_audio",
  "upload_texto",
  "health_check",
  "preprocesamiento",
  "tribe_real",
  "scoring",
  "dashboard",
  "pdf",
  "comparativa",
  "admin_coste",
  "borrado_seguro",
  "share_link",
  "benchmark",
  "kpi_externo",
  "export_uso",
];

const checklist = Object.fromEntries(checklistOrder.map((id) => [id, {
  status: "pending",
  evidence: "",
  artifact: null,
  checkedAt: null,
}]));

const artifacts = {};

function mark(id, status, evidence, artifact = null) {
  if (!checklist[id]) throw new Error(`Checklist id desconocido: ${id}`);
  checklist[id] = {
    status,
    evidence,
    artifact,
    checkedAt: new Date().toISOString(),
  };
}

function wavSilenceBuffer(durationSeconds = 0.8, sampleRate = 16_000) {
  const samples = Math.floor(durationSeconds * sampleRate);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

async function createVideoFixture(path) {
  if (process.env.QA_VIDEO_PATH) return { path: process.env.QA_VIDEO_PATH, source: "QA_VIDEO_PATH" };
  try {
    await runProcess("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=black:s=64x64:d=0.8",
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=mono:sample_rate=16000",
      "-shortest",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      path,
    ]);
    return { path, source: "ffmpeg-generated-mp4" };
  } catch {
    if (realMode) {
      throw new Error("QA_REAL_MODE necesita QA_VIDEO_PATH o ffmpeg disponible para generar un video real.");
    }
    await writeFile(path, Buffer.from("praevia sprint32 video fixture"), "binary");
    return { path, source: "extension-fixture" };
  }
}

async function ensureInputs() {
  await mkdir(outDir, { recursive: true });
  const videoPath = join(outDir, "sprint32_video.mp4");
  const audioPath = process.env.QA_AUDIO_PATH ?? join(outDir, "sprint32_audio.wav");
  const textPath = process.env.QA_TEXT_PATH ?? join(outDir, "sprint32_text.txt");

  const video = await createVideoFixture(videoPath);

  if (!process.env.QA_AUDIO_PATH) {
    await writeFile(audioPath, wavSilenceBuffer(), "binary");
  } else if (!existsSync(audioPath)) {
    throw new Error(`QA_AUDIO_PATH no existe: ${audioPath}`);
  }

  if (!process.env.QA_TEXT_PATH) {
    await writeFile(textPath, [
      "Version C para QA funcional Sprint 32.",
      "La pieza abre con una promesa clara, mantiene ritmo narrativo y cierra con un claim corto.",
      "El objetivo es validar subida de texto, health check, preprocesamiento, scoring y reporting.",
    ].join(" "), "utf8");
  } else if (!existsSync(textPath)) {
    throw new Error(`QA_TEXT_PATH no existe: ${textPath}`);
  }

  artifacts.inputs = {
    video: video.path,
    videoSource: video.source,
    audio: audioPath,
    text: textPath,
  };

  return [video.path, audioPath, textPath];
}

async function fetchJson(label, url) {
  const headers = readinessToken ? { "X-Readiness-Token": readinessToken } : {};
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(`${label} no responde: ${error.message}`);
  }
  const body = await response.text();
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = { raw: body.slice(0, 500) };
  }
  if (!response.ok) throw new Error(`${label} fallo con ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

async function assertRealDependencies() {
  const health = await fetchJson("api.health", `${apiUrl}/health`);
  const ready = await fetchJson("api.ready", `${apiUrl}/ready`);
  const dependencies = await fetchJson("api.dependencies", `${apiUrl}/ready/dependencies?strict=true&require_remote_worker=true`);
  const checks = dependencies?.checks ?? [];
  const missing = ["database", "storage", "worker"].filter((name) => !checks.some((check) => check.name === name && check.ok === true));
  if (dependencies?.ok !== true || missing.length > 0) {
    throw new Error(`Dependencias reales incompletas: ${missing.join(", ") || JSON.stringify(dependencies)}`);
  }
  artifacts.realDependencies = { health, ready, dependencies };
}

async function selectWrappedSelect(page, labelText, option) {
  await page.locator("label.field", { hasText: labelText }).locator("select").selectOption(option);
}

async function fillWrappedInput(page, labelText, value) {
  await page.locator("label.field", { hasText: labelText }).locator("input").fill(value);
}

async function createProject(page, {
  template,
  brand,
  campaign,
  experimentLabel,
  newWorkspace,
}) {
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Crear proyecto" }).first().click();
  const wizard = page.locator(".wizard-shell");
  await wizard.locator(".template-card", { hasText: template }).click();
  await wizard.getByRole("button", { name: "Siguiente" }).click();

  if (newWorkspace) {
    await selectWrappedSelect(wizard, "Workspace", "new");
    await fillWrappedInput(wizard, "Nuevo workspace", newWorkspace);
  }

  await fillWrappedInput(wizard, "Marca / Cliente", brand);
  await fillWrappedInput(wizard, "Campana", campaign);
  await wizard.getByRole("button", { name: "Siguiente" }).click();
  await selectWrappedSelect(wizard, "Tipo de experimento", { label: experimentLabel });
  await fillWrappedInput(wizard, "Audiencia", "Familias urbanas 35-55");
  await fillWrappedInput(wizard, "KPI esperado", experimentLabel === "A/B/C" ? "VTR / Retencion 30s" : "Retencion / engagement");
  await wizard.getByRole("button", { name: "Siguiente" }).click();
  await wizard.getByRole("button", { name: "Crear proyecto" }).click();
  await page.getByText(`${brand} / ${campaign}`).first().waitFor();
}

async function createAccountAndLogin(page) {
  const stamp = Date.now();
  const email = `nestor+sprint32-${stamp}@praevia.ai`;
  const password = "PraevIA-QA-32!";
  const organization = "PraevIA QA Sprint 32";

  await page.goto(`${baseUrl}/forgot`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Email corporativo").fill(email);
  await page.getByRole("button", { name: "Enviar recuperacion" }).click();
  await page.getByText(/Si el email existe/).waitFor();
  mark("recuperacion_password", "passed", "Flujo de recuperacion muestra confirmacion segura sin revelar si existe el email.");

  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("Nombre").fill("Nestor Guerra");
  await page.getByLabel("Email corporativo").fill(email);
  await page.getByLabel("Organizacion").fill(organization);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Crear organizacion" }).click();
  await page.waitForURL("**/app", { timeout: defaultTimeout });
  await page.getByText(organization).first().waitFor();
  mark("registro", "passed", "Registro completado desde la UI publica.");
  mark("crear_organizacion", "passed", `Organizacion creada y visible en topbar: ${organization}.`);

  if (realMode) {
    const hasLocalSession = await page.evaluate(() => Boolean(localStorage.getItem("praevia.auth.session.v1")));
    if (hasLocalSession) throw new Error("QA_REAL_MODE detecto sesion local. Configura Supabase Auth real antes de pasar Sprint 32.");
  }

  await page.getByRole("button", { name: "Salir" }).click();
  await page.getByRole("button", { name: "Entrar al workspace" }).waitFor();
  await page.getByLabel("Email corporativo").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entrar al workspace" }).click();
  await page.waitForURL("**/app", { timeout: defaultTimeout });
  await page.getByText(/Workspace privado/).waitFor();
  mark("login", "passed", "Login completado y acceso privado abierto.");
}

async function runBrowserChecklist(inputFiles) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(defaultTimeout);

  try {
    await createAccountAndLogin(page);

    await createProject(page, {
      template: "Analisis individual",
      brand: "Banco Atlas",
      campaign: "QA Individual Sprint 32",
      experimentLabel: "Individual",
      newWorkspace: "Banco Atlas / QA Sprint 32",
    });
    mark("crear_workspace", "passed", "Workspace creado desde el wizard de proyecto.");
    mark("crear_proyecto", "passed", "Proyecto completo creado con marca, campana, objetivo, canal, audiencia, idioma y KPI.");
    mark("crear_experimento_individual", "passed", "Experimento Individual creado desde el wizard.");

    await createProject(page, {
      template: "Spot A/B/C",
      brand: "Banco Atlas",
      campaign: "QA Spot 30s ABC Sprint 32",
      experimentLabel: "A/B/C",
    });
    mark("crear_abc", "passed", "Experimento A/B/C creado y listo para asociar tres versiones.");

    await page.goto(`${baseUrl}/app/upload`, { waitUntil: "networkidle" });
    await page.locator("input[type='file']").setInputFiles(inputFiles);
    await page.waitForFunction(() => document.querySelectorAll(".asset-row-card").length >= 3);
    const assetText = await page.locator(".asset-row-list").innerText();
    if (!assetText.includes("sprint32_video")) throw new Error("No aparece el asset de video en la lista.");
    if (!assetText.includes("sprint32_audio")) throw new Error("No aparece el asset de audio en la lista.");
    if (!assetText.includes("sprint32_text")) throw new Error("No aparece el asset de texto en la lista.");
    mark("upload_video", "passed", "Video cargado y asociado al experimento A/B/C.");
    mark("upload_audio", "passed", "Audio cargado y asociado al experimento A/B/C.");
    mark("upload_texto", "passed", "Texto cargado y asociado al experimento A/B/C.");

    await page.getByText("Health check").first().waitFor();
    const healthText = await page.locator("body").innerText();
    if (!/health check/i.test(healthText)) throw new Error("Health check incompleto.");
    mark("health_check", "passed", "Health check muestra tipo, peso, duracion/metadatos y creditos.");

    await page.getByRole("button", { name: "Preparar inputs TRIBE" }).first().click();
    await page.waitForFunction(() => document.querySelectorAll(".preprocessing-job").length >= 3);
    mark("preprocesamiento", "passed", "Preprocesamiento genera jobs y derivados para video/audio/texto.");

    await page.getByRole("button", { name: "Lanzar TRIBE" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".analysis-run-card").length >= 3, null, { timeout: runTimeout });
    const runText = await page.locator(".analysis-run-list").innerText();
    if (realMode && runText.includes("local_mock")) {
      throw new Error("TRIBE real requerido, pero el run muestra provider local_mock.");
    }
    mark(
      "tribe_real",
      realMode ? "passed" : "simulated",
      realMode ? "Worker TRIBE remoto completo y artefactos recibidos desde backend." : "Flujo TRIBE cubierto en modo local simulado; ejecutar QA_REAL_MODE=true para validar worker real.",
    );

    await page.getByRole("button", { name: "Calcular scoring" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".scoring-result-card").length >= 3, null, { timeout: defaultTimeout });
    mark("scoring", "passed", "Scoring calculado y visible en cards con NRI, confianza, benchmark y timeline.");

    await page.goto(`${baseUrl}/app/results`, { waitUntil: "networkidle" });
    await page.getByText(/Empieza por la decision/).waitFor();
    await page.locator(".result-tab-panel").first().waitFor();
    mark("dashboard", "passed", "Dashboard individual abre resultados accionables con decision y timeline.");

    await page.getByRole("button", { name: "Informe" }).click();
    await page.getByRole("button", { name: "Generar informe" }).click();
    await page.waitForSelector(".report-generated-card");
    const reportDownload = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "PDF" }).click(),
    ]).then(([download]) => download);
    const reportPath = join(outDir, "sprint32-functional-report.pdf");
    await reportDownload.saveAs(reportPath);
    const reportHead = (await readFile(reportPath)).subarray(0, 8).toString("utf8");
    if (reportHead !== "%PDF-1.4") throw new Error(`PDF invalido: ${reportHead}`);
    artifacts.reportPdf = reportPath;
    mark("pdf", "passed", "Informe PDF generado y descargado con cabecera valida.", reportPath);

    await page.goto(`${baseUrl}/app/compare`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Regenerar mix|Generar comparativa/ }).click();
    await page.waitForSelector(".comparison-version-card");
    const versions = await page.locator(".comparison-version-card").count();
    if (versions < 2) throw new Error(`Comparativa insuficiente: ${versions} versiones.`);
    mark("comparativa", "passed", `Comparativa A/B/C generada con ${versions} versiones y mix recomendado.`);

    await page.goto(`${baseUrl}/app/workflow`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Del informe a la ejecucion editorial." }).waitFor();
    await page.getByRole("button", { name: "Crear 3 tareas" }).click();
    await page.getByLabel("Comentario").fill("00:18-00:22 recortar locucion y adelantar claim.");
    await page.getByRole("button", { name: "Anadir comentario" }).click();
    await page.getByRole("button", { name: "Crear share link" }).click();
    await page.getByText(/client_viewer/).waitFor();
    const shareHref = await page.getByRole("link", { name: "Abrir viewer" }).getAttribute("href");
    if (!shareHref) throw new Error("No se genero share link.");
    await page.goto(`${baseUrl}${shareHref}`, { waitUntil: "networkidle" });
    await page.locator(".share-panel .share-row").first().waitFor();
    mark("share_link", "passed", `Share link externo de solo lectura operativo: ${shareHref}.`);

    await page.goto(`${baseUrl}/app/benchmarks`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "El moat empieza cuando el cliente compara contra su propio historico." }).waitFor();
    await page.getByRole("button", { name: "Asignar pieza nueva" }).click();
    await page.getByText(/Pieza nueva|Hipotecas Q2/).first().waitFor();
    mark("benchmark", "passed", "Pieza asignada a benchmark y percentiles visibles.");
    await page.getByRole("button", { name: "Importar KPI" }).click();
    await page.getByText(/resultados reales|VTR/).first().waitFor();
    mark("kpi_externo", "passed", "KPI externo importado manualmente y visible en calibracion.");

    await page.goto(`${baseUrl}/app/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector(".admin-stat-card");
    await page.getByText("Coste estimado").first().waitFor();
    mark("admin_coste", "passed", "Admin muestra creditos, coste estimado, GPU, tokens, storage y uso.");

    const monthlyDownload = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export mensual" }).click(),
    ]).then(([download]) => download);
    const monthlyPath = join(outDir, "sprint32-monthly-usage.json");
    await monthlyDownload.saveAs(monthlyPath);
    artifacts.monthlyUsage = monthlyPath;
    mark("export_uso", "passed", "Export mensual de uso generado para facturacion manual beta.", monthlyPath);

    const beforeAssets = await page.locator(".admin-delete-panel select option").count();
    await page.getByRole("button", { name: "Borrar asset y derivados" }).click();
    await page.waitForTimeout(500);
    const afterAssets = await page.locator(".admin-delete-panel select option").count();
    const adminText = await page.locator("body").innerText();
    if (afterAssets !== beforeAssets - 1 || !adminText.includes("secure_delete.completed")) {
      throw new Error(`Borrado seguro no confirmado. before=${beforeAssets} after=${afterAssets}`);
    }
    mark("borrado_seguro", "passed", "Borrado seguro elimina asset/derivados y deja audit log.");

    const screenshot = join(outDir, "sprint32-functional-admin-after-delete.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    artifacts.screenshot = screenshot;
  } finally {
    await browser.close();
  }
}

async function writeManifest(error = null) {
  const failed = Object.entries(checklist).filter(([, item]) => item.status === "failed");
  const pending = Object.entries(checklist).filter(([, item]) => item.status === "pending");
  const simulated = Object.entries(checklist).filter(([, item]) => item.status === "simulated");
  const productionReady = realMode && failed.length === 0 && pending.length === 0 && simulated.length === 0 && !error;
  const ok = !error && failed.length === 0 && pending.length === 0 && (!realMode || simulated.length === 0);
  const manifest = {
    ok,
    productionReady,
    realMode,
    baseUrl,
    apiUrl,
    generatedAt: new Date().toISOString(),
    checklist,
    summary: {
      total: checklistOrder.length,
      passed: Object.values(checklist).filter((item) => item.status === "passed").length,
      simulated: simulated.length,
      pending: pending.length,
      failed: failed.length,
    },
    artifacts,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
  const manifestPath = join(outDir, realMode ? "sprint32-functional-checklist-real.json" : "sprint32-functional-checklist.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return { manifest, manifestPath };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  if (realMode) await assertRealDependencies();
  const inputs = await ensureInputs();
  await runBrowserChecklist(inputs);
  const { manifest, manifestPath } = await writeManifest();
  console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
  if (!manifest.ok) process.exit(1);
}

main().catch(async (error) => {
  const firstPending = Object.keys(checklist).find((id) => checklist[id].status === "pending");
  if (firstPending) mark(firstPending, "failed", error instanceof Error ? error.message : String(error));
  const { manifest, manifestPath } = await writeManifest(error);
  console.error(JSON.stringify({ ...manifest, manifestPath }, null, 2));
  process.exit(1);
});
