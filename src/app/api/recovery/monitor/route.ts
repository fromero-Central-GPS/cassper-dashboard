import { NextResponse } from 'next/server';
import { RecoveryRepository, initSchema } from '@/lib/db';

/**
 * POST /api/recovery/monitor
 *
 * Ejecuta el ciclo de monitoreo de respuestas para sends activos.
 *
 * Body (opcional):
 *   { campaignId?: string }
 *
 * En Paperclip runtime, este endpoint es llamado por el agente
 * después de recolectar datos de GHL y Gmail via MCP.
 *
 * Modos:
 *   ?mode=mock → usa datos simulados
 *   ?mode=live → ejecuta monitoreo real sobre BD
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'live';

  if (mode === 'mock') {
    return NextResponse.json({
      result: getMockMonitorResult(),
      _meta: { mode: 'mock', note: 'Resultado simulado.' },
    });
  }

  try {
    let body: { campaignId?: string; responses?: Array<{
      sendId: string;
      text: string;
      date: string;
    }> } = {};

    try {
      body = await request.json();
    } catch {
      // No body is OK — just run monitoring on all active sends
    }

    const repo = new RecoveryRepository();
    initSchema();

    const activeSends = repo.getActiveMonitoringSends();

    if (activeSends.length === 0) {
      return NextResponse.json({
        result: {
          checkedAt: new Date().toISOString(),
          totalMonitored: 0,
          responsesDetected: 0,
          responsesClassified: { positive: 0, negative: 0, neutral: 0 },
          followupsTriggered: 0,
          archived: 0,
          campaignMetrics: repo.listAllCampaignMetrics(),
          details: [],
        },
        _meta: { message: 'No hay sends activos para monitorear.' },
      });
    }

    // Construir externalResponses Map si se proporcionaron
    const externalResponses = new Map<string, { text: string; date: string }>();
    if (body.responses) {
      for (const r of body.responses) {
        externalResponses.set(r.sendId, { text: r.text, date: r.date });
      }
    }

    // Importar y ejecutar el monitor
    const { runResponseMonitor } = await import('@/../scripts/monitor-responses');
    const result = runResponseMonitor({
      campaignId: body.campaignId,
      externalResponses: externalResponses.size > 0 ? externalResponses : undefined,
    });

    return NextResponse.json({
      result,
      _meta: {
        mode: 'live',
        activeSendsCount: activeSends.length,
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Error executing response monitor',
      detail: String(err),
    }, { status: 500 });
  }
}

/**
 * GET /api/recovery/monitor
 *
 * Retorna el estado actual de monitoreo sin ejecutar cambios.
 * Solo lectura — útil para el dashboard.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'live';

  if (mode === 'mock') {
    return NextResponse.json({
      ...getMockMonitorResult(),
      _meta: { mode: 'mock', readOnly: true },
    });
  }

  try {
    const repo = new RecoveryRepository();
    initSchema();

    const activeSends = repo.getActiveMonitoringSends();
    const campaignMetrics = repo.listAllCampaignMetrics();

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      totalMonitored: activeSends.length,
      activeSends: activeSends.map(s => ({
        id: s.id,
        contactName: s.contact_name,
        status: s.status,
        daysSinceSent: Math.floor(
          (Date.now() - new Date(s.sent_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      campaignMetrics,
      _meta: { mode: 'live', readOnly: true },
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Error fetching monitoring status',
      detail: String(err),
    }, { status: 500 });
  }
}

// ─── Mock ──────────────────────────────────────────────────────────────────

function getMockMonitorResult() {
  return {
    checkedAt: new Date().toISOString(),
    totalMonitored: 13,
    responsesDetected: 3,
    responsesClassified: { positive: 2, negative: 1, neutral: 0 },
    followupsTriggered: 0,
    archived: 0,
    campaignMetrics: [
      {
        id: 'recovery-wave1-20260622',
        name: 'Recuperación Wave 1 — Re-engagement',
        status: 'active',
        wave_number: 1,
        messagesSent: 13,
        totalValue: 10728575,
        responseRate: 23,
        conversions: 2,
        valueRecovered: 4300000,
        repliedCount: 3,
        positiveCount: 2,
        negativeCount: 1,
        noResponseCount: 0,
        awaitingCount: 8,
        followupCount: 2,
      },
    ],
    details: [
      {
        sendId: 'send-epysa',
        contactName: 'Maritza Gonzalez (EPYSA)',
        previousStatus: 'awaiting_response',
        newStatus: 'replied_positive',
        action: 'response_classified',
        detail: 'positive: Señales positivas detectadas: interes, solicitud_demo.',
      },
      {
        sendId: 'send-mcvargas',
        contactName: 'MC Vargas',
        previousStatus: 'awaiting_response',
        newStatus: 'replied_positive',
        action: 'response_classified',
        detail: 'positive: Señales positivas detectadas: interes, urgencia.',
      },
      {
        sendId: 'send-eternox',
        contactName: 'Ignacio Espinoza (Eternox)',
        previousStatus: 'awaiting_response',
        newStatus: 'replied_negative',
        action: 'response_classified',
        detail: 'negative: Señales negativas detectadas: ya_contrato.',
      },
    ],
  };
}
