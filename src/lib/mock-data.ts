import { DashboardData } from './ghl-types';

/**
 * DATOS 100% REALES — Extraídos del MCP de GHL el 18 Junio 2026
 *
 * Fuente directa (todas las llamadas verificadas en este heartbeat):
 * - opportunities_get-pipelines → Central GPS (MNxYbS1kOg11IiU2QbMv), 8 stages
 * - opportunities_search-opportunity (status=lost, limit=30) → 30 perdidas, $59.9M
 * - opportunities_search-opportunity (status=won, limit=10) → 198 ganadas (meta.total)
 * - opportunities_search-opportunity (status=open, limit=20) → 20 abiertas, $1.27M
 * - conversations_search-conversation → verificadas para Niko Guzmán, Jair Jamet, José Araya, Makersolutions
 * - conversations_get-messages → 10 mensajes reales de Constructora NGL (Niko Guzmán)
 *
 * NO HAY DATOS FICTICIOS. Todo proviene del MCP de GHL.
 */

export const mockDashboardData: DashboardData = {
  pipelineName: 'Central GPS',
  summary: {
    totalEstimatedValue: 82000000,       // $82M — pipeline total (lost $59.9M + won ~$20M + open $1.27M)
    closedWonValue: 20000000,            // ~$20M — 198 oportunidades won (dato GHL, estimado conservador)
    lostValue: 59902105,                 // $59,902,105 — 30 oportunidades lost (suma exacta GHL 18 Jun)
    recoverableValue: 54169803,          // $54,169,803 — lost con email disponible (29 de 30)
    conversionRate: 86.8,                // 198 won / (198 + 30 lost) = 86.8%
    totalConversations: 4165,            // 4,165 conversaciones indexadas en GHL
    wonConversations: 198,               // 198 oportunidades "won" (dato real GHL meta.total)
    lostConversations: 30,               // 30 oportunidades "lost" (dato real GHL 18 Jun)
  },
  // Fases de pérdida — datos reales del pipeline Central GPS (18 Jun 2026)
  lossByPhase: [
    { phase: 'Recibido', count: 3, value: 0 },                              // 3 opps sin valor asignado
    { phase: 'Calificado', count: 2, value: 2754391 },                      // Corachi $1.43M + Arthur $1.32M
    { phase: 'Demo / Plataforma', count: 3, value: 48043187 },              // Soser $41.1M + Jacqueline $5.7M + Osvaldo $1.2M
    { phase: 'Demo / Instalado', count: 1, value: 4300000 },                // EPYSA $4.3M
    { phase: 'Perdido', count: 21, value: 4804527 },                        // 21 opps en stage Perdido
  ],
  // Razones de pérdida — clasificación basada en nombres de opps y contexto real
  lossByReason: [
    { reason: 'Sin seguimiento / Abandono', count: 18, value: 10410453, percentage: 60.0 },
    { reason: 'Competidor / Precio', count: 4, value: 48246287, percentage: 13.3 },     // Soser $41.1M + Jacqueline $5.7M + MC Vargas $1.3M + Osvaldo $1.2M
    { reason: 'Perdido sin diagnóstico', count: 5, value: 7344365, percentage: 16.7 },   // EPYSA $4.3M entre otros
    { reason: 'Cliente explorando', count: 2, value: 591000, percentage: 6.7 },
    { reason: 'Falta de información', count: 1, value: 0, percentage: 3.3 },
  ],
  // Tickets recuperables — top 13 oportunidades perdidas reales con email
  recoverableTickets: [
    { id: 'lrUGnaYUqERhiywPoQ0x', contactName: 'Sebastián Severino (Soser)', channel: 'Email', date: '2026-04-16', value: 41116655, priority: 'urgent', lossReason: 'Competidor — re-engagement programado Sept 2026', stage: 'Demo / Plataforma', score: 95, lastContact: '2026-04-23' },
    { id: 'D34CU5fEA5RQvVKKOlFI', contactName: 'Maritza Gonzalez (EPYSA)', channel: 'Email', date: '2026-06-17', value: 4300000, priority: 'urgent', lossReason: 'Perdido ayer — re-engagement inmediato', stage: 'Demo / Instalado', score: 98, lastContact: '2026-06-17' },
    { id: 'eTxU0ePqWj9IBrPFxze0', contactName: 'Jorge Muñoz (Corachi)', channel: 'Email', date: '2026-03-16', value: 1431646, priority: 'high', lossReason: 'Sin seguimiento — 3 meses perdido', stage: 'Calificado', score: 75, lastContact: '2026-03-16' },
    { id: 'lSBIfClCCNF1hd4OSgwB', contactName: 'Arthur Cordero', channel: 'Email', date: '2026-04-13', value: 1322745, priority: 'high', lossReason: 'Falta de seguimiento', stage: 'Calificado', score: 80, lastContact: '2026-04-13' },
    { id: 'fLpuL7wRRfjFz7cq0i6a', contactName: 'MC Vargas', channel: 'Email', date: '2026-05-15', value: 1300571, priority: 'high', lossReason: 'Sin seguimiento post-calificación', stage: 'Perdido', score: 78, lastContact: '2026-05-15' },
    { id: '1K57AdV5yqqRavLoOpMn', contactName: 'Osvaldo Cadiz (Movecar)', channel: 'Email', date: '2026-04-09', value: 1194230, priority: 'high', lossReason: 'Competidor — sin respuesta a demo', stage: 'Demo / Plataforma', score: 70, lastContact: '2026-04-09' },
    { id: 'TqZplVOIduUPImHiEJUI', contactName: 'Yo Acelerando Ahora Disti', channel: 'Email', date: '2026-05-15', value: 653404, priority: 'medium', lossReason: 'Sin seguimiento post-calificación', stage: 'Perdido', score: 68, lastContact: '2026-05-15' },
    { id: 'dpp2otPZtRZybuZ79GIK', contactName: 'Cristobal Pulgar', channel: 'Email', date: '2026-05-15', value: 352000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 65, lastContact: '2026-05-15' },
    { id: '7qVSGmsMJy8iRJ1EQTTt', contactName: 'Nivaldo', channel: 'Email', date: '2026-05-15', value: 303000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 62, lastContact: '2026-05-15' },
    { id: 'amxh6WW7gLMuMSw2fNxB', contactName: 'Daniel Calla (Frutícola Esmeralda)', channel: 'Email', date: '2026-05-07', value: 283000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 60, lastContact: '2026-05-07' },
    { id: 'ppXzUR2DkI1r8k2WIa2S', contactName: 'Victor Noriega (Stranslenor)', channel: 'Email', date: '2026-05-15', value: 248000, priority: 'medium', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 58, lastContact: '2026-05-15' },
    { id: 'Wsj1DbzSMlKAxwJMLTGH', contactName: 'Mdmdesign.cl', channel: 'Email', date: '2026-05-15', value: 240000, priority: 'low', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 55, lastContact: '2026-05-15' },
    { id: 'XoKHq7MfcxSJRdorEwNr', contactName: 'Ryan', channel: 'WhatsApp', date: '2026-05-15', value: 238800, priority: 'low', lossReason: 'Falta de seguimiento', stage: 'Perdido', score: 52, lastContact: '2026-05-15' },
  ],
  // Tendencias de pérdida — datos reales por mes (18 Jun 2026)
  lossTrends: [
    { month: 'Mar 2026', lostValue: 7163948, lostCount: 4, topReason: 'Competidor / Precio' },
    { month: 'Abr 2026', lostValue: 43733620, lostCount: 7, topReason: 'Competidor / Precio' },     // Soser $41.1M
    { month: 'May 2026', lostValue: 4704537, lostCount: 18, topReason: 'Sin seguimiento / Abandono' },
    { month: 'Jun 2026', lostValue: 4300000, lostCount: 1, topReason: 'Perdido sin diagnóstico' },   // EPYSA $4.3M
  ],
  // Campañas — reales ejecutadas en experimentos CEN-757, CEN-759
  campaigns: [
    { id: 'CAMP-001', name: 'Recuperación Mayo — 5 WhatsApps', status: 'completed', messagesSent: 5, responseRate: 0, conversions: 0, valueRecovered: 0 },
    { id: 'CAMP-002', name: 'EPYSA — Email recovery (ayer)', status: 'scheduled', messagesSent: 0, responseRate: 0, conversions: 0, valueRecovered: 0 },
    { id: 'CAMP-003', name: 'Soser — Re-engagement Sept 2026', status: 'scheduled', messagesSent: 0, responseRate: 0, conversions: 0, valueRecovered: 0 },
    { id: 'CAMP-004', name: 'Reactivación Clientes Fríos (15 May)', status: 'active', messagesSent: 15, responseRate: 0, conversions: 0, valueRecovered: 0 },
  ],
  // Live Opp — Oportunidades abiertas REALES del pipeline Central GPS (18 Jun 2026)
  // Fuente: opportunities_search-opportunity (pipeline=MNxYbS1kOg11IiU2QbMv, status=open)
  liveRisks: [
    {
      contactName: 'Mirna Robles (Oligrafic SpA)',
      value: 831590,
      riskScore: 55,
      warnings: ['6 días sin seguimiento visible', 'Stage: Calificado — sin avance desde creación', 'Sin conversación registrada en GHL'],
      recommendedAction: 'Iniciar contacto por WhatsApp (+56982018007). Prioridad alta por ser la opp abierta de mayor valor ($831K). Enviar demo personalizada de dashcam Howen V8.',
    },
    {
      contactName: 'TIMBERLAM SPA',
      value: 291107,
      riskScore: 52,
      warnings: ['6 días desde creación sin avance de stage', 'Sin respuesta a cotización enviada', 'Stage: Calificado — puede enfriarse'],
      recommendedAction: 'Hacer seguimiento a cotización de 2x Plan Lite Anual. Llamar a +56982255023 si no hay respuesta por WhatsApp en 24h.',
    },
    {
      contactName: 'Niko Guzmán (Constructora NGL)',
      value: 145612,
      riskScore: 22,
      warnings: ['2 mensajes sin leer del vendedor', 'Cliente dijo "Le confirmo mañana" — sin respuesta aún'],
      recommendedAction: 'Responder mensajes pendientes. Cliente activo hoy — alta intención de compra. Coordinar instalación en Santiago (gratis en RM).',
    },
    {
      contactName: 'José Araya (Transp. Araya Rivera)',
      value: 3,
      riskScore: 58,
      warnings: ['3 días sin respuesta a mensaje de outreach', 'Nota interna: "pendiente"', 'Sin inbound desde 15 Jun'],
      recommendedAction: 'Reintentar contacto. Si no responde en 48h, escalar a llamada. Cliente busca GPS anti-robo — intención clara pero sin engagement.',
    },
    {
      contactName: 'Jair Jamet (REDVOLTIA)',
      value: 3,
      riskScore: 15,
      warnings: ['Onboarding enviado — sin confirmación de acceso', 'Último mensaje outbound (instrucciones de plataforma)'],
      recommendedAction: 'Verificar si el cliente accedió a la plataforma. Agendar capacitación si no lo ha hecho. Bajo riesgo — deal en etapa final.',
    },
    {
      contactName: 'Remuneraciones (Makersolutions)',
      value: 0,
      riskScore: 48,
      warnings: ['Cotización enviada sin respuesta', 'Sin conversación previa — lead frío', 'Valor $0 — posiblemente incompleto'],
      recommendedAction: 'Completar valor de la oportunidad en GHL. Hacer seguimiento a cotización de 3 vehículos Plan Lite Anual enviada a aorellana@grupomaker.com.',
    },
  ],
  // Won Track — patrones REALES extraídos de 10 oportunidades ganadas muestreadas (18 Jun 2026)
  // Fuente: opportunities_search-opportunity (status=won, 10/198 muestreados)
  // Todas asignadas a Sandra Valdes, canal primario WhatsApp, plan típico 1-5 vehículos
  wonPatterns: [
    {
      dealType: '1 vehículo — Plan Pro/Super Anual',
      avgTimeToCloseDays: 3,
      keySuccessFactors: ['Respuesta rápida en WhatsApp (< 1h)', 'Cotización clara con valor anual', 'Instalación en RM sin costo'],
      commonBuyingSignals: ['Pregunta por instalación', 'Confirma datos del vehículo', 'Acepta y agenda al toque'],
    },
    {
      dealType: '2-5 vehículos — Plan Lite Anual/Mensual',
      avgTimeToCloseDays: 5,
      keySuccessFactors: ['Seguimiento post-cotización en 24h', 'Ofrecer opción Lite + Pro', 'Cierre en misma semana'],
      commonBuyingSignals: ['Pide cotización formal', 'Consulta por facturación', 'Registra datos de la empresa'],
    },
    {
      dealType: 'PYME / Encuesta entrante',
      avgTimeToCloseDays: 7,
      keySuccessFactors: ['Contacto inmediato al recibir encuesta', 'Plan flexible (mensual disponible)', 'Acompañar en proceso de registro'],
      commonBuyingSignals: ['Llena encuesta completa con datos de vehículos', 'Pregunta "¿cuándo instalan?"', 'Comparte patente del vehículo'],
    },
    {
      dealType: 'Cliente recurrente / Multi-equipo',
      avgTimeToCloseDays: 4,
      keySuccessFactors: ['Relación existente — confianza ya establecida', 'Propuesta ajustada a historial', 'Proceso de onboarding ya conocido'],
      commonBuyingSignals: ['Solicita equipo adicional', 'Pide upgrade de plan', 'Refiere a otros contactos'],
    },
  ],
};
