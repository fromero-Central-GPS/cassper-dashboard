'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart,
} from 'recharts';
import type { CommissionPayment, Seller } from '@/lib/commission-types';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SellerMonthlyData {
  /** Período YYYY-MM */
  period: string;
  /** Label legible del mes */
  monthLabel: string;
  /** Datos por vendedor: sellerId -> monto */
  [sellerId: string]: string | number;
}

export interface SellerMonthlyChartProps {
  payments: CommissionPayment[];
  sellers: Seller[];
}

// ─── Colores para vendedores ──────────────────────────────────────────────────

const SELLER_COLORS = [
  '#818cf8', // indigo-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#60a5fa', // blue-400
  '#a78bfa', // violet-400
  '#fb923c', // orange-400
  '#4ade80', // green-400
];

function getSellerColor(index: number): string {
  return SELLER_COLORS[index % SELLER_COLORS.length]!;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString('es-CL')}`;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function monthLabel(period: string): string {
  const parts = period.split('-');
  const month = parts[1] ?? '';
  const year = parts[0]?.slice(2) ?? '';
  return `${MONTH_NAMES[month] ?? month} ${year}`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function SellerMonthlyChart({ payments, sellers }: SellerMonthlyChartProps) {
  const [chartType, setChartType] = useState<'stacked' | 'grouped' | 'trend'>('stacked');
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(
    new Set(sellers.filter((s) => s.active).map((s) => s.id))
  );

  // Agrupar pagos por período y vendedor
  const chartData = useMemo(() => {
    const periodMap = new Map<string, Map<string, number>>();

    for (const payment of payments) {
      if (!periodMap.has(payment.period)) {
        periodMap.set(payment.period, new Map());
      }
      const sellerMap = periodMap.get(payment.period)!;
      const current = sellerMap.get(payment.sellerId) ?? 0;
      sellerMap.set(payment.sellerId, current + payment.amount);
    }

    // Convertir a array de objetos para recharts
    const sortedPeriods = Array.from(periodMap.keys()).sort();
    return sortedPeriods.map((period) => {
      const sellerMap = periodMap.get(period)!;
      const entry: Record<string, unknown> = {
        period,
        monthLabel: monthLabel(period),
      };
      for (const seller of sellers) {
        entry[seller.id] = sellerMap.get(seller.id) ?? 0;
        entry[`${seller.id}_name`] = seller.name;
      }
      // Total
      entry['total'] = Array.from(sellerMap.values()).reduce((sum, v) => sum + v, 0);
      return entry;
    });
  }, [payments, sellers]);

  // Datos de tendencia (total mensual)
  const trendData = useMemo(() => {
    return chartData.map((d) => ({
      period: d.period as string,
      monthLabel: d.monthLabel as string,
      total: d.total as number,
    }));
  }, [chartData]);

  const activeSellers = sellers.filter((s) => selectedSellers.has(s.id));

  // Estadísticas resumen
  const totalAllPeriods = trendData.reduce((sum, d) => sum + d.total, 0);
  const avgMonthly = trendData.length > 0 ? totalAllPeriods / trendData.length : 0;
  const lastMonth = trendData[trendData.length - 1];
  const prevMonth = trendData[trendData.length - 2];
  const monthlyChange = prevMonth && lastMonth
    ? ((lastMonth.total - prevMonth.total) / (prevMonth.total || 1)) * 100
    : 0;

  function toggleSeller(sellerId: string) {
    const next = new Set(selectedSellers);
    if (next.has(sellerId)) {
      if (next.size > 1) next.delete(sellerId);
    } else {
      next.add(sellerId);
    }
    setSelectedSellers(next);
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            Total histórico
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {formatCurrency(totalAllPeriods)}
          </p>
          <p className="text-xs text-slate-500">
            {trendData.length} meses · {sellers.filter((s) => s.active).length} vendedores
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Promedio mensual
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {formatCurrency(avgMonthly)}
          </p>
          <p className="text-xs text-slate-500">
            Por mes histórico
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            Último mes
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {lastMonth ? formatCurrency(lastMonth.total as number) : 'N/A'}
          </p>
          <p className={`text-xs ${monthlyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {monthlyChange >= 0 ? '↑' : '↓'} {Math.abs(monthlyChange).toFixed(1)}% vs mes anterior
          </p>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          Comisiones por Vendedor y Mes
        </h3>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
          {([
            { id: 'stacked' as const, label: 'Apilado' },
            { id: 'grouped' as const, label: 'Agrupado' },
            { id: 'trend' as const, label: 'Tendencia' },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setChartType(opt.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                chartType === opt.id
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seller Toggle Pills */}
      <div className="flex flex-wrap gap-2">
        {sellers.map((seller, index) => (
          <button
            key={seller.id}
            onClick={() => toggleSeller(seller.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedSellers.has(seller.id)
                ? 'bg-slate-700 text-white border border-slate-600'
                : 'bg-slate-800/50 text-slate-500 border border-transparent hover:border-slate-700'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getSellerColor(index) }}
            />
            {seller.name}
            {!seller.active && (
              <span className="text-slate-600 text-[10px]">(inactivo)</span>
            )}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'trend' ? (
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#818cf8"
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ fill: '#818cf8', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const seller = sellers.find((s) => s.id === value);
                    return seller?.name ?? value;
                  }}
                  wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
                />
                {activeSellers.map((seller, index) => (
                  <Bar
                    key={seller.id}
                    dataKey={seller.id}
                    name={seller.id}
                    stackId={chartType === 'stacked' ? 'stack' : undefined}
                    fill={getSellerColor(index)}
                    radius={chartType === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80 text-left">
              <th className="px-4 py-2 text-slate-400 font-medium sticky left-0 bg-slate-800/80">
                Período
              </th>
              {activeSellers.map((seller) => (
                <th key={seller.id} className="px-4 py-2 text-slate-400 font-medium text-right">
                  {seller.name}
                </th>
              ))}
              <th className="px-4 py-2 text-slate-400 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {chartData.map((row) => (
              <tr key={row.period as string} className="hover:bg-slate-800/30">
                <td className="px-4 py-2 text-slate-300 font-mono sticky left-0 bg-slate-950/90">
                  {row.monthLabel as string}
                </td>
                {activeSellers.map((seller) => (
                  <td key={seller.id} className="px-4 py-2 text-right text-slate-400 font-mono">
                    {(row[seller.id] as number) > 0
                      ? formatCurrency(row[seller.id] as number)
                      : '—'}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-white font-mono font-semibold">
                  {formatCurrency(row.total as number)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800/50 border-t border-slate-600/30 font-semibold">
              <td className="px-4 py-2 text-slate-300 sticky left-0 bg-slate-800/50">Total</td>
              {activeSellers.map((seller) => {
                const sellerTotal = chartData.reduce(
                  (sum, row) => sum + (row[seller.id] as number),
                  0
                );
                return (
                  <td key={seller.id} className="px-4 py-2 text-right text-white font-mono">
                    {sellerTotal > 0 ? formatCurrency(sellerTotal) : '—'}
                  </td>
                );
              })}
              <td className="px-4 py-2 text-right text-indigo-400 font-mono">
                {formatCurrency(totalAllPeriods)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
