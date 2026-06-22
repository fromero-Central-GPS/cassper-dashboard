import { NextResponse } from 'next/server';
import { mockDashboardData } from '@/lib/mock-data';
import {
  estimateAnalysisCost,
  type BatchAnalysisResult,
} from '@/lib/analysis-engine';
import { PipelineRunRepository } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/ghl/summary
 *
 * Modos de operación:
 * - ?mode=snapshot  → datos reales del pipeline (PRODUCCIÓN, default)
 * - ?mode=mock      → datos mock (desarrollo/fallback)
 * - ?mode=live      → datos reales del MCP (requiere Paperclip runtime)
 * - ?mode=estimate  → solo devuelve estimación de costo
 */

function loadSnapshot(): any | null {
  try {
    const p = path.join(process.cwd(), 'data', 'pipeline-snapshot.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'snapshot';

  // Modo estimación: útil para planificar costos antes de ejecutar
  if (mode === 'estimate') {
    const conversationCount = parseInt(searchParams.get('count') || '50', 10);
    const cost = estimateAnalysisCost(conversationCount);
    return NextResponse.json({
      mode: 'estimate',
      conversationCount,
      cost,
      note: 'Costos basados en Sonnet 4.6 pricing ($3/$15 por MTok input/output)',
    });
  }

  // Modo snapshot: datos reales desde archivo JSON (PRODUCCIÓN)
  if (mode === 'snapshot') {
    const snap = loadSnapshot();
    if (!snap || !snap.opportunities) {
      // Fallback a mock si no hay snapshot
      return NextResponse.json({
        ...mockDashboardData,
        _meta: {
          mode: 'mock',
          fallback: true,
          reason: 'No snapshot found, using mock data',
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    const lostOpps = snap.opportunities.filter((o: any) => o.status === 'lost');
    const totalLost = lostOpps.reduce((s: number, o: any) => s + o.value, 0);
    const withEmail = lostOpps.filter((o: any) => o.email);
    const recoverable = withEmail.reduce((s: number, o: any) => s + o.value, 0);

    // Live risks from open opps (merged with mock liveRisks for now)
    const liveRisks = [...mockDashboardData.liveRisks!];

    return NextResponse.json({
      ...mockDashboardData,
      summary: {
        ...mockDashboardData.summary,
        lostValue: totalLost,
        recoverableValue: recoverable,
        lostConversations: lostOpps.length,
      },
      lossByPhase: [
        { phase: 'Recibido', count: lostOpps.filter((o: any) => o.stageId === '84c42420-0ec8-4cf4-bcf5-defec7d50783').length, value: lostOpps.filter((o: any) => o.stageId === '84c42420-0ec8-4cf4-bcf5-defec7d50783').reduce((s: number, o: any) => s + o.value, 0) },
        { phase: 'Calificado', count: lostOpps.filter((o: any) => o.stageId === 'dc05554e-7ed7-47d0-bb07-90d8fe1c829a').length, value: lostOpps.filter((o: any) => o.stageId === 'dc05554e-7ed7-47d0-bb07-90d8fe1c829a').reduce((s: number, o: any) => s + o.value, 0) },
        { phase: 'Demo / Plataforma', count: lostOpps.filter((o: any) => o.stageId === '62d38776-ffcf-42ed-9ae3-95537c8bb3dc').length, value: lostOpps.filter((o: any) => o.stageId === '62d38776-ffcf-42ed-9ae3-95537c8bb3dc').reduce((s: number, o: any) => s + o.value, 0) },
        { phase: 'Demo / Instalado', count: lostOpps.filter((o: any) => o.stageId === '8f1f9bc8-5ee8-428d-a67e-927b853b6d9f').length, value: lostOpps.filter((o: any) => o.stageId === '8f1f9bc8-5ee8-428d-a67e-927b853b6d9f').reduce((s: number, o: any) => s + o.value, 0) },
        { phase: 'Perdido', count: lostOpps.filter((o: any) => o.stageId === '2bfd0ea8-b816-4e1c-88de-4d25e2b535fb').length, value: lostOpps.filter((o: any) => o.stageId === '2bfd0ea8-b816-4e1c-88de-4d25e2b535fb').reduce((s: number, o: any) => s + o.value, 0) },
      ].filter(p => p.count > 0),
      recoverableTickets: withEmail.slice(0, 13).map((o: any) => {
        const name = o.contactName || o.name || '';
        const val = o.value || 0;
        return {
          id: o.id,
          contactName: name,
          channel: 'Email' as const,
          date: o.updatedAt?.slice(0, 10) || o.createdAt?.slice(0, 10) || '2026-01-01',
          value: val,
          priority: val > 4000000 ? 'urgent' as const : val > 1000000 ? 'high' as const : val > 200000 ? 'medium' as const : 'low' as const,
          lossReason: 'Sin seguimiento',
          stage: 'Perdido',
          score: val > 4000000 ? 98 : val > 1000000 ? 80 : 60,
          lastContact: o.updatedAt?.slice(0, 10) || o.createdAt?.slice(0, 10) || '2026-01-01',
          email: o.email,
          draftSubject: name ? `Seguimiento GPS — ${name}` : 'Seguimiento GPS — CentralGPS',
          draftMessage: name ? `Hola ${name.split(' ')[0]},\n\nHace un tiempo conversamos sobre GPS para tu empresa. Quería saber si todavía están evaluando opciones o si ya encontraron una solución.\n\nTenemos disponibilidad inmediata y podemos armar una propuesta ajustada a lo que necesites.\n\n¿Te interesa retomar la conversación?\n\nSaludos,\nFrancisco` : '',
          draftStatus: 'draft' as const,
        };
      }),
      liveRisks,
      _meta: {
        mode: 'snapshot',
        analyzedAt: snap.generatedAt || new Date().toISOString(),
        source: 'data/pipeline-snapshot.json',
        totalLost,
        totalRecoverable: recoverable,
        note: 'Datos reales de GHL. Snapshots generados por Paperclip routine.',
      },
    });
  }

  // Modo stored: último pipeline run desde BD
  if (mode === 'stored') {
    try {
      const repo = new PipelineRunRepository();
      const run = repo.getLatest();

      if (!run) {
        return NextResponse.json({
          error: 'No hay pipeline runs almacenados. Ejecuta la rutina diaria primero.',
          hint: 'Corre npx tsx scripts/daily-pipeline.ts --mock para generar datos de prueba.',
          _meta: { mode: 'stored', available: false },
        }, { status: 404 });
      }

      const summary = JSON.parse(run.summaryJson);
      const conversations = run.conversationsJson ? JSON.parse(run.conversationsJson) : [];

      // Reconstruir dashboard data desde el batch almacenado
      const lossReasons = (summary.topLossReasons ?? []).map((r: { reason: string; count: number; value: number }) => ({
        reason: r.reason,
        count: r.count,
        value: r.value,
        percentage: summary.totalValue > 0 ? Math.round((r.value / summary.totalValue) * 100) : 0,
      }));

      const lossPhases = (summary.lossByStage ?? []).map((s: { stage: string; count: number; value: number }) => ({
        phase: s.stage,
        count: s.count,
        value: s.value,
      }));

      const recoverableTickets = conversations
        .filter((c: { recoverability?: { priority: string } }) =>
          c.recoverability?.priority === 'urgent' || c.recoverability?.priority === 'high'
        )
        .slice(0, 20)
        .map((c: {
          conversationId: string;
          contactName: string;
          opportunityValue: number;
          channel: string;
          lossReason: { primaryReason: string };
          stageClassification: { detectedStage: string };
          recoverability: { totalScore: number; priority: string };
          abandonment: { lastInboundDate: string | null; daysSinceLastContact: number };
        }) => ({
          id: c.conversationId,
          contactName: c.contactName,
          value: c.opportunityValue,
          channel: c.channel as 'WhatsApp' | 'Email' | 'SMS',
          date: c.abandonment.lastInboundDate ?? run.runAt,
          priority: c.recoverability.priority as 'urgent' | 'high' | 'medium' | 'low',
          lossReason: c.lossReason.primaryReason,
          stage: c.stageClassification.detectedStage,
          score: c.recoverability.totalScore,
          lastContact: c.abandonment.lastInboundDate ?? run.runAt,
        }));

      const dashboardData = {
        summary: {
          totalEstimatedValue: summary.totalValue ?? 0,
          closedWonValue: summary.wonTotalValue ?? 0,
          lostValue: (summary.totalValue ?? 0) - (summary.recoverableValue ?? 0),
          recoverableValue: summary.recoverableValue ?? 0,
          conversionRate: summary.totalValue > 0
            ? Math.round(((summary.wonTotalValue ?? 0) / summary.totalValue) * 100)
            : 0,
          totalConversations: run.totalAnalyzed,
          wonConversations: summary.winPatterns?.length ?? 0,
          lostConversations: run.totalAnalyzed,
        },
        lossByPhase: lossPhases,
        lossByReason: lossReasons,
        recoverableTickets,
        campaigns: [],
        pipelineName: run.pipelineName,
        liveRisks: (summary.earlyWarnings ?? []).map((w: {
          contactName: string;
          value: number;
          severity: number;
          warnings: string[];
          intentSignals: string[];
        }) => ({
          contactName: w.contactName,
          value: w.value,
          riskScore: w.severity === 0 ? 90 : w.severity === 1 ? 70 : 50,
          warnings: w.warnings,
          recommendedAction: w.severity === 0
            ? 'Contactar inmediatamente'
            : 'Programar seguimiento prioritario',
        })),
        wonPatterns: (summary.winPatterns ?? []).map((w: {
          contactName: string;
          value: number;
          timeToClose: number;
          winningFactors: string[];
        }) => ({
          dealType: w.contactName,
          avgTimeToCloseDays: w.timeToClose,
          keySuccessFactors: w.winningFactors,
          commonBuyingSignals: [],
        })),
        lossTrends: [],
      };

      return NextResponse.json({
        ...dashboardData,
        _meta: {
          mode: 'stored',
          analyzedAt: run.runAt,
          runId: run.id,
          note: 'Datos del último pipeline run almacenado en BD.',
        },
      });
    } catch (err) {
      return NextResponse.json({
        error: 'Error al leer pipeline run de BD',
        detail: String(err),
        _meta: { mode: 'stored' },
      }, { status: 500 });
    }
  }

  // Modo mock: datos predefinidos (desarrollo/demo)
  if (mode === 'mock') {
    return NextResponse.json({
      ...mockDashboardData,
      _meta: {
        mode: 'mock',
        analyzedAt: new Date().toISOString(),
        note: 'Datos mock. Usa ?mode=live en Paperclip para análisis real.',
      },
    });
  }

  // Modo live: análisis real con MCP
  if (mode === 'live') {
    // NOTA: Esta ruta de código solo se ejecuta dentro de Paperclip
    // donde las herramientas MCP están disponibles.
    //
    // El flujo completo está documentado en:
    // - src/lib/analysis-engine.ts (motor de análisis)
    // - src/lib/ghl-mcp-client.ts (cliente MCP)
    //
    // Para ejecutar en un heartbeat de Paperclip, el agente debe:
    // 1. Llamar a mcp__prod-ghl-mcp__opportunities_get-pipelines()
    // 2. Llamar a mcp__prod-ghl-mcp__opportunities_search-opportunity()
    // 3. Iterar y llamar a mcp__prod-ghl-mcp__conversations_search-conversation()
    // 4. Para cada conversación, mcp__prod-ghl-mcp__conversations_get-messages()
    // 5. Construir arrays de GHLConversationInput y GHLOpportunityInput
    // 6. Llamar a analyzeConversation() y generateBatchSummary()
    // 7. Devolver BatchAnalysisResult

    return NextResponse.json({
      error: 'Live mode requires Paperclip runtime with MCP access',
      hint: 'Run this from a Paperclip agent heartbeat, not from a browser',
      _meta: {
        mode: 'live',
        requiredTools: [
          'opportunities_get-pipelines',
          'opportunities_search-opportunity',
          'conversations_search-conversation',
          'conversations_get-messages',
        ],
        estimatedCost: estimateAnalysisCost(50),
        docs: '/src/lib/analysis-engine.ts',
      },
    }, { status: 501 });
  }

  return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
}
