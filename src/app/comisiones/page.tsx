'use client';

import { useState, useEffect } from 'react';
import { CommissionKPICards } from '@/components/commissions/commission-kpi-cards';
import { ContractsTable } from '@/components/commissions/contracts-table';
import { PaymentHistory } from '@/components/commissions/payment-history';
import { SellerMonthlyChart } from '@/components/commissions/seller-monthly-chart';
import type { CommissionDashboardData, Contract, CommissionPayment, Seller } from '@/lib/commission-types';
import {
  BarChart3,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Download,
  Cpu,
  PieChart,
} from 'lucide-react';

export default function ComisionesPage() {
  const [data, setData] = useState<CommissionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'payments' | 'devices' | 'visualization'>('overview');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, contractsRes, paymentsRes, sellersRes] = await Promise.all([
          fetch('/api/commissions/summary'),
          fetch('/api/commissions/contracts'),
          fetch('/api/commissions/payments'),
          fetch('/api/commissions/payments?view=sellers'),
        ]);
        const summaryJson = await summaryRes.json();
        const contractsJson = await contractsRes.json();
        const paymentsJson = await paymentsRes.json();
        const sellersJson = await sellersRes.json();
        if (summaryJson.success) setData(summaryJson.data);
        if (contractsJson.success) setContracts(contractsJson.data);
        if (paymentsJson.success) setPayments(paymentsJson.data);
        if (sellersJson.success) setSellers(sellersJson.data);
      } catch (err) {
        console.error('Error cargando datos de comisiones:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Cargando datos de comisiones...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview' as const, label: 'Vista General', icon: BarChart3 },
    { id: 'contracts' as const, label: 'Contratos', icon: FileText },
    { id: 'payments' as const, label: 'Pagos', icon: DollarSign },
    { id: 'visualization' as const, label: 'Visualización', icon: PieChart },
    { id: 'devices' as const, label: 'Dispositivos', icon: Cpu },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Control de Comisiones
                </h1>
                <p className="text-xs text-slate-500">
                  Automatización · Período: {data.currentPeriod} · {data.activeSellers} vendedores activos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/api/commissions/report?period=${data.currentPeriod}&format=csv`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-300 text-xs hover:bg-slate-700/50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </a>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-slate-500">
                  {data.totalDevices} disp. activos · {data.activeContracts} contratos
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Vista General */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Cards */}
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Resumen de Comisiones · {data.currentPeriod}
              </h2>
              <CommissionKPICards data={data} />
            </div>

            {/* Alertas */}
            {data.contractsWithIssues > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-red-400 text-sm font-medium">
                    {data.contractsWithIssues} contrato(s) con dispositivos inactivos
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    La comisión de estos contratos está retenida hasta que se verifique el estado de los dispositivos.
                    Revisa la pestaña &ldquo;Dispositivos&rdquo; para más detalles.
                  </p>
                </div>
              </div>
            )}

            {/* Upsells Recientes */}
            {data.recentUpsells.length > 0 && (
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-purple-400">
                    Upsells Detectados ({data.recentUpsells.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {data.recentUpsells.map((upsell) => (
                    <div
                      key={upsell.id}
                      className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-2"
                    >
                      <div>
                        <p className="text-white text-sm">{upsell.clientName}</p>
                        <p className="text-slate-500 text-xs">
                          {upsell.planName} ×{upsell.quantity} · Comisión mensual: ${upsell.monthlyCommission.toLocaleString('es-CL')}
                        </p>
                      </div>
                      <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                        Vendedor: {upsell.sellerName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancelaciones Recientes */}
            {data.recentCancellations.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-400">
                    Cancelaciones Recientes ({data.recentCancellations.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {data.recentCancellations.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-2"
                    >
                      <div>
                        <p className="text-white text-sm">{contract.clientName}</p>
                        <p className="text-slate-500 text-xs">
                          {contract.cancellationReason || 'Sin motivo registrado'} · Cancelado: {contract.cancelledAt?.split('T')[0]}
                        </p>
                      </div>
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                        Pagos detenidos
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment History Summary */}
            <PaymentHistory sellerSummaries={data.sellerSummaries} />
          </>
        )}

        {/* Contratos */}
        {activeTab === 'contracts' && (
          <>
            <ContractsTable
              contracts={contracts}
              onSelect={setSelectedContract}
            />
          </>
        )}

        {/* Pagos */}
        {activeTab === 'payments' && (
          <PaymentHistory sellerSummaries={data.sellerSummaries} />
        )}

        {/* Visualización — Gráfico por Vendedor/Mes */}
        {activeTab === 'visualization' && (
          <SellerMonthlyChart payments={payments} sellers={sellers} />
        )}

        {/* Dispositivos */}
        {activeTab === 'devices' && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
              <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-medium">Verificación de Dispositivos</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
                Esta sección se integra con{' '}
                <strong className="text-indigo-400">Pegasus MCP</strong> y{' '}
                <strong className="text-indigo-400">flespi MCP</strong> para verificar
                en tiempo real qué dispositivos GPS están activos y asociados a cada cliente.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-800 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {data.totalDevices} dispositivos activos · Próxima integración: Pegasus MCP
              </div>
            </div>

            {/* Resumen rápido de contratos con issues */}
            {data.contractsWithIssues > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2">
                  ⚠️ Contratos con dispositivos inactivos ({data.contractsWithIssues})
                </h4>
                <p className="text-slate-400 text-xs">
                  Estos contratos tienen dispositivos que no están transmitiendo.
                  La comisión está retenida hasta que se reactive el servicio o se ajuste el contrato.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quote de Cassper */}
        <div className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border border-green-500/10 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs italic">
            &ldquo;Automatizar las comisiones no es solo eficiencia — es justicia para tus vendedores.&rdquo; — Cassper
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-600">
          <span>Cassper · Sistema de Comisiones · Powered by Paperclip Agents</span>
          <div className="flex items-center gap-4">
            <span>Integración: GHL MCP + Pegasus MCP</span>
            <span>Datos actualizados: {new Date().toLocaleDateString('es-CL')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
