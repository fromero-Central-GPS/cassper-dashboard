/**
 * Forensics Cache
 *
 * Gestiona el almacenamiento en caché de datos forenses reales obtenidos
 * desde el MCP de GHL. Los datos se persisten como JSON en el sistema de archivos
 * y se renuevan periódicamente por un heartbeat de Paperclip.
 *
 * Arquitectura:
 * - Paperclip heartbeat → llama herramientas MCP → almacena resultados en caché
 * - API route /api/ghl/forensics → lee de caché (modo live) o mock (desarrollo)
 *
 * @see CEN-998: Forense con conversaciones reales
 */

import fs from 'fs';
import path from 'path';
import type { GHLConversationInput, GHLOpportunityInput } from './analysis-engine';

// ─── Tipos para el caché ──────────────────────────────────────────────────

export interface ForensicsCacheEntry {
  opportunity: GHLOpportunityInput;
  conversation: GHLConversationInput;
}

export interface ForensicsCacheData {
  fetchedAt: string;
  pipelineId: string;
  pipelineName: string;
  entries: ForensicsCacheEntry[];
  _meta: {
    totalOpportunities: number;
    totalConversations: number;
    source: string;
  };
}

// ─── Path del archivo de caché ────────────────────────────────────────────

const CACHE_FILE = path.join(process.cwd(), 'data', 'forensics-cache.json');

// ─── API pública ──────────────────────────────────────────────────────────

/** Lee los datos forenses desde el caché en disco */
export function readForensicsCache(): ForensicsCacheData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as ForensicsCacheData;
  } catch (error) {
    console.error('[ForensicsCache] Error reading cache:', error);
    return null;
  }
}

/** Escribe datos forenses al caché en disco */
export function writeForensicsCache(data: ForensicsCacheData): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[ForensicsCache] Cache written: ${data.entries.length} entries`);
  } catch (error) {
    console.error('[ForensicsCache] Error writing cache:', error);
  }
}

/** Retorna la edad del caché en segundos. -1 si no existe. */
export function getCacheAgeSeconds(): number {
  try {
    if (!fs.existsSync(CACHE_FILE)) return -1;
    const stats = fs.statSync(CACHE_FILE);
    return Math.floor((Date.now() - stats.mtimeMs) / 1000);
  } catch {
    return -1;
  }
}

/** Verifica si el caché está fresco (menos de la TTL especificada en segundos) */
export function isCacheFresh(ttlSeconds: number = 3600): boolean {
  const age = getCacheAgeSeconds();
  return age >= 0 && age < ttlSeconds;
}

/** Construye entradas de caché directamente desde resultados MCP para persistencia */
export function buildCacheEntry(
  opportunity: GHLOpportunityInput,
  conversation: GHLConversationInput,
): ForensicsCacheEntry {
  return { opportunity, conversation };
}

/**
 * Construye un ForensicsCacheData completo desde listas de entradas.
 * Usado por el heartbeat de Paperclip para escribir resultados.
 */
export function buildForensicsCache(
  entries: ForensicsCacheEntry[],
  pipelineId: string,
  pipelineName: string,
): ForensicsCacheData {
  return {
    fetchedAt: new Date().toISOString(),
    pipelineId,
    pipelineName,
    entries,
    _meta: {
      totalOpportunities: new Set(entries.map((e) => e.opportunity.id)).size,
      totalConversations: entries.length,
      source: 'prod-ghl-mcp (Paperclip heartbeat)',
    },
  };
}
