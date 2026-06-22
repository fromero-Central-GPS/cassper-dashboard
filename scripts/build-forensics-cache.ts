/**
 * build-forensics-cache.ts
 *
 * Script ejecutable por un Paperclip heartbeat para poblar el caché
 * de datos forenses con datos reales desde el MCP de GHL.
 *
 * Uso en Paperclip:
 *   El agente llama a las herramientas MCP, construye los arrays de
 *   GHLOpportunityInput y GHLConversationInput, y los escribe al caché
 *   usando writeForensicsCache().
 *
 * Este archivo también sirve como documentación del flujo de datos esperado.
 *
 * @see CEN-998: Forense con conversaciones reales
 */

import {
  buildForensicsCache,
  writeForensicsCache,
  type ForensicsCacheEntry,
  type ForensicsCacheData,
} from '@/lib/forensics-cache';
import type { GHLConversationInput, GHLOpportunityInput, GHLMessage } from '@/lib/analysis-engine';

// ─── Pipeline de referencia ──────────────────────────────────────────────

const CENTRAL_GPS_PIPELINE = {
  id: 'MNxYbS1kOg11IiU2QbMv',
  name: 'Central GPS',
};

// ─── Helper para construir entradas ──────────────────────────────────────

interface RawForensicsData {
  opportunity: GHLOpportunityInput;
  conversation: GHLConversationInput;
}

/**
 * Recibe arrays de oportunidades y conversaciones con mensajes,
 * construye las entradas del caché y las persiste.
 */
export function persistForensicsData(rawData: RawForensicsData[]): ForensicsCacheData {
  const entries: ForensicsCacheEntry[] = rawData.map(({ opportunity, conversation }) => ({
    opportunity,
    conversation,
  }));

  const cache = buildForensicsCache(
    entries,
    CENTRAL_GPS_PIPELINE.id,
    CENTRAL_GPS_PIPELINE.name,
  );

  writeForensicsCache(cache);
  return cache;
}

/**
 * Construye un GHLMessage desde la respuesta MCP de conversations_get-messages.
 *
 * La respuesta MCP tiene mensajes con campos:
 * - id, direction, body, dateAdded, messageType, contentType, source, status
 */
export function buildMessageFromMcp(mcpMsg: Record<string, unknown>): GHLMessage {
  return {
    id: (mcpMsg.id as string) || '',
    direction: (mcpMsg.direction as 'inbound' | 'outbound') || 'inbound',
    body: (mcpMsg.body as string) || '',
    messageType: (mcpMsg.messageType as string) || 'TYPE_SMS',
    dateAdded: (mcpMsg.dateAdded as string) || new Date().toISOString(),
    contentType: mcpMsg.contentType as string | undefined,
    source: mcpMsg.source as string | undefined,
  };
}

/**
 * Construye GHLConversationInput desde la respuesta MCP de conversations_search-conversation
 * más los mensajes obtenidos de conversations_get-messages.
 */
export function buildConversationFromMcp(
  mcpConv: Record<string, unknown>,
  messages: GHLMessage[],
): GHLConversationInput {
  return {
    id: (mcpConv.id as string) || '',
    contactId: (mcpConv.contactId as string) || '',
    contactName: (mcpConv.contactName as string) || (mcpConv.fullName as string) || '',
    email: (mcpConv.email as string) || undefined,
    phone: (mcpConv.phone as string) || undefined,
    lastMessageDate: (mcpConv.lastMessageDate as number) || Date.now(),
    lastMessageType: (mcpConv.lastMessageType as string) || 'TYPE_SMS',
    lastMessageDirection: (mcpConv.lastMessageDirection as 'inbound' | 'outbound') || 'inbound',
    lastMessageBody: (mcpConv.lastMessageBody as string) || '',
    unreadCount: (mcpConv.unreadCount as number) || 0,
    tags: (mcpConv.tags as string[]) || [],
    messages,
  };
}

/**
 * Construye GHLOpportunityInput desde la respuesta MCP de opportunities_search-opportunity.
 */
export function buildOpportunityFromMcp(mcpOpp: Record<string, unknown>): GHLOpportunityInput {
  const contact = (mcpOpp.contact || {}) as Record<string, unknown>;
  return {
    id: (mcpOpp.id as string) || '',
    name: (mcpOpp.name as string) || '',
    contactId: (mcpOpp.contactId as string) || '',
    contactName: (contact.name as string) || (mcpOpp.contactName as string) || '',
    monetaryValue: (mcpOpp.monetaryValue as number) || 0,
    pipelineId: (mcpOpp.pipelineId as string) || CENTRAL_GPS_PIPELINE.id,
    pipelineStageId: (mcpOpp.pipelineStageId as string) || '',
    pipelineStageName: getStageName(mcpOpp.pipelineStageId as string),
    status: 'lost',
    createdAt: (mcpOpp.createdAt as string) || new Date().toISOString(),
  };
}

/** Mapea IDs de stage conocidos a nombres */
function getStageName(stageId: string): string {
  const stages: Record<string, string> = {
    '84c42420-0ec8-4cf4-bcf5-defec7d50783': 'Recibido',
    'dc05554e-7ed7-47d0-bb07-90d8fe1c829a': 'Calificado',
    '62d38776-ffcf-42ed-9ae3-95537c8bb3dc': 'Demo / Plataforma',
    '8f1f9bc8-5ee8-428d-a67e-927b853b6d9f': 'Demo / Instalado',
    'c7f57725-1fdd-4800-91d5-955370643e4d': 'Registro Clientes',
    'ed6aa62d-fb4e-4d44-bcd1-133ab984e2f8': 'Aceptado',
    '21acac86-cfd1-4ec5-8b84-90918a37ce1b': 'Frío',
    '2bfd0ea8-b816-4e1c-88de-4d25e2b535fb': 'Perdido',
  };
  return stages[stageId] || 'Perdido';
}
