/**
 * GHL MCP wrapper — calls prod-ghl-mcp via the Anthropic MCP bridge.
 * In production this runs inside a Claude tool-use session; for local testing
 * it expects MCP_GHL_ENDPOINT and GHL_LOCATION_ID in env.
 */

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface Opportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineName: string;
  pipelineStageId: string;
  pipelineStageName: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  contactId: string;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    tags?: string[];
  };
  lostReasonId?: string | null;
  customFields?: Array<{ id: string; fieldValueString?: string; type: string }>;
}

export interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  dateAdded: string;
  messageType: string;
  source?: string;
  status?: string;
}

// Ninety days ago as mm-dd-yyyy
function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export async function getPipelines(rawData: unknown): Promise<Pipeline[]> {
  const data = rawData as { pipelines: Array<{ id: string; name: string; stages: PipelineStage[] }> };
  return data.pipelines.map((p) => ({
    id: p.id,
    name: p.name,
    stages: p.stages,
  }));
}

export function findLostStages(pipelines: Pipeline[]): Array<{ pipelineId: string; pipelineName: string; stageId: string; stageName: string }> {
  const LOST_KEYWORDS = ["perdido", "negocio perdido", "lost"];
  const result: Array<{ pipelineId: string; pipelineName: string; stageId: string; stageName: string }> = [];

  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) {
      if (LOST_KEYWORDS.some((kw) => stage.name.toLowerCase().includes(kw))) {
        result.push({
          pipelineId: pipeline.id,
          pipelineName: pipeline.name,
          stageId: stage.id,
          stageName: stage.name,
        });
      }
    }
  }

  return result;
}

export function filterRecentOpportunities(opportunities: Opportunity[], days = 90): Opportunity[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return opportunities.filter(
    (o) => o.monetaryValue > 0 && new Date(o.updatedAt) >= cutoff
  );
}

export function parseOpportunities(
  rawData: unknown,
  pipelineName: string,
  stageName: string
): Opportunity[] {
  const data = rawData as {
    opportunities: Array<{
      id: string;
      name: string;
      monetaryValue: number;
      pipelineId: string;
      pipelineStageId: string;
      status: string;
      updatedAt: string;
      createdAt: string;
      contactId: string;
      contact?: { id: string; name: string; email?: string; phone?: string; tags?: string[] };
      lostReasonId?: string | null;
      customFields?: Array<{ id: string; fieldValueString?: string; type: string }>;
    }>;
  };

  return (data.opportunities || []).map((o) => ({
    ...o,
    pipelineName,
    pipelineStageName: stageName,
    contact: o.contact ?? { id: o.contactId, name: o.name },
  }));
}

export function parseMessages(rawData: unknown): ConversationMessage[] {
  const data = rawData as { messages: { messages: ConversationMessage[] } };
  return data.messages?.messages ?? [];
}
