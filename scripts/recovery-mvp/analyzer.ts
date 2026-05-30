import Anthropic from "@anthropic-ai/sdk";
import type { Opportunity, ConversationMessage } from "./ghl-client.js";

export interface AnalysisResult {
  opportunityId: string;
  intent_signals: string[];
  funnel_stage: string;
  loss_reason: string;
  recoverability_score: number;
  suggested_next_action: string;
}

const client = new Anthropic();

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

function buildPrompt(opp: Opportunity, messages: ConversationMessage[]): string {
  const msgSummary = messages
    .slice(0, 20)
    .map((m) => `[${m.dateAdded.slice(0, 10)} ${m.direction} ${m.messageType}] ${m.body?.slice(0, 200) ?? ""}`)
    .join("\n");

  return `Eres un analista de ventas para Central GPS, empresa chilena de rastreo vehicular GPS.

Analiza esta oportunidad perdida y sus conversaciones. Responde SOLO en JSON válido, sin markdown, sin texto extra.

OPORTUNIDAD:
- Nombre: ${opp.name}
- Valor: $${opp.monetaryValue.toLocaleString("es-CL")} CLP
- Pipeline: ${opp.pipelineName}
- Stage al perder: ${opp.pipelineStageName}
- Perdido el: ${opp.updatedAt.slice(0, 10)}
- Creado: ${opp.createdAt.slice(0, 10)}
- Tags del contacto: ${opp.contact.tags?.join(", ") ?? "ninguno"}
- Email: ${opp.contact.email ?? "no disponible"}
- Teléfono: ${opp.contact.phone ?? "no disponible"}

ÚLTIMAS CONVERSACIONES (más reciente primero):
${msgSummary || "Sin mensajes registrados"}

Devuelve este JSON exacto:
{
  "intent_signals": ["señal1", "señal2"],
  "funnel_stage": "etapa estimada al perder",
  "loss_reason": "razón principal de pérdida en 1 oración",
  "recoverability_score": 0-100,
  "suggested_next_action": "acción concreta a tomar para recuperar"
}

Criterios de recoverability_score:
- 80-100: Interés real demostrado, objeción de precio/tiempo, no hubo follow-up
- 60-79: Algo de interés, conversación incompleta
- 40-59: Interés bajo, necesita trabajo
- 0-39: Señales negativas, muy difícil recuperar`;
}

export async function analyzeOpportunity(
  opp: Opportunity,
  messages: ConversationMessage[]
): Promise<AnalysisResult> {
  const prompt = buildPrompt(opp, messages);

  // Use Haiku for initial analysis; upgrade to Sonnet if score > 70
  const firstPass = await client.messages.create({
    model: HAIKU,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = firstPass.content[0].type === "text" ? firstPass.content[0].text : "{}";

  let result: AnalysisResult;
  try {
    result = { opportunityId: opp.id, ...JSON.parse(text) };
  } catch {
    result = {
      opportunityId: opp.id,
      intent_signals: [],
      funnel_stage: opp.pipelineStageName,
      loss_reason: "No se pudo analizar",
      recoverability_score: 0,
      suggested_next_action: "Revisar manualmente",
    };
  }

  // Deep analysis for high-value recoverable leads
  if (result.recoverability_score > 70) {
    const deepPass = await client.messages.create({
      model: SONNET,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            prompt +
            `\n\nEl análisis inicial indica score ${result.recoverability_score}. Profundiza en las señales de intención y mejora la acción sugerida con pasos específicos y personalizados.`,
        },
      ],
    });

    const deepText =
      deepPass.content[0].type === "text" ? deepPass.content[0].text : text;
    try {
      result = { opportunityId: opp.id, ...JSON.parse(deepText) };
    } catch {
      // keep first-pass result
    }
  }

  return result;
}

export function weightedScore(opp: Opportunity, analysis: AnalysisResult): number {
  return opp.monetaryValue * (analysis.recoverability_score / 100);
}
