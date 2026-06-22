import React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertOctagon, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

export default function DashboardDiscrepancyPanel() {
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
                Panel de Discrepancias
              </h1>
            </div>
            <p className="text-slate-400 ml-11">
              Análisis detallado de diferencias entre facturación y plataforma
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Clientes con Discrepancia</p>
                <h3 className="text-2xl font-bold text-white">4</h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertOctagon className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-slate-500 text-xs">De un total de 145 clientes</span>
            </div>
          </div>
          
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Sobre-facturación</p>
                <h3 className="text-2xl font-bold text-white">2</h3>
              </div>
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-slate-500 text-xs">Pérdida potencial de clientes</span>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Sub-facturación</p>
                <h3 className="text-2xl font-bold text-white">2</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-slate-500 text-xs">Ingresos no percibidos</span>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Impacto Neto (Riesgo)</p>
                <h3 className="text-2xl font-bold text-rose-400">-$340,000</h3>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-slate-500 text-xs">Suma de diferencias absolutas</span>
            </div>
          </div>
        </div>

        {/* Detalle Tabla */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden mt-8">
           <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
              <h2 className="text-lg font-semibold text-white">Detalle Comparativo (Facturación vs Pegasus)</h2>
           </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium text-right">Disp. Pegasus</th>
                  <th className="px-6 py-4 font-medium text-right">Disp. Facturados</th>
                  <th className="px-6 py-4 font-medium text-center">Diferencia</th>
                  <th className="px-6 py-4 font-medium text-right">Impacto Est. (CLP)</th>
                  <th className="px-6 py-4 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">Transportes ABC</td>
                  <td className="px-6 py-4 text-right">45</td>
                  <td className="px-6 py-4 text-right">40</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-blue-400 font-bold">+5</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">$60,000</td>
                  <td className="px-6 py-4 text-center">
                     <span className="px-2 py-1 text-xs rounded bg-amber-500/10 text-amber-400">En Revisión</span>
                  </td>
                </tr>
                 <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">Logística Sur</td>
                  <td className="px-6 py-4 text-right">18</td>
                  <td className="px-6 py-4 text-right">22</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-rose-400 font-bold">-4</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">-$48,000</td>
                  <td className="px-6 py-4 text-center">
                     <span className="px-2 py-1 text-xs rounded bg-amber-500/10 text-amber-400">En Revisión</span>
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
