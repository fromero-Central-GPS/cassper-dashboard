/**
 * CEN-1000: Live Opp Alerts — Pipeline de Heartbeat
 *
 * Ejecuta el flujo completo de detección proactiva de riesgo en
 * oportunidades abiertas y notifica por email a los vendedores.
 *
 * Flujo:
 *   1. Obtener pipelines de GHL (opportunities_get-pipelines)
 *   2. Buscar oportunidades abiertas (opportunities_search-opportunity, status=open)
 *   3. Para cada opp, buscar conversaciones del contacto (conversations_search-conversation)
 *   4. Obtener mensajes de cada conversación (conversations_get-messages)
 *   5. Ejecutar Live Opp Engine: analyzeLiveOpportunity() por cada opp
 *   6. Generar LiveOppOutput con analyzeLiveOpportunities()
 *   7. Cargar sellers de la DB local (SellerRepository.findActive)
 *   8. Despachar alertas: dispatchLiveOppAlerts() → email vía GOG
 *
 * Uso desde Paperclip heartbeat:
 *   El agente llama a las herramientas MCP directamente y construye
 *   los arrays de OpenOpportunity y GHLMessage[], luego invoca las
 *   funciones del motor.
 *
 * Uso standalone (desarrollo/testing):
 *   npx tsx scripts/live-opp-alerts/index.ts --mode=dry-run
 */

import { analyzeLiveOpportunity, analyzeLiveOpportunities, formatLiveOppMarkdown } from "../../src/lib/live-opp-engine";
import type { OpenOpportunity, GHLMessage, LiveOppAnalysis } from "../../src/lib/live-opp-engine";
import type { SuccessThresholds } from "../../src/lib/won-track-engine";
import { dispatchLiveOppAlerts, sendEmailViaGog, buildGogEmailCommand, resolveSellerEmail, formatAlertEmail } from "../../src/lib/live-opp-alert-service";
import { SellerRepository } from "../../src/lib/db/repositories/sellers";
import type { Seller } from "../../src/lib/commission-types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LiveOppHeartbeatInput {
  /** Oportunidades abiertas con sus mensajes */
  opportunities: Array<{ opp: OpenOpportunity; messages: GHLMessage[] }>;
  /** Umbrales de éxito (desde Won Track) */
  thresholds: SuccessThresholds;
  /** Modo: "dry-run" solo analiza, no envía emails */
  mode?: "live" | "dry-run";
}

export interface LiveOppHeartbeatOutput {
  /** Análisis completo */
  analysis: ReturnType<typeof analyzeLiveOpportunities>;
  /** Resultados del despacho de alertas */
  dispatch?: Awaited<ReturnType<typeof dispatchLiveOppAlerts>>;
  /** Markdown formateado para el dashboard */
  markdown: string;
  /** Emails que se habrían enviado (dry-run) o se enviaron (live) */
  emailsSent: Array<{ to: string; subject: string }>;
}

// ─── Default Thresholds (when Won Track hasn't run yet) ─────────────────────

const DEFAULT_THRESHOLDS: SuccessThresholds = {
  avgTimeToClose: 15,
  medianTimeToClose: 10,
  fastCloseThreshold: 5,
  avgResponseMinutes: 45,
  medianResponseMinutes: 30,
  dangerResponseThreshold: 120,
  idealResponseThreshold: 30,
  avgMessagesPerDeal: 12,
  avgInboundRatio: 0.45,
  lowEngagementThreshold: 0.25,
  topChannel: "whatsapp",
  channelWinRates: { whatsapp: 120, organico: 40, ads: 20 },
  topPlan: "Lite Anual",
  planDistribution: { "Lite Anual": 80, "Pro Mensual": 40 },
  avgContractValue: 150000,
  medianContractValue: 120000,
  valueByFleetSize: { "1 vehículo": 100000, "2 a 9 vehículos": 250000 },
  sampleSize: 198,
  analyzedAt: new Date().toISOString(),
};

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function runLiveOppHeartbeat(
  input: LiveOppHeartbeatInput
): Promise<LiveOppHeartbeatOutput> {
  const { opportunities, thresholds, mode = "dry-run" } = input;

  console.log(`[CEN-1000] Live Opp Heartbeat started — ${opportunities.length} open opportunities`);
  console.log(`[CEN-1000] Mode: ${mode}`);

  // 1. Run analysis
  const analysis = analyzeLiveOpportunities(opportunities, thresholds);
  console.log(`[CEN-1000] Analysis complete: ${analysis.totalAnalyzed} analyzed, ${analysis.criticalCount} critical, ${analysis.highCount} high`);

  // 2. Format markdown
  const markdown = formatLiveOppMarkdown(analysis);

  // 3. Load sellers
  const sellerRepo = new SellerRepository();
  const sellers: Seller[] = sellerRepo.findActive();
  console.log(`[CEN-1000] Loaded ${sellers.length} active sellers from DB`);

  // 4. Dispatch alerts
  let dispatch;
  const emailsSent: Array<{ to: string; subject: string }> = [];

  if (mode === "live") {
    console.log(`[CEN-1000] LIVE mode — dispatching real email alerts`);
    dispatch = await dispatchLiveOppAlerts(analysis, sellers, sendEmailViaGog);

    for (const notif of dispatch.notifications) {
      if (notif.status === "sent") {
        const { subject } = formatAlertEmail(
          analysis.opportunities.find((o) => o.opportunityId === notif.opportunityId) ?? analysis.opportunities[0],
          notif.sellerEmail
        );
        emailsSent.push({ to: notif.sellerEmail, subject: notif.alerts[0]?.title ?? "Alerta Live Opp" });
      }
    }

    console.log(`[CEN-1000] Dispatch complete: ${dispatch.summary.emailsSent} sent, ${dispatch.summary.emailsFailed} failed`);
  } else {
    console.log(`[CEN-1000] DRY-RUN mode — analyzing without sending emails`);
    // In dry-run, show what would be sent
    const atRisk = analysis.opportunities.filter((o) => o.overallRiskScore >= 25);
    for (const opp of atRisk.slice(0, 10)) {
      const { email, sellerName } = resolveSellerEmail(opp.assignedTo, sellers);
      const { subject } = formatAlertEmail(opp, sellerName);
      emailsSent.push({ to: email, subject });
      console.log(`  → Would send to ${email}: ${subject}`);
    }
  }

  return { analysis, dispatch, markdown, emailsSent };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--live") ? "live" : "dry-run";

  console.log(`╔══════════════════════════════════════════╗`);
  console.log(`║   CEN-1000: Live Opp Alerts Pipeline    ║`);
  console.log(`║   Mode: ${mode.padEnd(31)}║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log("");

  // En modo standalone sin MCP, usamos un placeholder
  // En Paperclip heartbeat, los datos vienen de las llamadas MCP
  const result = await runLiveOppHeartbeat({
    opportunities: [], // Se llena desde MCP en Paperclip
    thresholds: DEFAULT_THRESHOLDS,
    mode,
  });

  console.log("");
  console.log("═".repeat(60));
  console.log(`Total analyzed: ${result.analysis.totalAnalyzed}`);
  console.log(`Critical: ${result.analysis.criticalCount}`);
  console.log(`High: ${result.analysis.highCount}`);
  console.log(`Value at risk: $${result.analysis.totalValueAtRisk.toLocaleString("es-CL")} CLP`);
  console.log(`Emails ${mode === "live" ? "sent" : "would send"}: ${result.emailsSent.length}`);
  console.log("═".repeat(60));

  if (result.emailsSent.length > 0) {
    console.log("\nEmails:");
    for (const e of result.emailsSent) {
      console.log(`  📧 To: ${e.to} — ${e.subject}`);
    }
  }
}

// Run if executed directly
if (process.argv[1]?.includes("live-opp-alerts")) {
  main().catch(console.error);
}
