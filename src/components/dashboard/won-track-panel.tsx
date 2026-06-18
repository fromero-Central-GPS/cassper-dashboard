'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WonTrackPattern } from '@/lib/ghl-types';
import { Trophy, Clock, CheckCircle2, TrendingUp, Zap } from 'lucide-react';

interface WonTrackPanelProps {
  patterns: WonTrackPattern[];
}

export function WonTrackPanel({ patterns }: WonTrackPanelProps) {
  if (!patterns || patterns.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-green-400" />
            Won Track Insights
          </CardTitle>
          <CardDescription className="text-slate-400">
            Patterns from closed-won opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium">Gathering data</p>
            <p className="text-slate-500 text-sm mt-1">Not enough won deals analyzed yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-green-400" />
          Won Track Insights
        </CardTitle>
        <CardDescription className="text-slate-400">
          Patterns from closed-won opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map((pattern, index) => (
            <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-slate-100 font-medium">{pattern.dealType || 'General Deal'}</h4>
                <div className="flex items-center text-slate-400 text-sm">
                  <Clock className="w-4 h-4 mr-1" />
                  Avg {pattern.avgTimeToCloseDays} days
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-slate-300 text-sm font-medium flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Key Success Factors
                  </p>
                  <ul className="text-sm text-slate-400 space-y-1 ml-5 list-disc">
                    {pattern.keySuccessFactors.slice(0, 3).map((factor, i) => (
                      <li key={i}>{factor}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-slate-300 text-sm font-medium flex items-center gap-1.5 mb-1.5">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Winning Signals
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pattern.commonBuyingSignals.slice(0, 4).map((signal, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
