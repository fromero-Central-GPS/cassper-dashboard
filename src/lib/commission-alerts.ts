import {
  CommissionEvent,
  CommissionEventType,
  Contract,
  GPSDevice,
  AlertType,
  CommissionAlert,
} from './commission-types';
import { onCommissionEvent } from './commission-engine';
import { AlertRepository } from './db/alert-repository';

// Re-export types for backward compatibility
export type { AlertType, CommissionAlert };

// Almacenamiento en memoria para alertas (MVP)
let activeAlerts: CommissionAlert[] = [];
let alertListeners: Array<(alert: CommissionAlert) => void> = [];

export function getAlerts(): CommissionAlert[] {
  return [...activeAlerts].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function markAlertAsRead(alertId: string): void {
  const alert = activeAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.read = true;
  }
}

export function clearAlerts(): void {
  activeAlerts = [];
}

export function onAlert(handler: (alert: CommissionAlert) => void): () => void {
  alertListeners.push(handler);
  return () => {
    alertListeners = alertListeners.filter(h => h !== handler);
  };
}

export function createAlert(alert: Omit<CommissionAlert, 'id' | 'createdAt' | 'read'>) {
  const id = `ALT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();

  const newAlert: CommissionAlert = {
    ...alert,
    id,
    createdAt,
    read: false,
  };

  // Persist to SQLite (best-effort; graceful fallback if schema not initialized)
  try {
    const repo = new AlertRepository();
    repo.create(alert);
  } catch (err) {
    // Schema may not be initialized yet (e.g. in tests or early startup).
    // The in-memory store still works; DB persistence will catch up once
    // initSchema() is called. Log at debug level to avoid noise in tests.
    console.debug('AlertRepository.create failed (schema may not be ready):', (err as Error).message);
  }

  activeAlerts.push(newAlert);

  for (const listener of alertListeners) {
    try {
      listener(newAlert);
    } catch (err) {
      console.error('Error en listener de alertas:', err);
    }
  }

  return newAlert;
}

// ─── Lógica de Procesamiento de Eventos ─────────────────────────────────────

export function setupAlertEngine() {
  return onCommissionEvent((event: CommissionEvent) => {
    switch (event.type) {
      case 'upsell_detected':
        createAlert({
          type: 'A1_NUEVO_DISPOSITIVO_UPSELL',
          title: 'Posible Upsell Detectado',
          description: event.description,
          severity: 'medium',
          contractId: event.contractId,
          sellerId: event.sellerId,
          clientId: event.clientId,
          metadata: event.metadata
        });
        break;
        
      case 'device_deactivated':
        createAlert({
          type: 'A2_BAJA_DISPOSITIVO_FACTURADO',
          title: 'Dispositivo Inactivo',
          description: event.description,
          severity: 'high',
          contractId: event.contractId,
          sellerId: event.sellerId,
          clientId: event.clientId,
          metadata: event.metadata
        });
        break;
        
      case 'invoice_overdue':
        createAlert({
          type: 'A5_FACTURA_IMPAGA',
          title: 'Factura Vencida',
          description: event.description,
          severity: 'high',
          contractId: event.contractId,
          sellerId: event.sellerId,
          clientId: event.clientId,
          metadata: event.metadata
        });
        break;
        
      case 'contract_cancelled':
        createAlert({
          type: 'A6_CONTRATO_CANCELADO',
          title: 'Contrato Cancelado',
          description: event.description,
          severity: 'critical',
          contractId: event.contractId,
          sellerId: event.sellerId,
          clientId: event.clientId,
          metadata: event.metadata
        });
        break;
        
      case 'payment_withheld':
        createAlert({
          type: 'A8_PAGO_RETENIDO',
          title: 'Pago de Comisión Retenido',
          description: event.description,
          severity: 'high',
          contractId: event.contractId,
          sellerId: event.sellerId,
          metadata: event.metadata
        });
        break;
        
      case 'payment_released':
        createAlert({
          type: 'A7_PAGO_LIBERADO',
          title: 'Pago de Comisión Liberado',
          description: event.description,
          severity: 'low',
          contractId: event.contractId,
          sellerId: event.sellerId,
          metadata: event.metadata
        });
        break;
        
      case 'contract_created':
        if (!event.sellerId) {
          createAlert({
            type: 'A3_CLIENTE_NUEVO_SIN_VENDEDOR',
            title: 'Contrato sin vendedor asignado',
            description: event.description,
            severity: 'medium',
            contractId: event.contractId,
            clientId: event.clientId
          });
        }
        break;
    }
  });
}

// ─── Chequeos Periódicos (No basados en eventos directos) ───────────────────

export function checkDeviceDiscrepancies(contract: Contract, activeDevices: GPSDevice[]) {
  const expectedCount = contract.deviceImeis.length;
  const activeCount = activeDevices.filter(d => 
    d.clientId === contract.clientId && d.connected
  ).length;
  
  if (expectedCount !== activeCount) {
    createAlert({
      type: 'A4_DISCREPANCIA_DISPOSITIVOS',
      title: 'Discrepancia en Dispositivos',
      description: `Contrato ${contract.id} espera ${expectedCount} dispositivos, pero hay ${activeCount} activos para el cliente.`,
      severity: 'high',
      contractId: contract.id,
      sellerId: contract.sellerId,
      clientId: contract.clientId,
      metadata: { expectedCount, activeCount }
    });
  }
}
