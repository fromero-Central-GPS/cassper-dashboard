import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Filter, MoreVertical, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function DashboardAlertsPanel() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
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
                Historial de Alertas
              </h1>
            </div>
            <p className="text-slate-400 ml-11">
              Registro de eventos de riesgo y notificaciones
            </p>
          </div>
          
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg text-sm font-medium transition-colors">
              <Filter className="w-4 h-4" />
              Filtrar
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Fecha</th>
                  <th className="px-6 py-4 font-medium">Tipo</th>
                  <th className="px-6 py-4 font-medium">Severidad</th>
                  <th className="px-6 py-4 font-medium">Descripción</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">2026-06-18 10:23</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">A4</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" /> Media
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">Cliente Translogistics renovó contrato sin actualización en ERP</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-amber-400 text-xs font-medium px-2 py-1 bg-amber-500/10 rounded-md">Pendiente</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="p-1 hover:bg-slate-700 rounded text-slate-400"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
                
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">2026-06-17 14:05</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">A1</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5" /> Alta
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">Discrepancia mayor a 20% en facturación de Constructora ABC</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-emerald-400 text-xs font-medium px-2 py-1 bg-emerald-500/10 rounded-md flex items-center w-max gap-1">
                      <CheckCircle2 className="w-3 h-3"/> Resuelto
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="p-1 hover:bg-slate-700 rounded text-slate-400"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
