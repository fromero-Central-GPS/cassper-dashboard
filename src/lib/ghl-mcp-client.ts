/**
 * GHL MCP Client
 *
 * Capa de abstracción sobre las herramientas MCP prod-ghl-mcp.
 * Encapsula las llamadas a la API de GHL para que el motor de análisis
 * no tenga dependencia directa con los detalles del MCP.
 *
 * En Paperclip, estas funciones serían implementadas como llamadas
 * directas a las herramientas MCP (mcp__prod-ghl-mcp__*).
 *
 * Para desarrollo local, se proporciona un adaptador mock que usa
 * los datos del archivo mock-data.ts.
 */

import type {
  GHLConversationInput,
  GHLOpportunityInput,
  GHLMessage,
} from './analysis-engine';

// ─── Tipos para la configuración del cliente ──────────────────────────────

export interface GHLClientConfig {
  /** ID de la ubicación/subaccount de GHL */
  locationId: string;
  /** Cantidad máxima de resultados por página */
  pageSize?: number;
  /** Timeout en ms para llamadas al MCP */
  timeout?: number;
}

// ─── Interfaces del cliente ───────────────────────────────────────────────

export interface PipelineInfo {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; position: number; winProbability: number }>;
}

export interface ConversationSearchParams {
  contactId?: string;
  assignedTo?: string;
  status?: 'all' | 'read' | 'unread' | 'starred';
  lastMessageType?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  sort?: 'asc' | 'desc';
  limit?: number;
  startAfterDate?: number;
  query?: string;
}

export interface OpportunitySearchParams {
  pipelineId?: string;
  pipelineStageId?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned' | 'all';
  contactId?: string;
  assignedTo?: string;
  limit?: number;
  startAfter?: string;
  startAfterId?: string;
}

// ─── Resultados tipados ───────────────────────────────────────────────────

export interface ConversationResult {
  conversation: GHLConversationInput;
  messages: GHLMessage[];
}

export interface OpportunityResult {
  opportunity: GHLOpportunityInput;
  conversations: ConversationResult[];
}

// ─── Cliente Principal ────────────────────────────────────────────────────

export class GHLMCPClient {
  private config: Required<GHLClientConfig>;

  constructor(config: GHLClientConfig) {
    this.config = {
      locationId: config.locationId,
      pageSize: config.pageSize ?? 50,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Obtiene todos los pipelines y sus stages.
   *
   * MCP tool: opportunities_get-pipelines
   * Endpoint: GET /opportunities/pipelines
   */
  async getPipelines(): Promise<PipelineInfo[]> {
    // En Paperclip: mcp__prod-ghl-mcp__opportunities_get-pipelines()
    // Retorna pipelines con stages, probabilidades, etc.
    throw new Error(
      'Este método debe ejecutarse en el contexto de Paperclip con acceso al MCP. ' +
      'Usa mcp__prod-ghl-mcp__opportunities_get-pipelines directamente.'
    );
  }

  /**
   * Busca oportunidades en el pipeline.
   *
   * MCP tool: opportunities_search-opportunity
   * Endpoint: POST /opportunities/search
   */
  async searchOpportunities(params: OpportunitySearchParams): Promise<GHLOpportunityInput[]> {
    // En Paperclip: mcp__prod-ghl-mcp__opportunities_search-opportunity(params)
    throw new Error(
      'Este método debe ejecutarse en el contexto de Paperclip con acceso al MCP. ' +
      'Usa mcp__prod-ghl-mcp__opportunities_search-opportunity directamente.'
    );
  }

  /**
   * Busca conversaciones con filtros.
   *
   * MCP tool: conversations_search-conversation
   * Endpoint: POST /conversations/search
   */
  async searchConversations(params: ConversationSearchParams): Promise<GHLConversationInput[]> {
    // En Paperclip: mcp__prod-ghl-mcp__conversations_search-conversation(params)
    throw new Error(
      'Este método debe ejecutarse en el contexto de Paperclip con acceso al MCP. ' +
      'Usa mcp__prod-ghl-mcp__conversations_search-conversation directamente.'
    );
  }

  /**
   * Obtiene los mensajes de una conversación específica.
   *
   * MCP tool: conversations_get-messages
   * Endpoint: GET /conversations/{conversationId}/messages
   */
  async getMessages(conversationId: string, limit?: number): Promise<GHLMessage[]> {
    // En Paperclip: mcp__prod-ghl-mcp__conversations_get-messages({path_conversationId, query_limit})
    throw new Error(
      'Este método debe ejecutarse en el contexto de Paperclip con acceso al MCP. ' +
      'Usa mcp__prod-ghl-mcp__conversations_get-messages directamente.'
    );
  }

  /**
   * Obtiene los datos completos de un contacto.
   *
   * MCP tool: contacts_get-contact
   * Endpoint: GET /contacts/{contactId}
   */
  async getContact(contactId: string): Promise<Record<string, unknown>> {
    // En Paperclip: mcp__prod-ghl-mcp__contacts_get-contact({path_contactId})
    throw new Error(
      'Este método debe ejecutarse en el contexto de Paperclip con acceso al MCP. ' +
      'Usa mcp__prod-ghl-mcp__contacts_get-contact directamente.'
    );
  }
}

// ─── Factory para crear el cliente ────────────────────────────────────────

let defaultClient: GHLMCPClient | null = null;

export function getGHLClient(config?: GHLClientConfig): GHLMCPClient {
  if (!defaultClient || config) {
    defaultClient = new GHLMCPClient(
      config ?? {
        locationId: process.env.GHL_LOCATION_ID || 'GChOJe5xdkQQn8cZEVxi',
      }
    );
  }
  return defaultClient;
}

// ─── Paperclip Agent Pipeline ─────────────────────────────────────────────
//
// Este es el flujo que ejecutaría un agente Paperclip programáticamente.
// Se incluye como pseudocódigo comentado porque la ejecución real
// ocurre en el contexto del MCP durante un heartbeat.
//
// ┌─────────────────────────────────────────────────────────────┐
// │ // 1. Obtener pipelines                                    │
// │ const pipelines = await mcp__prod-ghl-mcp__                │
// │   opportunities_get-pipelines()                            │
// │                                                             │
// │ // 2. Para el pipeline principal, buscar perdidos           │
// │ const lostStage = pipelines[0].stages                       │
// │   .find(s => s.name.includes('Perdido'))                   │
// │                                                             │
// │ const opportunities = await mcp__prod-ghl-mcp__            │
// │   opportunities_search-opportunity({                       │
// │     query_pipeline_id: pipelines[0].id,                    │
// │     query_pipeline_stage_id: lostStage.id,                  │
// │     query_status: 'open',                                  │
// │     query_limit: 50                                        │
// │   })                                                        │
// │                                                             │
// │ // 3. Para cada oportunidad, obtener conversaciones         │
// │ for (const opp of opportunities) {                          │
// │   const conversations = await mcp__prod-ghl-mcp__          │
// │     conversations_search-conversation({                     │
// │       query_contactId: opp.contactId,                       │
// │       query_limit: 5                                        │
// │     })                                                       │
// │                                                             │
// │   // 4. Obtener mensajes de cada conversación              │
// │   for (const conv of conversations) {                       │
// │     const messages = await mcp__prod-ghl-mcp__              │
// │       conversations_get-messages({                          │
// │         path_conversationId: conv.id,                       │
// │         query_limit: 50                                     │
// │       })                                                     │
// │                                                               │
// │     // 5. Ejecutar análisis                                  │
// │     const analysis = analyzeConversation(                   │
// │       { ...conv, messages },                                │
// │       { ...opp, pipelineStageName: lostStage.name }        │
// │     )                                                       │
// │   }                                                         │
// │ }                                                           │
// │                                                             │
// │ // 6. Generar batch summary                                 │
// │ const result = generateBatchSummary(                        │
// │   analyses,                                                 │
// │   pipelines[0].id,                                          │
// │   pipelines[0].name                                         │
// │ )                                                           │
// └─────────────────────────────────────────────────────────────┘
