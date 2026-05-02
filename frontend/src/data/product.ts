import {
  AudioLines,
  BrainCircuit,
  ChartNoAxesCombined,
  Clock3,
  FileText,
  Gauge,
  Layers3,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProductMetric = {
  name: string;
  description: string;
  decision: string;
  icon: LucideIcon;
};

export const metrics: ProductMetric[] = [
  {
    name: "Neural Response Index",
    description: "Indice general de respuesta predicha para comparar versiones sin venderlo como verdad absoluta.",
    decision: "Elegir master creativo",
    icon: Gauge,
  },
  {
    name: "Visual Salience",
    description: "Fortaleza de la capa visual y de sus cambios de escena, ritmo y foco.",
    decision: "Reordenar planos",
    icon: Video,
  },
  {
    name: "Narrative Clarity",
    description: "Claridad de progresion narrativa y densidad semantica del mensaje.",
    decision: "Ajustar guion",
    icon: FileText,
  },
  {
    name: "Multimodal Coherence",
    description: "Coherencia entre imagen, audio y texto cuando aparecen juntos.",
    decision: "Sincronizar capas",
    icon: Layers3,
  },
  {
    name: "Temporal Momentum",
    description: "Curva temporal, picos, valles y tramos planos de la pieza.",
    decision: "Editar por timecode",
    icon: Clock3,
  },
  {
    name: "Action Readiness",
    description: "Proximidad del cierre, CTA o decision creativa al momento de mayor traccion.",
    decision: "Mover CTA",
    icon: ChartNoAxesCombined,
  },
];

export const trustItems = [
  { label: "Uso", value: "Decision creativa sobre contenido; no scoring de personas." },
  { label: "Salida", value: "Hipotesis accionables, benchmarks, confianza y evidencia." },
  { label: "Privacidad", value: "Assets de cliente separados por organizacion y retencion configurable." },
  { label: "Gobierno", value: "Lenguaje controlado y claims prohibidos antes de generar PDF." },
];

export const plans = [
  {
    code: "Sprint 10",
    title: "Sprint 10",
    price: "12.000-20.000 EUR",
    items: ["10 piezas analizadas", "Ranking de versiones", "Informe ejecutivo", "Workshop de decision", "Recomendaciones por timecode"],
  },
  {
    code: "Piloto",
    title: "Piloto corporativo",
    price: "15.000-40.000 EUR",
    featured: true,
    items: ["10-30 assets", "Comparativa A/B/C", "Benchmark inicial", "2 workshops", "Reanalisis de versiones finales"],
  },
  {
    code: "SaaS",
    title: "Professional",
    price: "Lista de espera",
    items: ["Workspace multiusuario", "Creditos mensuales", "Informes avanzados", "Admin de consumo", "Soporte prioritario"],
  },
];

export const acceptedFormats = [
  { label: "Video", formats: ".mp4, .avi, .mov, .mkv, .webm", icon: Video },
  { label: "Audio", formats: ".mp3, .wav, .flac, .ogg, .m4a", icon: AudioLines },
  { label: "Texto", formats: ".txt, .md, .srt", icon: FileText },
];

export const governanceCards = [
  {
    title: "Instrumento, no oraculo",
    body: "El producto recomienda ediciones y comparaciones; la decision final sigue siendo humana.",
    icon: BrainCircuit,
  },
  {
    title: "Confianza visible",
    body: "Cada score vive con confianza, benchmark y evidencia. Ningun numero aparece solo.",
    icon: ShieldCheck,
  },
  {
    title: "PDF como output central",
    body: "El informe esta pensado para circular por comites, agencias y equipos de contenido.",
    icon: Sparkles,
  },
];

