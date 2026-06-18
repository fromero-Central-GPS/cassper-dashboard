#!/usr/bin/env tsx
/**
 * Detector multi-estado de oportunidades — Central GPS
 *
 * Expande el MVP original (solo perdidas) para cubrir 3 estados:
 *   1. LOST   → Diagnóstico de razón de pérdida + scoring de recuperabilidad
 *   2. OPEN   → Early warning: detección de riesgo de abandono inminente
 *   3. WON    → Win analysis: patrones de éxito y señales de cierre
 *
 * Uso: npx tsx scripts/recovery-mvp/index.ts [demo-data.json]
 *
 * En producción se ejecuta desde un agente Paperclip con acceso al MCP de GHL.
 */

import { join } from "path";
import {
  filterRecentOpportunities,
  parseMessages,
  type Opportunity,
} from "./ghl-client.js";
import { analyzeOpportunity, weightedScore } from "./analyzer.js";
import { generateMultiStatusReport, saveReport, type ReportRow } from "./report.js";

// ─── Config ────────────────────────────────────────────────────────────────

const REPORTS_DIR = join(process.cwd(), "reports");
const TOP_N_PER_CATEGORY = 15;
const TODAY = new Date().toISOString().slice(0, 10);

// Known "Perdido" stages from the 6 pipelines
const LOST_STAGES: Array<{ pipelineId: string; pipelineName: string; stageId: string; stageName: string }> = [
  { pipelineId: "MNxYbS1kOg11IiU2QbMv", pipelineName: "Central GPS",   stageId: "2bfd0ea8-b816-4e1c-88de-4d25e2b535fb", stageName: "Perdido" },
  { pipelineId: "qT53Vm7EKeS4gG8cyCG2", pipelineName: "Ejemplo DEMO",  stageId: "7c3069a1-6d2f-443a-8074-641975f4daf9", stageName: "Perdido" },
  { pipelineId: "bn2cknrVRCMLZYLQKkMb", pipelineName: "Ventas - Demo", stageId: "ed11aaf3-32f8-46ed-9588-1147fd117133", stageName: "Negocio perdido" },
];

// Known "Ganado" / "Negocio cerrado" stages
const WON_STAGES: Array<{ pipelineId: string; pipelineName: string; stageId: string; stageName: string }> = [
  { pipelineId: "MNxYbS1kOg11IiU2QbMv", pipelineName: "Central GPS",   stageId: "ed6aa62d-fb4e-4d44-bcd1-133ab984e2f8", stageName: "Aceptado" },
  { pipelineId: "qT53Vm7EKeS4gG8cyCG2", pipelineName: "Ejemplo DEMO",  stageId: "20cd75cf-a13c-4b8a-ac57-f97141efa8a6", stageName: "Ganado" },
  { pipelineId: "bn2cknrVRCMLZYLQKkMb", pipelineName: "Ventas - Demo", stageId: "c37eff6f-a962-4b0b-bfa0-cd1c25741cd3", stageName: "Negocio cerrado" },
];

// ─── Early Warning Engine (open opportunities) ─────────────────────────────

const EARLY_WARNING_PATTERNS = {
  // Señales de que un lead abierto está en riesgo de irse a perdido
  noResponse: {
    thresholdDays: 7,
    label: "Sin respuesta del vendedor",
    severity: "high" as const,
  },
  clientWaiting: {
    thresholdHours: 4,
    label: "Cliente esperando respuesta",
    severity: "urgent" as const,
  },
  stalling: {
    thresholdDays: 14,
    label: "Oportunidad estancada sin actividad",
    severity: "medium" as const,
  },
};

interface EarlyWarning {
  opportunityId: string;
  contactName: string;
  value: number;
  stage: string;
  warnings: Array<{ type: string; severity: "urgent" | "high" | "medium"; detail: string }>;
  lastActivity: string;
  daysSinceLastContact: number;
  intentSignals: string[];
}

function detectEarlyWarnings(
  opp: Opportunity,
  messages: Array<{ direction: string; body: string; dateAdded: string; messageType: string }>
): EarlyWarning {
  const now = Date.now();
  const warnings: EarlyWarning["warnings"] = [];
  const intentSignals: string[] = [];

  // Find last inbound and outbound
  let lastInbound: Date | null = null;
  let lastOutbound: Date | null = null;
  let lastAny: Date | null = null;

  for (const msg of messages) {
    const d = new Date(msg.dateAdded);
    if (!lastAny || d > lastAny) lastAny = d;
    if (msg.direction === "inbound" && (!lastInbound || d > lastInbound)) lastInbound = d;
    if (msg.direction === "outbound" && (!lastOutbound || d > lastOutbound)) lastOutbound = d;
  }

  const daysSinceLastContact = lastAny
    ? Math.floor((now - lastAny.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Check: client sent inbound but no outbound response within 4h
  if (lastInbound && lastOutbound) {
    const hoursBetween = (lastOutbound.getTime() - lastInbound.getTime()) / (1000 * 60 * 60);
    if (hoursBetween > EARLY_WARNING_PATTERNS.clientWaiting.thresholdHours && lastInbound > lastOutbound) {
      const hoursWaiting = Math.floor((now - lastInbound.getTime()) / (1000 * 60 * 60));
      warnings.push({
        type: "client_waiting",
        severity: "urgent",
        detail: `Cliente escribió hace ${hoursWaiting}h y no ha recibido respuesta`,
      });
    }
  } else if (lastInbound && !lastOutbound) {
    const hoursWaiting = Math.floor((now - lastInbound.getTime()) / (1000 * 60 * 60));
    warnings.push({
      type: "client_waiting",
      severity: "urgent",
      detail: `Cliente escribió hace ${hoursWaiting}h sin respuesta del equipo`,
    });
  }

  // Check: no activity for 7+ days
  if (daysSinceLastContact >= EARLY_WARNING_PATTERNS.noResponse.thresholdDays) {
    warnings.push({
      type: "no_contact",
      severity: "high",
      detail: `${daysSinceLastContact} días sin contacto con el cliente`,
    });
  }

  // Check: stalling (last outbound >14d ago, no inbound)
  if (lastOutbound && !lastInbound) {
    const daysSinceOutbound = Math.floor((now - lastOutbound.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceOutbound >= EARLY_WARNING_PATTERNS.stalling.thresholdDays) {
      warnings.push({
        type: "stalling",
        severity: "medium",
        detail: `Último contacto outbound hace ${daysSinceOutbound}d, sin respuesta del cliente`,
      });
    }
  }

  // Quick intent detection (lightweight regex, same patterns as analysis-engine.ts)
  const allText = messages.map((m) => m.body).join(" ");
  const INTENT_PATTERNS = [
    { re: /(?:cotizaci[oó]n|cotizar|cu[áa]nto (?:cuesta|vale|sale)|precio)/i, label: "consulta_precio" },
    { re: /(?:me interesa|estoy interesad[oa]|quiero comprar|quiero contratar)/i, label: "interes_directo" },
    { re: /(?:demo|probar|plataforma|c[oó]mo funciona)/i, label: "solicitud_demo" },
    { re: /(?:urgente|lo antes posible|necesito|necesitamos)/i, label: "urgencia" },
    { re: /(?:instalaci[oó]n|instalar|cu[áa]ndo pueden)/i, label: "consulta_instalacion" },
    { re: /(?:gps|rastreo|monitoreo|tracking)/i, label: "mencion_gps" },
  ];
  for (const { re, label } of INTENT_PATTERNS) {
    if (re.test(allText)) intentSignals.push(label);
  }

  return {
    opportunityId: opp.id,
    contactName: opp.contact.name,
    value: opp.monetaryValue,
    stage: opp.pipelineStageName,
    warnings,
    lastActivity: lastAny?.toISOString() ?? "nunca",
    daysSinceLastContact,
    intentSignals: Array.from(new Set(intentSignals)),
  };
}

// ─── Win Analysis Engine (won opportunities) ───────────────────────────────

interface WinPattern {
  opportunityId: string;
  contactName: string;
  value: number;
  timeToClose: number; // days from creation to won
  signals: string[];
  winningFactors: string[];
}

const WIN_SIGNAL_PATTERNS = [
  { re: /(?:aceptado|confirmado|proceder|avanzar|seguir adelante)/i, label: "confirmacion_activa" },
  { re: /(?:gracias|excelente|perfecto|genial|buen[oí]simo)/i, label: "satisfaccion" },
  { re: /(?:datos para (?:factura|instalaci)|documentos|firmar)/i, label: "documentacion_solicitada" },
  { re: /(?:recomend[aá]|referido|conocido|amigo|colega)/i, label: "potencial_referido" },
  { re: /(?:cu[áa]ndo (?:empieza|instalan|comienzan)|fecha)/i, label: "urgencia_implementacion" },
  { re: /(?:flota|varios (?:veh[íi]culos|equipos)|crecer|escalar)/i, label: "potencial_crecimiento" },
];

function detectWinPatterns(
  opp: Opportunity,
  messages: Array<{ direction: string; body: string; dateAdded: string; messageType: string }>
): WinPattern {
  const allText = messages.map((m) => m.body).join(" ");
  const signals: string[] = [];
  const winningFactors: string[] = [];

  for (const { re, label } of WIN_SIGNAL_PATTERNS) {
    if (re.test(allText)) signals.push(label);
  }

  // Time to close
  const created = new Date(opp.createdAt);
  const updated = new Date(opp.updatedAt);
  const timeToClose = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  // Winning factors
  if (timeToClose <= 3) winningFactors.push("Cierre rápido (≤3 días)");
  else if (timeToClose <= 7) winningFactors.push("Cierre en ≤1 semana");
  else if (timeToClose <= 30) winningFactors.push("Cierre en ≤1 mes");

  const inboundCount = messages.filter((m) => m.direction === "inbound").length;
  if (inboundCount >= 5) winningFactors.push(`Alta respuesta del cliente (${inboundCount} inbound)`);

  if (signals.includes("satisfaccion")) winningFactors.push("Cliente expresó satisfacción");
  if (signals.includes("documentacion_solicitada")) winningFactors.push("Proceso de cierre documentado");
  if (signals.includes("potencial_crecimiento")) winningFactors.push("Potencial de expansión");

  return {
    opportunityId: opp.id,
    contactName: opp.contact.name,
    value: opp.monetaryValue,
    timeToClose,
    signals: Array.from(new Set(signals)),
    winningFactors,
  };
}

// ─── Main: Multi-Status Pipeline ────────────────────────────────────────────

export interface MultiStatusInput {
  rawLostOpportunities: Record<string, unknown>;
  rawOpenOpportunities: Record<string, unknown>;
  rawWonOpportunities: Record<string, unknown>;
  rawMessagesPerContact: Record<string, unknown>;
}

export interface MultiStatusOutput {
  lost: { rows: ReportRow[]; totalValue: number };
  open: { warnings: EarlyWarning[]; totalAtRisk: number };
  won: { patterns: WinPattern[]; totalValue: number };
  reportPath: string;
}

export async function runMultiStatus(opts: MultiStatusInput): Promise<MultiStatusOutput> {
  const { rawLostOpportunities, rawOpenOpportunities, rawWonOpportunities, rawMessagesPerContact } = opts;

  // ─── 1. LOST: full analysis with Claude ──────────────────────────────────
  console.log("[multi-status] ── Analizando oportunidades PERDIDAS ──");
  let lostOpportunities: Opportunity[] = [];

  for (const stage of LOST_STAGES) {
    const raw = rawLostOpportunities[stage.stageId];
    if (!raw) continue;
    const data = raw as { opportunities: Opportunity[] };
    const opps = (data.opportunities ?? []).map((o) => ({
      ...o,
      pipelineName: stage.pipelineName,
      pipelineStageName: stage.stageName,
      contact: ((o as unknown as { contact?: Opportunity["contact"] }).contact) ?? { id: o.contactId, name: o.name },
    }));
    lostOpportunities = lostOpportunities.concat(opps);
  }

  const lostCandidates = filterRecentOpportunities(lostOpportunities, 90);
  console.log(`[multi-status]   ${lostCandidates.length} perdidas en últimos 90 días`);

  const lostRows: ReportRow[] = [];
  for (const opp of lostCandidates) {
    const rawMessages = rawMessagesPerContact[opp.contactId];
    const messages = rawMessages ? parseMessages(rawMessages) : [];
    try {
      const analysis = await analyzeOpportunity(opp, messages);
      const ws = weightedScore(opp, analysis);
      lostRows.push({ opportunity: opp, analysis, weightedScore: ws });
    } catch (err) {
      console.error(`[multi-status]   Error analizando perdida ${opp.id}: ${err}`);
    }
  }
  lostRows.sort((a, b) => b.weightedScore - a.weightedScore);
  const topLost = lostRows.slice(0, TOP_N_PER_CATEGORY);
  const lostTotalValue = lostCandidates.reduce((s, o) => s + o.monetaryValue, 0);

  // ─── 2. OPEN: early warning detection (no Claude needed) ─────────────────
  console.log("[multi-status] ── Analizando oportunidades ABIERTAS ──");
  let openOpportunities: Opportunity[] = [];

  for (const stage of LOST_STAGES) {
    const raw = rawOpenOpportunities[stage.stageId];
    if (!raw) continue;
    const data = raw as { opportunities: Opportunity[] };
    const opps = (data.opportunities ?? []).map((o) => ({
      ...o,
      pipelineName: stage.pipelineName,
      pipelineStageName: stage.stageName,
      contact: ((o as unknown as { contact?: Opportunity["contact"] }).contact) ?? { id: o.contactId, name: o.name },
    }));
    openOpportunities = openOpportunities.concat(opps);
  }

  // For open, we also accept raw data keyed by pipelineId for broad searches
  for (const key of Object.keys(rawOpenOpportunities)) {
    if (LOST_STAGES.some((s) => s.stageId === key)) continue; // already processed
    const raw = rawOpenOpportunities[key];
    if (!raw) continue;
    const data = raw as { opportunities: Opportunity[] };
    const opps = (data.opportunities ?? []).map((o) => ({
      ...o,
      pipelineName: o.pipelineName || "Central GPS",
      pipelineStageName: o.pipelineStageName || "Abierto",
      contact: ((o as unknown as { contact?: Opportunity["contact"] }).contact) ?? { id: o.contactId, name: o.name },
    }));
    openOpportunities = openOpportunities.concat(opps);
  }

  const openWithValue = openOpportunities.filter((o) => o.monetaryValue > 0);
  console.log(`[multi-status]   ${openWithValue.length} abiertas con valor > 0`);

  const earlyWarnings: EarlyWarning[] = [];
  for (const opp of openWithValue) {
    const rawMessages = rawMessagesPerContact[opp.contactId];
    const messages = rawMessages ? parseMessages(rawMessages) : [];
    const warning = detectEarlyWarnings(opp, messages);
    // Only include if there are actual warnings
    if (warning.warnings.length > 0) {
      earlyWarnings.push(warning);
    }
  }

  // Sort: urgent first, then by value desc
  earlyWarnings.sort((a, b) => {
    const severityOrder = { urgent: 0, high: 1, medium: 2 };
    const aMax = Math.min(...a.warnings.map((w) => severityOrder[w.severity]));
    const bMax = Math.min(...b.warnings.map((w) => severityOrder[w.severity]));
    if (aMax !== bMax) return aMax - bMax;
    return b.value - a.value;
  });

  const topWarnings = earlyWarnings.slice(0, TOP_N_PER_CATEGORY);
  const totalAtRisk = earlyWarnings.reduce((s, w) => s + w.value, 0);

  // ─── 3. WON: win pattern analysis (no Claude needed) ─────────────────────
  console.log("[multi-status] ── Analizando oportunidades GANADAS ──");
  let wonOpportunities: Opportunity[] = [];

  for (const stage of WON_STAGES) {
    const raw = rawWonOpportunities[stage.stageId];
    if (!raw) continue;
    const data = raw as { opportunities: Opportunity[] };
    const opps = (data.opportunities ?? []).map((o) => ({
      ...o,
      pipelineName: stage.pipelineName,
      pipelineStageName: stage.stageName,
      contact: ((o as unknown as { contact?: Opportunity["contact"] }).contact) ?? { id: o.contactId, name: o.name },
    }));
    wonOpportunities = wonOpportunities.concat(opps);
  }

  // Also accept status=won data keyed by pipelineId
  for (const key of Object.keys(rawWonOpportunities)) {
    if (WON_STAGES.some((s) => s.stageId === key)) continue;
    const raw = rawWonOpportunities[key];
    if (!raw) continue;
    const data = raw as { opportunities: Opportunity[] };
    const opps = (data.opportunities ?? []).map((o) => ({
      ...o,
      pipelineName: o.pipelineName || "Central GPS",
      pipelineStageName: o.pipelineStageName || "Ganado",
      contact: ((o as unknown as { contact?: Opportunity["contact"] }).contact) ?? { id: o.contactId, name: o.name },
    }));
    wonOpportunities = wonOpportunities.concat(opps);
  }

  const wonWithValue = wonOpportunities.filter((o) => o.monetaryValue > 0);
  console.log(`[multi-status]   ${wonWithValue.length} ganadas con valor > 0`);

  const winPatterns: WinPattern[] = [];
  for (const opp of wonWithValue) {
    const rawMessages = rawMessagesPerContact[opp.contactId];
    const messages = rawMessages ? parseMessages(rawMessages) : [];
    winPatterns.push(detectWinPatterns(opp, messages));
  }

  winPatterns.sort((a, b) => b.value - a.value);
  const topWins = winPatterns.slice(0, TOP_N_PER_CATEGORY);
  const wonTotalValue = wonWithValue.reduce((s, o) => s + o.monetaryValue, 0);

  // ─── 4. Generate combined report ──────────────────────────────────────────
  const content = generateMultiStatusReport({
    lost: { rows: topLost, totalValue: lostTotalValue, totalCount: lostCandidates.length },
    open: { warnings: topWarnings, totalAtRisk, totalCount: earlyWarnings.length },
    won: { patterns: topWins, totalValue: wonTotalValue, totalCount: wonWithValue.length },
    date: TODAY,
  });
  const path = saveReport(content, TODAY, REPORTS_DIR);
  console.log(`[multi-status] Reporte combinado guardado: ${path}`);

  return {
    lost: { rows: topLost, totalValue: lostTotalValue },
    open: { warnings: topWarnings, totalAtRisk },
    won: { patterns: topWins, totalValue: wonTotalValue },
    reportPath: path,
  };
}

// ─── Legacy single-status wrapper ───────────────────────────────────────────

export async function run(opts: {
  rawOpportunitiesPerStage: Record<string, unknown>;
  rawMessagesPerContact: Record<string, unknown>;
}) {
  const result = await runMultiStatus({
    rawLostOpportunities: opts.rawOpportunitiesPerStage,
    rawOpenOpportunities: {},
    rawWonOpportunities: {},
    rawMessagesPerContact: opts.rawMessagesPerContact,
  });
  return { rows: result.lost.rows, reportPath: result.reportPath };
}

// ─── CLI entry point ────────────────────────────────────────────────────────

if (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js")) {
  const demoDataPath = process.argv[2];
  if (!demoDataPath) {
    console.error("Uso: npx tsx scripts/recovery-mvp/index.ts <demo-data.json>");
    console.error("Ver README.md para formato del archivo de datos.");
    console.error("");
    console.error("Formato multi-status:");
    console.error("  {");
    console.error('    "rawLostOpportunities": { "<stageId>": { "opportunities": [...] } },');
    console.error('    "rawOpenOpportunities": { "<pipelineId>": { "opportunities": [...] } },');
    console.error('    "rawWonOpportunities": { "<stageId>": { "opportunities": [...] } },');
    console.error('    "rawMessagesPerContact": { "<contactId>": { "messages": { "messages": [...] } } }');
    console.error("  }");
    process.exit(1);
  }

  const { readFileSync } = await import("fs");
  const demo = JSON.parse(readFileSync(demoDataPath, "utf-8"));

  // Auto-detect mode: if the JSON has the multi-status keys, use runMultiStatus
  if (demo.rawLostOpportunities || demo.rawOpenOpportunities || demo.rawWonOpportunities) {
    await runMultiStatus({
      rawLostOpportunities: demo.rawLostOpportunities ?? demo.rawOpportunitiesPerStage ?? {},
      rawOpenOpportunities: demo.rawOpenOpportunities ?? {},
      rawWonOpportunities: demo.rawWonOpportunities ?? {},
      rawMessagesPerContact: demo.rawMessagesPerContact ?? {},
    });
  } else {
    // Legacy mode
    await run({
      rawOpportunitiesPerStage: demo.rawOpportunitiesPerStage ?? {},
      rawMessagesPerContact: demo.rawMessagesPerContact ?? {},
    });
  }
}
