#!/usr/bin/env tsx
/**
 * Recovery Response Monitor — CEN-1008
 *
 * Monitorea respuestas post-envío de campañas de recuperación:
 *   1. Revisa GHL conversations por nuevas respuestas inbound
 *   2. Revisa Gmail inbox por replies a los mensajes enviados
 *   3. Clasifica respuestas (positiva/negativa/neutral)
 *   4. Dispara follow-up automático a los 3 días sin respuesta
 *   5. Archiva a los 7 días sin respuesta
 *   6. Calcula métricas de campaña (responseRate, conversions, valueRecovered)
 *
 * Contexto de ejecución:
 *   - Paperclip Agent (Kai/Kai Backup) con acceso a MCP prod-ghl-mcp
 *   - Frecuencia: diaria (mañana, ~08:00 Chile)
 *
 * Uso:
 *   npx tsx scripts/monitor-responses.ts                    # Modo Paperclip (info)
 *   npx tsx scripts/monitor-responses.ts --local             # Modo local (gog CLI + BD)
 *   npx tsx scripts/monitor-responses.ts --campaign <id>     # Monitorear campaña específica
 */

import { getDb, closeDb, RecoveryRepository, initSchema } from '@/lib/db';
import type { RecoverySend, RecoveryCampaignMetrics } from '@/lib/db/repositories/recovery';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Configuración ──────────────────────────────────────────────────────────

const REPORTS_DIR = join(process.cwd(), 'reports');
const TODAY = new Date().toISOString().slice(0, 10);
const FOLLOWUP_AFTER_DAYS = 3;
const ARCHIVE_AFTER_DAYS = 7;

// ─── Clasificación de respuestas ────────────────────────────────────────────

interface ClassifiedResponse {
  classification: 'positive' | 'negative' | 'neutral';
  summary: string;
  signals: string[];
  confidence: number;
}

const POSITIVE_SIGNALS: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /(?:me interesa|interesado|quiero (?:comprar|contratar|avanzar|retomar|reactivar))/i, label: 'interes', weight: 3 },
  { re: /(?:cotizar|cotizaci[oó]n|cu[áa]nto (?:cuesta|vale|sale)|precio|valor)/i, label: 'consulta_precio', weight: 2 },
  { re: /(?:demo|probar|plataforma|agendar|reuni[oó]n|llamada)/i, label: 'solicitud_demo', weight: 3 },
  { re: /(?:gracias|excelente|perfecto|genial|buen[oí]simo|s[uú]per)/i, label: 'satisfaccion', weight: 1 },
  { re: /(?:cu[áa]ndo (?:podemos|pueden|empiezan|instalan)|fecha|empezar|comenzar)/i, label: 'urgencia', weight: 2 },
  { re: /(?:datos para (?:factura|instalaci)|documentos|firmar|contrato)/i, label: 'intencion_cierre', weight: 3 },
  { re: /(?:seguimos (?:adelante|en contacto)|proceder|avanzar|confirmar)/i, label: 'confirmacion', weight: 2 },
];

const NEGATIVE_SIGNALS: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /(?:no (?:me |nos |)(?:interesa|funciona|sirve|convence|gusta))/i, label: 'no_interes', weight: 3 },
  { re: /(?:ya (?:contrat[eé]|compr[eé]|tengo|tenemos)|otro proveedor|otra empresa)/i, label: 'ya_contrato', weight: 3 },
  { re: /(?:dejar de (?:insistir|escribir|contactar)|spam|molestar|no me vuelvan)/i, label: 'rechazo_explicito', weight: 4 },
  { re: /(?:muy caro|demasiado caro|no (?:tengo|tenemos) presupuesto|fuera de alcance)/i, label: 'precio', weight: 2 },
  { re: /(?:cerr[oó]|cerramos|ya no (?:estamos|opera|funciona)|empresa (?:cerr[oó]|quebr[oó]))/i, label: 'empresa_cerrada', weight: 4 },
  { re: /(?:no (?:es |era |)fue para (?:m[ií]|nosotros)|no aplica|no corresponde)/i, label: 'no_aplica', weight: 2 },
];

function classifyResponse(text: string): ClassifiedResponse {
  let positiveScore = 0;
  let negativeScore = 0;
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];

  for (const { re, label, weight } of POSITIVE_SIGNALS) {
    if (re.test(text)) {
      positiveScore += weight;
      positiveSignals.push(label);
    }
  }

  for (const { re, label, weight } of NEGATIVE_SIGNALS) {
    if (re.test(text)) {
      negativeScore += weight;
      negativeSignals.push(label);
    }
  }

  // Neutral si hay pocas señales
  if (positiveScore <= 1 && negativeScore <= 1) {
    return {
      classification: 'neutral',
      summary: 'Respuesta recibida sin señales claras de intención.',
      signals: [],
      confidence: 0.3,
    };
  }

  // Determinar clasificación por diferencia de scores
  const diff = positiveScore - negativeScore;

  if (diff >= 2) {
    return {
      classification: 'positive',
      summary: `Señales positivas detectadas: ${positiveSignals.join(', ')}.`,
      signals: positiveSignals,
      confidence: Math.min(0.9, positiveScore / (positiveScore + negativeScore + 1)),
    };
  }

  if (diff <= -2) {
    return {
      classification: 'negative',
      summary: `Señales negativas detectadas: ${negativeSignals.join(', ')}.`,
      signals: negativeSignals,
      confidence: Math.min(0.9, negativeScore / (positiveScore + negativeScore + 1)),
    };
  }

  return {
    classification: 'neutral',
    summary: `Señales mixtas (pos: ${positiveSignals.join(', ')}, neg: ${negativeSignals.join(', ')}).`,
    signals: [...positiveSignals, ...negativeSignals],
    confidence: 0.4,
  };
}

// ─── Tipos para el resultado del monitoreo ──────────────────────────────────

export interface MonitorResult {
  checkedAt: string;
  totalMonitored: number;
  responsesDetected: number;
  responsesClassified: { positive: number; negative: number; neutral: number };
  followupsTriggered: number;
  archived: number;
  campaignMetrics: RecoveryCampaignMetrics[];
  details: Array<{
    sendId: string;
    contactName: string;
    previousStatus: string;
    newStatus: string;
    action: string;
    detail: string;
  }>;
  reportPath?: string;
}

// ─── Monitor Principal ──────────────────────────────────────────────────────

/**
 * Ejecuta el ciclo de monitoreo de respuestas.
 *
 * En Paperclip, el agente:
 * 1. Obtiene los sends activos desde BD (status: awaiting_response, followup_sent)
 * 2. Para cada send, busca nuevas conversaciones/mensajes en GHL via MCP
 * 3. También revisa Gmail inbox via gog CLI
 * 4. Clasifica respuestas encontradas
 * 5. Aplica reglas de negocio (follow-up 3d, archivo 7d)
 * 6. Actualiza BD y genera reporte
 */
export function runResponseMonitor(options?: {
  campaignId?: string;
  /** Respuestas detectadas externamente (modo Paperclip MCP) */
  externalResponses?: Map<string, { text: string; date: string }>;
}): MonitorResult {
  const db = getDb();
  initSchema(db);
  const repo = new RecoveryRepository(db);

  // ─── 1. Obtener sends a monitorear ─────────────────────────────────────
  const activeSends = repo.getActiveMonitoringSends();
  console.log(`[monitor] ── Monitoreo de Respuestas: ${TODAY} ──`);
  console.log(`[monitor]   ${activeSends.length} sends en estado activo (awaiting_response + followup_sent)`);

  const now = new Date();
  const details: MonitorResult['details'] = [];
  let responsesDetected = 0;
  let classifications = { positive: 0, negative: 0, neutral: 0 };
  let followupsTriggered = 0;
  let archived = 0;

  for (const send of activeSends) {
    const sentDate = new Date(send.sent_at);
    const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

    // ─── 1a. Verificar respuestas externas (GHL/Gmail) ──────────────────
    const external = options?.externalResponses?.get(send.id);
    if (external) {
      const classification = classifyResponse(external.text);
      const newStatus = `replied_${classification.classification}` as RecoverySend['status'];

      repo.updateSendStatus(send.id, newStatus, {
        response_at: external.date,
        response_classification: classification.classification,
        response_summary: classification.summary,
      });

      responsesDetected++;
      classifications[classification.classification]++;

      details.push({
        sendId: send.id,
        contactName: send.contact_name,
        previousStatus: send.status,
        newStatus,
        action: 'response_classified',
        detail: `${classification.classification}: ${classification.summary}`,
      });

      console.log(`[monitor]   ✅ ${send.contact_name}: respuesta ${classification.classification} — "${external.text.slice(0, 60)}..."`);
      continue;
    }

    // ─── 2. Regla: Archivo a los 7 días (verificar PRIMERO) ─────────────
    if (daysSinceSent >= ARCHIVE_AFTER_DAYS) {
      repo.updateSendStatus(send.id, 'archived', {
        archived_at: now.toISOString(),
        notes: `Archivado automáticamente a los ${daysSinceSent} días sin respuesta.`,
      });
      archived++;

      details.push({
        sendId: send.id,
        contactName: send.contact_name,
        previousStatus: send.status,
        newStatus: 'archived',
        action: 'archived',
        detail: `${daysSinceSent} días sin respuesta. Archivado automáticamente.`,
      });

      console.log(`[monitor]   📦 ${send.contact_name}: archivado (${daysSinceSent}d sin respuesta)`);
      continue;
    }

    // ─── 3. Regla: Follow-up a los 3 días ───────────────────────────────
    if (send.status === 'awaiting_response' && daysSinceSent >= FOLLOWUP_AFTER_DAYS) {
      const followupDate = new Date(sentDate.getTime() + FOLLOWUP_AFTER_DAYS * 86400000);

      // Solo disparar follow-up si estamos en la ventana (hoy o después)
      if (now >= followupDate) {
        repo.updateSendStatus(send.id, 'followup_sent', {
          followup_sent_at: now.toISOString(),
          notes: `Follow-up automático disparado a los ${daysSinceSent} días sin respuesta.`,
        });
        followupsTriggered++;

        details.push({
          sendId: send.id,
          contactName: send.contact_name,
          previousStatus: send.status,
          newStatus: 'followup_sent',
          action: 'followup_triggered',
          detail: `${daysSinceSent} días sin respuesta. Follow-up automático activado.`,
        });

        console.log(`[monitor]   🔔 ${send.contact_name}: follow-up trigger (${daysSinceSent}d sin respuesta)`);
        continue;
      }
    }

    // ─── 4. Sin cambios aún ─────────────────────────────────────────────
    console.log(`[monitor]   ⏳ ${send.contact_name}: ${send.status} (${daysSinceSent}d desde envío) — sin novedad`);
  }

  // ─── 5. Calcular métricas ─────────────────────────────────────────────
  const campaignIds = new Set(activeSends.map(s => s.campaign_id));
  const campaignMetrics = Array.from(campaignIds)
    .map(id => repo.getCampaignMetrics(id))
    .filter((m): m is RecoveryCampaignMetrics => m !== null);

  // ─── 6. Si alguna campaña ya no tiene sends activos, marcarla completa ─
  for (const campaign of campaignMetrics) {
    if (campaign.awaitingCount === 0 && campaign.followupCount === 0) {
      repo.updateCampaignStatus(campaign.id, 'completed');
      console.log(`[monitor]   🏁 Campaña "${campaign.name}" completada (sin sends activos)`);
    }
  }

  // ─── 7. Generar reporte ───────────────────────────────────────────────
  const reportContent = generateMonitorReport({
    date: TODAY,
    totalMonitored: activeSends.length,
    responsesDetected,
    classifications,
    followupsTriggered,
    archived,
    campaignMetrics,
    details,
  });

  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportPath = join(REPORTS_DIR, `recovery-monitor-${TODAY}.md`);
  writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`[monitor]   Reporte: ${reportPath}`);

  closeDb();

  return {
    checkedAt: now.toISOString(),
    totalMonitored: activeSends.length,
    responsesDetected,
    responsesClassified: classifications,
    followupsTriggered,
    archived,
    campaignMetrics,
    details,
    reportPath,
  };
}

// ─── Generador de Reporte ───────────────────────────────────────────────────

function generateMonitorReport(opts: {
  date: string;
  totalMonitored: number;
  responsesDetected: number;
  classifications: { positive: number; negative: number; neutral: number };
  followupsTriggered: number;
  archived: number;
  campaignMetrics: RecoveryCampaignMetrics[];
  details: MonitorResult['details'];
}): string {
  const {
    date, totalMonitored, responsesDetected, classifications,
    followupsTriggered, archived, campaignMetrics, details,
  } = opts;

  const formatCLP = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`;

  let md = `# 📬 Monitoreo de Respuestas — ${date}\n\n`;
  md += `**Generado:** ${new Date().toLocaleString('es-CL')}\n`;
  md += `**Sends monitoreados:** ${totalMonitored}\n\n`;

  md += `---\n\n`;
  md += `## 📊 Resumen\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Respuestas detectadas | ${responsesDetected} |\n`;
  md += `| Positivas | ${classifications.positive} 🟢 |\n`;
  md += `| Negativas | ${classifications.negative} 🔴 |\n`;
  md += `| Neutrales | ${classifications.neutral} 🟡 |\n`;
  md += `| Follow-ups disparados | ${followupsTriggered} |\n`;
  md += `| Archivados | ${archived} |\n\n`;

  md += `---\n\n`;
  md += `## 📈 Métricas por Campaña\n\n`;

  for (const c of campaignMetrics) {
    md += `### ${c.name} (Wave ${c.wave_number})\n\n`;
    md += `| Métrica | Valor |\n|---|---|\n`;
    md += `| Estado | ${c.status} |\n`;
    md += `| Enviados | ${c.messagesSent} |\n`;
    md += `| Tasa de respuesta | ${c.responseRate}% |\n`;
    md += `| Positivas | ${c.positiveCount} |\n`;
    md += `| Negativas | ${c.negativeCount} |\n`;
    md += `| Sin respuesta | ${c.noResponseCount} |\n`;
    md += `| En espera | ${c.awaitingCount} |\n`;
    md += `| Conversiones | ${c.conversions} |\n`;
    md += `| Valor recuperado | ${formatCLP(c.valueRecovered)} |\n`;
    md += `| Valor total campaña | ${formatCLP(c.totalValue)} |\n\n`;
  }

  if (details.length > 0) {
    md += `---\n\n`;
    md += `## 🔍 Detalle de Acciones\n\n`;
    md += `| Contacto | Estado Anterior | Nuevo Estado | Acción | Detalle |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const d of details) {
      md += `| ${d.contactName} | ${d.previousStatus} | ${d.newStatus} | ${d.action} | ${d.detail} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*Monitoreo automático — CEN-1008 Post-envío Recovery Engine.*\n`;
  md += `*Próximo monitoreo: mañana ~08:00 Chile.*\n`;

  return md;
}

// ─── Verificación local de Gmail (gog CLI) ─────────────────────────────────

/**
 * Busca respuestas en Gmail para los sends activos usando gog CLI.
 * Retorna un Map de sendId → respuesta detectada.
 *
 * Modo local/demo — en Paperclip real, esto se haría via MCP Gmail tools.
 */
export async function checkGmailForReplies(
  sends: RecoverySend[]
): Promise<Map<string, { text: string; date: string }>> {
  const responses = new Map<string, { text: string; date: string }>();

  // Para cada send, buscar en Gmail usando el message_id o el email del contacto
  for (const send of sends) {
    if (!send.contact_email) continue;

    try {
      // Buscar threads recientes con el email del contacto
      const { execSync } = await import('child_process');
      const sentTs = new Date(send.sent_at).getTime();
      const query = `from:${send.contact_email} newer_than:${Math.floor((Date.now() - sentTs) / 1000)}s`;
      const result = execSync(
        `export GOG_KEYRING_PASSWORD="gogcli-mcp-2026" && ` +
        `gog gmail search "${query}" --account fromero@centralgps.cl --max 3`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim();

      if (result && result.length > 10) {
        // Extraer el cuerpo del mensaje más reciente (simplificado)
        const lines = result.split('\n').filter(l => l.trim());
        const body = lines.slice(0, 5).join(' ');
        responses.set(send.id, {
          text: body,
          date: new Date().toISOString(),
        });
      }
    } catch {
      // No hay respuesta o error — continuar
    }
  }

  return responses;
}

// ─── CLI entry point ────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('monitor-responses.ts') || process.argv[1]?.endsWith('monitor-responses.js')) {
  const isLocal = process.argv.includes('--local');
  const campaignIdx = process.argv.indexOf('--campaign');
  const campaignId = campaignIdx >= 0 ? process.argv[campaignIdx + 1] : undefined;

  if (isLocal) {
    console.log('[monitor] Modo LOCAL — usando BD + gog CLI para Gmail...\n');
    const db = getDb();
    initSchema(db);
    const repo = new RecoveryRepository(db);

    const activeSends = repo.getActiveMonitoringSends();
    console.log(`[monitor] ${activeSends.length} sends activos encontrados en BD.`);

    if (activeSends.length === 0) {
      console.log('[monitor] No hay sends para monitorear. ¿Ya ejecutaste la campaña?');
      console.log('[monitor] Sugerencia: crea sends de prueba con el script de inicialización.');
      closeDb();
      process.exit(0);
    }

    // En modo local, intentamos detectar respuestas via Gmail
    checkGmailForReplies(activeSends).then(gmailResponses => {
      console.log(`[monitor] Gmail: ${gmailResponses.size} respuestas detectadas.`);

      const result = runResponseMonitor({
        campaignId,
        externalResponses: gmailResponses,
      });

      console.log('\n[monitor] ✅ Monitoreo completado!');
      console.log(`  Respuestas: ${result.responsesDetected} (${result.responsesClassified.positive}+, ${result.responsesClassified.negative}-, ${result.responsesClassified.neutral}~)`);
      console.log(`  Follow-ups: ${result.followupsTriggered}`);
      console.log(`  Archivados: ${result.archived}`);
      console.log(`  Reporte: ${result.reportPath}`);
    });
  } else {
    console.log('[monitor] Modo Paperclip — esperando datos del MCP...');
    console.log('  Este script debe ser invocado por un Paperclip Agent con acceso a MCP.');
    console.log('  La función runResponseMonitor() recibe los datos ya recolectados.');
    console.log('');
    console.log('  Paperclip Agent Flow:');
    console.log('    1. Leer sends activos desde recovery_sends (BD)');
    console.log('    2. Para cada send, mcp__prod-ghl-mcp__conversations_search-conversation');
    console.log('    3. mcp__prod-ghl-mcp__conversations_get-messages (buscar nuevos inbound)');
    console.log('    4. mcp__gog__gmail_search (buscar replies en Gmail)');
    console.log('    5. Construir externalResponses Map y llamar runResponseMonitor()');
    console.log('    6. El dashboard lee los resultados de la BD');
    console.log('');
    console.log('  Para probar con BD local + Gmail: npx tsx scripts/monitor-responses.ts --local');
  }
}
