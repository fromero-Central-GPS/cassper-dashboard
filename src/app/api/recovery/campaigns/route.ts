import { NextResponse } from 'next/server';
import { RecoveryRepository, initSchema } from '@/lib/db';
import type { RecoveryCampaignMetrics } from '@/lib/db/repositories/recovery';

/**
 * GET /api/recovery/campaigns
 *
 * Retorna todas las campañas de recuperación con sus métricas.
 *
 * Query params:
 *   ?id=<campaignId> — filtrar por campaña específica
 *   ?mode=mock       — datos mock para desarrollo
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'live';
  const campaignId = searchParams.get('id');

  if (mode === 'mock') {
    return NextResponse.json({
      campaigns: getMockCampaignMetrics(),
      _meta: { mode: 'mock', note: 'Datos mock para desarrollo.' },
    });
  }

  try {
    const repo = new RecoveryRepository();
    initSchema();

    let campaigns: RecoveryCampaignMetrics[];

    if (campaignId) {
      const metrics = repo.getCampaignMetrics(campaignId);
      campaigns = metrics ? [metrics] : [];
    } else {
      campaigns = repo.listAllCampaignMetrics();
    }

    return NextResponse.json({
      campaigns,
      _meta: {
        mode: 'live',
        count: campaigns.length,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Error fetching recovery campaigns',
      detail: String(err),
    }, { status: 500 });
  }
}

/**
 * POST /api/recovery/campaigns
 *
 * Inicializa una campaña de recuperación desde datos de envío.
 * Body: { id, name, waveNumber, sends: Array<{...}> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, waveNumber, sends } = body;

    if (!id || !name || !sends || !Array.isArray(sends)) {
      return NextResponse.json({
        error: 'Campos requeridos: id, name, sends (array)',
      }, { status: 400 });
    }

    const repo = new RecoveryRepository();
    initSchema();

    // Verificar que la campaña no exista ya
    const existing = repo.getCampaign(id);
    if (existing) {
      return NextResponse.json({
        error: `La campaña ${id} ya existe.`,
        existing: { id: existing.id, name: existing.name, status: existing.status },
      }, { status: 409 });
    }

    const totalValue = sends.reduce((sum: number, s: { value_clp?: number }) => sum + (s.value_clp || 0), 0);

    // Crear campaña
    repo.createCampaign({
      id,
      name,
      wave_number: waveNumber || 1,
      status: 'active',
      messages_sent: sends.length,
      total_value_targeted: totalValue,
      started_at: new Date().toISOString(),
      completed_at: null,
    });

    // Crear sends
    const now = new Date().toISOString();
    const sendRecords = sends.map((s: {
      id: string;
      contact_name: string;
      contact_email?: string;
      company_name?: string;
      ghl_contact_id?: string;
      opportunity_id?: string;
      value_clp?: number;
      channel?: string;
      message_id?: string;
      sent_at?: string;
      notes?: string;
    }) => ({
      id: s.id,
      campaign_id: id,
      contact_name: s.contact_name,
      contact_email: s.contact_email || null,
      company_name: s.company_name || null,
      ghl_contact_id: s.ghl_contact_id || null,
      opportunity_id: s.opportunity_id || null,
      value_clp: s.value_clp || 0,
      channel: (s.channel || 'email') as 'email' | 'whatsapp' | 'sms',
      message_id: s.message_id || null,
      status: 'awaiting_response' as const,
      sent_at: s.sent_at || now,
      response_at: null,
      response_classification: null,
      response_summary: null,
      followup_sent_at: null,
      followup_message_id: null,
      archived_at: null,
      notes: s.notes || null,
    }));

    repo.createSends(sendRecords);

    const metrics = repo.getCampaignMetrics(id);

    return NextResponse.json({
      success: true,
      campaign: { id, name, waveNumber, sendsCount: sends.length, totalValue },
      metrics,
      _meta: { createdAt: now },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({
      error: 'Error creating recovery campaign',
      detail: String(err),
    }, { status: 500 });
  }
}

// ─── Mock data ─────────────────────────────────────────────────────────────

function getMockCampaignMetrics(): RecoveryCampaignMetrics[] {
  return [
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
      noResponseCount: 2,
      awaitingCount: 6,
      followupCount: 2,
    },
    {
      id: 'recovery-may-2026',
      name: 'Recuperación Mayo 2026 — Lote Antiguo',
      status: 'completed',
      wave_number: 1,
      messagesSent: 8,
      totalValue: 3200000,
      responseRate: 38,
      conversions: 1,
      valueRecovered: 850000,
      repliedCount: 3,
      positiveCount: 1,
      negativeCount: 2,
      noResponseCount: 5,
      awaitingCount: 0,
      followupCount: 0,
    },
  ];
}
