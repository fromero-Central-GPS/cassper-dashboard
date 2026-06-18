/**
 * Mock data para el sistema de comisiones.
 *
 * Datos realistas que reflejan el escenario descrito en CEN-822:
 * - Planes GPS con diferentes precios
 * - Vendedores con contratos activos
 * - Dispositivos vinculados vía Pegasus MCP
 * - Facturas para verificación de pago
 *
 * En producción, estos datos vienen de:
 * - GHL MCP (clientes, oportunidades)
 * - Pegasus MCP (dispositivos, vehículos)
 * - Sistema de facturación (invoices)
 */

import type {
  Seller,
  Client,
  Plan,
  Contract,
  CommissionPayment,
  Invoice,
  GPSDevice,
  MonthlyCommissionReport,
  CommissionDashboardData,
} from './commission-types';
import {
  calculateCommission,
  generatePaymentSchedule,
  generateMonthlyReport,
  generateDashboardData,
} from './commission-engine';

// ─── Vendedores ─────────────────────────────────────────────────────────────

export const mockSellers: Seller[] = [
  {
    id: 'SEL-001',
    name: 'Carlos Muñoz',
    email: 'carlos.munoz@cassper.cl',
    commissionRate: 0.12,
    active: true,
    ghlUserId: 'CVokAlI8fgw4WYWoCtQz',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'SEL-002',
    name: 'María González',
    email: 'maria.gonzalez@cassper.cl',
    commissionRate: 0.12,
    active: true,
    ghlUserId: 'BqTwX8QFwXzpegMve9EQ',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'SEL-003',
    name: 'Pedro Rojas',
    email: 'pedro.rojas@cassper.cl',
    commissionRate: 0.12,
    active: true,
    ghlUserId: 'ocQHyuzHvysMo5N5VsXc',
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'SEL-004',
    name: 'Ana Soto',
    email: 'ana.soto@cassper.cl',
    commissionRate: 0.12,
    active: false,
    createdAt: '2025-01-10T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
  },
];

// ─── Planes ─────────────────────────────────────────────────────────────────

export const mockPlans: Plan[] = [
  {
    id: 'PLAN-001',
    name: 'GPS Básico',
    type: 'gps_basico',
    monthlyPricePerUnit: 10000,
    description: 'Rastreo GPS básico con actualización cada 5 minutos',
    active: true,
  },
  {
    id: 'PLAN-002',
    name: 'GPS Avanzado',
    type: 'gps_avanzado',
    monthlyPricePerUnit: 18000,
    description: 'Rastreo en tiempo real, geocercas, alertas de velocidad',
    active: true,
  },
  {
    id: 'PLAN-003',
    name: 'GPS Premium',
    type: 'gps_premium',
    monthlyPricePerUnit: 25000,
    description: 'Rastreo en tiempo real, dashcam, sensor de combustible, mantenimiento predictivo',
    active: true,
  },
  {
    id: 'PLAN-004',
    name: 'Flota Básico',
    type: 'flota_basico',
    monthlyPricePerUnit: 8000,
    description: 'Plan económico para flotas grandes (mínimo 20 unidades)',
    active: true,
  },
  {
    id: 'PLAN-005',
    name: 'Flota Avanzado',
    type: 'flota_avanzado',
    monthlyPricePerUnit: 15000,
    description: 'Gestión de flota completa con reportes y optimización de rutas',
    active: true,
  },
];

// ─── Clientes ───────────────────────────────────────────────────────────────

export const mockClients: Client[] = [
  {
    id: 'CLI-001',
    name: 'Transportes del Sur SpA',
    companyName: 'Transportes del Sur SpA',
    rut: '76.123.456-7',
    email: 'admin@transportesdelsur.cl',
    phone: '+56 9 1234 5678',
    ghlContactId: '9VEmS0si86GW6gXWU89b',
    acquiredBySellerId: 'SEL-001',
    createdAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'CLI-002',
    name: 'Logística Rápida Ltda',
    companyName: 'Logística Rápida Ltda',
    rut: '76.987.654-3',
    email: 'info@logisticarapida.cl',
    phone: '+56 9 8765 4321',
    ghlContactId: 'WFwVrSSjZ2CNHbZThQX2',
    acquiredBySellerId: 'SEL-002',
    createdAt: '2025-12-15T00:00:00Z',
  },
  {
    id: 'CLI-003',
    name: 'Minerales Andinos SA',
    companyName: 'Minerales Andinos SA',
    rut: '77.456.789-0',
    email: 'operaciones@mineralesandinos.cl',
    phone: '+56 9 5555 6666',
    ghlContactId: 'UIaE1WjAwWKdlyD7osQI',
    acquiredBySellerId: 'SEL-001',
    createdAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'CLI-004',
    name: 'Distribuidora Patagonia',
    companyName: 'Distribuidora Patagonia SpA',
    rut: '78.111.222-3',
    email: 'contacto@distribuidorapatagonia.cl',
    phone: '+56 9 3333 4444',
    ghlContactId: 'sx6wyHhbFdRXh302LLNR',
    acquiredBySellerId: 'SEL-003',
    createdAt: '2026-03-10T00:00:00Z',
  },
];

// ─── Contratos ──────────────────────────────────────────────────────────────

function buildContract(
  id: string,
  client: Client,
  plan: Plan,
  seller: Seller,
  quantity: number,
  startDate: string,
  deviceImeis: string[],
  overrides: Partial<Contract> = {}
): Contract {
  const monthlyValue = plan.monthlyPricePerUnit * quantity;
  const commission = calculateCommission(monthlyValue, seller.commissionRate);

  return {
    id,
    clientId: client.id,
    clientName: client.name,
    planId: plan.id,
    planName: plan.name,
    planType: plan.type,
    sellerId: seller.id,
    sellerName: seller.name,
    quantity,
    monthlyValue: commission.monthlyValue,
    acv: commission.acv,
    totalCommission: commission.totalCommission,
    monthlyCommission: commission.monthlyCommission,
    startDate,
    status: 'activo',
    isUpsell: false,
    deviceImeis,
    createdAt: startDate,
    updatedAt: startDate,
    ...overrides,
  };
}

export const mockContracts: Contract[] = [
  // Carlos Muñoz (SEL-001) - Transportes del Sur: 10 GPS Avanzado
  buildContract(
    'CTR-001',
    mockClients[0],
    mockPlans[1],
    mockSellers[0],
    10,
    '2025-11-01T00:00:00Z',
    Array.from({ length: 10 }, (_, i) => `8681660500000${i}`)
  ),
  // Carlos Muñoz (SEL-001) - Minerales Andinos: 20 GPS Premium
  buildContract(
    'CTR-002',
    mockClients[2],
    mockPlans[2],
    mockSellers[0],
    20,
    '2026-01-20T00:00:00Z',
    Array.from({ length: 20 }, (_, i) => `8681660500010${i}`)
  ),
  // María González (SEL-002) - Logística Rápida: 15 GPS Básico
  buildContract(
    'CTR-003',
    mockClients[1],
    mockPlans[0],
    mockSellers[1],
    15,
    '2025-12-15T00:00:00Z',
    Array.from({ length: 15 }, (_, i) => `8681660500020${i}`)
  ),
  // Pedro Rojas (SEL-003) - Distribuidora Patagonia: 8 GPS Avanzado
  buildContract(
    'CTR-004',
    mockClients[3],
    mockPlans[1],
    mockSellers[2],
    8,
    '2026-03-10T00:00:00Z',
    Array.from({ length: 8 }, (_, i) => `8681660500030${i}`)
  ),
  // UPSell: Transportes del Sur contrata 5 GPS Premium adicional (mismo vendedor Carlos)
  buildContract(
    'CTR-005',
    mockClients[0],
    mockPlans[2],
    mockSellers[0],
    5,
    '2026-04-15T00:00:00Z',
    Array.from({ length: 5 }, (_, i) => `8681660500040${i}`),
    {
      isUpsell: true,
      originalContractId: 'CTR-001',
    }
  ),
  // UPSell: Logística Rápida contrata 3 GPS Premium (misma vendedora María)
  buildContract(
    'CTR-006',
    mockClients[1],
    mockPlans[2],
    mockSellers[1],
    3,
    '2026-05-10T00:00:00Z',
    Array.from({ length: 3 }, (_, i) => `8681660500050${i}`),
    {
      isUpsell: true,
      originalContractId: 'CTR-003',
    }
  ),
  // Contrato cancelado — ejemplo de baja de servicio
  buildContract(
    'CTR-007',
    mockClients[3],
    mockPlans[0],
    mockSellers[2],
    5,
    '2025-08-01T00:00:00Z',
    ['86816605000600', '86816605000601', '86816605000602', '86816605000603', '86816605000604'],
    {
      status: 'cancelado',
      cancelledAt: '2026-02-28T00:00:00Z',
      cancellationReason: 'Cliente cambió de proveedor',
    }
  ),
];

// ─── Plan de Pagos Generado ─────────────────────────────────────────────────

export const mockPayments: CommissionPayment[] = mockContracts.flatMap((contract) =>
  generatePaymentSchedule(contract)
);

// Simular algunos pagos ya realizados (meses anteriores)
for (const payment of mockPayments) {
  const [year, month] = payment.period.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Pagos de meses pasados: marcar como pagados
  if (
    year < currentYear ||
    (year === currentYear && month < currentMonth)
  ) {
    payment.status = 'pagado';
    payment.invoiceVerified = true;
    payment.devicesVerified = true;
    payment.invoiceId = `INV-${payment.contractId}-${payment.period}`;
    payment.paidAt = new Date(year, month - 1, 5).toISOString();
    payment.deviceVerification = {
      verifiedAt: new Date(year, month - 1, 1).toISOString(),
      expectedCount: 10,
      activeCount: 10,
      inactiveImeis: [],
      allActive: true,
      source: 'pegasus',
    };
  }

  // Contratos cancelados: marcar pagos futuros como cancelados
  const contract = mockContracts.find((c) => c.id === payment.contractId);
  if (contract && (contract.status === 'cancelado' || contract.status === 'finalizado')) {
    if (payment.status === 'pendiente') {
      payment.status = 'cancelado';
    }
  }

  // Simular 2 dispositivos inactivos en CTR-001 meses recientes (problema a detectar)
  if (payment.contractId === 'CTR-001' && payment.period === '2026-05') {
    payment.status = 'retenido';
    payment.devicesVerified = false;
    payment.deviceVerification = {
      verifiedAt: '2026-05-28T00:00:00Z',
      expectedCount: 10,
      activeCount: 8,
      inactiveImeis: ['86816605000005', '86816605000008'],
      allActive: false,
      source: 'pegasus',
    };
    payment.notes = '2 dispositivos no están transmitiendo. Verificar con el cliente.';
  }
}

// ─── Facturas ───────────────────────────────────────────────────────────────

export const mockInvoices: Invoice[] = [
  {
    id: 'INV-2026-05-001',
    clientId: 'CLI-001',
    clientName: 'Transportes del Sur SpA',
    contractId: 'CTR-001',
    amount: 180000,
    status: 'pagada',
    issuedAt: '2026-05-01T00:00:00Z',
    paidAt: '2026-05-15T00:00:00Z',
    period: '2026-05',
  },
  {
    id: 'INV-2026-05-002',
    clientId: 'CLI-002',
    clientName: 'Logística Rápida Ltda',
    contractId: 'CTR-003',
    amount: 150000,
    status: 'pagada',
    issuedAt: '2026-05-01T00:00:00Z',
    paidAt: '2026-05-20T00:00:00Z',
    period: '2026-05',
  },
  {
    id: 'INV-2026-05-003',
    clientId: 'CLI-003',
    clientName: 'Minerales Andinos SA',
    contractId: 'CTR-002',
    amount: 500000,
    status: 'pagada',
    issuedAt: '2026-05-01T00:00:00Z',
    paidAt: '2026-05-10T00:00:00Z',
    period: '2026-05',
  },
  {
    id: 'INV-2026-05-004',
    clientId: 'CLI-004',
    clientName: 'Distribuidora Patagonia',
    contractId: 'CTR-004',
    amount: 144000,
    status: 'emitida',
    issuedAt: '2026-05-01T00:00:00Z',
    period: '2026-05',
  },
  {
    id: 'INV-2026-05-005',
    clientId: 'CLI-001',
    clientName: 'Transportes del Sur SpA',
    contractId: 'CTR-005',
    amount: 125000,
    status: 'pagada',
    issuedAt: '2026-05-01T00:00:00Z',
    paidAt: '2026-05-15T00:00:00Z',
    period: '2026-05',
  },
];

// ─── Dispositivos GPS (simulando datos de Pegasus) ──────────────────────────

export function generateMockDevices(): GPSDevice[] {
  const devices: GPSDevice[] = [];

  for (const contract of mockContracts) {
    for (let i = 0; i < contract.deviceImeis.length; i++) {
      const imei = contract.deviceImeis[i];
      // Simular que 2 dispositivos de CTR-001 están desconectados
      const isDisconnected =
        contract.id === 'CTR-001' &&
        (imei === '86816605000005' || imei === '86816605000008');

      devices.push({
        imei,
        name: `GPS-${imei.slice(-6)}`,
        vehicleId: `VEH-${imei.slice(-4)}`,
        vehicleName: `Vehículo ${i + 1} - ${contract.clientName}`,
        connected: !isDisconnected && contract.status === 'activo',
        lastSeen: isDisconnected
          ? '2026-05-20T00:00:00Z'
          : new Date().toISOString(),
        clientId: contract.clientId,
        contractId: contract.id,
        source: 'pegasus',
      });
    }
  }

  return devices;
}

export const mockDevices = generateMockDevices();

// ─── Dashboard Data ─────────────────────────────────────────────────────────

const currentPeriod = '2026-05';

export const mockCommissionDashboard: CommissionDashboardData = generateDashboardData(
  currentPeriod,
  mockContracts,
  mockPayments,
  mockSellers,
  mockDevices
);

// ─── Reporte Mensual ────────────────────────────────────────────────────────

export const mockMonthlyReport: MonthlyCommissionReport = generateMonthlyReport(
  currentPeriod,
  mockPayments,
  mockSellers
);
