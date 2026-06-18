'use client';

import { RecoverableTicket, CampaignMetric } from '@/lib/ghl-types';
import { Phone, Mail, MessageCircle, Camera, Hash, AlertTriangle, Zap, ArrowUp, MessageSquare, Send, CheckCircle, Clock, AtSign } from 'lucide-react';

interface RecoveryTicketsProps {
  tickets: RecoverableTicket[];
  campaigns: CampaignMetric[];
}

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

const channelIcons: Record<RecoverableTicket['channel'], React.ComponentType<{ className?: string }>> = {
  WhatsApp: MessageCircle,
  Email: Mail,
  SMS: MessageSquare,
  Facebook: Hash,
  Instagram: Camera,
  Llamada: Phone,
};

const channelColors: Record<RecoverableTicket['channel'], string> = {
  WhatsApp: 'text-green-400',
  Email: 'text-blue-400',
  SMS: 'text-yellow-400',
  Facebook: 'text-indigo-400',
  Instagram: 'text-pink-400',
  Llamada: 'text-orange-400',
};

const priorityConfig = {
  urgent: { label: 'Urgente', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle },
  high: { label: 'Alta', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Zap },
  medium: { label: 'Media', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: ArrowUp },
  low: { label: 'Baja', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: ArrowUp },
};

const campaignStatusConfig = {
  active: { label: 'Activa', color: 'text-green-400', bg: 'bg-green-500/10', icon: Send },
  scheduled: { label: 'Programada', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Clock },
  completed: { label: 'Finalizada', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: CheckCircle },
};

export function RecoveryTickets({ tickets, campaigns }: RecoveryTicketsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Ticket List - 3 cols */}
      <div className="lg:col-span-3 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Tickets Recuperables</h3>
        <p className="text-slate-400 text-xs mb-4">
          {tickets.length} tickets priorizados · {formatValue(tickets.reduce((sum, t) => sum + t.value, 0))} valor total
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-2 text-slate-400 font-medium text-xs">ID</th>
                <th className="text-left py-2 text-slate-400 font-medium text-xs">Contacto</th>
                <th className="text-left py-2 text-slate-400 font-medium text-xs">Canal</th>
                <th className="text-right py-2 text-slate-400 font-medium text-xs">Valor</th>
                <th className="text-left py-2 text-slate-400 font-medium text-xs">Razón</th>
                <th className="text-center py-2 text-slate-400 font-medium text-xs">Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const ChannelIcon = channelIcons[ticket.channel];
                const priority = priorityConfig[ticket.priority];
                const PriorityIcon = priority.icon;
                return (
                  <tr key={ticket.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="py-2.5 text-slate-500 text-xs">{ticket.id}</td>
                    <td className="py-2.5">
                      <p className="text-slate-200 text-xs">{ticket.contactName}</p>
                      <p className="text-slate-500 text-[10px]">{ticket.stage} · Último: {ticket.lastContact}</p>
                    </td>
                    <td className="py-2.5">
                      <ChannelIcon className={`w-4 h-4 ${channelColors[ticket.channel]}`} />
                    </td>
                    <td className="py-2.5 text-right text-slate-200 font-medium text-xs">
                      {formatValue(ticket.value)}
                    </td>
                    <td className="py-2.5 text-slate-400 text-xs max-w-[140px] truncate">
                      {ticket.lossReason}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${priority.color}`}>
                        <PriorityIcon className="w-2.5 h-2.5" />
                        {priority.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaigns - 2 cols */}
      <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Campañas de Recuperación</h3>
        <p className="text-slate-400 text-xs mb-4">
          {campaigns.length} campañas · {formatValue(campaigns.reduce((sum, c) => sum + c.valueRecovered, 0))} recuperado
        </p>
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const status = campaignStatusConfig[campaign.status];
            const StatusIcon = status.icon;
            return (
              <div
                key={campaign.id}
                className="bg-slate-700/30 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-200 text-xs font-medium">{campaign.name}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {status.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500">Enviados</span>
                    <p className="text-slate-300">{campaign.messagesSent.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Tasa Resp.</span>
                    <p className="text-slate-300">{campaign.responseRate}%</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Conversiones</span>
                    <p className="text-green-400">{campaign.conversions}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Recuperado</span>
                    <p className="text-amber-400">{formatValue(campaign.valueRecovered)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
