'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BatchAnalysisResult } from '@/lib/analysis-engine';
import {
  Search,
  TrendingUp,
  AlertTriangle,
  Activity,
  Clock,
  Fingerprint,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  DollarSign,
} from 'lucide-react';

interface ForensicsDetailProps {
  batchResult?: BatchAnalysisResult | null;
}

function fmt(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-CL')}`;
}

const reasonLabels: Record<string, string> = {
  sin_seguimiento: 'Sin seguimiento',
  precio: 'Precio fuera de rango',
  competidor: 'Competidor',
  producto_no_disponible: 'Producto no disponible',
  falta_informacion: 'Falta información',
  proceso_complejo: 'Proceso complejo',
  cliente_explorando: 'Cliente explorando',
  desconocido: 'Sin diagnóstico',
};

const stageLabels: Record<string, string> = {
  consulta_inicial: 'Consulta inicial',
  cotizacion: 'Cotización',
  demo_plataforma: 'Demo / Plataforma',
  negociacion: 'Negociación',
  cierre: 'Cierre',
  seguimiento: 'Seguimiento',
  perdido: 'Perdido',
  ganado: 'Ganado',
};

function priorityBadge(p: string) {
  const config: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'default' | 'outline' }> = {
    urgent: { label: 'Urgente', variant: 'destructive' },
    high: { label: 'Alta', variant: 'secondary' },
    medium: { label: 'Media', variant: 'default' },
    low: { label: 'Baja', variant: 'outline' },
  };
  const c = config[p] ?? { label: p, variant: 'outline' as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function ForensicsDetailView({ batchResult }: ForensicsDetailProps) {
  if (!batchResult || !batchResult.summary) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-400" />
            Análisis Forense — Por Conversación
          </CardTitle>
          <CardDescription className="text-slate-400">
            Resultados del analysis-engine por oportunidad perdida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium">Sin datos forenses</p>
            <p className="text-slate-500 text-sm mt-1">Carga los datos desde el endpoint /api/ghl/forensics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, conversations } = batchResult;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleConv = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Forense — Resumen del Motor de Análisis
          </CardTitle>
          <CardDescription className="text-slate-400">
            {batchResult.totalAnalyzed} oportunidades · {fmt(summary.totalValue)} valor total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-red-400" /> Total Perdido
              </p>
              <p className="text-xl font-bold text-red-400 mt-1">{fmt(summary.totalValue)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-amber-400" /> Recuperable
              </p>
              <p className="text-xl font-bold text-amber-400 mt-1">{fmt(summary.recoverableValue)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-orange-400" /> Alta/Urgente
              </p>
              <p className="text-xl font-bold text-orange-400 mt-1">{summary.highPriorityCount}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-blue-400" /> Score Promedio
              </p>
              <p className="text-xl font-bold text-blue-400 mt-1">{summary.avgRecoverabilityScore}</p>
            </div>
          </div>

          {/* Top loss reasons */}
          {summary.topLossReasons.length > 0 && (
            <div className="mt-4">
              <p className="text-slate-300 text-xs font-medium mb-2">Razones de pérdida (top):</p>
              <div className="flex flex-wrap gap-2">
                {summary.topLossReasons.slice(0, 5).map((r) => (
                  <span
                    key={r.reason}
                    className="px-2.5 py-1 rounded-full text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50"
                  >
                    {reasonLabels[r.reason] ?? r.reason} ({r.count}) — {fmt(r.value)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-conversation analysis */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-400" />
            Análisis por Conversación
          </CardTitle>
          <CardDescription className="text-slate-400">
            Resultados del pipeline de 5 análisis del engine por cada contacto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversations.map((conv) => {
            const isOpen = expanded.has(conv.conversationId);
            const { lossReason, recoverability, stageClassification, intentSignals, abandonment } = conv;

            return (
              <div
                key={conv.conversationId}
                className="bg-slate-900/50 rounded-lg border border-slate-700/30 overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => toggleConv(conv.conversationId)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{conv.contactName}</p>
                      <p className="text-slate-500 text-xs">{fmt(conv.opportunityValue)} · {conv.channel} · {stageLabels[stageClassification.detectedStage] ?? stageClassification.detectedStage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      recoverability.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                      recoverability.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      recoverability.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {recoverability.priority === 'urgent' ? '🔴' :
                       recoverability.priority === 'high' ? '🟠' :
                       recoverability.priority === 'medium' ? '🟡' : '⚪'}
                      {recoverability.priority.toUpperCase()}
                    </span>
                    <span className="text-lg font-bold text-slate-200">{recoverability.totalScore}</span>
                    <span className="text-slate-500 text-xs">/100</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-3 pb-3 border-t border-slate-700/30 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Loss Reason */}
                      <div className="bg-slate-800/30 rounded p-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Razón de pérdida</p>
                        <p className="text-sm text-slate-200 font-medium">{reasonLabels[lossReason.primaryReason] ?? lossReason.primaryReason}</p>
                        <p className="text-xs text-slate-400 mt-1">Confianza: {(lossReason.confidence * 100).toFixed(0)}%</p>
                        {lossReason.evidence.length > 0 && (
                          <ul className="text-xs text-slate-400 mt-1 list-disc list-inside">
                            {lossReason.evidence.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                      </div>

                      {/* Recoverability Breakdown */}
                      <div className="bg-slate-800/30 rounded p-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Scoring recuperabilidad</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-slate-400">Valor:</span>
                          <span className="text-slate-200 text-right">{recoverability.valueScore}/30</span>
                          <span className="text-slate-400">Recencia:</span>
                          <span className="text-slate-200 text-right">{recoverability.recencyScore}/25</span>
                          <span className="text-slate-400">Intención:</span>
                          <span className="text-slate-200 text-right">{recoverability.intentScore}/25</span>
                          <span className="text-slate-400">Engagement:</span>
                          <span className="text-slate-200 text-right">{recoverability.engagementScore}/20</span>
                        </div>
                        {recoverability.factors.length > 0 && (
                          <div className="mt-1">
                            <p className="text-[10px] text-slate-500 mt-1">Factores:</p>
                            {recoverability.factors.map((f, i) => (
                              <p key={i} className="text-[11px] text-slate-400">• {f}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Intent Signals */}
                      <div className="bg-slate-800/30 rounded p-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Señales de intención</p>
                        {intentSignals.purchaseIntent ? (
                          <span className="inline-block px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] mb-1">COMPRA DETECTADA</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 bg-slate-600/20 text-slate-400 rounded text-[10px] mb-1">Sin señales claras</span>
                        )}
                        {intentSignals.signals.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {intentSignals.signals.map((s, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-slate-700/50 rounded text-[10px] text-slate-400">{s}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mt-1">Score intención: {intentSignals.score}/100</p>
                      </div>

                      {/* Abandonment */}
                      <div className="bg-slate-800/30 rounded p-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Abandono</p>
                        {abandonment.isAbandoned ? (
                          <>
                            <span className="inline-block px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] mb-1">ABANDONADO</span>
                            <p className="text-xs text-slate-400">{abandonment.daysSinceLastContact} días sin contacto</p>
                            <p className="text-xs text-slate-400">Dirección: {abandonment.direction.replace(/_/g, ' ')}</p>
                          </>
                        ) : (
                          <>
                            <span className="inline-block px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] mb-1">ACTIVO</span>
                            <p className="text-xs text-slate-400">{abandonment.daysSinceLastContact} días desde último contacto</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Suggested Action */}
                    <div className="mt-3 bg-indigo-500/5 border border-indigo-500/10 rounded p-2.5">
                      <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium mb-1">Acción sugerida</p>
                      <p className="text-sm text-slate-300">{lossReason.suggestedAction}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
