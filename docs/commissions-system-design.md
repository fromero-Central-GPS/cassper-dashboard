# Sistema de Control y Pago de Comisiones — Diseño

## Problema Original (CEN-822)

El proceso actual de comisiones es manual y tiene los siguientes problemas:

1. **Planillas manuales**: Los vendedores llenan sus comisiones en Google Sheets → errores de tipeo y sobrepago
2. **Sin conexión con facturación**: No se verifica si el cliente efectivamente pagó
3. **Sin tracking de dispositivos**: No se sabe qué GPS están asociados al cliente
4. **Upsells invisibles**: Cuando soporte agrega planes a un cliente existente, el vendedor no se entera
5. **Cancelaciones ignoradas**: Se sigue pagando comisión aunque el cliente haya cancelado

## Solución Diseñada

Sistema automatizado dentro del dashboard **Cassper** que reemplaza las planillas manuales.

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Cassper Dashboard                      │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Comisiones   │  │ Commission   │  │ Pegasus         │  │
│  │ Dashboard UI │  │ Engine       │  │ Integration     │  │
│  │              │  │              │  │                 │  │
│  │ /comisiones  │  │ calculate()  │  │ verifyDevices() │  │
│  │ KPI Cards    │  │ payments()   │  │ getRawData()    │  │
│  │ Contracts    │  │ verify()     │  │ listVehicles()  │  │
│  │ Payments     │  │ upsell()     │  │                 │  │
│  │ Devices      │  │ cancel()     │  │                 │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  API Routes                            │  │
│  │  /api/commissions/summary  ← GET dashboard data       │  │
│  │  /api/commissions/contracts ← GET/POST contracts      │  │
│  │  /api/commissions/payments ← GET/PATCH payments       │  │
│  │  /api/commissions/report   ← GET monthly report + CSV │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                           │
└──────────────────────┬────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌──────────┐  ┌───────────┐
    │ GHL MCP │  │ Pegasus  │  │ Billing   │
    │ (CRM)   │  │ MCP (GPS)│  │ System    │
    └─────────┘  └──────────┘  └───────────┘
```

### Reglas de Negocio Implementadas

| Regla | Implementación |
|-------|---------------|
| 12% sobre ACV | `calculateCommission()` en `commission-engine.ts` |
| 12 cuotas mensuales | `generatePaymentSchedule()` |
| Solo pagar si factura pagada | `verifyInvoicesForPeriod()` |
| Solo pagar si dispositivos activos | `verifyDevices()` |
| Detección de upsells | `detectUpsell()` |
| Cancelación detiene pagos | `processCancellation()` |
| Baja de dispositivos reduce comisión | `adjustForDeviceRemoval()` |

### Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| `src/lib/commission-types.ts` | Tipos: Contract, Payment, Seller, Device, etc. |
| `src/lib/commission-engine.ts` | Motor de cálculo (12 funciones de negocio) |
| `src/lib/commission-mock-data.ts` | Datos de prueba realistas |
| `src/lib/pegasus-integration.ts` | Integración con Pegasus MCP |
| `src/app/comisiones/page.tsx` | Dashboard de comisiones |
| `src/components/commissions/commission-kpi-cards.tsx` | Tarjetas KPI |
| `src/components/commissions/contracts-table.tsx` | Tabla de contratos |
| `src/components/commissions/payment-history.tsx` | Historial de pagos por vendedor |
| `src/app/api/commissions/summary/route.ts` | API GET dashboard |
| `src/app/api/commissions/contracts/route.ts` | API GET/POST contratos |
| `src/app/api/commissions/payments/route.ts` | API GET/PATCH pagos |
| `src/app/api/commissions/report/route.ts` | API GET reporte + CSV |

### Próximos Pasos

1. **Integración real con Pegasus MCP**: Conectar `PegasusIntegrationService.verifyContractDevices()` con llamadas reales a `mcp__prod-pegasus-mcp__pegasus_list_vehicles` y `pegasus_get_rawdata`
2. **Integración con facturación**: Conectar con el sistema de facturación para verificar invoices
3. **Persistencia**: Migrar de mock data a base de datos (SQLite o Postgres)
4. **Notificaciones**: Usar `mcp__prod-ghl-mcp__conversations_send-a-new-message` para notificar upsells y cancelaciones a vendedores
5. **Paperclip Agent Scheduler**: Crear un heartbeat programado que ejecute la verificación mensual de dispositivos
6. **Migración desde planillas**: Importar datos históricos de los Google Sheets actuales

### Ejemplo de Uso

```typescript
// Calcular comisión para un nuevo contrato
const commission = calculateCommission(100000); // $100,000/mes
// → { acv: 1200000, totalCommission: 144000, monthlyCommission: 12000 }

// Verificar dispositivos del contrato
const verification = verifyDevices(contract, activeDevices);
// → { allActive: false, inactiveImeis: ['86816605000005'] }

// Generar reporte mensual
const report = generateMonthlyReport('2026-05', payments, sellers);
// → { totalToPay: 456000, totalVerified: 380000, totalPending: 76000 }
```
