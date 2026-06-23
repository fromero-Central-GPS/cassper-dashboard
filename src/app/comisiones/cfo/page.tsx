import React from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, ShieldAlert, BarChart3 } from 'lucide-react';

export default function DashboardCFOPanel() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link 
                href="/comisiones"
                className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                title="Volver al resumen"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <h1 className="text-3xl font-bold text-emerald-400">
                Tablero de Control CFO
              </h1>
            </div>
            <p className="text-slate-400 ml-11">
              KPIs financieros y métricas de retención
            </p>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Comisión Total (Mes)</p>
                <h3 className="text-2xl font-bold text-white">$4.2M</h3>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-emerald-400 flex items-center text-sm font-medium">
                 <TrendingUp className="w-4 h-4 mr-1"/> +12%
               </span>
               <span className="text-slate-500 text-xs">vs mes anterior</span>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Comisión Retenida</p>
                <h3 className="text-2xl font-bold text-white">$850K</h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-slate-500 text-xs">Por discrepancias activas</span>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Discrepancias Activas</p>
                <h3 className="text-2xl font-bold text-white">4</h3>
              </div>
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-rose-400 flex items-center text-sm font-medium">
                 <TrendingUp className="w-4 h-4 mr-1"/> +2
               </span>
               <span className="text-slate-500 text-xs">vs mes anterior</span>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Clientes sin Vendedor</p>
                <h3 className="text-2xl font-bold text-white">12</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-slate-500 text-xs">Riesgo de fuga (Churn)</span>
            </div>
          </div>
        </div>

        {/* Secondary section: Charts and Lists placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
           {/* Burn Rate / Trend */}
           <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-6 lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                   <BarChart3 className="w-5 h-5 text-slate-400"/>
                   Burn Rate (Últimos 6 meses)
                </h2>
              </div>
              <div className="h-64 flex items-center justify-center border border-slate-800/50 rounded-lg bg-slate-950/30">
                 <span className="text-slate-500">[Gráfico de Burn Rate placeholder]</span>
              </div>
           </div>

           <div className="space-y-6">
              {/* Top Vendedores */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Top 5 Vendedores</h2>
                <div className="space-y-4">
                   {/* Placeholder data */}
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Juan Pérez</span>
                     <span className="text-sm font-medium text-emerald-400">$1.2M</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">María Silva</span>
                     <span className="text-sm font-medium text-emerald-400">$950K</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Carlos Ruiz</span>
                     <span className="text-sm font-medium text-emerald-400">$800K</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Ana Gómez</span>
                     <span className="text-sm font-medium text-emerald-400">$750K</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Luis Torres</span>
                     <span className="text-sm font-medium text-emerald-400">$500K</span>
                   </div>
                </div>
              </div>

              {/* Concentración de Clientes */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Concentración Top 3 Clientes</h2>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Empresa Alfa</span>
                     <span className="text-sm font-medium text-slate-400">15%</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Transportes Beta</span>
                     <span className="text-sm font-medium text-slate-400">12%</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-300">Logística Gamma</span>
                     <span className="text-sm font-medium text-slate-400">8%</span>
                   </div>
                </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
