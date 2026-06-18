'use client';

import { LossPhase, LossReason } from '@/lib/ghl-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface LossPhasesChartProps {
  lossByPhase: LossPhase[];
  lossByReason: LossReason[];
}

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

const PHASE_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#dc2626', '#991b1b'];
const REASON_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22d3ee', '#a78bfa'];

export function LossPhasesChart({ lossByPhase, lossByReason }: LossPhasesChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Funnel de Pérdida por Fase */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Funnel de Pérdida por Fase</h3>
        <p className="text-slate-400 text-xs mb-4">Conversaciones perdidas en cada etapa</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={lossByPhase} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}`} />
            <YAxis
              type="category"
              dataKey="phase"
              stroke="#94a3b8"
              fontSize={12}
              width={110}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              formatter={(value, name) => {
                if (name === 'count') return [`${value} tickets`, 'Cantidad'];
                if (name === 'value') return [formatValue(Number(value)), 'Valor perdido'];
                return [value, name];
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {lossByPhase.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PHASE_COLORS[index]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Razones de Pérdida */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Razones de Pérdida</h3>
        <p className="text-slate-400 text-xs mb-4">Diagnóstico de no-conversión por valor</p>
        <div className="space-y-3">
          {lossByReason.map((reason, index) => (
            <div key={reason.reason}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-300 text-sm">{reason.reason}</span>
                <span className="text-slate-400 text-xs">
                  {reason.count} tickets · {formatValue(reason.value)}
                </span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${reason.percentage}%`,
                    backgroundColor: REASON_COLORS[index % REASON_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
