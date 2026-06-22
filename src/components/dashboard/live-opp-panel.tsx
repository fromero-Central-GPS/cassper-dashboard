'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveOpportunityRisk } from '@/lib/ghl-types';
import { AlertTriangle, Activity, CheckCircle, User } from 'lucide-react';

interface LiveOppPanelProps {
  risks: LiveOpportunityRisk[];
}

export function LiveOppPanel({ risks }: LiveOppPanelProps) {
  if (!risks || risks.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Live Opp Monitor
          </CardTitle>
          <CardDescription className="text-slate-400">
            Early warnings for open opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500/50 mb-3" />
            <p className="text-slate-300 font-medium">Pipeline is healthy</p>
            <p className="text-slate-500 text-sm mt-1">No early warnings detected in active deals.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Live Opp Monitor
        </CardTitle>
        <CardDescription className="text-slate-400">
          Early warnings for open opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {risks.map((risk, index) => (
            <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-slate-100 font-medium">{risk.contactName || 'Unknown Contact'}</h4>
                  <div className="flex items-center gap-3 text-sm">
                    <p className="text-slate-400">Value: ${risk.value.toLocaleString()}</p>
                    {risk.assignedTo && (
                      <p className="text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {risk.assignedTo}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={risk.riskScore > 70 ? 'destructive' : risk.riskScore > 40 ? 'secondary' : 'default'}>
                  Score: {risk.riskScore}/100
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-slate-300 text-sm font-medium">Warnings:</p>
                <ul className="text-sm text-slate-400 space-y-1">
                  {risk.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                 <p className="text-slate-300 text-sm font-medium">Recommended Action:</p>
                 <p className="text-sm text-slate-400 mt-1">{risk.recommendedAction}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
