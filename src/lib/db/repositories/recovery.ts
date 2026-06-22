/**
 * Recovery Campaign Repository
 *
 * Persistencia para campañas de recuperación post-envío (CEN-1008).
 * Maneja el ciclo de vida completo: envío → awaiting_response →
 * clasificación → follow-up → archivo.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface RecoveryCampaign {
  id: string;
  name: string;
  wave_number: number;
  status: 'active' | 'completed' | 'archived' | 'draft';
  messages_sent: number;
  total_value_targeted: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface RecoverySend {
  id: string;
  campaign_id: string;
  contact_name: string;
  contact_email: string | null;
  company_name: string | null;
  ghl_contact_id: string | null;
  opportunity_id: string | null;
  value_clp: number;
  channel: 'email' | 'whatsapp' | 'sms';
  message_id: string | null;
  status: 'sent' | 'awaiting_response' | 'replied_positive' | 'replied_negative'
    | 'replied_neutral' | 'no_response' | 'followup_sent' | 'archived' | 'failed';
  sent_at: string;
  response_at: string | null;
  response_classification: 'positive' | 'negative' | 'neutral' | null;
  response_summary: string | null;
  followup_sent_at: string | null;
  followup_message_id: string | null;
  archived_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RecoveryCampaignMetrics {
  id: string;
  name: string;
  status: string;
  wave_number: number;
  messagesSent: number;
  totalValue: number;
  responseRate: number;
  conversions: number;
  valueRecovered: number;
  repliedCount: number;
  positiveCount: number;
  negativeCount: number;
  noResponseCount: number;
  awaitingCount: number;
  followupCount: number;
}

export type RecoverySendStatus = RecoverySend['status'];

// ─── Repositorio ────────────────────────────────────────────────────────────

export class RecoveryRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  // ─── Campañas ──────────────────────────────────────────────────────────

  getCampaign(id: string): RecoveryCampaign | undefined {
    return this.db.prepare(
      'SELECT * FROM recovery_campaigns WHERE id = ?'
    ).get(id) as RecoveryCampaign | undefined;
  }

  listCampaigns(status?: string): RecoveryCampaign[] {
    if (status) {
      return this.db.prepare(
        'SELECT * FROM recovery_campaigns WHERE status = ? ORDER BY started_at DESC'
      ).all(status) as RecoveryCampaign[];
    }
    return this.db.prepare(
      'SELECT * FROM recovery_campaigns ORDER BY started_at DESC'
    ).all() as RecoveryCampaign[];
  }

  createCampaign(campaign: Omit<RecoveryCampaign, 'created_at'>): void {
    this.db.prepare(`
      INSERT INTO recovery_campaigns (id, name, wave_number, status, messages_sent, total_value_targeted, started_at, completed_at)
      VALUES (@id, @name, @wave_number, @status, @messages_sent, @total_value_targeted, @started_at, @completed_at)
    `).run(campaign);
  }

  updateCampaignStatus(id: string, status: RecoveryCampaign['status']): void {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    this.db.prepare(
      `UPDATE recovery_campaigns SET status = ?, completed_at = ? WHERE id = ?`
    ).run(status, completedAt, id);
  }

  // ─── Envíos ────────────────────────────────────────────────────────────

  getSend(id: string): RecoverySend | undefined {
    return this.db.prepare(
      'SELECT * FROM recovery_sends WHERE id = ?'
    ).get(id) as RecoverySend | undefined;
  }

  listSendsByCampaign(campaignId: string): RecoverySend[] {
    return this.db.prepare(
      'SELECT * FROM recovery_sends WHERE campaign_id = ? ORDER BY sent_at DESC'
    ).all(campaignId) as RecoverySend[];
  }

  listSendsByStatus(status: RecoverySendStatus | RecoverySendStatus[]): RecoverySend[] {
    if (Array.isArray(status)) {
      const placeholders = status.map(() => '?').join(',');
      return this.db.prepare(
        `SELECT * FROM recovery_sends WHERE status IN (${placeholders}) ORDER BY sent_at ASC`
      ).all(...status) as RecoverySend[];
    }
    return this.db.prepare(
      'SELECT * FROM recovery_sends WHERE status = ? ORDER BY sent_at ASC'
    ).all(status) as RecoverySend[];
  }

  createSend(send: Omit<RecoverySend, 'created_at'>): void {
    this.db.prepare(`
      INSERT INTO recovery_sends (
        id, campaign_id, contact_name, contact_email, company_name,
        ghl_contact_id, opportunity_id, value_clp, channel, message_id,
        status, sent_at, response_at, response_classification, response_summary,
        followup_sent_at, followup_message_id, archived_at, notes
      ) VALUES (
        @id, @campaign_id, @contact_name, @contact_email, @company_name,
        @ghl_contact_id, @opportunity_id, @value_clp, @channel, @message_id,
        @status, @sent_at, @response_at, @response_classification, @response_summary,
        @followup_sent_at, @followup_message_id, @archived_at, @notes
      )
    `).run(send);
  }

  /** Bulk insert sends — for campaign initialization */
  createSends(sends: Array<Omit<RecoverySend, 'created_at'>>): void {
    const insert = this.db.prepare(`
      INSERT INTO recovery_sends (
        id, campaign_id, contact_name, contact_email, company_name,
        ghl_contact_id, opportunity_id, value_clp, channel, message_id,
        status, sent_at, response_at, response_classification, response_summary,
        followup_sent_at, followup_message_id, archived_at, notes
      ) VALUES (
        @id, @campaign_id, @contact_name, @contact_email, @company_name,
        @ghl_contact_id, @opportunity_id, @value_clp, @channel, @message_id,
        @status, @sent_at, @response_at, @response_classification, @response_summary,
        @followup_sent_at, @followup_message_id, @archived_at, @notes
      )
    `);

    const tx = this.db.transaction((items: Array<Omit<RecoverySend, 'created_at'>>) => {
      for (const send of items) {
        insert.run(send);
      }
    });
    tx(sends);
  }

  updateSendStatus(
    id: string,
    status: RecoverySendStatus,
    extra?: {
      response_at?: string;
      response_classification?: 'positive' | 'negative' | 'neutral';
      response_summary?: string;
      followup_sent_at?: string;
      followup_message_id?: string;
      archived_at?: string;
      notes?: string;
    }
  ): void {
    const sets: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined) {
          sets.push(`${key} = ?`);
          params.push(value);
        }
      }
    }

    params.push(id);
    this.db.prepare(`UPDATE recovery_sends SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  /** Mark all 'sent' sends in a campaign as 'awaiting_response' */
  activateCampaignSends(campaignId: string): number {
    const result = this.db.prepare(
      `UPDATE recovery_sends SET status = 'awaiting_response'
       WHERE campaign_id = ? AND status = 'sent'`
    ).run(campaignId);
    return result.changes;
  }

  // ─── Métricas ──────────────────────────────────────────────────────────

  getCampaignMetrics(campaignId: string): RecoveryCampaignMetrics | null {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) return null;

    const sends = this.listSendsByCampaign(campaignId);
    const total = sends.length;

    const repliedCount = sends.filter(s =>
      ['replied_positive', 'replied_negative', 'replied_neutral'].includes(s.status)
    ).length;
    const positiveCount = sends.filter(s => s.status === 'replied_positive').length;
    const negativeCount = sends.filter(s => s.status === 'replied_negative').length;
    const noResponseCount = sends.filter(s =>
      ['no_response', 'archived'].includes(s.status)
    ).length;
    const awaitingCount = sends.filter(s =>
      ['sent', 'awaiting_response', 'followup_sent'].includes(s.status)
    ).length;
    const followupCount = sends.filter(s => s.status === 'followup_sent').length;
    const conversions = positiveCount;
    const valueRecovered = sends
      .filter(s => s.status === 'replied_positive')
      .reduce((sum, s) => sum + s.value_clp, 0);

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      wave_number: campaign.wave_number,
      messagesSent: campaign.messages_sent,
      totalValue: campaign.total_value_targeted,
      responseRate: total > 0 ? Math.round((repliedCount / total) * 100) : 0,
      conversions,
      valueRecovered,
      repliedCount,
      positiveCount,
      negativeCount,
      noResponseCount,
      awaitingCount,
      followupCount,
    };
  }

  /** Returns all campaign metrics as an array */
  listAllCampaignMetrics(): RecoveryCampaignMetrics[] {
    const campaigns = this.listCampaigns();
    return campaigns
      .map(c => this.getCampaignMetrics(c.id))
      .filter((m): m is RecoveryCampaignMetrics => m !== null);
  }

  /** Get sends that need monitoring (active monitoring statuses) */
  getActiveMonitoringSends(): RecoverySend[] {
    return this.listSendsByStatus(['awaiting_response', 'followup_sent']);
  }

  /** Get total sends count for a campaign */
  countSends(campaignId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM recovery_sends WHERE campaign_id = ?'
    ).get(campaignId) as { count: number };
    return row.count;
  }
}
