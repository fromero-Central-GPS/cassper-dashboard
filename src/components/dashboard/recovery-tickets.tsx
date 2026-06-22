'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RecoverableTicket, CampaignMetric } from '@/lib/ghl-types';
import { Phone, Mail, MessageCircle, Camera, Hash, AlertTriangle, Zap, ArrowUp, MessageSquare, Send, CheckCircle, Clock, ChevronDown, ChevronRight, ThumbsUp, XCircle, Loader2, TrendingUp, Ban, Eye } from 'lucide-react';

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
  draft: { label: 'Borrador', color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Clock },
  archived: { label: 'Archivada', color: 'text-slate-500', bg: 'bg-slate-600/10', icon: Ban },
};

const draftStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Pendiente', color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Clock },
  approved: { label: 'Aprobado', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: ThumbsUp },
  sent: { label: 'Enviado', color: 'text-indigo-400', bg: 'bg-indigo-500/10', icon: Send },
  awaiting_response: { label: 'Esperando respuesta', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Eye },
  replied_positive: { label: 'Respondió ✅', color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle },
  replied_negative: { label: 'Respondió ❌', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  replied_neutral: { label: 'Respondió ~', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: TrendingUp },
  followed_up: { label: 'Follow-up enviado', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Send },
  no_response: { label: 'Sin respuesta', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Ban },
  archived: { label: 'Archivado', color: 'text-slate-500', bg: 'bg-slate-600/10', icon: Ban },
  rejected: { label: 'Descartado', color: 'text-slate-500', bg: 'bg-slate-600/10', icon: Ban },
  failed: { label: 'Fallido', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
};

const LS_KEY = 'cassper-ticket-status';

function loadStatusFromStorage(tickets: RecoverableTicket[]): Record<string, string> {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // Initialize from draftStatus in mock data
  const initial: Record<string, string> = {};
  tickets.forEach(t => { if (t.draftStatus) initial[t.id] = t.draftStatus; });
  return initial;
}

export function RecoveryTickets({ tickets, campaigns }: RecoveryTicketsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [discarding, setDiscarding] = useState<Set<string>>(new Set());
  const [ticketStatus, setTicketStatus] = useState<Record<string, string>>(() => loadStatusFromStorage(tickets));

  // Persist to localStorage on every status change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ticketStatus)); } catch {}
  }, [ticketStatus]);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const handleApprove = async (ticket: RecoverableTicket) => {
    if (!ticket.draftMessage || !ticket.email) return;

    setApproving(prev => new Set(prev).add(ticket.id));

    try {
      const res = await fetch('/api/ghl/send-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          contactEmail: ticket.email,
          subject: ticket.draftSubject || 'Seguimiento GPS — CentralGPS',
          body: ticket.draftMessage,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setTicketStatus(prev => ({ ...prev, [ticket.id]: 'awaiting_response' }));
      } else {
        setTicketStatus(prev => ({ ...prev, [ticket.id]: 'failed' }));
      }
    } catch {
      setTicketStatus(prev => ({ ...prev, [ticket.id]: 'failed' }));
    } finally {
      setApproving(prev => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }
  };

  const handleDiscard = (ticket: RecoverableTicket) => {
    setDiscarding(prev => new Set(prev).add(ticket.id));
    setTicketStatus(prev => ({ ...prev, [ticket.id]: 'rejected' }));
    setExpanded(prev => { const next = new Set(prev); next.delete(ticket.id); return next; });
    // Small delay to show feedback
    setTimeout(() => {
      setDiscarding(prev => { const next = new Set(prev); next.delete(ticket.id); return next; });
    }, 300);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Ticket List with Approval UI - 3 cols */}
      <div className="lg:col-span-3 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Tickets Recuperables</h3>
        <p className="text-slate-400 text-xs mb-4">
          {tickets.length} tickets · {formatValue(tickets.reduce((sum, t) => sum + t.value, 0))} valor total · Expande para previsualizar y aprobar
        </p>
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const ChannelIcon = channelIcons[ticket.channel];
            const priority = priorityConfig[ticket.priority];
            const PriorityIcon = priority.icon;
            const isOpen = expanded.has(ticket.id);
            const isApproving = approving.has(ticket.id);
            const status = ticketStatus[ticket.id] || ticket.draftStatus || 'draft';
            const hasDraft = !!ticket.draftMessage;
            const statusInfo = draftStatusConfig[status];

            return (
              <div
                key={ticket.id}
                className="bg-slate-900/50 rounded-lg border border-slate-700/30 overflow-hidden"
              >
                {/* Row header */}
                <button
                  onClick={() => hasDraft && toggleExpand(ticket.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left ${hasDraft ? 'hover:bg-slate-800/30 cursor-pointer' : 'cursor-default'} transition-colors`}
                >
                  {hasDraft ? (
                    isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : <span className="w-4 shrink-0" />}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200 text-xs font-medium truncate">{ticket.contactName}</span>
                      <ChannelIcon className={`w-3 h-3 ${channelColors[ticket.channel]} shrink-0`} />
                    </div>
                    <p className="text-slate-500 text-[10px]">
                      {ticket.description && <span className="text-slate-400">{ticket.description}</span>}
                      {ticket.description && <br />}
                      {ticket.stage} · {ticket.lastContact} · {ticket.lossReason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-200 text-xs font-semibold">{formatValue(ticket.value)}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${priority.color}`}>
                      <PriorityIcon className="w-2.5 h-2.5" />
                      {priority.label}
                    </span>
                    {hasDraft && (
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                        {React.createElement(statusInfo.icon, { className: 'w-2.5 h-2.5' })}
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded draft + approval */}
                {isOpen && hasDraft && (
                  <div className="border-t border-slate-700/30 px-3 pb-3 pt-3">
                    {/* Channel indicator */}
                    <div className="flex items-center gap-2 mb-2">
                      <ChannelIcon className={`w-4 h-4 ${channelColors[ticket.channel]}`} />
                      <span className="text-xs text-slate-400">
                        {ticket.channel} → {ticket.email || ticket.phone || 'sin datos'}
                      </span>
                    </div>

                    {/* Subject */}
                    <div className="mb-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Asunto</span>
                      <p className="text-xs text-slate-300 bg-slate-800/50 rounded p-1.5 mt-0.5">{ticket.draftSubject}</p>
                    </div>

                    {/* Message body */}
                    <div className="mb-3">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Mensaje</span>
                      <div className="text-xs text-slate-300 bg-slate-800/50 rounded p-2 mt-0.5 whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {ticket.draftMessage}
                      </div>
                    </div>

                    {/* Approval button */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        {status === 'awaiting_response' ? '📨 Esperando respuesta del contacto'
                          : status === 'replied' ? '💬 El contacto respondió'
                          : status === 'recovered' ? '🎯 ¡Oportunidad recuperada!'
                          : status === 'no_response' ? '📪 Sin respuesta (archivado)'
                          : status === 'failed' ? '❌ Error al enviar'
                          : '⚠️ Requiere aprobación humana'}
                      </span>
                      {status === 'draft' && (
                        <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(ticket)}
                          disabled={isApproving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {isApproving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-3 h-3" />
                          )}
                          {isApproving ? 'Enviando...' : 'Aprobar envío'}
                        </button>
                        <button
                          onClick={() => handleDiscard(ticket)}
                          disabled={discarding.has(ticket.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-600/50 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Ban className="w-3 h-3" />
                          {discarding.has(ticket.id) ? 'Descartando...' : 'Descartar'}
                        </button>
                        </div>
                      )}
                      {status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Ban className="w-3 h-3" /> Descartado
                        </span>
                      )}
                      {(status === 'awaiting_response' || status === 'sent') && (
                        <div className="text-[10px] text-slate-500">
                          <Eye className="w-3 h-3 inline mr-1" />
                          Monitoreando respuesta
                        </div>
                      )}
                      {status === 'replied' && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <TrendingUp className="w-3 h-3" /> En seguimiento
                        </span>
                      )}
                      {status === 'recovered' && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" /> Recuperado
                        </span>
                      )}
                      {status === 'no_response' && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Ban className="w-3 h-3" /> Archivado
                        </span>
                      )}
                      {status === 'failed' && (
                        <button
                          onClick={() => handleApprove(ticket)}
                          disabled={isApproving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Reintentar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
            const status = campaignStatusConfig[campaign.status] || campaignStatusConfig.active;
            const StatusIcon = status.icon;
            const isCampaignOpen = expandedCampaigns.has(campaign.id);
            // Tickets in this campaign (those with awaiting_response/sent status)
            const campaignTickets = tickets.filter(t => {
              const s = ticketStatus[t.id] || t.draftStatus;
              return s === 'awaiting_response' || s === 'sent' || s === 'replied' || s === 'recovered';
            });
            return (
              <div
                key={campaign.id}
                className="bg-slate-700/30 rounded-lg overflow-hidden hover:bg-slate-700/50 transition-colors"
              >
                <button
                  onClick={() => {
                    const next = new Set(expandedCampaigns);
                    if (next.has(campaign.id)) next.delete(campaign.id); else next.add(campaign.id);
                    setExpandedCampaigns(next);
                  }}
                  className="w-full text-left p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      {isCampaignOpen ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                      <span className="text-slate-200 text-xs font-medium">{campaign.name}</span>
                      {campaign.waveNumber && (
                        <span className="text-slate-500 text-[10px] ml-1">Wave {campaign.waveNumber}</span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      {status.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
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
                    <div>
                      <span className="text-slate-500">Valor Total</span>
                    <p className="text-slate-400">{formatValue(campaign.totalValue || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Pendientes</span>
                    <p className="text-blue-400">{campaign.awaitingCount ?? '—'}</p>
                  </div>
                </div>
                {/* Response breakdown bar */}
                {(campaign.positiveCount !== undefined || campaign.negativeCount !== undefined) && (
                  <div className="mt-2 flex gap-1 items-center">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
                      {campaign.positiveCount ? (
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${Math.round((campaign.positiveCount / campaign.messagesSent) * 100)}%` }}
                        />
                      ) : null}
                      {campaign.negativeCount ? (
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${Math.round((campaign.negativeCount / campaign.messagesSent) * 100)}%` }}
                        />
                      ) : null}
                      {campaign.noResponseCount ? (
                        <div
                          className="h-full bg-slate-600 transition-all"
                          style={{ width: `${Math.round((campaign.noResponseCount / campaign.messagesSent) * 100)}%` }}
                        />
                      ) : null}
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0">
                      {campaign.positiveCount || 0}✅ {campaign.negativeCount || 0}❌ {campaign.noResponseCount || 0}💤
                    </span>
                  </div>
                )}
                </button>
                {/* Expanded campaign detail: contact list */}
                {isCampaignOpen && (
                  <div className="border-t border-slate-700/30 px-3 pb-3 pt-2">
                    {campaignTickets.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-2">Sin envíos aún</p>
                    ) : (
                      <div className="space-y-1">
                        {campaignTickets.map(ct => {
                          const s = ticketStatus[ct.id] || ct.draftStatus || 'draft';
                          const si = draftStatusConfig[s];
                          return (
                            <div key={ct.id} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-700/20 last:border-0">
                              <div className="min-w-0 flex-1">
                                <span className="text-slate-300 truncate">{ct.contactName}</span>
                                <span className="text-slate-500 ml-1">{formatValue(ct.value)}</span>
                              </div>
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] shrink-0 ml-2 ${si.bg} ${si.color}`}>
                                {React.createElement(si.icon, { className: 'w-2 h-2' })}
                                {si.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
