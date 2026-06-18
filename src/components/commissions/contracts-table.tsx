'use client';

import type { Contract } from '@/lib/commission-types';
import { FileText, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Zap } from 'lucide-react';

interface ContractsTableProps {
  contracts: Contract[];
  onSelect?: (contract: Contract) => void;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CL')}`;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  activo: { icon: CheckCircle2, color: 'text-green-400', label: 'Activo' },
  suspendido: { icon: AlertTriangle, color: 'text-amber-400', label: 'Suspendido' },
  cancelado: { icon: XCircle, color: 'text-red-400', label: 'Cancelado' },
  finalizado: { icon: CheckCircle2, color: 'text-slate-400', label: 'Finalizado' },
};

export function ContractsTable({ contracts, onSelect }: ContractsTableProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            Contratos
          </h3>
          <span className="text-xs text-slate-500">{contracts.length} contratos</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-left">
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Cliente</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Plan</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Vendedor</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider text-right">Cant.</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider text-right">Valor/Mes</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider text-right">Comisión/Mes</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider text-right">ACV</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Upsell</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {contracts.map((contract) => {
              const status = statusConfig[contract.status] || statusConfig.activo;
              const StatusIcon = status.icon;
              return (
                <tr
                  key={contract.id}
                  className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => onSelect?.(contract)}
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-white font-medium">{contract.clientName}</p>
                      <p className="text-slate-500 text-xs">{contract.id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-slate-300">{contract.planName}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-slate-300">{contract.sellerName}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-white font-mono">{contract.quantity}</span>
                    <span className="text-slate-500 text-xs ml-1">disp.</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-300">
                    {formatCurrency(contract.monthlyValue)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-indigo-400">
                    {formatCurrency(contract.monthlyCommission)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-300">
                    {formatCurrency(contract.acv)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {contract.isUpsell ? (
                      <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                        <TrendingUp className="w-3 h-3" />
                        Upsell
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
