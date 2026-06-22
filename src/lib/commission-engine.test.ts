import { test, expect, describe, vi, afterEach } from 'vitest';
import { 
  onCommissionEvent,
  emitCommissionEvent
} from './commission-engine';

describe('Commission Engine Event Bus (A1-A8 Alerts Integration)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('A1: Dispatches an event and calls handlers correctly', () => {
    const handler = vi.fn();
    const unsubscribe = onCommissionEvent(handler);

    emitCommissionEvent('upsell_detected', {
      contractId: 'C-001',
      sellerId: 'S-001',
      clientId: 'CLI-001',
      description: 'Upsell',
      metadata: { originalContractId: 'C-000' }
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'upsell_detected',
      contractId: 'C-001',
      sellerId: 'S-001',
      clientId: 'CLI-001',
      description: 'Upsell',
      metadata: { originalContractId: 'C-000' }
    }));

    unsubscribe();
  });

  test('A2: Does not call handlers after they unsubscribe', () => {
    const handler = vi.fn();
    const unsubscribe = onCommissionEvent(handler);
    
    unsubscribe();
    
    emitCommissionEvent('payment_withheld', {
      contractId: 'C-001',
      description: 'No invoice'
    });
    
    expect(handler).not.toHaveBeenCalled();
  });

  test('A3: Multiple handlers receive the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    const unsub1 = onCommissionEvent(handler1);
    const unsub2 = onCommissionEvent(handler2);
    
    emitCommissionEvent('device_deactivated', {
      contractId: 'C-002',
      description: 'device offline',
      metadata: { inactiveCount: 3 }
    });
    
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    
    unsub1();
    unsub2();
  });
});
