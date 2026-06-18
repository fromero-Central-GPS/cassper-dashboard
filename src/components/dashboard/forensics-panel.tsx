'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LossTrendMonth, LossReason } from '@/lib/ghl-types';
import { Search, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface ForensicsPanelProps {
  lossTrends?: LossTrendMonth[];
  lossByReason?: LossReason[];
}

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

export function ForensicsPanel({ lossTrends, lossByReason }: ForensicsPanelProps) {
  if (!lossTrends || lossTrends.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-400" />
            Análisis Forense Profundo
          </CardTitle>
          <CardDescription className="text-slate-400">
            Tendencias y diagnóstico avanzado de oportunidades perdidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium">Recopilando datos históricos</p>
            <p className="text-slate-500 text-sm mt-1">Se requieren más datos para generar tendencias.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Encontrar el mes con más pérdidas
  const worstMonth = [...lossTrends].sort((a, b) => b.lostValue - a.lostValue)[0];

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-400" />
            Tendencia de Pérdidas (Mensual)
          </CardTitle>
          <CardDescription className="text-slate-400">
            Valor de oportunidades perdidas a lo largo del tiempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
             <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-lg flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
               <div>
                  <p className="text-slate-200 text-sm font-medium">Insights Forenses</p>
                  <p className="text-slate-400 text-sm">
                    El mes con mayor pérdida fue <strong>{worstMonth.month}</strong> ({formatValue(worstMonth.lostValue)}). 
                    La razón principal recurrente sigue siendo <strong>{worstMonth.topReason}</strong>.
                  </p>
               </div>
             </div>
          </div>
          
          <div className="h-[250px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lossTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickFormatter={(val) => formatValue(val)} 
                  tickLine={false} 
                  axisLine={false} 
                  width={60}
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value: any, name: any) => {
                     if (name === 'lostValue') return [formatValue(value), 'Valor Perdido'] as any;
                     return [value, name] as any;
                  }}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="lostValue" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorLoss)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {lossByReason && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Severidad por Razón de Pérdida
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lossByReason.slice(0,4).map((reason, i) => (
                  <div key={i} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                    <p className="text-slate-100 font-medium">{reason.reason}</p>
                    <div className="mt-2 flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-slate-200">{formatValue(reason.value)}</p>
                        <p className="text-slate-400 text-xs mt-1">{reason.count} oportunidades afectadas</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-medium">
                          {reason.percentage}% del total
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
