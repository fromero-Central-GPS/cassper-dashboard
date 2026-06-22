# CEN-1000: Live Opp Alerts

Pipeline de heartbeat que detecta oportunidades abiertas en riesgo y notifica
por email a los vendedores asignados con acciones recomendadas.

## Flujo

```
GHL MCP                          Live Opp Engine          Alert Service         GOG
───────                          ───────────────          ─────────────         ───
open opps ──→ analyzeLiveOpp() ──→ risk score + alerts ──→ dispatchLiveOppAlerts() ──→ email
messages ──→                     ──→ recommendations      ──→ seller resolution
                                                            ──→ dedup check
                                                            ──→ format email
```

## Ejecución desde Paperclip Heartbeat

El agente Paperclip:
1. Llama a `mcp__prod-ghl-mcp__opportunities_search-opportunity` (status=open)
2. Para cada opp, `mcp__prod-ghl-mcp__conversations_search-conversation` + `conversations_get-messages`
3. Construye arrays de `OpenOpportunity` y `GHLMessage[]`
4. Invoca `analyzeLiveOpportunities()` del live-opp-engine
5. Invoca `dispatchLiveOppAlerts()` del live-opp-alert-service
6. Los emails se envían vía GOG CLI

## Seller Mapping (GHL users → local DB)

Los vendedores en GHL se mapean a la tabla `sellers` mediante `ghl_user_id`:

| GHL User ID | Nombre | Email | Sellers DB ID |
|---|---|---|---|
| `jgJW8AQLBREVyfElMWY1` | Sandra | sandra@centralgps.cl | SEL-PROD-004 |
| `EjsSBi5gJX0pqYMHuzKl` | Sebastian Salas | sebastian.salas@centralgps.cl | SEL-PROD-005 |
| — (sin GHL user) | Carlos Muñoz | carlos.munoz@analyzegps.cl | SEL-PROD-001 |
| — (sin GHL user) | María González | maria.gonzalez@analyzegps.cl | SEL-PROD-002 |
| — (sin GHL user) | Pedro Rojas | pedro.rojas@analyzegps.cl | SEL-PROD-003 |

Si un `assignedTo` de GHL no tiene seller correspondiente, la alerta cae al fallback `contacto@centralgps.cl`.

## Ejecución standalone (dry-run)

```bash
npx tsx scripts/live-opp-alerts/index.ts --mode=dry-run
```

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `index.ts` | Pipeline de heartbeat |
| `src/lib/live-opp-engine.ts` | Motor de análisis de riesgo |
| `src/lib/live-opp-alert-service.ts` | Servicio de notificación por email |
| `src/lib/alert-dispatcher.ts` | Canales de despacho (email, WhatsApp, Paperclip) |

## Umbrales de riesgo

| Nivel | Score | Acción |
|-------|-------|--------|
| 🔴 Critical | ≥80 | AHORA — email inmediato |
| 🟠 High | ≥50 | HOY — email prioritario |
| 🟡 Medium | ≥25 | Esta semana — email informativo |
| 🟢 Low | >0 | Monitorear — sin email |
| ⚪ None | 0 | Sin riesgo |

Los umbrales se calculan desde Won Track (deals ganados) para reflejar
patrones reales de éxito.
