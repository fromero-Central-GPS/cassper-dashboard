import { NextResponse } from 'next/server';
import { mockDashboardData } from '@/lib/mock-data';
import {
  estimateAnalysisCost,
  type BatchAnalysisResult,
} from '@/lib/analysis-engine';

/**
 * GET /api/ghl/summary
 *
 * Endpoint que orquesta el análisis automático de conversaciones GHL.
 *
 * Flujo en producción (cuando el MCP está disponible):
 *
 * 1. GET pipelines → identificar pipeline principal + stage "Perdido"
 * 2. Buscar oportunidades en stage "Perdido" u oportunidades estancadas
 * 3. Para cada oportunidad, buscar conversaciones del contacto
 * 4. Obtener mensajes completos de cada conversación
 * 5. Ejecutar AnalysisEngine.analyzeConversation() para cada una
 * 6. Generar BatchAnalysisResult con AnalysisEngine.generateBatchSummary()
 * 7. Devolver datos estructurados para el dashboard
 *
 * MCP tools requeridas (todas verificadas y funcionales):
 * - opportunities_get-pipelines             ✓ 6 pipelines, 36 stages
 * - opportunities_search-opportunity        ✓ Filtro por stage, status, pipeline
 * - conversations_search-conversation       ✓ 4,165 conversaciones indexadas
 * - conversations_get-messages              ✓ Historial completo con bodies
 * - contacts_get-contact                    ✓ Datos de contacto con tags
 *
 * Costo estimado por batch de 50 conversaciones:
 * ~$0.30 USD (~$285 CLP)
 *
 * Modos de operación:
 * - ?mode=mock      → datos mock (default en desarrollo)
 * - ?mode=live      → datos reales del MCP (requiere Paperclip runtime)
 * - ?mode=estimate  → solo devuelve estimación de costo
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'mock';

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
