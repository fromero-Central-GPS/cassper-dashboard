import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  getAlerts, 
  clearAlerts, 
  setupAlertEngine,
  markAlertAsRead,
  checkDeviceDiscrepancies
} from './commission-alerts';
import { emitCommissionEvent } from './commission-engine';
import { Contract, GPSDevice } from './commission-types';

describe('Commission Alerts Engine', () => {
  let cleanupEngine: () => void;

  beforeEach(() => {
    clearAlerts();
    cleanupEngine = setupAlertEngine();
  });

  afterEach(() => {
    cleanupEngine();
  });

  it('should generate A1 alert on upsell event', () => {
    emitCommissionEvent('upsell_detected', {
      contractId: 'CTR-123',
      sellerId: 'SELL-1',
      clientId: 'CLI-1',
      description: 'Upsell from basic to premium'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('A1_NUEVO_DISPOSITIVO_UPSELL');
    expect(alerts[0].contractId).toBe('CTR-123');
    expect(alerts[0].severity).toBe('medium');
    expect(alerts[0].read).toBe(false);
  });

  it('should generate A2 alert on device deactivated', () => {
    emitCommissionEvent('device_deactivated', {
      contractId: 'CTR-123',
      sellerId: 'SELL-1',
      clientId: 'CLI-1',
      deviceImei: 'IMEI123',
      description: 'Device offline for 30 days'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('A2_BAJA_DISPOSITIVO_FACTURADO');
    expect(alerts[0].severity).toBe('high');
  });

  it('should generate A3 alert on new contract without seller', () => {
    emitCommissionEvent('contract_created', {
      contractId: 'CTR-NO-SELLER',
      clientId: 'CLI-1',
      description: 'New contract via web form'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('A3_CLIENTE_NUEVO_SIN_VENDEDOR');
    expect(alerts[0].severity).toBe('medium');
    expect(alerts[0].sellerId).toBeUndefined();
  });

  it('should NOT generate A3 alert if seller is present', () => {
    emitCommissionEvent('contract_created', {
      contractId: 'CTR-WITH-SELLER',
      sellerId: 'SELL-1',
      clientId: 'CLI-1',
      description: 'New contract by seller'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(0);
  });

  it('should generate A5 alert on overdue invoice', () => {
    emitCommissionEvent('invoice_overdue', {
      contractId: 'CTR-123',
      sellerId: 'SELL-1',
      clientId: 'CLI-1',
      description: 'Invoice INV-1 is 10 days overdue'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('A5_FACTURA_IMPAGA');
    expect(alerts[0].severity).toBe('high');
  });

  it('should generate A6 alert on contract cancellation', () => {
    emitCommissionEvent('contract_cancelled', {
      contractId: 'CTR-123',
      sellerId: 'SELL-1',
      clientId: 'CLI-1',
      description: 'Client requested cancellation'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('A6_CONTRATO_CANCELADO');
    expect(alerts[0].severity).toBe('critical');
  });

  it('should generate A7 and A8 alerts for payments', async () => {
    emitCommissionEvent('payment_released', {
      contractId: 'CTR-123',
      description: 'Payment released'
    });
    
    // add small delay so timestamps are distinct
    await new Promise(r => setTimeout(r, 10));
    
    emitCommissionEvent('payment_withheld', {
      contractId: 'CTR-123',
      description: 'Payment withheld due to inactive devices'
    });

    const alerts = getAlerts();
    expect(alerts.length).toBe(2);
    // alerts are sorted by createdAt desc
    expect(alerts[0].type).toBe('A8_PAGO_RETENIDO');
    expect(alerts[1].type).toBe('A7_PAGO_LIBERADO');
  });

  it('should mark alerts as read', () => {
    emitCommissionEvent('upsell_detected', { description: 'test' });
    const alertsBefore = getAlerts();
    const alertId = alertsBefore[0].id;
    
    expect(alertsBefore[0].read).toBe(false);
    
    markAlertAsRead(alertId);
    
    const alertsAfter = getAlerts();
    expect(alertsAfter[0].read).toBe(true);
  });

  it('should generate A4 alert on device discrepancies', () => {
    const contract: Contract = {
      id: 'CTR-1',
      clientId: 'CLI-1',
      clientName: 'Test Client',
      sellerId: 'SELL-1',
      sellerName: 'Test Seller',
      planId: 'PLAN-1',
      status: 'activo',
      startDate: '2026-01-01',
      monthlyValue: 30000,
      monthlyCommission: 3000,
      deviceImeis: ['IMEI1', 'IMEI2', 'IMEI3'] // expects 3 devices
    };

    const activeDevices: GPSDevice[] = [
      { imei: 'IMEI1', clientId: 'CLI-1', connected: true, lastUpdate: '2026-06-01' },
      { imei: 'IMEI2', clientId: 'CLI-1', connected: true, lastUpdate: '2026-06-01' }
      // missing IMEI3
    ];

    checkDeviceDiscrepancies(contract, activeDevices);

    const alerts = getAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('A4_DISCREPANCIA_DISPOSITIVOS');
    expect(alerts[0].severity).toBe('high');
    expect(alerts[0].metadata?.expectedCount).toBe(3);
    expect(alerts[0].metadata?.activeCount).toBe(2);
  });
});
