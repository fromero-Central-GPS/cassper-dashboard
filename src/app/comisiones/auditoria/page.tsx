'use client';

/**
 * /comisiones/auditoria — Dashboard de Auditoría con Drill-Down
 *
 * Trazabilidad completa: cada peso → invoice_id + device_ids + historial de eventos.
 * Layout master-detail: tabla de pagos interactiva + panel de detalle.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  DollarSign,
  FileSearch,
  Filter,
  X,
  ChevronRight,
  Receipt,
  Cpu,
  History,
  ShieldCheck,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import { AuditPaymentsTable } from '@/components/commissions/audit-payments-table';
import { AuditDrillDownPanel } from '@/components/commissions/audit-drilldown-panel';
import type { AuditPaymentRecord, AuditResponse } from '@/app/api/commissions/audit/route';
import type { CommissionPayment } from '@/lib/commission-types';

type SortField = 'period' | 'amount' | 'clientName' | 'sellerName' | 'status';
type SortDir = 'asc' | 'desc';

export default function AuditoriaPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AuditPaymentRecord | null>(null);

  // Filters
  const [period, setPeriod] = useState<string>('');
  const [sellerId, setSellerId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('period');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (period) params.set('period', period);
        if (sellerId) params.set('sellerId', sellerId);
        if (status) params.set('status', status);
        if (search) params.set('search', search);

        const res = await fetch(`/api/commissions/audit?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          // Clear selection if the selected payment is no longer in results
          if (selectedRecord) {
            const stillExists = json.data.payments.find(
              (p: AuditPaymentRecord) => p.payment.id === selectedRecord.payment.id
            );
            if (!stillExists) setSelectedRecord(null);
          }
        }
      } catch (err) {
        console.error('Error cargando auditoría:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, sellerId, status, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sorted & filtered payments
  const sortedPayments = useMemo(() => {
    if (!data) return [];
    const payments = [...data.payments];
    payments.sort((a, b) => {
      let cmp: number;
      switch (sortField) {
        case 'period':
          cmp = a.payment.period.localeCompare(b.payment.period);
          break;
        case 'amount':
          cmp = a.payment.amount - b.payment.amount;
          break;
        case 'clientName':
          cmp = a.payment.clientName.localeCompare(b.payment.clientName);
          break;
        case 'sellerName':
          cmp = a.payment.sellerName.localeCompare(b.payment.sellerName);
          break;
        case 'status':
          cmp = a.payment.status.localeCompare(b.payment.status);
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return payments;
  }, [data, sortField, sortDir]);

  const handleSort = (field: string) => {
    const f = field as SortField;
    if (sortField === f) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(f);
      setSortDir('desc');
    }
  };

  const clearFilters = () => {
    setPeriod('');
    setSellerId('');
    setStatus('');
    setSearch('');
  };

  const hasActiveFilters = period || sellerId || status || search;

  const statusSummary = data?.summary.byStatus ?? {};

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Cargando auditoría de comisiones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <FileSearch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Auditoría de Comisiones
                </h1>
                <p className="text-xs text-slate-500">
                  Trazabilidad completa · Cada peso rastreado a factura + dispositivos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <span className="text-xs text-slate-600">
                  {data.summary.totalPayments} pagos ·{' '}
                  {data.summary.totalAmount.toLocaleString('es-CL')} CLP total
                </span>
              )}
            </div>
          </div>

          {/* ─── Filters bar ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar cliente, vendedor, contrato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Period filter */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos los períodos</option>
              {data?.filters.periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Seller filter */}
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos los vendedores</option>
              {data?.filters.sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos los estados</option>
              {data?.filters.statuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-3 h-3" />
                Limpiar filtros
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
              title="Refrescar datos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ─── Status summary pills ────────────────────────────────────── */}
          {!loading && data && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {Object.entries(statusSummary).map(([st, info]) => {
                const config = STATUS_PILLS[st] ?? STATUS_PILLS.default;
                return (
                  <button
                    key={st}
                    onClick={() => setStatus(status === st ? '' : st)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      status === st
                        ? 'ring-2 ring-offset-1 ring-offset-slate-900 ' + config.ring
                        : ''
                    } ${config.bg} ${config.color}`}
                  >
                    <span>{info.count}</span>
                    <span className="opacity-70">{config.label}</span>
                    <span className="font-mono opacity-50">
                      ${info.amount.toLocaleString('es-CL')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content: Master-Detail Layout ──────────────────────────── */}
      <main className="flex h-[calc(100vh-220px)]">
        {/* Left: Payments Table */}
        <div
          className={`overflow-auto border-r border-slate-800 transition-all ${
            selectedRecord ? 'w-[55%]' : 'w-full'
          }`}
        >
          <AuditPaymentsTable
            payments={sortedPayments}
            selectedId={selectedRecord?.payment.id ?? null}
            onSelect={setSelectedRecord}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>

        {/* Right: Drill-Down Panel */}
        {selectedRecord && (
          <div className="w-[45%] overflow-auto bg-slate-900/50">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 px-5 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Trazabilidad · Pago {selectedRecord.payment.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AuditDrillDownPanel record={selectedRecord} />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Status pill config ──────────────────────────────────────────────────

const STATUS_PILLS: Record<
  string,
  { label: string; color: string; bg: string; ring: string }
> = {
  pagado: {
    label: 'Pagado',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    ring: 'ring-green-500/50',
  },
  pendiente: {
    label: 'Pendiente',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/50',
  },
  retenido: {
    label: 'Retenido',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/50',
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    ring: 'ring-slate-500/50',
  },
  disputado: {
    label: 'Disputado',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    ring: 'ring-purple-500/50',
  },
  default: {
    label: 'Otro',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    ring: 'ring-slate-500/50',
  },
};
