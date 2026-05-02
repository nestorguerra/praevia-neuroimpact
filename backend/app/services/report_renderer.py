from __future__ import annotations

import hashlib
import html
import json
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from app.schemas.reports import ReportRead
from app.schemas.scoring import NeuroScoringRead
from app.settings import settings


ReportTemplate = Literal["executive", "creative", "technical"]


@dataclass(frozen=True)
class RenderedReportArtifacts:
    html_path: Path
    pdf_path: Path
    html_sha256: str
    pdf_sha256: str
    html_bytes: int
    pdf_bytes: int
    page_count: int


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _escape(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def _date(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def _timecode(seconds: float) -> str:
    safe = max(0, float(seconds))
    minutes = int(safe // 60)
    whole_seconds = int(round(safe % 60))
    return f"{minutes:02d}:{whole_seconds:02d}"


def _short_hash(value: str | None) -> str:
    if not value:
        return "no-disponible"
    return value[:12]


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _recommendations(report: ReportRead) -> list[dict]:
    for section in report.sections:
        if section.section_key == "recommendations":
            rows = section.payload.get("recommendations", [])
            if isinstance(rows, list):
                return [row for row in rows[:5] if isinstance(row, dict)]
    return []


def _top_scores(scoring: NeuroScoringRead):
    top = max(scoring.editorial_scores, key=lambda score: score.score)
    weak = min(scoring.editorial_scores, key=lambda score: score.score)
    peak = next((moment for moment in scoring.peak_moments if moment.moment_type == "peak"), scoring.peak_moments[0])
    valley = next((moment for moment in scoring.peak_moments if moment.moment_type == "valley"), scoring.peak_moments[0])
    return top, weak, peak, valley


def _footer(report: ReportRead, scoring: NeuroScoringRead, page: int, total: int) -> str:
    return (
        f"<div class=\"footer mono\"><span>Report {_escape(report.id)} - model {_escape(scoring.model_id)} "
        f"- prompt {_escape(report.usage.prompt_version)}</span><span>BENCH {_escape(scoring.benchmark_label)} - {page:02d}/{total:02d}</span></div>"
    )


def _score_cards(scoring: NeuroScoringRead, limit: int = 9) -> str:
    cards = []
    for score in scoring.editorial_scores[:limit]:
        cards.append(
            "<article class=\"score\">"
            f"<span>{_escape(score.metric_label)}</span>"
            f"<b>{_escape(score.score)}</b>"
            f"<p>{_escape(score.action)}</p>"
            f"<small>CONF {_escape(round(score.confidence, 2))} - BENCH {_escape(score.benchmark_delta)}</small>"
            "</article>"
        )
    return "".join(cards)


def _timeline(scoring: NeuroScoringRead) -> str:
    bars = []
    for point in scoring.timecourse_points[:80]:
        color = "#B4DC54" if point.event_label == "peak" else "#FF6B5A" if point.event_label == "valley" else "#22C7D8"
        height = max(10, min(100, float(point.normalized_response)))
        bars.append(
            "<div class=\"bar\">"
            f"<i style=\"height:{height}px;background:{color};\"></i>"
            f"<span>{_timecode(point.stimulus_time_seconds)}</span>"
            "</div>"
        )
    return "".join(bars)


def _recommendation_rows(report: ReportRead) -> str:
    rows = []
    for index, row in enumerate(_recommendations(report), start=1):
        rows.append(
            "<article class=\"rec\">"
            f"<div class=\"rank\">{index:02d}</div>"
            f"<div class=\"tc\">{_escape(row.get('timecode', 'global'))}</div>"
            f"<div class=\"layer\">{_escape(row.get('layer', 'decision'))}</div>"
            f"<p>{_escape(row.get('action', 'Revisar este punto antes de version final.'))}</p>"
            f"<div class=\"conf\">CONF {_escape(row.get('confidence', 'media'))}<br/>impacto {_escape(row.get('impact', 'medio'))}</div>"
            "</article>"
        )
    return "".join(rows)


def _technical_rows(scoring: NeuroScoringRead) -> str:
    networks = "".join(
        f"<p><b>{_escape(row.network_label)}</b><span>{_escape(row.score)} - CONF {_escape(round(row.confidence, 2))}</span></p>"
        for row in scoring.network_scores[:8]
    )
    regions = "".join(
        f"<p><b>{_escape(row.region_label)}</b><span>{_escape(row.score)} - peak {_escape(round(row.peak_response, 4))}</span></p>"
        for row in scoring.region_scores[:10]
    )
    return f"<div class=\"tile\"><span>Networks</span>{networks}</div><div class=\"tile\"><span>ROIs</span>{regions}</div>"


def build_report_html(report: ReportRead, scoring: NeuroScoringRead, *, asset_sha256: str | None = None) -> str:
    top, weak, peak, valley = _top_scores(scoring)
    template = report.report_type
    total_pages = 4 if template == "executive" else 5 if template == "creative" else 6
    technical_page = ""
    if template == "technical":
        technical_page = f"""
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>{_escape(report.id)} - anexo tecnico</div></div>
  <div class="kicker mono">05 - Anexo tecnico</div>
  <h2>Redes, regiones y trazabilidad.</h2>
  <div class="two-col">{_technical_rows(scoring)}</div>
  {_footer(report, scoring, 6, total_pages)}
</section>"""

    recommendations_page = ""
    if template in {"creative", "technical"}:
        recommendations_page = f"""
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>{_escape(report.id)} - recomendaciones</div></div>
  <div class="kicker mono">03 - Recomendaciones priorizadas</div>
  <h2>Maximo cinco acciones.</h2>
  <div class="recs">{_recommendation_rows(report)}</div>
  {_footer(report, scoring, 4, total_pages)}
</section>"""

    methodology_page_number = 4 if template == "executive" else 5
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>{_escape(report.title)}</title>
<style>
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; background: #2A2D32; color: #17202A; }}
body {{ font-family: Georgia, "Times New Roman", serif; }}
.page {{ width: 210mm; height: 297mm; margin: 12mm auto; padding: 20mm 18mm; background: #F4F1EA; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; }}
.page:last-child {{ page-break-after: auto; }}
@media print {{ html, body {{ background: #F4F1EA; }} .page {{ margin: 0; }} }}
.mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }}
.header, .footer {{ display: flex; justify-content: space-between; gap: 14px; color: #69717C; font-size: 8px; border-bottom: 1px solid #D8D1C3; padding-bottom: 9px; overflow-wrap: anywhere; }}
.footer {{ margin-top: auto; border-bottom: 0; border-top: 1px solid #D8D1C3; padding: 10px 0 0; }}
.brand {{ color: #17202A; font-size: 21px; letter-spacing: 0; text-transform: none; }}
.brand em, h1 em, h2 em {{ color: #B7792F; }}
.kicker {{ color: #B7792F; font-size: 10px; margin: 14px 0; }}
h1 {{ max-width: 13ch; margin: 36mm 0 0; font-size: 58px; line-height: .96; font-weight: 400; letter-spacing: 0; }}
h2 {{ margin: 0 0 10px; font-size: 30px; line-height: 1.05; font-weight: 500; letter-spacing: 0; }}
h3 {{ margin: 0 0 8px; font-size: 18px; line-height: 1.2; }}
p {{ margin: 0; color: #58616D; line-height: 1.45; font-size: 13px; overflow-wrap: anywhere; }}
.lede {{ max-width: 62ch; margin-top: 18px; font-size: 17px; color: #404A55; }}
.meta, .grid, .two-col {{ display: grid; gap: 8px; }}
.meta {{ grid-template-columns: repeat(4, 1fr); margin-top: 24mm; }}
.grid {{ grid-template-columns: repeat(3, 1fr); margin: 14px 0; }}
.two-col {{ grid-template-columns: 1fr 1fr; margin-top: 14px; }}
.decision, .score, .rec, .method, .timeline, .tile, .meta div {{ border: 1px solid #D8D1C3; background: #ECE7DC; border-radius: 4px; }}
.meta div, .score, .tile {{ padding: 12px; }}
.meta span, .score span, .tile span {{ display: block; color: #69717C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 7px; }}
.meta strong {{ display: block; color: #17202A; font-size: 14px; overflow-wrap: anywhere; }}
.decision {{ padding: 18px; margin: 14px 0 18px; border-color: rgba(183,121,47,.44); }}
.decision strong {{ display: block; color: #B7792F; font-size: 10px; margin-bottom: 8px; }}
.decision p {{ color: #17202A; font-size: 18px; line-height: 1.34; }}
.score b {{ display: block; color: #B7792F; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 27px; margin-top: 4px; }}
.score p {{ font-size: 11px; margin-top: 7px; }}
.score small {{ display: block; margin-top: 8px; color: #69717C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; }}
.timeline {{ padding: 14px; margin: 16px 0; }}
.bars {{ height: 126px; display: grid; grid-template-columns: repeat({max(1, min(80, len(scoring.timecourse_points)))}, 1fr); gap: 4px; align-items: end; padding: 10px; background: #17202A; border-radius: 3px; }}
.bar {{ display: grid; gap: 5px; align-items: end; color: #87909C; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 7px; text-align: center; min-width: 0; }}
.bar i {{ display: block; border-radius: 999px 999px 2px 2px; }}
.recs {{ display: grid; gap: 8px; margin-top: 14px; }}
.rec {{ display: grid; grid-template-columns: 34px 74px 78px 1fr 76px; gap: 10px; padding: 10px; align-items: baseline; min-height: 54px; }}
.rank, .tc, .layer, .conf {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; color: #58616D; }}
.rank, .tc {{ color: #B7792F; }}
.layer {{ text-transform: uppercase; letter-spacing: .1em; }}
.rec p {{ color: #17202A; font-size: 11px; line-height: 1.35; }}
.method {{ padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }}
.method p, .tile p {{ font-size: 11px; }}
.tile p {{ padding: 6px 0; border-bottom: 1px dashed #D8D1C3; color: #17202A; display: flex; justify-content: space-between; gap: 10px; }}
.tile p:last-child {{ border-bottom: 0; }}
</style>
</head>
<body>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>CONFIDENCIAL - {_escape(report.id)}</div></div>
  <div>
    <div class="kicker mono">Informe {_escape(template)} - NeuroImpact Analyzer</div>
    <h1>Que cambiar.<br/>Y <em>por que.</em></h1>
    <p class="lede">{_escape(report.tldr)}</p>
  </div>
  <div class="meta">
    <div><span>Asset</span><strong>{_escape(scoring.asset_name)}</strong></div>
    <div><span>NRI</span><strong>{_escape(scoring.summary.get("nri"))}</strong></div>
    <div><span>Confianza</span><strong>{_escape(scoring.confidence_label)}</strong></div>
    <div><span>Fecha</span><strong>{_escape(_date(report.created_at))}</strong></div>
  </div>
  <div class="decision"><strong class="mono">Decision recomendada</strong><p>{_escape(report.decision)}</p></div>
  {_footer(report, scoring, 1, total_pages)}
</section>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>{_escape(report.id)} - resumen</div></div>
  <div class="kicker mono">01 - Resumen ejecutivo</div>
  <h2>Tres lecturas. Una decision <em>accionable</em>.</h2>
  <div class="decision"><strong class="mono">TL;DR</strong><p>{_escape(report.tldr)}</p></div>
  <div class="grid">{_score_cards(scoring, 6 if template == "executive" else 9)}</div>
  {_footer(report, scoring, 2, total_pages)}
</section>
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>{_escape(report.id)} - timeline</div></div>
  <div class="kicker mono">02 - Timeline accionable</div>
  <h2>Del BOLD al timecode de montaje.</h2>
  <p>Correccion usada: {_escape(scoring.bold_delay_seconds)}s hacia tiempo de estimulo. Peak {_timecode(peak.start_seconds)}-{_timecode(peak.end_seconds)}. Valley {_timecode(valley.start_seconds)}-{_timecode(valley.end_seconds)}.</p>
  <div class="timeline"><div class="bars">{_timeline(scoring)}</div></div>
  <div class="grid">
    <article class="score"><span>Fortaleza</span><b>{_escape(top.score)}</b><p>{_escape(top.metric_label)} - {_escape(top.action)}</p></article>
    <article class="score"><span>A corregir</span><b>{_escape(weak.score)}</b><p>{_escape(weak.metric_label)} - {_escape(weak.action)}</p></article>
    <article class="score"><span>Asset hash</span><b style="font-size:15px;">{_escape(_short_hash(asset_sha256))}</b><p>Hash SHA-256 del asset original o version usada.</p></article>
  </div>
  {_footer(report, scoring, 3, total_pages)}
</section>
{recommendations_page}
<section class="page">
  <div class="header mono"><div class="brand">prae<em>vi</em>A</div><div>{_escape(report.id)} - metodologia</div></div>
  <div class="kicker mono">04 - Metodo y limites</div>
  <h2>Instrumento. <em>No oraculo.</em></h2>
  <div class="method">
    <div>
      <h3>Modelo y prompt</h3>
      <p>TRIBE/modelo: {_escape(scoring.model_id)}. Scoring: {_escape(scoring.scoring_version)}. Prompt: {_escape(report.usage.prompt_version)}.</p>
      <h3>Benchmark</h3>
      <p>{_escape(scoring.benchmark_label)}. Los scores se leen como indicadores comparativos, no como medicion de audiencia real.</p>
    </div>
    <div>
      <h3>Guardrails</h3>
      <p>Estado: {_escape(report.guardrail_status)}. Findings: {_escape(len(report.guardrail_findings))}. Lenguaje sin promesas absolutas.</p>
      <h3>Artefactos</h3>
      <p>HTML: {_escape(report.html_storage_key)}. PDF: {_escape(report.pdf_storage_key)}. Asset hash: {_escape(_short_hash(asset_sha256))}.</p>
    </div>
  </div>
  {_footer(report, scoring, methodology_page_number, total_pages)}
</section>
{technical_page}
</body>
</html>"""


def _validate_pdf_html(html_text: str, expected_pages: int) -> None:
    page_count = html_text.count('class="page"')
    if page_count != expected_pages:
        raise RuntimeError(f"Report template produced {page_count} pages, expected {expected_pages}.")
    if "overflow: hidden" not in html_text or "@page" not in html_text:
        raise RuntimeError("Report template is missing print/overflow controls.")


def _render_with_python_playwright(html_path: Path, pdf_path: Path) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1240, "height": 1754})
        page.set_content(html_path.read_text(encoding="utf-8"), wait_until="networkidle")
        overflow = page.evaluate(
            """() => Array.from(document.querySelectorAll('.page')).map((page, index) => ({
              index,
              scrollHeight: page.scrollHeight,
              clientHeight: page.clientHeight,
              overflow: page.scrollHeight > page.clientHeight + 2
            }))"""
        )
        overflowing = [item for item in overflow if item.get("overflow")]
        if overflowing:
            browser.close()
            raise RuntimeError(f"PDF page overflow: {json.dumps(overflowing)}")
        page.pdf(path=str(pdf_path), format="A4", print_background=True, prefer_css_page_size=True)
        browser.close()


def _render_with_node_playwright(html_path: Path, pdf_path: Path) -> None:
    script = _repo_root() / "reporting" / "render-html-to-pdf.mjs"
    completed = subprocess.run(
        ["node", str(script), "--input-html", str(html_path), "--output-pdf", str(pdf_path)],
        cwd=_repo_root(),
        text=True,
        capture_output=True,
        timeout=settings.report_renderer_timeout_seconds,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr or completed.stdout or "Node Playwright renderer failed.")


def render_report_artifacts(
    report: ReportRead,
    scoring: NeuroScoringRead,
    *,
    asset_sha256: str | None = None,
    output_dir: Path | None = None,
) -> RenderedReportArtifacts:
    expected_pages = 4 if report.report_type == "executive" else 5 if report.report_type == "creative" else 6
    html_text = build_report_html(report, scoring, asset_sha256=asset_sha256)
    _validate_pdf_html(html_text, expected_pages)

    if output_dir is None:
        output_dir = Path(tempfile.mkdtemp(prefix="praevia-report-"))
    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / "report.html"
    pdf_path = output_dir / "report.pdf"
    html_path.write_text(html_text, encoding="utf-8")

    if settings.report_renderer_mode == "node":
        _render_with_node_playwright(html_path, pdf_path)
    else:
        try:
            _render_with_python_playwright(html_path, pdf_path)
        except ModuleNotFoundError:
            _render_with_node_playwright(html_path, pdf_path)

    if not pdf_path.exists() or pdf_path.stat().st_size < 3000:
        raise RuntimeError("Rendered PDF is missing or too small.")
    if pdf_path.read_bytes()[:8].decode("utf-8", errors="ignore") != "%PDF-1.4":
        raise RuntimeError("Rendered report is not a PDF 1.4 document.")

    return RenderedReportArtifacts(
        html_path=html_path,
        pdf_path=pdf_path,
        html_sha256=_file_sha256(html_path),
        pdf_sha256=_file_sha256(pdf_path),
        html_bytes=html_path.stat().st_size,
        pdf_bytes=pdf_path.stat().st_size,
        page_count=expected_pages,
    )
