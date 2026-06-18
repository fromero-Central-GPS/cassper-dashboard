'use client';

import type { CommissionDashboardData } from '@/lib/commission-types';
import {
  Users,
  FileText,
  Cpu,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

interface CommissionKPICardsProps {
  data: CommissionDashboardData;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString('es-CL')}`;
}

export function CommissionKPICards({ data }: CommissionKPICardsProps) {
  const cards = [
    {
      title: 'Comisión del Mes',
      value: formatCurrency(data.currentMonthCommission),
      subtitle: `${data.activeContracts} contratos activos`,
      icon: DollarSign,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      trend: null,
    },
    {
      title: 'Pagado',
      value: formatCurrency(data.paidThisMonth),
      subtitle: `Verificado y liberado`,
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      trend: null,
    },
    {
      title: 'Pendiente',
      value: formatCurrency(data.pendingVerification),
      subtitle: `Esperando verificación`,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      trend: null,
    },
    {
      title: 'Retenido',
      value: formatCurrency(data.withheldAmount),
      subtitle: `${data.contractsWithIssues} contratos con problemas`,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      trend: data.contractsWithIssues > 0 ? 'up' : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-medium">{card.title}</p>
              <p className="text-2xl font-bold text-white mt-1 tracking-tight">
                {card.value}
              </p>
              <p className="text-slate-500 text-xs mt-1">{card.subtitle}</p>
            </div>
            <div className={`${card.bg} p-2.5 rounded-lg`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
