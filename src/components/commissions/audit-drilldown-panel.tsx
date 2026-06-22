'use client';

/**
 * AuditDrillDownPanel — Panel de trazabilidad completa para un pago.
 *
 * Secciones:
 *  1. Trazabilidad: cada peso → invoice_id + device_ids
 *  2. Factura vinculada + estado de verificación
 *  3. Dispositivos del contrato con estado conectado/desconectado
 *  4. Historial de eventos del sistema (audit log)
 */

import type { AuditPaymentRecord } from '@/app/api/commissions/audit/route';
import type { GPSDevice, CommissionEventType } from '@/lib/commission-types';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Receipt,
  Cpu,
  History,
  Link2,
  Signal,
  SignalLow,
  SignalHigh,
  Wifi,
  WifiOff,
  FileText,
  TrendingUp,
  ShieldCheck,
  Ban,
  DollarSign,
} from 'lucide-react';

interface Props {
  record: AuditPaymentRecord;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CL')}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Event type config ───────────────────────────────────────────────────

const eventTypeConfig: Record<CommissionEventType, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  contract_created:    { icon: FileText,      label: 'Contrato creado',        color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  contract_cancelled:  { icon: Ban,            label: 'Contrato cancelado',     color: 'text-red-400',    bg: 'bg-red-500/10' },
  upsell_detected:     { icon: TrendingUp,     label: 'Upsell detectado',      color: 'text-purple-400', bg: 'bg-purple-500/10' },
  device_deactivated:  { icon: WifiOff,        label: 'Dispositivo inactivo',  color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  device_reactivated:  { icon: Wifi,           label: 'Dispositivo reactivado', color: 'text-green-400', bg: 'bg-green-500/10' },
  invoice_paid:        { icon: CheckCircle2,   label: 'Factura pagada',        color: 'text-green-400',  bg: 'bg-green-500/10' },
  invoice_overdue:     { icon: AlertTriangle,  label: 'Factura vencida',       color: 'text-red-400',    bg: 'bg-red-500/10' },
  payment_released:    { icon: ShieldCheck,    label: 'Pago liberado',         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  payment_withheld:    { icon: AlertTriangle,  label: 'Pago retenido',         color: 'text-red-400',    bg: 'bg-red-500/10' },
  payment_disputed:    { icon: HelpCircle,     label: 'Pago disputado',        color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

export function AuditDrillDownPanel({ record }: Props) {
  const { payment, invoice, invoices, contract, devices, events, traceability } = record;

  return (
    <div className="p-5 space-y-6 pb-12">
      {/* ─── 1. Trazabilidad: cada peso → invoice_id + device_ids ──────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Trazabilidad del Pago
          </h4>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 space-y-3">
          {/* Payment meta row */}
          <div className="grid grid-cols-3 gap-3">
            <DetailCard
              label="Monto"
              value={formatCurrency(payment.amount)}
              sub={payment.status}
              color="text-emerald-400"
            />
            <DetailCard
              label="Período"
              value={payment.period}
              sub={`Cuota ${payment.monthNumber}/12`}
              color="text-slate-300"
            />
            <DetailCard
              label="Vendedor"
              value={payment.sellerName}
              sub={payment.sellerId}
              color="text-indigo-400"
            />
          </div>

          {/* Traceability chain */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-slate-500">💵</span>
            <span className="text-white font-mono">{formatCurrency(payment.amount)}</span>

            <span className="text-slate-600">→</span>

            {traceability.invoiceId ? (
              <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Factura {traceability.invoiceVerified ? 'verificada' : 'pendiente'}
              </span>
            ) : (
              <span className="text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
                Sin factura vinculada
              </span>
            )}

            <span className="text-slate-600">→</span>

            <span
              className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                traceability.devicesVerified
                  ? 'text-green-400 bg-green-500/10'
                  : traceability.activeDeviceCount > 0
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-red-400 bg-red-500/10'
              }`}
            >
              {traceability.devicesVerified ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertTriangle className="w-3 h-3" />
              )}
              {traceability.activeDeviceCount}/{traceability.expectedDeviceCount} dispositivos
            </span>
          </div>

          {/* Trace IDs */}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
            <p className="text-[11px] text-slate-500 mb-2 font-medium">
              IDs de trazabilidad
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-600">invoice_id: </span>
                <span className={traceability.invoiceId ? 'text-green-400' : 'text-slate-600'}>
                  {traceability.invoiceId || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-600">contract_id: </span>
                <span className="text-indigo-400">{payment.contractId}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-600">device_ids: </span>
                <span className="text-slate-500">
                  {traceability.deviceImeis.length > 0
                    ? traceability.deviceImeis.join(', ')
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. Factura Vinculada ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Facturación · Período {payment.period}
          </h4>
        </div>

        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const isPaid = inv.status === 'pagada';
              const isLinked = inv.id === payment.invoiceId;
              return (
                <div
                  key={inv.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isLinked
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-slate-800/30 border-slate-700/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isLinked && <Link2 className="w-3 h-3 text-emerald-400" />}
                      <span className="text-xs font-mono text-slate-300">{inv.id}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                          isPaid
                            ? 'text-green-400 bg-green-500/10'
                            : inv.status === 'vencida'
                              ? 'text-red-400 bg-red-500/10'
                              : 'text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {isPaid ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : inv.status === 'vencida' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {inv.status}
                      </span>
                      {isLinked && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Vinculada a este pago
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-white">
                      {formatCurrency(inv.amount)}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
                    <span>Emitida: {formatDate(inv.issuedAt)}</span>
                    {inv.paidAt && <span>Pagada: {formatDate(inv.paidAt)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Receipt} text="Sin facturas para este período" />
        )}
      </section>

      {/* ─── 3. Dispositivos del Contrato ────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Dispositivos GPS
          </h4>
          <span className="text-[11px] text-slate-600">
            {traceability.activeDeviceCount}/{traceability.expectedDeviceCount} activos
          </span>
        </div>

        {devices.length > 0 ? (
          <div className="space-y-1.5">
            {devices.map((device) => (
              <DeviceRow key={device.imei} device={device} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Cpu} text="Sin dispositivos registrados para este contrato" />
        )}
      </section>

      {/* ─── 4. Historial de Eventos (Audit Log) ─────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Historial de Eventos
          </h4>
          <span className="text-[11px] text-slate-600">{events.length} eventos</span>
        </div>

        {events.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[13px] top-2 bottom-2 w-px bg-slate-800" />

            <div className="space-y-1">
              {events
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((event, idx) => {
                  const config = eventTypeConfig[event.type] ?? eventTypeConfig.contract_created;
                  const EventIcon = config.icon;
                  return (
                    <div key={event.id} className="relative pl-8 py-2">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-[7px] top-3 w-3 h-3 rounded-full border-2 border-slate-900 ${config.bg} ring-1 ring-slate-800`}
                      />

                      <div className="flex items-start gap-2">
                        <div className={`p-1.5 rounded ${config.bg}`}>
                          <EventIcon className={`w-3 h-3 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white font-medium">
                              {config.label}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {formatDate(event.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {event.description}
                          </p>
                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="mt-1 flex gap-1 flex-wrap">
                              {Object.entries(event.metadata).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded"
                                >
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <EmptyState icon={History} text="Sin eventos registrados" />
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function DetailCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/30 rounded-lg p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${color} mt-0.5`}>{value}</p>
      <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function DeviceRow({ device }: { device: GPSDevice }) {
  const isConnected = device.connected;
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
        isConnected
          ? 'bg-slate-800/30 border-slate-700/30'
          : 'bg-red-500/5 border-red-500/10'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-green-400 shrink-0" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-slate-300 font-mono truncate">{device.imei}</p>
          {device.name && (
            <p className="text-[11px] text-slate-600 truncate">{device.name}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {device.vehicleName && (
          <span className="text-[11px] text-slate-500">{device.vehicleName}</span>
        )}
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ${
            isConnected
              ? 'text-green-400 bg-green-500/10'
              : 'text-red-400 bg-red-500/10'
          }`}
        >
          {isConnected ? 'Activo' : 'Inactivo'}
        </span>
        {device.lastSeen && !isConnected && (
          <span className="text-[10px] text-slate-600">
            Último: {formatDate(device.lastSeen)}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-6 text-center">
      <Icon className="w-6 h-6 text-slate-600 mx-auto mb-2 opacity-50" />
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  );
}
