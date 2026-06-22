#!/usr/bin/env tsx
/**
 * Daily GHL Pipeline — Rutina Paperclip de Actualización Diaria
 *
 * Ejecuta el pipeline completo de análisis GHL cada mañana:
 *   1. Extrae oportunidades de GHL (lost, open, won)
 *   2. Obtiene conversaciones y mensajes por contacto
 *   3. Ejecuta el motor de análisis forense (analysis-engine.ts)
 *   4. Detecta early warnings en oportunidades abiertas
 *   5. Extrae patrones de éxito de oportunidades ganadas
 *   6. Genera reporte Markdown y persiste en BD local
 *   7. El dashboard lee de la BD para mostrar datos actualizados
 *
 * Contexto de ejecución:
 *   - Paperclip Agent (Kai/Kai Backup) con acceso a MCP prod-ghl-mcp
 *   - Frecuencia: diaria (mañana, ~08:00 Chile)
 *
 * Uso (modo mock para desarrollo local):
 *   npx tsx scripts/daily-pipeline.ts --mock
 *
 * Uso (modo Paperclip — el agente orquesta las llamadas MCP):
 *   npx tsx scripts/daily-pipeline.ts
 *
 * MCP tools requeridas:
 *   - mcp__prod-ghl-mcp__opportunities_get-pipelines
 *   - mcp__prod-ghl-mcp__opportunities_search-opportunity
 *   - mcp__prod-ghl-mcp__conversations_search-conversation
 *   - mcp__prod-ghl-mcp__conversations_get-messages
 *   - mcp__prod-ghl-mcp__contacts_get-contact
 */

import { getDb, closeDb, PipelineRunRepository } from '@/lib/db';
import { initSchema } from '@/lib/db/schema';
import {
  analyzeConversation,
  generateBatchSummary,
  type GHLConversationInput,
  type GHLOpportunityInput,
  type GHLMessage,
  type BatchAnalysisResult,
} from '@/lib/analysis-engine';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Configuración ──────────────────────────────────────────────────────────

const REPORTS_DIR = join(process.cwd(), 'reports');
const TODAY = new Date().toISOString().slice(0, 10);
const MAX_OPPORTUNITIES_PER_STAGE = 50;
const MAX_CONVERSATIONS_PER_CONTACT = 5;
const MAX_MESSAGES_PER_CONVERSATION = 50;

/** Pipelines y stages conocidos de Central GPS en GHL */
const PIPELINE_CONFIG = {
  primary: {
    id: 'MNxYbS1kOg11IiU2QbMv',
    name: 'Central GPS',
    lostStageId: '2bfd0ea8-b816-4e1c-88de-4d25e2b535fb',
    lostStageName: 'Perdido',
    wonStageId: 'ed6aa62d-fb4e-4d44-bcd1-133ab984e2f8',
    wonStageName: 'Aceptado',
  },
  secondary: [
    {
      id: 'qT53Vm7EKeS4gG8cyCG2',
      name: 'Ejemplo DEMO',
      lostStageId: '7c3069a1-6d2f-443a-8074-641975f4daf9',
      lostStageName: 'Perdido',
      wonStageId: '20cd75cf-a13c-4b8a-ac57-f97141efa8a6',
      wonStageName: 'Ganado',
    },
    {
      id: 'bn2cknrVRCMLZYLQKkMb',
      name: 'Ventas - Demo',
      lostStageId: 'ed11aaf3-32f8-46ed-9588-1147fd117133',
      lostStageName: 'Negocio perdido',
      wonStageId: 'c37eff6f-a962-4b0b-bfa0-cd1c25741cd3',
      wonStageName: 'Negocio cerrado',
    },
  ],
};

// ─── Tipos para datos crudos de MCP ────────────────────────────────────────

interface RawOpportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  lastStageChangeAt?: string;
  createdAt: string;
}

interface RawConversation {
  id: string;
  contactId: string;
  contactName: string;
  email?: string;
  phone?: string;
  lastMessageDate: number;
  lastMessageType: string;
  lastMessageBody: string;
  lastMessageDirection: 'inbound' | 'outbound';
  unreadCount: number;
  tags: string[];
}

interface RawMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  messageType: string;
  dateAdded: string;
}

/** Datos que el agente Paperclip recolecta vía MCP */
export interface DailyPipelineInput {
  /** Oportunidades perdidas, keyed by stageId */
  lostOpportunities: Record<string, RawOpportunity[]>;
  /** Oportunidades abiertas, keyed by pipelineId */
  openOpportunities: Record<string, RawOpportunity[]>;
  /** Oportunidades ganadas, keyed by stageId */
  wonOpportunities: Record<string, RawOpportunity[]>;
  /** Conversaciones por contactId */
  conversations: Record<string, RawConversation[]>;
  /** Mensajes por conversationId */
  messages: Record<string, RawMessage[]>;
}

export interface DailyPipelineOutput {
  forensics: BatchAnalysisResult;
  earlyWarnings: EarlyWarning[];
  winPatterns: WinPattern[];
  reportPath: string;
  dbRunId: string;
  summary: {
    totalLostAnalyzed: number;
    totalLostValue: number;
    recoverableValue: number;
    openAtRisk: number;
    openAtRiskValue: number;
    wonAnalyzed: number;
    wonTotalValue: number;
  };
}

// ─── Early Warning Engine ──────────────────────────────────────────────────

interface EarlyWarning {
  opportunityId: string;
  contactName: string;
  value: number;
  stage: string;
  warnings: Array<{
    type: string;
    severity: 'urgent' | 'high' | 'medium';
    detail: string;
  }>;
  lastActivity: string;
  daysSinceLastContact: number;
  intentSignals: string[];
}

function detectEarlyWarnings(
  opp: RawOpportunity,
  messages: RawMessage[]
): EarlyWarning {
  const now = Date.now();
  const warnings: EarlyWarning['warnings'] = [];
  const intentSignals: string[] = [];

  let lastInbound: Date | null = null;
  let lastOutbound: Date | null = null;
  let lastAny: Date | null = null;

  for (const msg of messages) {
    const d = new Date(msg.dateAdded);
    if (!lastAny || d > lastAny) lastAny = d;
    if (msg.direction === 'inbound' && (!lastInbound || d > lastInbound)) lastInbound = d;
    if (msg.direction === 'outbound' && (!lastOutbound || d > lastOutbound)) lastOutbound = d;
  }

  const daysSinceLastContact = lastAny
    ? Math.floor((now - lastAny.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Cliente esperando respuesta
  if (lastInbound && lastOutbound && lastInbound > lastOutbound) {
    const hoursWaiting = Math.floor((now - lastInbound.getTime()) / (1000 * 60 * 60));
    if (hoursWaiting > 4) {
      warnings.push({
        type: 'client_waiting',
        severity: 'urgent',
        detail: `Cliente escribió hace ${hoursWaiting}h y no ha recibido respuesta`,
      });
    }
  } else if (lastInbound && !lastOutbound) {
    const hoursWaiting = Math.floor((now - lastInbound.getTime()) / (1000 * 60 * 60));
    warnings.push({
      type: 'client_waiting',
      severity: 'urgent',
      detail: `Cliente escribió hace ${hoursWaiting}h sin respuesta del equipo`,
    });
  }

  // Sin contacto por 7+ días
  if (daysSinceLastContact >= 7) {
    warnings.push({
      type: 'no_contact',
      severity: 'high',
      detail: `${daysSinceLastContact} días sin contacto con el cliente`,
    });
  }

  // Estancamiento
  if (lastOutbound && !lastInbound) {
    const daysSinceOutbound = Math.floor((now - lastOutbound.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceOutbound >= 14) {
      warnings.push({
        type: 'stalling',
        severity: 'medium',
        detail: `Último contacto outbound hace ${daysSinceOutbound}d, sin respuesta del cliente`,
      });
    }
  }

  // Quick intent detection
  const allText = messages.map((m) => m.body).join(' ');
  const INTENT_PATTERNS = [
    { re: /(?:cotizaci[oó]n|cotizar|cu[áa]nto (?:cuesta|vale|sale)|precio)/i, label: 'consulta_precio' },
    { re: /(?:me interesa|estoy interesad[oa]|quiero comprar|quiero contratar)/i, label: 'interes_directo' },
    { re: /(?:demo|probar|plataforma|c[oó]mo funciona)/i, label: 'solicitud_demo' },
    { re: /(?:urgente|lo antes posible|necesito|necesitamos)/i, label: 'urgencia' },
    { re: /(?:gps|rastreo|monitoreo|tracking)/i, label: 'mencion_gps' },
  ];
  for (const { re, label } of INTENT_PATTERNS) {
    if (re.test(allText)) intentSignals.push(label);
  }

  return {
    opportunityId: opp.id,
    contactName: opp.contactName,
    value: opp.monetaryValue,
    stage: opp.pipelineStageId,
    warnings,
    lastActivity: lastAny?.toISOString() ?? 'nunca',
    daysSinceLastContact,
    intentSignals: Array.from(new Set(intentSignals)),
  };
}

// ─── Win Pattern Engine ────────────────────────────────────────────────────

interface WinPattern {
  opportunityId: string;
  contactName: string;
  value: number;
  timeToClose: number;
  signals: string[];
  winningFactors: string[];
}

const WIN_SIGNAL_PATTERNS = [
  { re: /(?:aceptado|confirmado|proceder|avanzar|seguir adelante)/i, label: 'confirmacion_activa' },
  { re: /(?:gracias|excelente|perfecto|genial|buen[oí]simo)/i, label: 'satisfaccion' },
  { re: /(?:datos para (?:factura|instalaci)|documentos|firmar)/i, label: 'documentacion_solicitada' },
  { re: /(?:cu[áa]ndo (?:empieza|instalan|comienzan)|fecha)/i, label: 'urgencia_implementacion' },
  { re: /(?:flota|varios (?:veh[íi]culos|equipos)|crecer|escalar)/i, label: 'potencial_crecimiento' },
];

function detectWinPatterns(
  opp: RawOpportunity,
  messages: RawMessage[]
): WinPattern {
  const allText = messages.map((m) => m.body).join(' ');
  const signals: string[] = [];
  const winningFactors: string[] = [];

  for (const { re, label } of WIN_SIGNAL_PATTERNS) {
    if (re.test(allText)) signals.push(label);
  }

  const created = new Date(opp.createdAt);
  const updated = new Date(opp.lastStageChangeAt ?? opp.createdAt);
  const timeToClose = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (timeToClose <= 3) winningFactors.push('Cierre rápido (≤3 días)');
  else if (timeToClose <= 7) winningFactors.push('Cierre en ≤1 semana');
  else if (timeToClose <= 30) winningFactors.push('Cierre en ≤1 mes');

  const inboundCount = messages.filter((m) => m.direction === 'inbound').length;
  if (inboundCount >= 5) winningFactors.push(`Alta respuesta del cliente (${inboundCount} inbound)`);
  if (signals.includes('satisfaccion')) winningFactors.push('Cliente expresó satisfacción');
  if (signals.includes('documentacion_solicitada')) winningFactors.push('Proceso de cierre documentado');
  if (signals.includes('potencial_crecimiento')) winningFactors.push('Potencial de expansión');

  return {
    opportunityId: opp.id,
    contactName: opp.contactName,
    value: opp.monetaryValue,
    timeToClose,
    signals: Array.from(new Set(signals)),
    winningFactors,
  };
}

// ─── Conversión de datos crudos a tipos del analysis-engine ────────────────

function toGHLMessages(rawMessages: RawMessage[]): GHLMessage[] {
  return rawMessages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    messageType: m.messageType,
    dateAdded: m.dateAdded,
  }));
}

function toGHLConversationInput(raw: RawConversation, messages: RawMessage[]): GHLConversationInput {
  return {
    id: raw.id,
    contactId: raw.contactId,
    contactName: raw.contactName,
    email: raw.email,
    phone: raw.phone,
    lastMessageDate: raw.lastMessageDate,
    lastMessageType: raw.lastMessageType,
    lastMessageBody: raw.lastMessageBody,
    lastMessageDirection: raw.lastMessageDirection,
    unreadCount: raw.unreadCount,
    tags: raw.tags,
    messages: toGHLMessages(messages),
  };
}

function toGHLOpportunityInput(raw: RawOpportunity, pipelineName: string, stageName: string): GHLOpportunityInput {
  return {
    id: raw.id,
    name: raw.name,
    contactId: raw.contactId,
    contactName: raw.contactName,
    monetaryValue: raw.monetaryValue,
    pipelineId: raw.pipelineId,
    pipelineStageId: raw.pipelineStageId,
    pipelineStageName: stageName,
    status: raw.status,
    lastStageChangeAt: raw.lastStageChangeAt,
    createdAt: raw.createdAt,
  };
}

// ─── Pipeline Principal ────────────────────────────────────────────────────

/**
 * Ejecuta el pipeline completo de análisis diario.
 *
 * En Paperclip, el agente:
 * 1. Llama a las herramientas MCP para recolectar los datos
 * 2. Construye un objeto DailyPipelineInput
 * 3. Llama a esta función
 * 4. El dashboard lee los resultados de la BD
 */
export function runDailyPipeline(input: DailyPipelineInput): DailyPipelineOutput {
  // ─── 1. Análisis Forense (oportunidades perdidas) ─────────────────────
  console.log('[daily-pipeline] ── FASE 1: Análisis Forense (Perdidas) ──');

  const forensicsConversations: Array<{
    conversation: GHLConversationInput;
    opportunity: GHLOpportunityInput;
  }> = [];

  for (const stage of [PIPELINE_CONFIG.primary, ...PIPELINE_CONFIG.secondary]) {
    const rawOpps = input.lostOpportunities[stage.lostStageId] ?? [];
    const recentOpps = rawOpps.slice(0, MAX_OPPORTUNITIES_PER_STAGE);
    console.log(`[daily-pipeline]   ${stage.name}/${stage.lostStageName}: ${recentOpps.length} oportunidades`);

    for (const opp of recentOpps) {
      const rawConversations = input.conversations[opp.contactId] ?? [];
      const topConvs = rawConversations.slice(0, MAX_CONVERSATIONS_PER_CONTACT);

      for (const conv of topConvs) {
        const rawMessages = input.messages[conv.id] ?? [];
        const messages = rawMessages.slice(0, MAX_MESSAGES_PER_CONVERSATION);

        forensicsConversations.push({
          conversation: toGHLConversationInput(conv, messages),
          opportunity: toGHLOpportunityInput(opp, stage.name, stage.lostStageName),
        });
      }
    }
  }

  console.log(`[daily-pipeline]   Total conversaciones a analizar: ${forensicsConversations.length}`);

  const analyses = forensicsConversations.map(({ conversation, opportunity }) =>
    analyzeConversation(conversation, opportunity)
  );

  const forensics = generateBatchSummary(analyses, PIPELINE_CONFIG.primary.id, PIPELINE_CONFIG.primary.name);
  console.log(`[daily-pipeline]   Análisis completado: ${forensics.totalAnalyzed} conversaciones`);

  // ─── 2. Early Warnings (oportunidades abiertas) ──────────────────────
  console.log('[daily-pipeline] ── FASE 2: Early Warnings (Abiertas) ──');

  const allWarnings: EarlyWarning[] = [];
  for (const [pipelineId, opps] of Object.entries(input.openOpportunities)) {
    const oppsWithValue = opps.filter((o) => o.monetaryValue > 0).slice(0, MAX_OPPORTUNITIES_PER_STAGE);
    console.log(`[daily-pipeline]   Pipeline ${pipelineId}: ${oppsWithValue.length} abiertas con valor`);

    for (const opp of oppsWithValue) {
      const rawConversations = input.conversations[opp.contactId] ?? [];
      const allMessages: RawMessage[] = [];
      for (const conv of rawConversations.slice(0, MAX_CONVERSATIONS_PER_CONTACT)) {
        allMessages.push(...(input.messages[conv.id] ?? []));
      }

      const warning = detectEarlyWarnings(opp, allMessages);
      if (warning.warnings.length > 0) {
        allWarnings.push(warning);
      }
    }
  }

  allWarnings.sort((a, b) => {
    const sevOrder = { urgent: 0, high: 1, medium: 2 };
    const aMin = Math.min(...a.warnings.map((w) => sevOrder[w.severity]));
    const bMin = Math.min(...b.warnings.map((w) => sevOrder[w.severity]));
    if (aMin !== bMin) return aMin - bMin;
    return b.value - a.value;
  });

  const earlyWarnings = allWarnings.slice(0, 20);
  const totalAtRisk = allWarnings.reduce((s, w) => s + w.value, 0);
  console.log(`[daily-pipeline]   ${allWarnings.length} warnings detectados (top ${earlyWarnings.length}), $${totalAtRisk.toLocaleString('es-CL')} en riesgo`);

  // ─── 3. Win Patterns (oportunidades ganadas) ─────────────────────────
  console.log('[daily-pipeline] ── FASE 3: Win Patterns (Ganadas) ──');

  const allWins: WinPattern[] = [];
  for (const stage of [PIPELINE_CONFIG.primary, ...PIPELINE_CONFIG.secondary]) {
    const rawOpps = input.wonOpportunities[stage.wonStageId] ?? [];
    const oppsWithValue = rawOpps.filter((o) => o.monetaryValue > 0).slice(0, MAX_OPPORTUNITIES_PER_STAGE);
    console.log(`[daily-pipeline]   ${stage.name}/${stage.wonStageName}: ${oppsWithValue.length} ganadas`);

    for (const opp of oppsWithValue) {
      const rawConversations = input.conversations[opp.contactId] ?? [];
      const allMessages: RawMessage[] = [];
      for (const conv of rawConversations.slice(0, MAX_CONVERSATIONS_PER_CONTACT)) {
        allMessages.push(...(input.messages[conv.id] ?? []));
      }

      allWins.push(detectWinPatterns(opp, allMessages));
    }
  }

  allWins.sort((a, b) => b.value - a.value);
  const winPatterns = allWins.slice(0, 20);
  const wonTotalValue = allWins.reduce((s, w) => s + w.value, 0);
  console.log(`[daily-pipeline]   ${allWins.length} ganadas, $${wonTotalValue.toLocaleString('es-CL')} total`);

  // ─── 4. Calcular summary ─────────────────────────────────────────────
  const totalLostValue = Object.values(input.lostOpportunities)
    .flat()
    .reduce((s, o) => s + o.monetaryValue, 0);

  const openAtRiskCount = allWarnings.length;
  const openAtRiskValue = totalAtRisk;

  const summary = {
    totalLostAnalyzed: forensics.totalAnalyzed,
    totalLostValue,
    recoverableValue: forensics.summary.recoverableValue,
    openAtRisk: openAtRiskCount,
    openAtRiskValue,
    wonAnalyzed: allWins.length,
    wonTotalValue,
  };

  // ─── 5. Persistir en BD ──────────────────────────────────────────────
  console.log('[daily-pipeline] ── FASE 4: Persistencia en BD ──');
  const db = getDb();
  initSchema(db);

  const repo = new PipelineRunRepository(db);
  const runId = `run-${TODAY}-${Date.now()}`;

  // Guardar como un registro extendido con early warnings y win patterns
  const extendedSummary = {
    ...forensics.summary,
    earlyWarnings: earlyWarnings.map((w) => ({
      contactName: w.contactName,
      value: w.value,
      severity: Math.min(...w.warnings.map((x) => (x.severity === 'urgent' ? 0 : x.severity === 'high' ? 1 : 2))),
      warnings: w.warnings.map((x) => x.detail),
      intentSignals: w.intentSignals,
    })),
    winPatterns: winPatterns.map((w) => ({
      contactName: w.contactName,
      value: w.value,
      timeToClose: w.timeToClose,
      winningFactors: w.winningFactors,
    })),
    summary,
  };

  repo.insert({
    id: runId,
    runAt: new Date().toISOString(),
    pipelineId: PIPELINE_CONFIG.primary.id,
    pipelineName: PIPELINE_CONFIG.primary.name,
    totalAnalyzed: forensics.totalAnalyzed,
    summaryJson: JSON.stringify(extendedSummary),
    conversationsJson: JSON.stringify(forensics.conversations),
    status: 'completed',
  });

  console.log(`[daily-pipeline]   Run ${runId} guardado en BD`);

  // ─── 6. Generar reporte Markdown ──────────────────────────────────────
  console.log('[daily-pipeline] ── FASE 5: Reporte ──');
  const reportContent = generateDailyReport({
    date: TODAY,
    forensics,
    earlyWarnings,
    winPatterns,
    summary,
  });

  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportPath = join(REPORTS_DIR, `daily-pipeline-${TODAY}.md`);
  writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`[daily-pipeline]   Reporte guardado: ${reportPath}`);

  closeDb();

  return {
    forensics,
    earlyWarnings,
    winPatterns,
    reportPath,
    dbRunId: runId,
    summary,
  };
}

// ─── Generador de Reporte Markdown ──────────────────────────────────────────

function generateDailyReport(opts: {
  date: string;
  forensics: BatchAnalysisResult;
  earlyWarnings: EarlyWarning[];
  winPatterns: WinPattern[];
  summary: DailyPipelineOutput['summary'];
}): string {
  const { date, forensics, earlyWarnings, winPatterns, summary } = opts;
  const { summary: fSummary } = forensics;

  const formatCLP = (v: number) =>
    `$${Math.round(v).toLocaleString('es-CL')}`;

  let md = `# 📊 Reporte Diario GHL — ${date}\n\n`;
  md += `**Pipeline:** ${forensics.pipelineName}\n`;
  md += `**Generado:** ${new Date().toLocaleString('es-CL')}\n`;
  md += `**Conversaciones analizadas:** ${forensics.totalAnalyzed}\n\n`;

  md += `---\n\n`;
  md += `## 📈 Resumen Ejecutivo\n\n`;
  md += `| Métrica | Valor |\n`;
  md += `|---|---|\n`;
  md += `| Valor total pipeline | ${formatCLP(fSummary.totalValue)} |\n`;
  md += `| Valor recuperable | ${formatCLP(fSummary.recoverableValue)} |\n`;
  md += `| Alta prioridad | ${fSummary.highPriorityCount} |\n`;
  md += `| Urgentes | ${fSummary.urgentCount} |\n`;
  md += `| Score promedio recuperabilidad | ${fSummary.avgRecoverabilityScore}/100 |\n`;
  md += `| Oportunidades en riesgo (abiertas) | ${summary.openAtRisk} (${formatCLP(summary.openAtRiskValue)}) |\n`;
  md += `| Negocios ganados analizados | ${summary.wonAnalyzed} (${formatCLP(summary.wonTotalValue)}) |\n\n`;

  md += `---\n\n`;
  md += `## 🔴 Early Warnings — Oportunidades en Riesgo\n\n`;

  if (earlyWarnings.length === 0) {
    md += `✅ No se detectaron warnings de alta prioridad.\n\n`;
  } else {
    md += `| Contacto | Valor | Severidad | Warnings | Señales |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const w of earlyWarnings) {
      const maxSev = w.warnings.map((x) => x.severity).sort()[0] ?? 'medium';
      const sevEmoji = maxSev === 'urgent' ? '🔴' : maxSev === 'high' ? '🟠' : '🟡';
      md += `| ${w.contactName} | ${formatCLP(w.value)} | ${sevEmoji} ${maxSev} | ${w.warnings.map((x) => x.detail).join('<br>')} | ${w.intentSignals.join(', ') || '—'} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## 💀 Top Pérdidas por Razón\n\n`;
  md += `| Razón | Cantidad | Valor |\n`;
  md += `|---|---|---|\n`;
  for (const r of fSummary.topLossReasons.slice(0, 10)) {
    md += `| ${r.reason} | ${r.count} | ${formatCLP(r.value)} |\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `## 🏆 Win Patterns — ¿Qué funciona?\n\n`;

  if (winPatterns.length === 0) {
    md += `Sin datos de patrones de éxito.\n\n`;
  } else {
    md += `| Contacto | Valor | Tiempo cierre | Factores |\n`;
    md += `|---|---|---|---|\n`;
    for (const w of winPatterns.slice(0, 10)) {
      md += `| ${w.contactName} | ${formatCLP(w.value)} | ${w.timeToClose}d | ${w.winningFactors.join(', ') || '—'} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## 🎯 Top Oportunidades Recuperables\n\n`;
  md += `| # | Contacto | Valor | Score | Prioridad | Razón | Acción Sugerida |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  const top10 = forensics.conversations.slice(0, 10);
  for (let i = 0; i < top10.length; i++) {
    const c = top10[i];
    md += `| ${i + 1} | ${c.contactName} | ${formatCLP(c.opportunityValue)} | ${c.recoverability.totalScore} | ${c.recoverability.priority} | ${c.lossReason.primaryReason} | ${c.lossReason.suggestedAction.slice(0, 80)}... |\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `*Reporte generado automáticamente por Paperclip Daily Pipeline Routine.*\n`;
  md += `*Próxima ejecución: mañana ~08:00 Chile.*\n`;

  return md;
}

// ─── CLI entry point ────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('daily-pipeline.ts') || process.argv[1]?.endsWith('daily-pipeline.js')) {
  const isMock = process.argv.includes('--mock');

  if (isMock) {
    console.log('[daily-pipeline] Modo MOCK — generando datos de demo...\n');

    // Generar datos mock para probar localmente
    const mockConversations = buildMockConversations();
    const mockOpps = buildMockOpportunities();

    const input: DailyPipelineInput = {
      lostOpportunities: {
        [PIPELINE_CONFIG.primary.lostStageId]: mockOpps.filter((o) => o.status === 'lost'),
      },
      openOpportunities: {
        [PIPELINE_CONFIG.primary.id]: mockOpps.filter((o) => o.status === 'open'),
      },
      wonOpportunities: {
        [PIPELINE_CONFIG.primary.wonStageId]: mockOpps.filter((o) => o.status === 'won'),
      },
      conversations: buildMockConversationsMap(mockConversations),
      messages: buildMockMessagesMap(mockConversations),
    };

    const output = runDailyPipeline(input);

    console.log('\n[daily-pipeline] ✅ Pipeline completado!');
    console.log(`  Forense: ${output.forensics.totalAnalyzed} conversaciones analizadas`);
    console.log(`  Warnings: ${output.earlyWarnings.length} en riesgo`);
    console.log(`  Win patterns: ${output.winPatterns.length}`);
    console.log(`  Reporte: ${output.reportPath}`);
    console.log(`  BD Run ID: ${output.dbRunId}`);
  } else {
    console.log('[daily-pipeline] Modo Paperclip — esperando datos del MCP...');
    console.log('  Este script debe ser invocado por un Paperclip Agent con acceso a MCP.');
    console.log('  La función runDailyPipeline() recibe los datos ya recolectados.');
    console.log('');
    console.log('  Paperclip Agent Flow:');
    console.log('    1. mcp__prod-ghl-mcp__opportunities_get-pipelines');
    console.log('    2. mcp__prod-ghl-mcp__opportunities_search-opportunity (lost/open/won)');
    console.log('    3. mcp__prod-ghl-mcp__conversations_search-conversation (por contacto)');
    console.log('    4. mcp__prod-ghl-mcp__conversations_get-messages (por conversación)');
    console.log('    5. Construir DailyPipelineInput');
    console.log('    6. Llamar runDailyPipeline(input)');
    console.log('');
    console.log('  Para probar con datos mock: npx tsx scripts/daily-pipeline.ts --mock');
  }
}

// ─── Helpers para modo mock ────────────────────────────────────────────────

function buildMockConversations(): Array<RawConversation & { messages: RawMessage[] }> {
  const now = Date.now();
  return [
    {
      id: 'CONV-001', contactId: 'c1', contactName: 'Sebastián Severino (Soser)',
      email: 'severino@soser.cl', phone: '+56912345678',
      lastMessageDate: now - 56 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'No me alcanza el presupuesto',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'high-value'],
      messages: [
        { id: 'm1', direction: 'outbound', body: 'Hola, gracias por contactar a Central GPS.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:00:00Z' },
        { id: 'm2', direction: 'inbound', body: 'Hola, me interesa el servicio de rastreo para una flota de 5 camiones. ¿Cuánto cuesta?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:05:00Z' },
        { id: 'm3', direction: 'outbound', body: 'El valor es de $45.000 mensuales por equipo, incluye plataforma y soporte.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:12:00Z' },
        { id: 'm4', direction: 'inbound', body: 'Está muy caro, en la competencia me ofrecieron algo similar por menos.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:20:00Z' },
        { id: 'm5', direction: 'outbound', body: 'Entendible. Nuestra diferencia es el soporte local 24/7.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:25:00Z' },
        { id: 'm6', direction: 'inbound', body: 'No me alcanza el presupuesto para este mes, muy caro para mi empresa.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-12T10:30:00Z' },
      ],
    },
    {
      id: 'CONV-002', contactId: 'c2', contactName: 'Maritza Gonzalez (EPYSA)',
      email: 'mgonzalez@epysa.cl', phone: '+56987654321',
      lastMessageDate: now - 1 * 86400000,
      lastMessageType: 'TYPE_EMAIL', lastMessageBody: 'El proyecto está en pausa',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'follow-up'],
      messages: [
        { id: 'm7', direction: 'outbound', body: 'Buenas tardes, ¿cómo va el proyecto? Nos interesa seguir ayudándole.', messageType: 'TYPE_EMAIL', dateAdded: '2026-06-01T15:00:00Z' },
        { id: 'm8', direction: 'inbound', body: 'Hola, disculpa la demora. El proyecto está en pausa por ahora.', messageType: 'TYPE_EMAIL', dateAdded: '2026-06-21T15:30:00Z' },
      ],
    },
    {
      id: 'CONV-003', contactId: 'c3', contactName: 'Jorge Muñoz (Corachi)',
      email: 'jmunoz@corachi.cl', phone: '+56911223344',
      lastMessageDate: now - 2 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'Necesito urgente una solución',
      lastMessageDirection: 'inbound', unreadCount: 1,
      tags: ['open', 'urgent'],
      messages: [
        { id: 'm9', direction: 'inbound', body: 'Hola, necesito urgente una solución de rastreo para 3 vehículos nuevos.', messageType: 'TYPE_WHATSAPP', dateAdded: new Date(now - 2 * 86400000).toISOString() },
      ],
    },
    {
      id: 'CONV-004', contactId: 'c4', contactName: 'Ignacio Espinoza (Eternox)',
      email: 'iespinoza@eternox.cl', phone: '+56955443322',
      lastMessageDate: now - 34 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'Ya contraté con otra empresa',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'competitor'],
      messages: [
        { id: 'm10', direction: 'inbound', body: 'Hola, vi el demo en la página. ¿Puedo agendar una demo personalizada?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-10T09:00:00Z' },
        { id: 'm11', direction: 'outbound', body: 'Claro, ¿qué día le queda mejor?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-10T09:05:00Z' },
        { id: 'm12', direction: 'inbound', body: 'El jueves a las 11am', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-10T09:10:00Z' },
        { id: 'm13', direction: 'outbound', body: 'Confirmado. Le enviamos el link de zoom.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-10T09:15:00Z' },
        { id: 'm14', direction: 'inbound', body: 'Ya contraté con otra empresa. Gracias de todas formas.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-20T10:00:00Z' },
      ],
    },
    {
      id: 'CONV-005', contactId: 'c5', contactName: 'Tabita Solis (Sermat)',
      email: 'tsolis@sermat.cl', phone: '+56999887766',
      lastMessageDate: now - 78 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'No me convence el precio',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'price-sensitive'],
      messages: [
        { id: 'm15', direction: 'inbound', body: 'Hola, ¿podrían explicarme cómo funciona el sistema para una flota mixta?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:00:00Z' },
        { id: 'm16', direction: 'outbound', body: 'Con gusto. Nuestra plataforma soporta camiones, autos y motos en una misma cuenta.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:10:00Z' },
        { id: 'm17', direction: 'inbound', body: 'Pero es muy caro para 10 vehículos. No me convence el precio.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:20:00Z' },
      ],
    },
    {
      id: 'CONV-006', contactId: 'c6', contactName: 'Transportes Rápidos SpA',
      email: 'contacto@trapidos.cl', phone: '+56911111111',
      lastMessageDate: now - 5 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'Perfecto, comenzamos el lunes',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['won', 'enterprise'],
      messages: [
        { id: 'm18', direction: 'inbound', body: 'Hola, necesito una cotización para 20 vehículos de mi flota.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-01T08:00:00Z' },
        { id: 'm19', direction: 'outbound', body: 'Por supuesto. Para 20 vehículos tenemos un plan empresa con descuento por volumen.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-01T08:15:00Z' },
        { id: 'm20', direction: 'inbound', body: 'Me interesa. ¿Cuándo pueden instalar?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-01T08:30:00Z' },
        { id: 'm21', direction: 'outbound', body: 'Podemos instalar la próxima semana. Le envío los datos para la factura.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-01T08:35:00Z' },
        { id: 'm22', direction: 'inbound', body: 'Perfecto, comenzamos el lunes. Gracias por la rapidez.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-03T09:00:00Z' },
      ],
    },
  ];
}

function buildMockOpportunities(): RawOpportunity[] {
  return [
    { id: 'OPP-001', name: 'Soser - Flota 5 camiones', contactId: 'c1', contactName: 'Sebastián Severino (Soser)', monetaryValue: 41116655, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: PIPELINE_CONFIG.primary.lostStageId, status: 'lost', createdAt: '2026-01-15T00:00:00Z' },
    { id: 'OPP-002', name: 'EPYSA - Proyecto GPS', contactId: 'c2', contactName: 'Maritza Gonzalez (EPYSA)', monetaryValue: 4300000, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: PIPELINE_CONFIG.primary.lostStageId, status: 'lost', createdAt: '2026-03-01T00:00:00Z' },
    { id: 'OPP-003', name: 'Corachi - Consulta API', contactId: 'c3', contactName: 'Jorge Muñoz (Corachi)', monetaryValue: 1431646, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: PIPELINE_CONFIG.primary.lostStageId, status: 'lost', createdAt: '2026-04-20T00:00:00Z' },
    { id: 'OPP-004', name: 'Eternox - Demo', contactId: 'c4', contactName: 'Ignacio Espinoza (Eternox)', monetaryValue: 140000, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: PIPELINE_CONFIG.primary.lostStageId, status: 'lost', createdAt: '2026-05-10T00:00:00Z' },
    { id: 'OPP-005', name: 'Sermat - Flota 10', contactId: 'c5', contactName: 'Tabita Solis (Sermat)', monetaryValue: 59762, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: PIPELINE_CONFIG.primary.lostStageId, status: 'lost', createdAt: '2026-04-01T00:00:00Z' },
    { id: 'OPP-006', name: 'Corachi - Urgente 3 vehículos', contactId: 'c3', contactName: 'Jorge Muñoz (Corachi)', monetaryValue: 3500000, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: 'open-stage', status: 'open', createdAt: '2026-06-20T00:00:00Z' },
    { id: 'OPP-007', name: 'Transportes Rápidos - 20 vehículos', contactId: 'c6', contactName: 'Transportes Rápidos SpA', monetaryValue: 18000000, pipelineId: PIPELINE_CONFIG.primary.id, pipelineStageId: PIPELINE_CONFIG.primary.wonStageId, status: 'won', createdAt: '2026-05-01T00:00:00Z', lastStageChangeAt: '2026-05-03T00:00:00Z' },
  ];
}

function buildMockConversationsMap(convs: Array<RawConversation & { messages: RawMessage[] }>): Record<string, RawConversation[]> {
  const map: Record<string, RawConversation[]> = {};
  for (const c of convs) {
    if (!map[c.contactId]) map[c.contactId] = [];
    map[c.contactId].push(c);
  }
  return map;
}

function buildMockMessagesMap(convs: Array<RawConversation & { messages: RawMessage[] }>): Record<string, RawMessage[]> {
  const map: Record<string, RawMessage[]> = {};
  for (const c of convs) {
    map[c.id] = c.messages;
  }
  return map;
}
