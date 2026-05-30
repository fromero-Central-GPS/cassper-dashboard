import { writeFileSync } from "fs";
import { join } from "path";
import type { Opportunity } from "./ghl-client.js";
import type { AnalysisResult } from "./analyzer.js";

export interface ReportRow {
  opportunity: Opportunity;
  analysis: AnalysisResult;
  weightedScore: number;
}

function fmt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

function scoreEmoji(score: number): string {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  if (score >= 40) return "🟠";
  return "🔴";
}

export function generateMarkdownReport(rows: ReportRow[], date: string): string {
  const totalValue = rows.reduce((s, r) => s + r.opportunity.monetaryValue, 0);
  const totalWeighted = rows.reduce((s, r) => s + r.weightedScore, 0);

  const lines: string[] = [
    `# Reporte de Recuperación de Oportunidades — ${date}`,
    "",
    `> Generado automáticamente por el detector MVP. Pipeline principal: **Central GPS**.`,
    "",
    `## Resumen ejecutivo`,
    "",
    `| Métrica | Valor |`,
    `|---|---|`,
    `| Oportunidades analizadas | ${rows.length} |`,
    `| Valor total en riesgo | $${fmt(totalValue)} CLP |`,
    `| Valor recuperable estimado | $${fmt(Math.round(totalWeighted))} CLP |`,
    `| Score promedio recuperabilidad | ${Math.round(rows.reduce((s, r) => s + r.analysis.recoverability_score, 0) / rows.length)} |`,
    "",
    `## Top ${rows.length} oportunidades por potencial de recuperación`,
    "",
    `| # | Contacto | Valor CLP | Pipeline/Stage | Razón pérdida | Score | Acción sugerida |`,
    `|---|---|---|---|---|---|---|`,
  ];

  rows.forEach((row, i) => {
    const { opportunity: opp, analysis, weightedScore: ws } = row;
    const emoji = scoreEmoji(analysis.recoverability_score);
    lines.push(
      `| ${i + 1} | **${opp.contact.name}** | $${fmt(opp.monetaryValue)} | ${opp.pipelineName} / ${opp.pipelineStageName} | ${analysis.loss_reason} | ${emoji} ${analysis.recoverability_score} | ${analysis.suggested_next_action} |`
    );
  });

  lines.push("");
  lines.push("## Detalle por oportunidad");
  lines.push("");

  rows.forEach((row, i) => {
    const { opportunity: opp, analysis } = row;
    lines.push(`### ${i + 1}. ${opp.contact.name}`);
    lines.push("");
    lines.push(`- **ID oportunidad:** \`${opp.id}\``);
    lines.push(`- **Valor:** $${fmt(opp.monetaryValue)} CLP`);
    lines.push(`- **Score recuperabilidad:** ${scoreEmoji(analysis.recoverability_score)} **${analysis.recoverability_score}/100**`);
    lines.push(`- **Valor ponderado:** $${fmt(Math.round(row.weightedScore))} CLP`);
    lines.push(`- **Etapa funnel:** ${analysis.funnel_stage}`);
    lines.push(`- **Razón de pérdida:** ${analysis.loss_reason}`);
    lines.push(`- **Señales de intención:**`);
    analysis.intent_signals.forEach((s) => lines.push(`  - ${s}`));
    lines.push(`- **Acción sugerida:** ${analysis.suggested_next_action}`);
    if (opp.contact.email) lines.push(`- **Email:** ${opp.contact.email}`);
    if (opp.contact.phone) lines.push(`- **Teléfono:** ${opp.contact.phone}`);
    lines.push("");
  });

  lines.push("---");
  lines.push(`*Reporte generado el ${new Date().toISOString()} vía scripts/recovery-mvp*`);

  return lines.join("\n");
}

export function saveReport(content: string, date: string, outputDir: string): string {
  const filename = `recovery-${date}.md`;
  const path = join(outputDir, filename);
  writeFileSync(path, content, "utf-8");
  return path;
}
