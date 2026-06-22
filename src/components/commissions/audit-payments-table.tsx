'use client';

/**
 * AuditPaymentsTable — Tabla interactiva de pagos con sort y selección.
 *
 * Cada fila es clickeable → abre el panel de drill-down.
 * Muestra trazabilidad resumida: invoice_id + conteo de dispositivos activos/totales.
 */

import { useState } from 'react';
import type { AuditPaymentRecord } from '@/app/api/commissions/audit/route';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface Props {
  payments: AuditPaymentRecord[];
  selectedId: string | null;
  onSelect: (record: AuditPaymentRecord) => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void; // eslint-disable-line @typescript-eslint/no-unused-vars
}

type SortField = 'period' | 'amount' | 'clientName' | 'sellerName' | 'status';

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CL')}`;
}

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string }
> = {
  pagado: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Pagado' },
  pendiente: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pendiente' },
  retenido: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Retenido' },
  cancelado: { icon: XCircle, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Cancelado' },
  disputado: { icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Disputado' },
};

const SortIcon = ({
  field,
  currentField,
  currentDir,
}: {
  field: string;
  currentField: string;
  currentDir: 'asc' | 'desc';
}) => {
  if (field !== currentField) return null;
  return currentDir === 'asc' ? (
    <ArrowUp className="w-3 h-3 inline ml-1" />
  ) : (
    <ArrowDown className="w-3 h-3 inline ml-1" />
  );
};

export function AuditPaymentsTable({
  payments,
  selectedId,
  onSelect,
  sortField,
  sortDir,
  onSort,
}: Props) {
  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Clock className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No se encontraron pagos</p>
        <p className="text-xs mt-1 opacity-70">
          Ajusta los filtros para ver resultados
        </p>
      </div>
    );
  }

  const colClass =
    'px-4 py-2.5 text-slate-400 font-medium text-[11px] uppercase tracking-wider cursor-pointer select-none hover:text-slate-200 transition-colors';

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
          <th className={colClass} onClick={() => onSort('period')}>
            Período <SortIcon field="period" currentField={sortField} currentDir={sortDir} />
          </th>
          <th className={colClass + ' text-left'} onClick={() => onSort('clientName')}>
            Cliente <SortIcon field="clientName" currentField={sortField} currentDir={sortDir} />
          </th>
          <th className={colClass + ' text-left'} onClick={() => onSort('sellerName')}>
            Vendedor <SortIcon field="sellerName" currentField={sortField} currentDir={sortDir} />
          </th>
          <th className={colClass + ' text-right'} onClick={() => onSort('amount')}>
            Monto <SortIcon field="amount" currentField={sortField} currentDir={sortDir} />
          </th>
          <th className={colClass} onClick={() => onSort('status')}>
            Estado <SortIcon field="status" currentField={sortField} currentDir={sortDir} />
          </th>
          <th className={colClass}>Cuota</th>
          <th className={colClass}>Trazabilidad</th>
          <th className="px-4 py-2.5 w-8" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/50">
        {payments.map((record) => {
          const { payment, traceability } = record;
          const st = statusConfig[payment.status] ?? statusConfig.pendiente;
          const StatusIcon = st.icon;
          const isSelected = payment.id === selectedId;

          return (
            <tr
              key={payment.id}
              onClick={() => onSelect(record)}
              className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                isSelected ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''
              }`}
            >
              <td className="px-4 py-3">
                <span className="text-slate-300 font-mono text-xs">{payment.period}</span>
              </td>
              <td className="px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{payment.clientName}</p>
                  <p className="text-slate-600 text-[11px] font-mono">{payment.contractId}</p>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-slate-300 text-sm">{payment.sellerName}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-white font-mono text-sm font-medium">
                  {formatCurrency(payment.amount)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}
                >
                  <StatusIcon className="w-3 h-3" />
                  {st.label}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-slate-500 font-mono text-xs">
                  {payment.monthNumber}/12
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs">
                  {/* Invoice ID badge */}
                  {traceability.invoiceId ? (
                    <span className="inline-flex items-center gap-0.5 text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      INV:{traceability.invoiceId.slice(-9)}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-[11px]">Sin factura</span>
                  )}

                  {/* Device count badge */}
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono text-[11px] ${
                      traceability.activeDeviceCount === traceability.expectedDeviceCount &&
                      traceability.expectedDeviceCount > 0
                        ? 'text-green-400 bg-green-500/10'
                        : traceability.activeDeviceCount > 0
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-red-400 bg-red-500/10'
                    }`}
                  >
                    {traceability.activeDeviceCount}/{traceability.expectedDeviceCount} disp.
                  </span>

                  {/* Events count */}
                  {record.events.length > 0 && (
                    <span className="text-slate-500 text-[11px]">
                      {record.events.length} eventos
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2 py-3 text-right">
                <ChevronRight
                  className={`w-4 h-4 transition-colors ${
                    isSelected ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
