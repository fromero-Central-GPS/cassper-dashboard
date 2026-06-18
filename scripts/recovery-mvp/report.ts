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

// ─── Multi-Status Report Types ──────────────────────────────────────────────

interface EarlyWarning {
  opportunityId: string;
  contactName: string;
  value: number;
  stage: string;
  warnings: Array<{ type: string; severity: "urgent" | "high" | "medium"; detail: string }>;
  lastActivity: string;
  daysSinceLastContact: number;
  intentSignals: string[];
}

interface WinPattern {
  opportunityId: string;
  contactName: string;
  value: number;
  timeToClose: number;
  signals: string[];
  winningFactors: string[];
}

interface MultiStatusReportInput {
  lost: { rows: ReportRow[]; totalValue: number; totalCount: number };
  open: { warnings: EarlyWarning[]; totalAtRisk: number; totalCount: number };
  won: { patterns: WinPattern[]; totalValue: number; totalCount: number };
  date: string;
}

function severityEmoji(severity: string): string {
  if (severity === "urgent") return "🔴";
  if (severity === "high") return "🟠";
  return "🟡";
}

function winEmoji(factors: string[]): string {
  if (factors.length >= 4) return "🏆";
  if (factors.length >= 2) return "✅";
  return "👍";
}

export function generateMultiStatusReport(input: MultiStatusReportInput): string {
  const { lost, open, won, date } = input;
  const grandTotal = lost.totalValue + open.totalAtRisk + won.totalValue;

  const lines: string[] = [
    `# Reporte Multi-Estado de Oportunidades — ${date}`,
    "",
    `> Generado por el detector multi-estado Cassper. Cubre oportunidades **perdidas**, **abiertas en riesgo**, y **ganadas**.`,
    "",
    `## 📊 Dashboard General`,
    "",
    `| Categoría | Cantidad | Valor total |`,
    `|---|---|---|`,
    `| 🔴 Perdidas (recuperables) | ${lost.totalCount} | $${fmt(lost.totalValue)} CLP |`,
    `| 🟡 Abiertas (con alertas) | ${open.totalCount} | $${fmt(open.totalAtRisk)} CLP |`,
    `| 🟢 Ganadas | ${won.totalCount} | $${fmt(won.totalValue)} CLP |`,
    `| **Total monitoreado** | **${lost.totalCount + open.totalCount + won.totalCount}** | **$${fmt(grandTotal)} CLP** |`,
    "",
    `---`,
    "",
    `## 🔴 Sección 1: Oportunidades Perdidas — Recuperación`,
    "",
    `> ${lost.totalCount} oportunidades perdidas por **$${fmt(lost.totalValue)} CLP**. Top ${lost.rows.length} por score de recuperabilidad.`,
    "",
    `| # | Contacto | Valor CLP | Pipeline/Stage | Razón pérdida | Score | Acción sugerida |`,
    `|---|---|---|---|---|---|---|`,
  ];

  lost.rows.forEach((row, i) => {
    const { opportunity: opp, analysis, weightedScore: ws } = row;
    const emoji = scoreEmoji(analysis.recoverability_score);
    lines.push(
      `| ${i + 1} | **${opp.contact.name}** | $${fmt(opp.monetaryValue)} | ${opp.pipelineName} / ${opp.pipelineStageName} | ${analysis.loss_reason} | ${emoji} ${analysis.recoverability_score} | ${analysis.suggested_next_action.slice(0, 80)} |`
    );
  });

  lines.push("");
  lines.push(`---`);
  lines.push("");
  lines.push(`## 🟡 Sección 2: Oportunidades Abiertas — Early Warning`);
  lines.push("");
  lines.push(`> ${open.totalCount} oportunidades abiertas con señales de riesgo. **$${fmt(open.totalAtRisk)} CLP** en juego. Actuar antes de que pasen a Perdido.`);
  lines.push("");

  if (open.warnings.length === 0) {
    lines.push("✅ No se detectaron alertas en oportunidades abiertas.");
  } else {
    lines.push(`| # | Contacto | Valor CLP | Stage | Alertas | Señales intención | Última actividad |`);
    lines.push(`|---|---|---|---|---|---|`);
    open.warnings.forEach((w, i) => {
      const alertList = w.warnings.map((a) => `${severityEmoji(a.severity)} ${a.detail}`).join("<br>");
      const signals = w.intentSignals.join(", ") || "—";
      const lastAct = w.lastActivity !== "nunca" ? new Date(w.lastActivity).toLocaleDateString("es-CL") : "nunca";
      lines.push(
        `| ${i + 1} | **${w.contactName}** | $${fmt(w.value)} | ${w.stage} | ${alertList} | ${signals} | ${lastAct} |`
      );
    });
  }

  lines.push("");
  lines.push(`---`);
  lines.push("");
  lines.push(`## 🟢 Sección 3: Oportunidades Ganadas — Win Analysis`);
  lines.push("");
  lines.push(`> ${won.totalCount} oportunidades ganadas por **$${fmt(won.totalValue)} CLP**. Patrones de éxito detectados.`);
  lines.push("");

  if (won.patterns.length === 0) {
    lines.push("ℹ️ Sin datos de oportunidades ganadas para analizar.");
  } else {
    // Summary stats
    const avgTimeToClose = Math.round(
      won.patterns.reduce((s, p) => s + p.timeToClose, 0) / (won.patterns.length || 1)
    );
    const fastWins = won.patterns.filter((p) => p.timeToClose <= 7).length;
    const topSignals = new Map<string, number>();
    won.patterns.forEach((p) => p.signals.forEach((s) => topSignals.set(s, (topSignals.get(s) ?? 0) + 1)));
    const sortedSignals = Array.from(topSignals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    lines.push(`| Métrica | Valor |`);
    lines.push(`|---|---|`);
    lines.push(`| Tiempo promedio de cierre | ${avgTimeToClose} días |`);
    lines.push(`| Cierres rápidos (≤7 días) | ${fastWins} de ${won.patterns.length} (${Math.round(fastWins / won.patterns.length * 100)}%) |`);
    lines.push(`| Señales más comunes | ${sortedSignals.map(([s, c]) => `${s} (${c})`).join(", ")} |`);
    lines.push("");

    lines.push(`| # | Contacto | Valor CLP | Tiempo cierre | Señales | Factores de éxito |`);
    lines.push(`|---|---|---|---|---|---|`);
    won.patterns.forEach((p, i) => {
      const signals = p.signals.join(", ") || "—";
      lines.push(
        `| ${i + 1} | **${p.contactName}** | $${fmt(p.value)} | ${p.timeToClose}d | ${signals} | ${winEmoji(p.winningFactors)} ${p.winningFactors.join("; ")} |`
      );
    });
  }

  lines.push("");
  lines.push("---");
  lines.push(`*Reporte multi-estado generado el ${new Date().toISOString()} vía scripts/recovery-mvp*`);

  return lines.join("\n");
}
