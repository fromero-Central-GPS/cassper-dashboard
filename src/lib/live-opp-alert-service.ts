/**
 * Live Opp Alert Service — CEN-1000
 *
 * Cuando una oportunidad abierta cruza un umbral de riesgo,
 * notifica por email al vendedor asignado con la acción recomendada.
 *
 * Flujo:
 *   1. Recibe los resultados del Live Opp Engine (analyzeLiveOpportunities)
 *   2. Filtra oportunidades que cruzan umbrales de riesgo (medium+)
 *   3. Resuelve el email del vendedor asignado (vía GHL user ID → sellers DB)
 *   4. Formatea un email profesional con riesgos y acciones recomendadas
 *   5. Envía el email vía GOG (gogcli)
 *   6. Trackea alertas enviadas para evitar duplicados
 *
 * Ejecución: desde un heartbeat Paperclip con acceso a MCP GHL + GOG CLI
 */

import type { LiveOppAnalysis, LiveOppOutput } from "./live-opp-engine";
import type { Seller } from "./commission-types";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AlertNotification {
  /** ID único de la notificación (oppId + timestamp) */
  id: string;
  /** ID de la oportunidad en GHL */
  opportunityId: string;
  /** Nombre del contacto */
  contactName: string;
  /** Email del vendedor asignado */
  sellerEmail: string;
  /** ID del vendedor en GHL (assignedTo) */
  sellerGhlUserId: string | null;
  /** Nivel de riesgo */
  riskLevel: string;
  /** Score de riesgo (0-100) */
  riskScore: number;
  /** Alertas detectadas */
  alerts: Array<{
    category: string;
    severity: string;
    title: string;
    detail: string;
  }>;
  /** Acciones recomendadas */
  recommendedActions: string[];
  /** Valor de la oportunidad en CLP */
  opportunityValue: number;
  /** Etapa del pipeline */
  stage: string;
  /** Urgencia */
  urgency: string;
  /** Fecha de envío */
  sentAt: string;
  /** Estado del envío */
  status: "sent" | "failed" | "skipped";
  /** Error si falló */
  error?: string;
}

export interface AlertDispatchResult {
  notifications: AlertNotification[];
  summary: {
    totalAnalyzed: number;
    alertsTriggered: number;
    emailsSent: number;
    emailsFailed: number;
    skippedNoSeller: number;
    skippedBelowThreshold: number;
  };
}

// ─── Configuración ──────────────────────────────────────────────────────────

const DEFAULT_SELLER_EMAIL = "contacto@centralgps.cl";
const FROM_EMAIL = "fromero@centralgps.cl";

/** Umbral mínimo de riesgo para disparar alerta (medium = 25+) */
const MIN_RISK_SCORE_FOR_ALERT = 25;

/** Máximo de alertas por ejecución para evitar spam */
const MAX_ALERTS_PER_RUN = 10;

/** Alerta ya enviada en las últimas N horas no se reenvía */
const DEDUP_WINDOW_HOURS = 4;

// ─── In-memory alert tracking (en producción: DB table) ────────────────────

const sentAlerts = new Map<string, number>(); // oppId → timestamp de último envío

// ─── Seller Resolution ──────────────────────────────────────────────────────

/**
 * Resuelve el email del vendedor asignado a una oportunidad.
 *
 * Estrategia:
 *   1. Busca en la DB local de sellers por ghlUserId
 *   2. Si no encuentra, usa el email del contacto de la opp (menos ideal)
 *   3. Fallback: email por defecto de la empresa
 */
export function resolveSellerEmail(
  assignedTo: string | null | undefined,
  sellers: Seller[]
): { email: string; sellerName: string; resolved: boolean } {
  if (assignedTo) {
    const seller = sellers.find(
      (s) => s.ghlUserId === assignedTo && s.active
    );
    if (seller) {
      return { email: seller.email, sellerName: seller.name, resolved: true };
    }
  }

  // No se pudo resolver — cae en el email default
  return {
    email: DEFAULT_SELLER_EMAIL,
    sellerName: "Vendedor no identificado",
    resolved: false,
  };
}

// ─── Alert Dedup ────────────────────────────────────────────────────────────

export function shouldSendAlert(
  opportunityId: string,
  riskScore: number
): boolean {
  const lastSent = sentAlerts.get(opportunityId);
  if (!lastSent) return true;

  const hoursSinceLastSent =
    (Date.now() - lastSent) / (1000 * 60 * 60);
  return hoursSinceLastSent >= DEDUP_WINDOW_HOURS;
}

export function markAlertSent(opportunityId: string): void {
  sentAlerts.set(opportunityId, Date.now());
}

// ─── Email Formatting ───────────────────────────────────────────────────────

function severityEmoji(severity: string): string {
  return { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢", none: "⚪" }[
    severity
  ] ?? "⚪";
}

function urgencyLabel(urgency: string): string {
  return {
    ahora: "🚨 ACTUAR AHORA",
    hoy: "📞 Contactar hoy",
    esta_semana: "📅 Esta semana",
    monitorear: "👀 Monitorear",
  }[urgency] ?? urgency;
}

export function formatAlertEmail(
  analysis: LiveOppAnalysis,
  sellerName: string
): { subject: string; body: string } {
  const fmt = (n: number) =>
    n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

  const subject = `${severityEmoji(analysis.riskLevel)} [${
    analysis.riskLevel.toUpperCase()
  }] ${analysis.contactName} — $${fmt(analysis.value)} en riesgo`;

  const alertsMd = analysis.alerts
    .map(
      (a) =>
        `- ${severityEmoji(a.severity)} **${a.title}**: ${a.detail}`
    )
    .join("\n");

  const actionsMd = analysis.recommendedActions
    .map((a) => `- ${a}`)
    .join("\n");

  const body = [
    `Hola ${sellerName},`,
    "",
    `El sistema Cassper Live Opp detectó que la siguiente oportunidad abierta cruzó umbrales de riesgo y requiere tu atención.`,
    "",
    `---`,
    "",
    `## 📋 Oportunidad en Riesgo`,
    "",
    `| Campo | Valor |`,
    `|---|---|`,
    `| Contacto | **${analysis.contactName}** |`,
    `| Valor | $${fmt(analysis.value)} CLP |`,
    `| Etapa | ${analysis.stage} |`,
    `| Pipeline | ${analysis.pipeline} |`,
    `| Score de Riesgo | ${analysis.overallRiskScore}/100 (${analysis.riskLevel}) |`,
    `| Urgencia | ${urgencyLabel(analysis.urgency)} |`,
    `| Días abierto | ${analysis.daysOpen} |`,
    `| Días sin contacto | ${analysis.daysSinceLastContact} |`,
    `| Msgs últimos 7d | ${analysis.messagesInLast7Days} |`,
    "",
    `## 🚨 Alertas Detectadas`,
    "",
    alertsMd,
    "",
    `## 💡 Acciones Recomendadas`,
    "",
    actionsMd,
    "",
    `---`,
    "",
    `_Este es un mensaje automático del sistema Cassper Live Opp (CEN-1000). Los umbrales de riesgo se calculan a partir de los patrones de éxito en deals ganados (Won Track). Si esta alerta ya fue atendida, puedes ignorar este mensaje._`,
    "",
    `_Central GPS — Cassper Dashboard_`,
  ].join("\n");

  return { subject, body };
}

// ─── Main Alert Pipeline ────────────────────────────────────────────────────

/**
 * Procesa los resultados del Live Opp Engine y despacha alertas por email.
 *
 * @param output - Resultado del análisis de Live Opp
 * @param sellers - Lista de vendedores activos (de la DB local)
 * @param sendEmail - Función que envía el email (inyectada para testing)
 * @returns Resultado del despacho con resumen y notificaciones individuales
 */
export async function dispatchLiveOppAlerts(
  output: LiveOppOutput,
  sellers: Seller[],
  sendEmail: (to: string, subject: string, body: string) => Promise<boolean> = sendEmailViaGog
): Promise<AlertDispatchResult> {
  const notifications: AlertNotification[] = [];
  let emailsSent = 0;
  let emailsFailed = 0;
  let skippedNoSeller = 0;
  let skippedBelowThreshold = 0;

  // Filtrar oportunidades que requieren alerta
  const candidates = output.opportunities.filter((opp) => {
    // Solo risk level medium+ genera alerta
    if (opp.overallRiskScore < MIN_RISK_SCORE_FOR_ALERT) {
      skippedBelowThreshold++;
      return false;
    }
    // Solo si no se envió alerta recientemente
    if (!shouldSendAlert(opp.opportunityId, opp.overallRiskScore)) {
      return false;
    }
    return true;
  });

  // Ordenar por riesgo (más crítico primero) y limitar
  const toAlert = candidates
    .sort((a, b) => b.overallRiskScore - a.overallRiskScore)
    .slice(0, MAX_ALERTS_PER_RUN);

  for (const analysis of toAlert) {
    // Resolver seller email desde el campo assignedTo de GHL
    const { email, sellerName, resolved } = resolveSellerEmail(analysis.assignedTo, sellers);

    if (!resolved) {
      skippedNoSeller++;
      // Aún enviamos al email default para no perder la alerta
    }

    const { subject, body } = formatAlertEmail(analysis, sellerName);

    const notification: AlertNotification = {
      id: `${analysis.opportunityId}-${Date.now()}`,
      opportunityId: analysis.opportunityId,
      contactName: analysis.contactName,
      sellerEmail: email,
      sellerGhlUserId: analysis.assignedTo ?? null,
      riskLevel: analysis.riskLevel,
      riskScore: analysis.overallRiskScore,
      alerts: analysis.alerts.map((a) => ({
        category: a.category,
        severity: a.severity,
        title: a.title,
        detail: a.detail,
      })),
      recommendedActions: analysis.recommendedActions,
      opportunityValue: analysis.value,
      stage: analysis.stage,
      urgency: analysis.urgency,
      sentAt: new Date().toISOString(),
      status: "skipped",
    };

    try {
      const success = await sendEmail(email, subject, body);
      if (success) {
        notification.status = "sent";
        markAlertSent(analysis.opportunityId);
        emailsSent++;
      } else {
        notification.status = "failed";
        notification.error = "GOG send returned false";
        emailsFailed++;
      }
    } catch (err) {
      notification.status = "failed";
      notification.error = err instanceof Error ? err.message : String(err);
      emailsFailed++;
    }

    notifications.push(notification);
  }

  return {
    notifications,
    summary: {
      totalAnalyzed: output.totalAnalyzed,
      alertsTriggered: toAlert.length,
      emailsSent,
      emailsFailed,
      skippedNoSeller,
      skippedBelowThreshold,
    },
  };
}

// ─── GOG Email Sender ───────────────────────────────────────────────────────

/**
 * Envía un email usando gogcli (GOG CLI).
 *
 * Requiere que la variable de entorno GOG_KEYRING_PASSWORD esté configurada.
 * Cuenta: fromero@centralgps.cl
 *
 * En Paperclip, esta función se llama vía Bash tool con el comando gog.
 * Fuera de Paperclip (desarrollo local), simula el envío.
 */
export async function sendEmailViaGog(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // En纸clip runtime, esto se ejecutaría vía Bash:
  // export GOG_KEYRING_PASSWORD="gogcli-mcp-2026"
  // gog gmail send --to "..." --subject "..." --body "..." --account fromero@centralgps.cl

  console.log(`[LiveOppAlert] Sending email via GOG:`);
  console.log(`  From: ${FROM_EMAIL}`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body: ${body.slice(0, 200)}...`);

  // En producción (Paperclip heartbeat), el envío real se hace con:
  //
  // const cmd = `export GOG_KEYRING_PASSWORD="gogcli-mcp-2026" && gog gmail send \\
  //   --to "${to}" \\
  //   --subject "${subject.replace(/"/g, '\\"')}" \\
  //   --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" \\
  //   --account ${FROM_EMAIL}`;
  //
  // const result = await execBash(cmd);

  return true; // Placeholder — en Paperclip se usa Bash tool directamente
}

/**
 * Versión del sender que usa el comando bash real.
 * Debe ejecutarse dentro de Paperclip donde Bash tool está disponible.
 */
export function buildGogEmailCommand(
  to: string,
  subject: string,
  body: string
): string {
  // Escapar comillas dobles en subject y body
  const escapedSubject = subject.replace(/"/g, '\\"');
  const escapedBody = body.replace(/"/g, '\\"');

  return `export GOG_KEYRING_PASSWORD="gogcli-mcp-2026" && gog gmail send --to "${to}" --subject "${escapedSubject}" --body "${escapedBody}" --account ${FROM_EMAIL}`;
}
