'use client';

import { useState, useEffect } from 'react';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { LossPhasesChart } from '@/components/dashboard/loss-phases-chart';
import { RecoveryTickets } from '@/components/dashboard/recovery-tickets';
import { LiveOppPanel } from '@/components/dashboard/live-opp-panel';
import { WonTrackPanel } from '@/components/dashboard/won-track-panel';
import { ForensicsPanel } from '@/components/dashboard/forensics-panel';
import { ForensicsDetailView } from '@/components/dashboard/forensics-detail-view';
import type { DashboardData, ForensicsApiResponse } from '@/lib/ghl-types';
import type { BatchAnalysisResult } from '@/lib/analysis-engine';
import { BarChart3, RefreshCw, Zap, Activity, Trophy, Fingerprint } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [forensics, setForensics] = useState<BatchAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'recovery' | 'live' | 'won'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, forensicsRes] = await Promise.all([
          fetch('/api/ghl/summary?mode=stored'),
          fetch('/api/ghl/forensics?mode=stored'),
        ]);

        if (summaryRes.status === 404) {
          // Fall back to mock if no pipeline run exists yet
          const [sRes, fRes] = await Promise.all([
            fetch('/api/ghl/summary?mode=mock'),
            fetch('/api/ghl/forensics?mode=mock'),
          ]);
          const summaryJson = await sRes.json();
          setData(summaryJson);
          const forensicsJson: ForensicsApiResponse = await fRes.json();
          if (forensicsJson.batchResult) {
            setForensics(forensicsJson.batchResult as unknown as BatchAnalysisResult);
          }
        } else {
          const summaryJson = await summaryRes.json();
          setData(summaryJson);
          const forensicsJson: ForensicsApiResponse = await forensicsRes.json();
          if (forensicsJson.batchResult) {
            setForensics(forensicsJson.batchResult as unknown as BatchAnalysisResult);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Cargando datos del pipeline...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview' as const, label: 'Vista General (Forense)', icon: BarChart3 },
    { id: 'live' as const, label: 'Live Opp (Prevención)', icon: Activity },
    { id: 'won' as const, label: 'Won Track (Inteligencia)', icon: Trophy },
    { id: 'recovery' as const, label: 'Recuperación (Acción)', icon: RefreshCw },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Centro de Control de Ventas</h1>
                <p className="text-xs text-slate-500">GHL + Paperclip Agent · Pipeline: {data.pipelineName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              GHL conectado · {data.summary.totalConversations} conversaciones
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Vista General (Forense) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Diagnóstico Forense y Tendencias
              </h2>
              <ForensicsPanel lossTrends={data.lossTrends} lossByReason={data.lossByReason} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 mt-6">
                El Invisible Pipeline
              </h2>
              <KPICards summary={data.summary} />
            </div>

            <div className="mt-6"><LossPhasesChart
              lossByPhase={data.lossByPhase}
              lossByReason={data.lossByReason}
            /></div>

            <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-xs italic">
                &ldquo;Live Opp aplica lo aprendido en Won Track para prevenir pérdidas activamente.&rdquo;
              </p>
              <p className="text-indigo-400 text-xs mt-1">
                Arquitectura de 3 motores: Forense (Diagnóstico), Won Track (Aprendizaje), Live Opp (Prevención).
              </p>
            </div>

            {/* Forense deep-dive: per-conversation analysis */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <Fingerprint className="w-4 h-4 inline mr-1" />
                Análisis por Conversación — Resultados del Motor Forense
              </h2>
              <ForensicsDetailView batchResult={forensics} />
            </div>
          </div>
        )}

        {/* Live Opp */}
        {activeTab === 'live' && (
          <div className="space-y-4">
             <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Monitoreo Predictivo en Tiempo Real
              </h2>
             <LiveOppPanel risks={data.liveRisks || []} />
          </div>
        )}

        {/* Won Track */}
        {activeTab === 'won' && (
          <div className="space-y-4">
             <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Inteligencia Extraída de Negocios Ganados
              </h2>
             <WonTrackPanel patterns={data.wonPatterns || []} />
          </div>
        )}

        {/* Recuperación */}
        {activeTab === 'recovery' && (
          <RecoveryTickets
            tickets={data.recoverableTickets}
            campaigns={data.campaigns}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-600">
          <span>Paperclip Agent · Arquitectura 3 Motores</span>
          <span>Datos actualizados: {new Date().toLocaleDateString('es-CL')}</span>
        </div>
      </footer>
    </div>
  );
}
