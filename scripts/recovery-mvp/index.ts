#!/usr/bin/env tsx
/**
 * MVP: Detector de oportunidades perdidas - Central GPS
 *
 * Uso: npx tsx scripts/recovery-mvp/index.ts
 *
 * Requiere:
 *   - ANTHROPIC_API_KEY en env
 *   - Acceso a prod-ghl-mcp (se invoca externamente via MCP o se pasa rawData)
 *
 * En producción se ejecuta desde un agente Paperclip que tiene acceso al MCP.
 * Para testing local, se puede pasar un archivo JSON con los datos de GHL.
 */

import { join } from "path";
import {
  filterRecentOpportunities,
  parseMessages,
  type Opportunity,
} from "./ghl-client.js";
import { analyzeOpportunity, weightedScore } from "./analyzer.js";
import { generateMarkdownReport, saveReport, type ReportRow } from "./report.js";

// ─── Config ────────────────────────────────────────────────────────────────

const REPORTS_DIR = join(process.cwd(), "reports");
const TOP_N = 20;
const TODAY = new Date().toISOString().slice(0, 10);

// Known "Perdido" stages from the 6 pipelines (auto-detected via findLostStages)
// Updated 2026-05-30 via opportunities_get-pipelines
const LOST_STAGES: Array<{ pipelineId: string; pipelineName: string; stageId: string; stageName: string }> = [
  { pipelineId: "MNxYbS1kOg11IiU2QbMv", pipelineName: "Central GPS",   stageId: "2bfd0ea8-b816-4e1c-88de-4d25e2b535fb", stageName: "Perdido" },
  { pipelineId: "qT53Vm7EKeS4gG8cyCG2", pipelineName: "Ejemplo DEMO",  stageId: "7c3069a1-6d2f-443a-8074-641975f4daf9", stageName: "Perdido" },
  { pipelineId: "bn2cknrVRCMLZYLQKkMb", pipelineName: "Ventas - Demo", stageId: "ed11aaf3-32f8-46ed-9588-1147fd117133", stageName: "Negocio perdido" },
];

// ─── Main ──────────────────────────────────────────────────────────────────

export async function run(opts: {
  /** Raw GHL opportunities data per stage (keyed by stageId) */
  rawOpportunitiesPerStage: Record<string, unknown>;
  /** Raw GHL conversation messages per contactId */
  rawMessagesPerContact: Record<string, unknown>;
}) {
  const { rawOpportunitiesPerStage, rawMessagesPerContact } = opts;

  // 1. Parse and merge all opportunities across stages
  let allOpportunities: Opportunity[] = [];

  for (const stage of LOST_STAGES) {
    const raw = rawOpportunitiesPerStage[stage.stageId];
    if (!raw) continue;

    const data = raw as { opportunities: Opportunity[] };
    const opps: Opportunity[] = (data.opportunities ?? []).map((o) => ({
      ...o,
      pipelineName: stage.pipelineName,
      pipelineStageName: stage.stageName,
      contact: (o as unknown as { contact?: { id: string; name: string; email?: string; phone?: string; tags?: string[] } }).contact ?? { id: o.contactId, name: o.name },
    }));

    allOpportunities = allOpportunities.concat(opps);
  }

  // 2. Filter: monetaryValue > 0, last 90 days
  const candidates = filterRecentOpportunities(allOpportunities, 90);
  console.log(`[recovery-mvp] ${candidates.length} candidatos con valor > 0 en últimos 90 días`);

  // 3. Analyze each opportunity
  const rows: ReportRow[] = [];

  for (const opp of candidates) {
    const rawMessages = rawMessagesPerContact[opp.contactId];
    const messages = rawMessages ? parseMessages(rawMessages) : [];

    try {
      const analysis = await analyzeOpportunity(opp, messages);
      const ws = weightedScore(opp, analysis);
      rows.push({ opportunity: opp, analysis, weightedScore: ws });
    } catch (err) {
      console.error(`[recovery-mvp] Error analizando ${opp.id}: ${err}`);
    }
  }

  // 4. Sort by weighted score desc, take top N
  rows.sort((a, b) => b.weightedScore - a.weightedScore);
  const topRows = rows.slice(0, TOP_N);

  // 5. Generate and save report
  const content = generateMarkdownReport(topRows, TODAY);
  const path = saveReport(content, TODAY, REPORTS_DIR);
  console.log(`[recovery-mvp] Reporte guardado: ${path}`);

  return { rows: topRows, reportPath: path };
}

// Allow direct execution with demo data file
if (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js")) {
  const demoDataPath = process.argv[2];
  if (!demoDataPath) {
    console.error("Uso: npx tsx scripts/recovery-mvp/index.ts <demo-data.json>");
    console.error("Ver README.md para formato del archivo de datos.");
    process.exit(1);
  }

  const { readFileSync } = await import("fs");
  const demo = JSON.parse(readFileSync(demoDataPath, "utf-8")) as {
    rawOpportunitiesPerStage: Record<string, unknown>;
    rawMessagesPerContact: Record<string, unknown>;
  };

  await run(demo);
}
