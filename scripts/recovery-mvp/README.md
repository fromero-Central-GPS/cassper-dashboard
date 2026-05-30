# Recovery MVP — Detector de Oportunidades Perdidas

Script que detecta oportunidades perdidas en GHL, las analiza con Claude, y genera un reporte Markdown priorizado.

## Archivos

| Archivo | Función |
|---|---|
| `index.ts` | Entrypoint, orquesta el flujo end-to-end |
| `ghl-client.ts` | Parsers y helpers para datos de GHL MCP |
| `analyzer.ts` | Análisis con Claude (Haiku → Sonnet para score > 70) |
| `report.ts` | Genera el Markdown del reporte |

## Prerrequisitos

```bash
ANTHROPIC_API_KEY=sk-...
```

## Cómo correr (modo agente Paperclip)

Este script fue diseñado para ejecutarse como herramienta de un agente Claude con acceso a `prod-ghl-mcp`. El agente:

1. Llama `opportunities_get-pipelines` → detecta stages "Perdido"
2. Llama `opportunities_search-opportunity` por cada stage → obtiene oportunidades perdidas
3. Llama `conversations_search-conversation` + `conversations_get-messages` por cada contacto
4. Pasa los datos a `run()` y guarda el reporte en `reports/recovery-YYYY-MM-DD.md`

## Cómo correr localmente (con datos de demo)

```bash
# 1. Instalar tsx si no está
npm install -D tsx

# 2. Preparar archivo de datos (ver formato abajo)
cp scripts/recovery-mvp/demo-data.example.json /tmp/demo.json

# 3. Ejecutar
npx tsx scripts/recovery-mvp/index.ts /tmp/demo.json
```

### Formato del archivo de datos

```json
{
  "rawOpportunitiesPerStage": {
    "<stageId>": { "opportunities": [...] }
  },
  "rawMessagesPerContact": {
    "<contactId>": { "messages": { "messages": [...] } }
  }
}
```

## Stages "Perdido" mapeados (2026-05-30)

| Pipeline | Stage | IDs |
|---|---|---|
| Central GPS | Perdido | pipeline: `MNxYbS1kOg11IiU2QbMv` / stage: `2bfd0ea8...` |
| Ejemplo DEMO | Perdido | pipeline: `qT53Vm7E...` / stage: `7c3069a1...` |
| Ventas - Demo | Negocio perdido | pipeline: `bn2cknrV...` / stage: `ed11aaf3...` |

## Output

`reports/recovery-YYYY-MM-DD.md` con tabla de top 10-20 oportunidades ordenadas por `monetaryValue × (recoverability_score/100)`.

## Fase 2 (fuera de scope actual)

- Envío automático de mensajes de reactivación
- Dashboard web con histórico de scores
- Persistencia en base de datos
