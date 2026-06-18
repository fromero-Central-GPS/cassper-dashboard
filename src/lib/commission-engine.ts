/**
 * Cassper Commission Engine
 *
 * Motor de cálculo de comisiones que reemplaza las planillas manuales.
 *
 * Reglas de negocio:
 * 1. Comisión = 12% del ACV (Annual Contract Value)
 * 2. ACV = valor_mensual × 12
 * 3. Pago en 12 cuotas mensuales iguales
 * 4. Solo se paga si la factura del cliente está pagada
 * 5. Solo se paga si los dispositivos GPS están activos y asociados
 * 6. Upsells generan nueva comisión para el vendedor original
 * 7. Cancelación de servicio detiene los pagos futuros
 * 8. Baja de dispositivos reduce o detiene la comisión proporcionalmente
 */

import type {
  Seller,
  Client,
  Plan,
  Contract,
  ContractStatus,
  CommissionPayment,
  PaymentStatus,
  DeviceVerification,
  Invoice,
  GPSDevice,
  MonthlyCommissionReport,
  SellerCommissionSummary,
  CommissionDashboardData,
  CommissionConfig,
  CommissionEvent,
  CommissionEventType,
} from './commission-types';

// ─── Configuración Default ──────────────────────────────────────────────────

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  defaultCommissionRate: 0.12,
  paymentInstallments: 12,
  invoiceGraceDays: 5,
  verifyDevicesBeforePayment: true,
  inactiveDeviceTolerance: 0,
  notifyUpsell: true,
  notifyCancellation: true,
};

// ─── 1. Cálculo de Comisión ────────────────────────────────────────────────

export interface CommissionCalculation {
  monthlyValue: number;
  acv: number;
  totalCommission: number;
  monthlyCommission: number;
  commissionRate: number;
  installments: number;
}

/**
 * Calcula la comisión para un contrato.
 *
 * Fórmula: ACV = monthlyValue × 12
 *          totalCommission = ACV × commissionRate
 *          monthlyCommission = totalCommission / installments
 *
 * Ejemplo: 10 planes GPS a $10,000 c/u = $100,000/mes
 *          ACV = 100,000 × 12 = 1,200,000
 *          Comisión total = 1,200,000 × 0.12 = 144,000
 *          Comisión mensual = 144,000 / 12 = 12,000
 */
export function calculateCommission(
  monthlyValue: number,
  commissionRate: number = DEFAULT_COMMISSION_CONFIG.defaultCommissionRate,
  installments: number = DEFAULT_COMMISSION_CONFIG.paymentInstallments
): CommissionCalculation {
  const acv = monthlyValue * 12;
  const totalCommission = acv * commissionRate;
  const monthlyCommission = totalCommission / installments;

  return {
    monthlyValue,
    acv,
    totalCommission,
    monthlyCommission,
    commissionRate,
    installments,
  };
}

// ─── 2. Generación de Plan de Pagos ─────────────────────────────────────────

/**
 * Genera los 12 pagos mensuales de comisión para un contrato.
 * Cada pago queda en estado "pendiente" hasta verificar factura y dispositivos.
 */
export function generatePaymentSchedule(contract: Contract): CommissionPayment[] {
  const payments: CommissionPayment[] = [];
  const startDate = new Date(contract.startDate);

  for (let i = 0; i < DEFAULT_COMMISSION_CONFIG.paymentInstallments; i++) {
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    const period = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

    payments.push({
      id: `${contract.id}-M${i + 1}`,
      contractId: contract.id,
      sellerId: contract.sellerId,
      sellerName: contract.sellerName,
      clientId: contract.clientId,
      clientName: contract.clientName,
      monthNumber: i + 1,
      period,
      amount: contract.monthlyCommission,
      status: 'pendiente',
      invoiceVerified: false,
      devicesVerified: false,
      createdAt: new Date().toISOString(),
    });
  }

  return payments;
}

// ─── 3. Verificación de Dispositivos ────────────────────────────────────────

/**
 * Verifica que los dispositivos asociados a un contrato estén activos.
 *
 * Compara los IMEIs del contrato con los dispositivos reportados
 * por Pegasus o flespi para determinar cuáles están efectivamente
 * transmitiendo datos.
 */
export function verifyDevices(
  contract: Contract,
  activeDevices: GPSDevice[],
  source: 'pegasus' | 'flespi' = 'pegasus'
): DeviceVerification {
  const expectedImeis = new Set(contract.deviceImeis);
  const activeImeis = new Set(
    activeDevices
      .filter((d) => d.connected && d.clientId === contract.clientId)
      .map((d) => d.imei)
  );

  const inactiveImeis: string[] = [];

  for (const imei of expectedImeis) {
    if (!activeImeis.has(imei)) {
      inactiveImeis.push(imei);
    }
  }

  const activeCount = contract.deviceImeis.length - inactiveImeis.length;

  return {
    verifiedAt: new Date().toISOString(),
    expectedCount: contract.deviceImeis.length,
    activeCount,
    inactiveImeis,
    allActive: inactiveImeis.length === 0,
    source,
  };
}

/**
 * Determina si un pago de comisión debe ser liberado basado en:
 * 1. Factura del cliente pagada
 * 2. Dispositivos activos y asociados
 */
export function shouldReleasePayment(
  payment: CommissionPayment,
  invoiceVerified: boolean,
  deviceVerification?: DeviceVerification,
  config: CommissionConfig = DEFAULT_COMMISSION_CONFIG
): { release: boolean; reason?: string } {
  // Verificar factura
  if (!invoiceVerified) {
    return { release: false, reason: 'Factura del cliente no ha sido pagada' };
  }

  // Verificar dispositivos
  if (config.verifyDevicesBeforePayment && deviceVerification) {
    if (!deviceVerification.allActive) {
      const inactiveCount = deviceVerification.inactiveImeis.length;
      if (inactiveCount > config.inactiveDeviceTolerance) {
        return {
          release: false,
          reason: `${inactiveCount} dispositivo(s) inactivo(s): ${deviceVerification.inactiveImeis.join(', ')}`,
        };
      }
    }
  }

  return { release: true };
}

// ─── 4. Detección de Upsells ───────────────────────────────────────────────

/**
 * Detecta si un nuevo contrato es un upsell de uno existente.
 *
 * Un upsell ocurre cuando un cliente existente contrata un plan adicional.
 * La comisión del upsell va al vendedor original.
 */
export function detectUpsell(
  newContract: Contract,
  existingContracts: Contract[]
): { isUpsell: boolean; originalContract?: Contract } {
  const clientContracts = existingContracts.filter(
    (c) =>
      c.clientId === newContract.clientId &&
      c.id !== newContract.id &&
      c.status === 'activo'
  );

  if (clientContracts.length > 0) {
    // El contrato más antiguo se considera el original
    const original = clientContracts.sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )[0];
    return { isUpsell: true, originalContract: original };
  }

  return { isUpsell: false };
}

// ─── 5. Manejo de Cancelaciones ─────────────────────────────────────────────

/**
 * Procesa la cancelación de un contrato:
 * - Detiene los pagos futuros
 * - Marca los pagos pendientes como cancelados
 * - Calcula el monto recuperado
 */
export function processCancellation(
  contract: Contract,
  payments: CommissionPayment[],
  reason: string
): {
  updatedPayments: CommissionPayment[];
  cancelledAmount: number;
  alreadyPaidAmount: number;
} {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const updatedPayments = payments.map((payment) => {
    const [payYear, payMonth] = payment.period.split('-').map(Number);

    // Pagos de meses ya pasados (ya devengados) se mantienen
    const isPastPayment =
      payYear < currentYear ||
      (payYear === currentYear && payMonth <= currentMonth + 1);

    if (!isPastPayment && payment.status === 'pendiente') {
      return { ...payment, status: 'cancelado' as PaymentStatus };
    }

    return payment;
  });

  const cancelledAmount = updatedPayments
    .filter((p) => p.status === 'cancelado')
    .reduce((sum, p) => sum + p.amount, 0);

  const alreadyPaidAmount = updatedPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0);

  return { updatedPayments, cancelledAmount, alreadyPaidAmount };
}

// ─── 6. Ajuste por Baja de Dispositivos ─────────────────────────────────────

/**
 * Cuando un cliente da de baja dispositivos, recalcula la comisión
 * proporcionalmente. Solo afecta pagos futuros.
 */
export function adjustForDeviceRemoval(
  contract: Contract,
  remainingDeviceCount: number,
  futurePayments: CommissionPayment[]
): {
  adjustedPayments: CommissionPayment[];
  monthlyReduction: number;
} {
  if (remainingDeviceCount <= 0) {
    // Todos los dispositivos fueron removidos = cancelación total
    const adjusted = futurePayments.map((p) => ({
      ...p,
      amount: 0,
      status: 'cancelado' as PaymentStatus,
      notes: 'Todos los dispositivos fueron dados de baja',
    }));
    return {
      adjustedPayments: adjusted,
      monthlyReduction: contract.monthlyCommission,
    };
  }

  // Reducción proporcional
  const ratio = remainingDeviceCount / contract.quantity;
  const newMonthlyCommission = contract.monthlyCommission * ratio;
  const monthlyReduction = contract.monthlyCommission - newMonthlyCommission;

  const adjustedPayments = futurePayments.map((p) => ({
    ...p,
    amount: newMonthlyCommission,
    notes: `Ajustado por baja de dispositivos: ${contract.quantity} → ${remainingDeviceCount}`,
  }));

  return { adjustedPayments, monthlyReduction };
}

// ─── 7. Reporte Mensual de Comisiones ───────────────────────────────────────

/**
 * Genera el reporte mensual de comisiones agrupado por vendedor.
 * Este es el reemplazo directo de las planillas manuales.
 */
export function generateMonthlyReport(
  period: string,
  payments: CommissionPayment[],
  sellers: Seller[]
): MonthlyCommissionReport {
  const periodPayments = payments.filter((p) => p.period === period);

  const sellerMap = new Map<string, CommissionPayment[]>();
  for (const payment of periodPayments) {
    const existing = sellerMap.get(payment.sellerId) || [];
    existing.push(payment);
    sellerMap.set(payment.sellerId, existing);
  }

  const sellerSummaries: SellerCommissionSummary[] = [];

  for (const [sellerId, sellerPayments] of sellerMap) {
    const seller = sellers.find((s) => s.id === sellerId);
    const verifiedAmount = sellerPayments
      .filter((p) => p.status === 'pagado')
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = sellerPayments
      .filter((p) => p.status === 'pendiente' || p.status === 'retenido')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalCommission = sellerPayments.reduce((sum, p) => sum + p.amount, 0);

    sellerSummaries.push({
      sellerId,
      sellerName: seller?.name ?? sellerPayments[0]?.sellerName ?? 'Desconocido',
      contracts: new Set(sellerPayments.map((p) => p.contractId)).size,
      activeDevices: 0, // Se completa con datos de Pegasus
      totalCommission,
      verifiedAmount,
      pendingAmount,
      payments: sellerPayments,
    });
  }

  const totalToPay = sellerSummaries.reduce((sum, s) => sum + s.totalCommission, 0);
  const totalVerified = sellerSummaries.reduce((sum, s) => sum + s.verifiedAmount, 0);
  const totalPending = sellerSummaries.reduce((sum, s) => sum + s.pendingAmount, 0);
  const totalCancelled = periodPayments
    .filter((p) => p.status === 'cancelado')
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    period,
    generatedAt: new Date().toISOString(),
    sellers: sellerSummaries.sort((a, b) => b.totalCommission - a.totalCommission),
    totalToPay,
    totalVerified,
    totalPending,
    totalCancelled,
  };
}

// ─── 8. Datos del Dashboard ─────────────────────────────────────────────────

export function generateDashboardData(
  period: string,
  contracts: Contract[],
  payments: CommissionPayment[],
  sellers: Seller[],
  activeDevices: GPSDevice[]
): CommissionDashboardData {
  const activeContracts = contracts.filter((c) => c.status === 'activo');
  const periodPayments = payments.filter((p) => p.period === period);
  const report = generateMonthlyReport(period, payments, sellers);

  const currentMonthCommission = periodPayments.reduce((sum, p) => sum + p.amount, 0);
  const paidThisMonth = periodPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingVerification = periodPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + p.amount, 0);
  const withheldAmount = periodPayments
    .filter((p) => p.status === 'retenido')
    .reduce((sum, p) => sum + p.amount, 0);

  const contractsWithIssues = activeContracts.filter((c) => {
    const contractDevices = activeDevices.filter((d) => d.contractId === c.id);
    const activeCount = contractDevices.filter((d) => d.connected).length;
    return activeCount < c.deviceImeis.length;
  }).length;

  // Upsells recientes (últimos 30 días)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentUpsells = contracts.filter(
    (c) => c.isUpsell && new Date(c.createdAt) >= thirtyDaysAgo
  );

  // Cancelaciones recientes
  const recentCancellations = contracts.filter(
    (c) =>
      (c.status === 'cancelado' || c.status === 'finalizado') &&
      c.cancelledAt &&
      new Date(c.cancelledAt) >= thirtyDaysAgo
  );

  return {
    currentPeriod: period,
    activeSellers: sellers.filter((s) => s.active).length,
    activeContracts: activeContracts.length,
    totalDevices: activeDevices.filter((d) => d.connected).length,
    currentMonthCommission,
    paidThisMonth,
    pendingVerification,
    withheldAmount,
    contractsWithIssues,
    sellerSummaries: report.sellers,
    recentUpsells,
    recentCancellations,
  };
}

// ─── 9. Sistema de Eventos ──────────────────────────────────────────────────

let eventHandlers: Array<(event: CommissionEvent) => void> = [];

export function onCommissionEvent(handler: (event: CommissionEvent) => void): () => void {
  eventHandlers.push(handler);
  return () => {
    eventHandlers = eventHandlers.filter((h) => h !== handler);
  };
}

export function emitCommissionEvent(
  type: CommissionEventType,
  data: {
    contractId?: string;
    sellerId?: string;
    clientId?: string;
    deviceImei?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
): CommissionEvent {
  const event: CommissionEvent = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt: new Date().toISOString(),
    ...data,
  };

  // Notificar a todos los handlers
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch (err) {
      console.error(`Error en handler de evento ${type}:`, err);
    }
  }

  return event;
}

// ─── 10. Validación de Contrato ─────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateContract(
  contract: Partial<Contract>,
  existingContracts: Contract[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!contract.clientId) errors.push('Cliente es requerido');
  if (!contract.planId) errors.push('Plan es requerido');
  if (!contract.sellerId) errors.push('Vendedor es requerido');
  if (!contract.startDate) errors.push('Fecha de inicio es requerida');

  if (contract.quantity !== undefined && contract.quantity <= 0) {
    errors.push('Cantidad de dispositivos debe ser mayor a 0');
  }

  if (contract.monthlyValue !== undefined && contract.monthlyValue <= 0) {
    errors.push('Valor mensual debe ser mayor a 0');
  }

  // Verificar duplicados
  if (contract.clientId && contract.planId) {
    const duplicate = existingContracts.find(
      (c) =>
        c.clientId === contract.clientId &&
        c.planId === contract.planId &&
        c.status === 'activo' &&
        c.id !== contract.id
    );
    if (duplicate) {
      warnings.push(
        `El cliente ya tiene un contrato activo para este plan (${duplicate.id}). ¿Es un upsell?`
      );
    }
  }

  // Verificar dispositivos
  if (contract.deviceImeis && contract.quantity) {
    if (contract.deviceImeis.length !== contract.quantity) {
      warnings.push(
        `Cantidad de dispositivos (${contract.deviceImeis.length}) no coincide con la cantidad contratada (${contract.quantity})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── 11. Sincronización con Facturación ─────────────────────────────────────

/**
 * Verifica si un contrato tiene facturas pagadas para el período.
 * Solo se libera comisión si la factura del cliente está pagada.
 */
export function verifyInvoicesForPeriod(
  invoices: Invoice[],
  clientId: string,
  period: string
): { hasPaidInvoice: boolean; paidInvoice?: Invoice; unpaidInvoices: Invoice[] } {
  const periodInvoices = invoices.filter(
    (i) => i.clientId === clientId && i.period === period
  );

  const paidInvoice = periodInvoices.find((i) => i.status === 'pagada');
  const unpaidInvoices = periodInvoices.filter((i) => i.status !== 'pagada');

  return {
    hasPaidInvoice: !!paidInvoice,
    paidInvoice,
    unpaidInvoices,
  };
}
