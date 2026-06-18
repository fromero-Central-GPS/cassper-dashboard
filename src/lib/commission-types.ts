/**
 * Sistema de Control y Pago de Comisiones — Cassper
 *
 * Modelo de datos para automatizar el cálculo de comisiones
 * reemplazando las planillas manuales actuales.
 *
 * Regla de negocio:
 * - 12% sobre el ACV (Annual Contract Value)
 * - ACV = valor_mensual × 12 meses
 * - Pagado en 12 cuotas mensuales
 * - Solo se paga cuando el cliente ha sido facturado y pagado
 * - Se detiene el pago si el cliente cancela o da de baja dispositivos
 */

// ─── Entidades Principales ─────────────────────────────────────────────────

export interface Seller {
  id: string;
  name: string;
  email: string;
  /** Porcentaje de comisión base (default 12%) */
  commissionRate: number;
  /** Si está activo para recibir comisiones */
  active: boolean;
  /** ID en GHL (si existe como usuario) */
  ghlUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  /** Razón social / empresa */
  companyName?: string;
  rut?: string;
  email: string;
  phone?: string;
  /** ID en GHL */
  ghlContactId?: string;
  /** Seller que trajo al cliente (para upsells futuros) */
  acquiredBySellerId: string;
  createdAt: string;
}

export type PlanType =
  | 'gps_basico'
  | 'gps_avanzado'
  | 'gps_premium'
  | 'flota_basico'
  | 'flota_avanzado'
  | 'flota_premium'
  | 'personalizado';

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  /** Precio mensual por unidad/dispositivo en CLP */
  monthlyPricePerUnit: number;
  /** Descripción del plan */
  description?: string;
  active: boolean;
}

export type ContractStatus =
  | 'activo'
  | 'suspendido'
  | 'cancelado'
  | 'finalizado';

export interface Contract {
  id: string;
  clientId: string;
  clientName: string;
  planId: string;
  planName: string;
  planType: PlanType;
  /** Seller que recibe la comisión por este contrato */
  sellerId: string;
  sellerName: string;
  /** Cantidad de dispositivos/unidades contratadas */
  quantity: number;
  /** Precio mensual total del contrato (quantity × monthlyPricePerUnit) */
  monthlyValue: number;
  /** Annual Contract Value = monthlyValue × 12 */
  acv: number;
  /** Comisión total = acv × commissionRate (12%) */
  totalCommission: number;
  /** Comisión mensual = totalCommission / 12 */
  monthlyCommission: number;
  /** Fecha de inicio del contrato */
  startDate: string;
  /** Fecha de fin (null si es indefinido) */
  endDate?: string;
  status: ContractStatus;
  /** Fecha de cancelación si aplica */
  cancelledAt?: string;
  /** Motivo de cancelación */
  cancellationReason?: string;
  /** Si este contrato fue un upsell de otro contrato */
  isUpsell: boolean;
  /** ID del contrato original si es upsell */
  originalContractId?: string;
  /** Dispositivos asociados (IMEIs) */
  deviceImeis: string[];
  /** Notas internas */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | 'pendiente'
  | 'pagado'
  | 'retenido'
  | 'cancelado'
  | 'disputado';

export interface CommissionPayment {
  id: string;
  contractId: string;
  sellerId: string;
  sellerName: string;
  clientId: string;
  clientName: string;
  /** Mes que cubre este pago (1-12) */
  monthNumber: number;
  /** Año y mes (YYYY-MM) */
  period: string;
  /** Monto a pagar este mes */
  amount: number;
  status: PaymentStatus;
  /** Si la factura del cliente fue pagada */
  invoiceVerified: boolean;
  /** ID de la factura verificada */
  invoiceId?: string;
  /** Si los dispositivos están activos y asociados */
  devicesVerified: boolean;
  /** Detalle de verificación de dispositivos */
  deviceVerification?: DeviceVerification;
  /** Fecha en que se liberó el pago */
  paidAt?: string;
  /** Notas sobre el pago */
  notes?: string;
  createdAt: string;
}

export interface DeviceVerification {
  verifiedAt: string;
  /** Total de dispositivos que deberían estar activos */
  expectedCount: number;
  /** Dispositivos efectivamente activos */
  activeCount: number;
  /** Dispositivos no encontrados o inactivos */
  inactiveImeis: string[];
  /** ¿Todos los dispositivos están activos? */
  allActive: boolean;
  /** Fuente de verificación (pegasus, flespi, manual) */
  source: 'pegasus' | 'flespi' | 'manual';
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  contractId?: string;
  /** Monto total de la factura */
  amount: number;
  /** Estado de pago de la factura */
  status: 'emitida' | 'pagada' | 'vencida' | 'anulada';
  /** Fecha de emisión */
  issuedAt: string;
  /** Fecha de pago */
  paidAt?: string;
  /** Período que cubre (YYYY-MM) */
  period: string;
}

// ─── Dispositivo GPS (desde Pegasus/flespi) ────────────────────────────────

export interface GPSDevice {
  imei: string;
  /** Nombre/alias del dispositivo */
  name?: string;
  /** Vehículo asociado en Pegasus */
  vehicleId?: string;
  vehicleName?: string;
  /** Si el dispositivo está transmitiendo datos */
  connected: boolean;
  /** Última transmisión */
  lastSeen?: string;
  /** Cliente al que está asociado */
  clientId?: string;
  /** Contrato al que está asociado */
  contractId?: string;
  /** Fuente de datos */
  source: 'pegasus' | 'flespi';
}

// ─── Reportes y Vistas ─────────────────────────────────────────────────────

export interface MonthlyCommissionReport {
  period: string;
  generatedAt: string;
  sellers: SellerCommissionSummary[];
  totalToPay: number;
  totalVerified: number;
  totalPending: number;
  totalCancelled: number;
}

export interface SellerCommissionSummary {
  sellerId: string;
  sellerName: string;
  contracts: number;
  activeDevices: number;
  totalCommission: number;
  verifiedAmount: number;
  pendingAmount: number;
  payments: CommissionPayment[];
}

export interface CommissionDashboardData {
  /** Período actual */
  currentPeriod: string;
  /** Total de vendedores activos */
  activeSellers: number;
  /** Total de contratos activos */
  activeContracts: number;
  /** Total de dispositivos monitoreados */
  totalDevices: number;
  /** Comisión total del mes actual */
  currentMonthCommission: number;
  /** Comisión ya pagada este mes */
  paidThisMonth: number;
  /** Comisión pendiente de verificación */
  pendingVerification: number;
  /** Comisión retenida (dispositivos inactivos) */
  withheldAmount: number;
  /** Contratos con problemas */
  contractsWithIssues: number;
  /** Detalle por vendedor */
  sellerSummaries: SellerCommissionSummary[];
  /** Upsells detectados este mes */
  recentUpsells: Contract[];
  /** Cancelaciones detectadas este mes */
  recentCancellations: Contract[];
}

// ─── Eventos del Sistema ───────────────────────────────────────────────────

export type CommissionEventType =
  | 'contract_created'
  | 'contract_cancelled'
  | 'upsell_detected'
  | 'device_deactivated'
  | 'device_reactivated'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'payment_released'
  | 'payment_withheld'
  | 'payment_disputed';

export interface CommissionEvent {
  id: string;
  type: CommissionEventType;
  contractId?: string;
  sellerId?: string;
  clientId?: string;
  deviceImei?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── Configuración del Sistema ─────────────────────────────────────────────

export interface CommissionConfig {
  /** Tasa de comisión default (0.12 = 12%) */
  defaultCommissionRate: number;
  /** Número de cuotas para pagar la comisión */
  paymentInstallments: number;
  /** Días de gracia después del vencimiento de factura */
  invoiceGraceDays: number;
  /** Verificar dispositivos antes de cada pago */
  verifyDevicesBeforePayment: boolean;
  /** Tolerancia de dispositivos inactivos (0 = todos deben estar activos) */
  inactiveDeviceTolerance: number;
  /** Notificar a vendedor cuando se detecta un upsell */
  notifyUpsell: boolean;
  /** Notificar a vendedor cuando se cancela un contrato */
  notifyCancellation: boolean;
}
