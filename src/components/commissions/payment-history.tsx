'use client';

import type { CommissionPayment, SellerCommissionSummary } from '@/lib/commission-types';
import { DollarSign, CheckCircle2, Clock, AlertTriangle, XCircle, User } from 'lucide-react';

interface PaymentHistoryProps {
  sellerSummaries: SellerCommissionSummary[];
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CL')}`;
}

const paymentStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pagado: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Pagado' },
  pendiente: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pendiente' },
  retenido: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Retenido' },
  cancelado: { icon: XCircle, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Cancelado' },
  disputado: { icon: AlertTriangle, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Disputado' },
};

export function PaymentHistory({ sellerSummaries }: PaymentHistoryProps) {
  return (
    <div className="space-y-6">
      {sellerSummaries.map((seller) => (
        <div
          key={seller.sellerId}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden"
        >
          {/* Seller Header */}
          <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{seller.sellerName}</h3>
                  <p className="text-xs text-slate-500">
                    {seller.contracts} contratos · {seller.payments.length} pagos
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white font-mono">
                  {formatCurrency(seller.totalCommission)}
                </p>
                <p className="text-xs text-slate-500">Total comisión del mes</p>
              </div>
            </div>
          </div>

          {/* Payments Detail */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase">Período</th>
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase">Cliente</th>
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase">Contrato</th>
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase text-right">Mes</th>
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase text-right">Monto</th>
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase">Estado</th>
                  <th className="px-5 py-2 text-slate-400 font-medium text-xs uppercase">Verificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {seller.payments
                  .sort((a, b) => b.period.localeCompare(a.period))
                  .map((payment) => {
                    const status = paymentStatusConfig[payment.status] || paymentStatusConfig.pendiente;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={payment.id} className="hover:bg-slate-700/20">
                        <td className="px-5 py-2.5">
                          <span className="text-slate-300 font-mono text-xs">{payment.period}</span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-slate-300">{payment.clientName}</span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-slate-500 font-mono text-xs">{payment.contractId}</span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="text-slate-400 font-mono text-xs">{payment.monthNumber}/12</span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="text-white font-mono text-xs">
                            {formatCurrency(payment.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            {payment.invoiceVerified ? (
                              <span className="text-green-400 text-xs flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Factura
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> Factura
                              </span>
                            )}
                            {payment.devicesVerified ? (
                              <span className="text-green-400 text-xs flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Dispositivos
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> Dispositivos
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
