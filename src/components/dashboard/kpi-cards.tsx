'use client';

import { RevenueLeakSummary } from '@/lib/ghl-types';
import { TrendingDown, TrendingUp, DollarSign, BarChart3, Target, RefreshCw } from 'lucide-react';

interface KPICardsProps {
  summary: RevenueLeakSummary;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function KPICards({ summary }: KPICardsProps) {
  const leakPercentage = summary.totalEstimatedValue > 0
    ? ((summary.lostValue / summary.totalEstimatedValue) * 100).toFixed(1)
    : '0';

  const cards = [
    {
      title: 'Valor Total Estimado',
      value: formatCurrency(summary.totalEstimatedValue),
      subtitle: `${summary.totalConversations} conversaciones`,
      icon: BarChart3,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Venta Concretada',
      value: formatCurrency(summary.closedWonValue),
      subtitle: `${summary.wonConversations} ventas (${summary.conversionRate}%)`,
      icon: TrendingUp,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Venta Perdida',
      value: formatCurrency(summary.lostValue),
      subtitle: `${leakPercentage}% del pipeline total`,
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      title: 'Recuperable',
      value: formatCurrency(summary.recoverableValue),
      subtitle: `${summary.lostConversations} tickets perdidos`,
      icon: RefreshCw,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
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
