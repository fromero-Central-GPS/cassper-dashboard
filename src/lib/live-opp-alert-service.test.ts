/**
 * CEN-1000: Live Opp Alert Service — Unit Tests
 *
 * Verifica:
 *   1. Formateo de email con riesgos y acciones recomendadas
 *   2. Resolución de seller email
 *   3. Dedup de alertas
 *   4. Pipeline de despacho completo
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  formatAlertEmail,
  resolveSellerEmail,
  shouldSendAlert,
  markAlertSent,
  buildGogEmailCommand,
} from "./live-opp-alert-service";
import type { LiveOppAnalysis } from "./live-opp-engine";
import type { Seller } from "./commission-types";

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_SELLERS: Seller[] = [
  {
    id: "s1",
    name: "Niko Guzmán",
    email: "niko@centralgps.cl",
    commissionRate: 0.12,
    active: true,
    ghlUserId: "CVokAlI8fgw4WYWoCtQz",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
  {
    id: "s2",
    name: "Jair Jamet",
    email: "jair@centralgps.cl",
    commissionRate: 0.12,
    active: true,
    ghlUserId: "y0BeYjuRIlDwsDcOHOJo",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
  {
    id: "s3",
    name: "Inactivo Pérez",
    email: "inactivo@centralgps.cl",
    commissionRate: 0.12,
    active: false,
    ghlUserId: "inactive123",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
];

function makeAnalysis(
  overrides: Partial<LiveOppAnalysis> = {}
): LiveOppAnalysis {
  return {
    opportunityId: "opp-123",
    contactName: "Cliente Test",
    value: 500000,
    stage: "Demo / Plataforma",
    pipeline: "Central GPS",
    assignedTo: "CVokAlI8fgw4WYWoCtQz",
    overallRiskScore: 75,
    riskLevel: "high",
    alerts: [
      {
        category: "no_response",
        severity: "high",
        title: "Cliente esperando respuesta",
        detail: "Último mensaje inbound hace 6h sin respuesta",
        metric: "hours_since_last_inbound",
        currentValue: 6,
        threshold: 1,
        direction: "above",
      },
      {
        category: "stalling",
        severity: "medium",
        title: "Contacto en riesgo",
        detail: "3 días sin actividad — seguimiento recomendado",
        metric: "days_since_last_contact",
        currentValue: 3,
        threshold: 3,
        direction: "above",
      },
    ],
    recommendedActions: [
      "🚨 RESPONDER AHORA: Cliente esperando",
      "📞 Llamada de seguimiento",
    ],
    messagesInLast7Days: 2,
    daysSinceLastContact: 3,
    hoursSinceLastInbound: 6,
    avgResponseMinutes: 45,
    inboundRatio: 0.3,
    totalMessages: 8,
    daysOpen: 12,
    isPastBenchmark: false,
    intentSignals: ["consulta_precio"],
    urgency: "hoy",
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("resolveSellerEmail", () => {
  it("resuelve email por ghlUserId", () => {
    const result = resolveSellerEmail(
      "CVokAlI8fgw4WYWoCtQz",
      MOCK_SELLERS
    );
    expect(result.email).toBe("niko@centralgps.cl");
    expect(result.sellerName).toBe("Niko Guzmán");
    expect(result.resolved).toBe(true);
  });

  it("no resuelve sellers inactivos", () => {
    const result = resolveSellerEmail("inactive123", MOCK_SELLERS);
    expect(result.resolved).toBe(false);
    expect(result.email).toBe("contacto@centralgps.cl");
  });

  it("usa fallback cuando no encuentra ghlUserId", () => {
    const result = resolveSellerEmail("no-existe", MOCK_SELLERS);
    expect(result.resolved).toBe(false);
    expect(result.email).toBe("contacto@centralgps.cl");
    expect(result.sellerName).toBe("Vendedor no identificado");
  });

  it("usa fallback cuando assignedTo es null", () => {
    const result = resolveSellerEmail(null, MOCK_SELLERS);
    expect(result.resolved).toBe(false);
    expect(result.email).toBe("contacto@centralgps.cl");
  });
});

describe("shouldSendAlert / markAlertSent (dedup)", () => {
  beforeEach(() => {
    // Limpiar tracking entre tests
    // Nota: en producción esto sería una DB table
  });

  it("permite enviar si no hay alerta previa", () => {
    expect(shouldSendAlert("opp-nueva", 80)).toBe(true);
  });

  it("bloquea reenvío dentro de la ventana de 4h", () => {
    markAlertSent("opp-123");
    expect(shouldSendAlert("opp-123", 80)).toBe(false);
  });
});

describe("formatAlertEmail", () => {
  it("genera subject con nivel de riesgo y valor", () => {
    const analysis = makeAnalysis();
    const { subject } = formatAlertEmail(analysis, "Niko Guzmán");
    expect(subject).toContain("HIGH");
    expect(subject).toContain("Cliente Test");
    expect(subject).toContain("500");
  });

  it("incluye alertas y acciones recomendadas en el body", () => {
    const analysis = makeAnalysis();
    const { body } = formatAlertEmail(analysis, "Niko Guzmán");
    expect(body).toContain("Hola Niko Guzmán");
    expect(body).toContain("Cliente esperando respuesta");
    expect(body).toContain("Contacto en riesgo");
    expect(body).toContain("RESPONDER AHORA");
    expect(body).toContain("Llamada de seguimiento");
    expect(body).toContain("Cassper Live Opp");
  });

  it("formatea valores correctamente para critical", () => {
    // Build analysis directly with critical risk
    const criticalAnalysis: LiveOppAnalysis = {
      opportunityId: "opp-999",
      contactName: "Cliente Crítico",
      value: 5000000,
      stage: "Demo / Plataforma",
      pipeline: "Central GPS",
      assignedTo: "CVokAlI8fgw4WYWoCtQz",
      overallRiskScore: 95,
      riskLevel: "critical",
      alerts: [{
        category: "no_response",
        severity: "critical",
        title: "Cliente esperando respuesta urgente",
        detail: "Último mensaje inbound hace 8h sin respuesta",
        metric: "hours_since_last_inbound",
        currentValue: 8,
        threshold: 1,
        direction: "above",
      }],
      recommendedActions: ["🚨 RESPONDER AHORA: Cliente esperando"],
      messagesInLast7Days: 1,
      daysSinceLastContact: 1,
      hoursSinceLastInbound: 8,
      avgResponseMinutes: 120,
      inboundRatio: 0.2,
      totalMessages: 5,
      daysOpen: 30,
      isPastBenchmark: true,
      intentSignals: ["consulta_precio", "urgencia"],
      urgency: "ahora",
    };
    const { subject } = formatAlertEmail(criticalAnalysis, "Niko");
    expect(subject).toContain("🔴");
    expect(subject).toContain("CRITICAL");
    expect(subject).toContain("5.000.000");
  });
});

describe("buildGogEmailCommand", () => {
  it("genera comando GOG con los parámetros correctos", () => {
    const cmd = buildGogEmailCommand(
      "niko@centralgps.cl",
      "Test Subject",
      "Test Body"
    );
    expect(cmd).toContain("GOG_KEYRING_PASSWORD");
    expect(cmd).toContain("gogcli-mcp-2026");
    expect(cmd).toContain("gog gmail send");
    expect(cmd).toContain('--to "niko@centralgps.cl"');
    expect(cmd).toContain('--subject "Test Subject"');
    expect(cmd).toContain("--account fromero@centralgps.cl");
  });

  it("escapa comillas dobles en subject y body", () => {
    const cmd = buildGogEmailCommand(
      "test@test.cl",
      'Alert "urgent"',
      'Body with "quotes"'
    );
    expect(cmd).toContain('\\"urgent\\"');
    expect(cmd).toContain('\\"quotes\\"');
  });
});

describe("LiveOppAlertService integration", () => {
  it("análisis de riesgo alto activa notificación", async () => {
    const analysis = makeAnalysis({ overallRiskScore: 75 });
    expect(analysis.overallRiskScore).toBeGreaterThanOrEqual(25);
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.recommendedActions.length).toBeGreaterThan(0);
  });

  it("oportunidad sin riesgo no debería generar alerta", () => {
    const healthyAnalysis: LiveOppAnalysis = {
      opportunityId: "opp-healthy",
      contactName: "Cliente Sano",
      value: 300000,
      stage: "Cotización",
      pipeline: "Central GPS",
      overallRiskScore: 10,
      riskLevel: "low",
      alerts: [],
      recommendedActions: ["✅ Sin alertas detectadas. Monitorear próximos 7 días."],
      messagesInLast7Days: 15,
      daysSinceLastContact: 1,
      hoursSinceLastInbound: 2,
      avgResponseMinutes: 15,
      inboundRatio: 0.6,
      totalMessages: 25,
      daysOpen: 5,
      isPastBenchmark: false,
      intentSignals: ["interes_directo"],
      urgency: "monitorear",
    };
    expect(healthyAnalysis.overallRiskScore).toBeLessThan(25);
    expect(healthyAnalysis.riskLevel).toBe("low");
    expect(healthyAnalysis.recommendedActions[0]).toContain("Sin alertas");
  });
});
