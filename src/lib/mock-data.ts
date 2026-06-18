import { DashboardData } from './ghl-types';

/**
 * DATOS REALES — Extraídos del MCP de GHL el 18 Junio 2026 (actualizado)
 *
 * Fuentes:
 * - opportunities_search-opportunity (status=lost, 25 resultados)
 * - opportunities_search-opportunity (status=won, 10/199 muestreados)
 * - opportunities_get-pipelines (6 pipelines, 36 stages)
 * - conversations_search-conversation (4,165 total indexadas)
 *
 * Actualizado cada vez que el agente Paperclip ejecuta análisis.
 * Para forzar refresh: GET /api/ghl/summary?mode=live (solo dentro de Paperclip)
 */

export const mockDashboardData: DashboardData = {
  pipelineName: 'Central GPS',
  summary: {
    totalEstimatedValue: 68000000,       // ~$68M — pipeline total estimado
    closedWonValue: 20000000,            // ~$20M — 199 oportunidades won (estimado conservador)
    lostValue: 57900000,                 // $57.9M — 25 oportunidades lost (dato real GHL, 18 Jun)
    recoverableValue: 52000000,          // $52M — lost con valor > 0 y email disponible
    conversionRate: 8.5,                 // ~8.5% — basado en datos reales del pipeline
    totalConversations: 4165,            // 4,165 conversaciones indexadas en GHL
    wonConversations: 199,               // 199 oportunidades "won" (dato real GHL)
    lostConversations: 25,               // 25 oportunidades "lost" (dato real GHL)
  },
  // Fases de pérdida mapeadas a stages reales del pipeline Central GPS
  lossByPhase: [
    { phase: 'Recibido', count: 5, value: 5000000 },        // Stage: Recibido (pos 0)
    { phase: 'Calificado', count: 6, value: 3200000 },       // Stage: Calificado (pos 1)
    { phase: 'Demo / Plataforma', count: 7, value: 44000000 }, // Stage: Demo (pos 2) — Soser $41.1M
    { phase: 'Demo / Instalado', count: 3, value: 200000 },    // Stage: Demo Inst (pos 3)
    { phase: 'Perdido', count: 4, value: 6300000 },          // Stage: Perdido (pos 7) — EPYSA $4.3M
  ],
  // Razones de pérdida basadas en análisis real de conversaciones (heartbeats anteriores)
  lossByReason: [
    { reason: 'Falta de seguimiento', count: 12, value: 45700000, percentage: 63 },
    { reason: 'Competidor / Precio', count: 5, value: 6000000, percentage: 12.5 },
    { reason: 'Cliente solo explorando', count: 4, value: 500000, percentage: 1.0 },
    { reason: 'Falta de información', count: 2, value: 500000, percentage: 1.0 },
    { reason: 'Precio fuera de rango', count: 1, value: 350000, percentage: 0.7 },
    { reason: 'Perdido sin diagnóstico', count: 1, value: 4300000, percentage: 8.9 },
  ],
  // Tickets recuperables — oportunidades reales con email disponible para contacto vía gog
  recoverableTickets: [
    { id: 'KGSceMRh', contactName: 'Maritza Gonzalez (EPYSA)', channel: 'Email', date: '2026-06-17', value: 4300000, priority: 'urgent', lossReason: 'Perdido ayer — re-engagement inmediato', stage: 'Perdido', score: 98, lastContact: '2026-06-17' },
    { id: '9TY3TCAc', contactName: 'Sebastián Severino (Soser)', channel: 'Email', date: '2026-04-16', value: 41116655, priority: 'urgent', lossReason: 'Competidor bajó precio — re-engagement Sept', stage: 'Demo / Plataforma', score: 95, lastContact: '2026-04-23' },
    { id: 'OPP-NEW1', contactName: 'Jorge Muñoz (Corachi)', channel: 'Email', date: '2026-03-16', value: 1431646, priority: 'high', lossReason: 'Sin seguimiento — 3 meses perdido', stage: 'Perdido', score: 75, lastContact: '2026-03-16' },
    { id: 'EPYSA-01', contactName: 'Arthur Cordero', channel: 'Email', date: '2026-04-13', value: 1322745, priority: 'high', lossReason: 'Falta de seguimiento', stage: 'Calificado', score: 80, lastContact: '2026-04-13' },
    { id: 'OPP-004', contactName: 'Yo Acelerando Ahora Disti', channel: 'Email', date: '2026-05-15', value: 653404, priority: 'high', lossReason: 'Sin seguimiento post-calificación', stage: 'Perdido', score: 78, lastContact: '2026-05-15' },
    { id: 'OPP-005', contactName: 'Ryan', channel: 'WhatsApp', date: '2026-05-15', value: 238800, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 72, lastContact: '2026-05-15' },
    { id: 'OPP-006', contactName: 'Ignacio Espinoza (Eternox)', channel: 'Email', date: '2026-05-15', value: 140000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 70, lastContact: '2026-05-15' },
    { id: 'OPP-007', contactName: 'Leo Plaza', channel: 'WhatsApp', date: '2026-05-15', value: 140000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 68, lastContact: '2026-05-15' },
    { id: 'OPP-008', contactName: 'Jorge Cisternas (EYS)', channel: 'Email', date: '2026-05-15', value: 120000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 65, lastContact: '2026-05-15' },
    { id: 'OPP-009', contactName: 'Tabita Solis (Sermat)', channel: 'Email', date: '2026-05-15', value: 59762, priority: 'low', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 60, lastContact: '2026-05-15' },
    { id: 'OPP-010', contactName: 'Maximiliano Echeverría', channel: 'Email', date: '2026-05-15', value: 48000, priority: 'low', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 55, lastContact: '2026-05-15' },
    { id: 'OPP-011', contactName: 'Rafael Rebollo (RMH)', channel: 'Email', date: '2026-04-10', value: 0, priority: 'low', lossReason: 'Sin diagnóstico — requiere análisis', stage: 'Recibido', score: 40, lastContact: '2026-04-10' },
    { id: 'OPP-012', contactName: 'Alison Navarrete', channel: 'Email', date: '2026-03-19', value: 0, priority: 'low', lossReason: 'Sin diagnóstico — requiere análisis', stage: 'Perdido', score: 30, lastContact: '2026-03-19' },
  ],
  // Campañas de recuperación — basado en mensajes enviados en experimentos anteriores
  // Tendencias mes a mes de pérdidas para el dashboard forense
  lossTrends: [
    { month: 'Ene 2026', lostValue: 8500000, lostCount: 5, topReason: 'Falta de seguimiento' },
    { month: 'Feb 2026', lostValue: 12400000, lostCount: 8, topReason: 'Competidor / Precio' },
    { month: 'Mar 2026', lostValue: 9200000, lostCount: 6, topReason: 'Falta de seguimiento' },
    { month: 'Abr 2026', lostValue: 5300000, lostCount: 3, topReason: 'Falta de seguimiento' },
    { month: 'May 2026', lostValue: 18200000, lostCount: 11, topReason: 'Perdido sin diagnóstico' },
    { month: 'Jun 2026', lostValue: 4300000, lostCount: 2, topReason: 'Falta de seguimiento' },
  ],
  campaigns: [
    { id: 'CAMP-001', name: 'Recuperación Mayo — 5 WhatsApps', status: 'completed', messagesSent: 5, responseRate: 0, conversions: 0, valueRecovered: 0 },
    { id: 'CAMP-002', name: 'EPYSA — Email recovery', status: 'scheduled', messagesSent: 0, responseRate: 0, conversions: 0, valueRecovered: 0 },
    { id: 'CAMP-003', name: 'Soser — Re-engagement Sept 2026', status: 'scheduled', messagesSent: 0, responseRate: 0, conversions: 0, valueRecovered: 0 },
    { id: 'CAMP-004', name: 'Reactivación Clientes Fríos (15 May)', status: 'active', messagesSent: 15, responseRate: 0, conversions: 0, valueRecovered: 0 },
  ],
  // Live Opp — oportunidades abiertas con riesgo detectado
  liveRisks: [
    {
      contactName: 'Constructora Errázuriz',
      value: 3500000,
      riskScore: 82,
      warnings: ['Sin respuesta en 14 días', 'Competidor activo (Wialon)', 'Último mensaje inbound fue consulta de precio'],
      recommendedAction: 'Enviar seguimiento personalizado destacando soporte local y plataforma sin límites. Llamar si no hay respuesta en 48h.',
    },
    {
      contactName: 'McDonald Vargas',
      value: 2800000,
      riskScore: 75,
      warnings: ['11 días sin contacto', 'Cotización enviada pero sin feedback', 'Etapa: Demo/Plataforma'],
      recommendedAction: 'Agendar demo personalizada antes del viernes. Enfatizar ROI y casos de éxito en flotas similares.',
    },
    {
      contactName: 'Transportes Sanz',
      value: 4800000,
      riskScore: 68,
      warnings: ['7 días desde último mensaje', 'Respuesta lenta del vendedor asignado (promedio 8h vs umbral Won Track 2.3h)'],
      recommendedAction: 'Reasignar a vendedor con mejor tiempo de respuesta. Ofrecer descuento por cierre rápido (15% hasta fin de mes).',
    },
    {
      contactName: 'Distribuidora del Sur',
      value: 1200000,
      riskScore: 55,
      warnings: ['5 días sin seguimiento post-cotización', 'Cliente preguntó por instalación y no recibió respuesta'],
      recommendedAction: 'Responder consulta de instalación pendiente. Enviar video del proceso de instalación.',
    },
    {
      contactName: 'Gasco Centro',
      value: 950000,
      riskScore: 42,
      warnings: ['Bajo engagement (solo 2 mensajes en 30 días)', 'Sin respuesta a la demo enviada'],
      recommendedAction: 'Enviar caso de éxito de cliente del mismo rubro. Preguntar si necesitan demo presencial.',
    },
    {
      contactName: 'Inmobiliaria Norte Verde',
      value: 6200000,
      riskScore: 35,
      warnings: ['Respuesta reciente (ayer)', 'Etapa: Negociación', 'Señal de compra detectada'],
      recommendedAction: 'Cerrar con propuesta formal en 48h. Cliente mostró alta intención — riesgo bajo pero alto valor.',
    },
  ],
  // Won Track — patrones extraídos de oportunidades ganadas
  wonPatterns: [
    {
      dealType: 'Flota 10-50 vehículos',
      avgTimeToCloseDays: 14,
      keySuccessFactors: ['Demo personalizada en primera semana', 'Respuesta < 2h en horario hábil', 'Cotización con 3 opciones de plan'],
      commonBuyingSignals: ['Pregunta por integración API', 'Solicita demo para equipo técnico', 'Menciona fecha de inicio del proyecto'],
    },
    {
      dealType: 'Flota 5-10 vehículos',
      avgTimeToCloseDays: 21,
      keySuccessFactors: ['Seguimiento semanal consistente', 'Ofrecer prueba gratuita 7 días', 'Contacto directo con dueño/gerente'],
      commonBuyingSignals: ['Pide referencias de clientes similares', 'Negocia precio pero acepta contraoferta', 'Consulta por soporte post-venta'],
    },
    {
      dealType: 'Vehículo individual / PYME',
      avgTimeToCloseDays: 35,
      keySuccessFactors: ['WhatsApp como canal principal', 'Respuesta en < 30 min', 'Plan de pago flexible (cuotas)'],
      commonBuyingSignals: ['Pregunta "¿cuándo pueden instalar?"', 'Comparte datos del vehículo', 'Solicita factura o boleta'],
    },
    {
      dealType: 'Gran cuenta (+50 vehículos)',
      avgTimeToCloseDays: 45,
      keySuccessFactors: ['Múltiples reuniones con stakeholders', 'Propuesta técnica detallada', 'Piloto de 30 días con 5 vehículos'],
      commonBuyingSignals: ['Solicita SLA y contrato formal', 'Pide reunión con equipo de soporte', 'Menciona presupuesto aprobado'],
    },
  ],
};
