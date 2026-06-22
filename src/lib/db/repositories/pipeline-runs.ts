/**
 * PipelineRunRepository
 *
 * Acceso a la tabla pipeline_runs para almacenar y recuperar
 * resultados de ejecuciones diarias del pipeline GHL.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type {
  BatchAnalysisResult,
  ConversationAnalysis,
} from '@/lib/analysis-engine';

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface PipelineRun {
  id: string;
  runAt: string;
  pipelineId: string;
  pipelineName: string;
  totalAnalyzed: number;
  summaryJson: string;
  conversationsJson: string | null;
  status: 'completed' | 'failed' | 'running';
  errorMessage: string | null;
  createdAt: string;
}

export interface PipelineRunSummary {
  id: string;
  runAt: string;
  pipelineId: string;
  pipelineName: string;
  totalAnalyzed: number;
  status: string;
}

// ─── Row type from DB ─────────────────────────────────────────────────────

interface PipelineRunRow {
  id: string;
  run_at: string;
  pipeline_id: string;
  pipeline_name: string;
  total_analyzed: number;
  summary_json: string;
  conversations_json: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

// ─── Repository ───────────────────────────────────────────────────────────

export class PipelineRunRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  /** Guarda un nuevo pipeline run */
  insert(run: {
    id: string;
    runAt: string;
    pipelineId: string;
    pipelineName: string;
    totalAnalyzed: number;
    summaryJson: string;
    conversationsJson?: string | null;
    status?: 'completed' | 'failed' | 'running';
    errorMessage?: string | null;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO pipeline_runs (id, run_at, pipeline_id, pipeline_name, total_analyzed, summary_json, conversations_json, status, error_message)
      VALUES (@id, @run_at, @pipeline_id, @pipeline_name, @total_analyzed, @summary_json, @conversations_json, @status, @error_message)
    `);
    stmt.run({
      id: run.id,
      run_at: run.runAt,
      pipeline_id: run.pipelineId,
      pipeline_name: run.pipelineName,
      total_analyzed: run.totalAnalyzed,
      summary_json: run.summaryJson,
      conversations_json: run.conversationsJson ?? null,
      status: run.status ?? 'completed',
      error_message: run.errorMessage ?? null,
    });
  }

  /** Guarda un BatchAnalysisResult completo */
  saveBatchResult(batch: BatchAnalysisResult): void {
    const { summary, conversations, ...rest } = batch;
    this.insert({
      id: `run-${batch.pipelineId}-${Date.now()}`,
      runAt: batch.analyzedAt,
      pipelineId: batch.pipelineId,
      pipelineName: batch.pipelineName,
      totalAnalyzed: batch.totalAnalyzed,
      summaryJson: JSON.stringify(summary),
      conversationsJson: JSON.stringify(conversations),
      status: 'completed',
    });
  }

  /** Obtiene el último run exitoso para un pipeline */
  getLatest(pipelineId?: string): PipelineRun | null {
    let stmt;
    if (pipelineId) {
      stmt = this.db.prepare(`
        SELECT * FROM pipeline_runs
        WHERE pipeline_id = @pipeline_id AND status = 'completed'
        ORDER BY run_at DESC LIMIT 1
      `);
      const row = stmt.get({ pipeline_id: pipelineId }) as PipelineRunRow | undefined;
      return row ? this._mapRow(row) : null;
    }
    stmt = this.db.prepare(`
      SELECT * FROM pipeline_runs
      WHERE status = 'completed'
      ORDER BY run_at DESC LIMIT 1
    `);
    const row = stmt.get() as PipelineRunRow | undefined;
    return row ? this._mapRow(row) : null;
  }

  /** Obtiene el último BatchAnalysisResult reconstruido */
  getLatestBatch(pipelineId?: string): BatchAnalysisResult | null {
    const run = this.getLatest(pipelineId);
    if (!run) return null;

    try {
      const summary = JSON.parse(run.summaryJson);
      const conversations: ConversationAnalysis[] = run.conversationsJson
        ? JSON.parse(run.conversationsJson)
        : [];

      return {
        analyzedAt: run.runAt,
        pipelineId: run.pipelineId,
        pipelineName: run.pipelineName,
        totalAnalyzed: run.totalAnalyzed,
        summary,
        conversations,
      };
    } catch {
      return null;
    }
  }

  /** Lista los últimos N runs (solo metadatos, sin el JSON pesado) */
  listRecent(limit: number = 10): PipelineRunSummary[] {
    const stmt = this.db.prepare(`
      SELECT id, run_at, pipeline_id, pipeline_name, total_analyzed, status
      FROM pipeline_runs
      ORDER BY run_at DESC
      LIMIT @limit
    `);
    const rows = stmt.all({ limit }) as Array<{
      id: string;
      run_at: string;
      pipeline_id: string;
      pipeline_name: string;
      total_analyzed: number;
      status: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      runAt: r.run_at,
      pipelineId: r.pipeline_id,
      pipelineName: r.pipeline_name,
      totalAnalyzed: r.total_analyzed,
      status: r.status,
    }));
  }

  /** Marca un run como fallido */
  markFailed(id: string, errorMessage: string): void {
    const stmt = this.db.prepare(`
      UPDATE pipeline_runs SET status = 'failed', error_message = @error WHERE id = @id
    `);
    stmt.run({ id, error: errorMessage });
  }

  private _mapRow(row: PipelineRunRow): PipelineRun {
    return {
      id: row.id,
      runAt: row.run_at,
      pipelineId: row.pipeline_id,
      pipelineName: row.pipeline_name,
      totalAnalyzed: row.total_analyzed,
      summaryJson: row.summary_json,
      conversationsJson: row.conversations_json,
      status: row.status as PipelineRun['status'],
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
