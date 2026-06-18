import { NextResponse } from 'next/server';
import {
  analyzeConversation,
  generateBatchSummary,
  type GHLConversationInput,
  type BatchAnalysisResult,
} from '@/lib/analysis-engine';

/**
 * GET /api/ghl/forensics
 *
 * Devuelve datos de análisis forense profundo — por conversación.
 * Complementa /api/ghl/summary con el output completo del analysis-engine.
 *
 * Modos:
 * - ?mode=mock → datos mock generados dinámicamente desde el engine
 * - ?mode=live → requiere Paperclip runtime con MCP
 */

// ─── Mock conversaciones representativas del pipeline Central GPS ─────────

const MOCK_MESSAGES = [
  { id: 'm1', direction: 'outbound' as const, body: 'Hola, gracias por contactar a Central GPS. ¿En qué puedo ayudarte?', messageType: 'TYPE_SMS', dateAdded: '2026-06-10T10:00:00Z' },
  { id: 'm2', direction: 'inbound' as const, body: 'Hola, me interesa el servicio de rastreo para una flota de 5 camiones', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:05:00Z' },
  { id: 'm3', direction: 'outbound' as const, body: 'Perfecto. Te puedo ofrecer nuestro plan Pro con reportes en tiempo real.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:10:00Z' },
  { id: 'm4', direction: 'outbound' as const, body: 'El valor es de $45.000 mensuales por equipo, incluye plataforma y soporte.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:12:00Z' },
  { id: 'm5', direction: 'inbound' as const, body: 'Ok, gracias por la información. Lo voy a evaluar con mi jefe.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-10T10:15:00Z' },
  { id: 'm6', direction: 'inbound' as const, body: 'Hola, quería saber los precios de los equipos GPS', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-20T09:00:00Z' },
  { id: 'm7', direction: 'outbound' as const, body: '¡Hola! Claro, tenemos desde $120.000 el equipo básico.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-20T09:05:00Z' },
  { id: 'm8', direction: 'inbound' as const, body: 'Está muy caro, en Wialon me ofrecieron algo similar por menos.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-20T09:10:00Z' },
  { id: 'm9', direction: 'outbound' as const, body: 'Entendible. Nuestra diferencia es el soporte local y la plataforma sin límites.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-20T09:15:00Z' },
  { id: 'm10', direction: 'inbound' as const, body: 'Lo vamos a pensar. Gracias.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-05-20T09:20:00Z' },
  { id: 'm11', direction: 'outbound' as const, body: 'Buenos días, ¿pudo revisar la cotización que le enviamos?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-01T11:00:00Z' },
  { id: 'm12', direction: 'inbound' as const, body: 'Sí, aún no tomo una decisión. Avísame si hay algún descuento.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-01T11:05:00Z' },
  { id: 'm13', direction: 'outbound' as const, body: 'Le ofrecemos 15% descuento si contrata antes del 15 de junio.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-02T10:00:00Z' },
  { id: 'm14', direction: 'inbound' as const, body: 'No me alcanza el presupuesto para este mes, muy caro para mi empresa.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-02T10:30:00Z' },
  { id: 'm15', direction: 'outbound' as const, body: 'Tenemos planes más económicos desde $20.000 mensuales.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-02T10:35:00Z' },
  { id: 'm16', direction: 'inbound' as const, body: 'Solo estaba cotizando, más adelante les escribo.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-06-02T10:40:00Z' },
  { id: 'm17', direction: 'outbound' as const, body: 'Buenas tardes, ¿cómo va el proyecto? Nos interesa seguir ayudándole.', messageType: 'TYPE_EMAIL', dateAdded: '2026-05-10T15:00:00Z' },
  { id: 'm18', direction: 'inbound' as const, body: 'Hola, disculpa la demora. El proyecto está en pausa.', messageType: 'TYPE_EMAIL', dateAdded: '2026-05-10T15:30:00Z' },
  { id: 'm19', direction: 'outbound' as const, body: 'Sin problema. Quedamos atentos para cuando reactiven.', messageType: 'TYPE_EMAIL', dateAdded: '2026-05-10T15:35:00Z' },
  { id: 'm20', direction: 'inbound' as const, body: 'Necesito información sobre integración con su API para nuestro software', messageType: 'TYPE_EMAIL', dateAdded: '2026-04-20T14:00:00Z' },
  { id: 'm21', direction: 'outbound' as const, body: 'Le envío la documentación de nuestra API REST.', messageType: 'TYPE_EMAIL', dateAdded: '2026-04-20T14:10:00Z' },
  { id: 'm22', direction: 'inbound' as const, body: 'Gracias. ¿Tienen SDK para Python?', messageType: 'TYPE_EMAIL', dateAdded: '2026-04-20T14:15:00Z' },
  { id: 'm23', direction: 'outbound' as const, body: 'Sí, tenemos SDK en Python, Java y Node.js. Le comparto ejemplos.', messageType: 'TYPE_EMAIL', dateAdded: '2026-04-20T14:20:00Z' },
  { id: 'm24', direction: 'inbound' as const, body: 'Excelente. Reviso y te confirmo si me sirve.', messageType: 'TYPE_EMAIL', dateAdded: '2026-04-20T14:25:00Z' },
  { id: 'm25', direction: 'inbound' as const, body: 'Hola, vi el demo en la página. ¿Puedo agendar una demo personalizada?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-10T09:00:00Z' },
  { id: 'm26', direction: 'outbound' as const, body: 'Claro, ¿qué día le queda mejor?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-10T09:05:00Z' },
  { id: 'm27', direction: 'inbound' as const, body: 'El jueves a las 11am', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-10T09:10:00Z' },
  { id: 'm28', direction: 'outbound' as const, body: 'Confirmado. Le enviamos el link de zoom.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-10T09:15:00Z' },
  { id: 'm29', direction: 'inbound' as const, body: 'Hola, hace tiempo que no tengo noticias. ¿Sigue vigente la cotización?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-15T16:00:00Z' },
  { id: 'm30', direction: 'outbound' as const, body: '¡Claro que sí! Le actualizo los valores hoy.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-15T16:30:00Z' },
  { id: 'm31', direction: 'inbound' as const, body: 'Ya contraté con otra empresa. Gracias de todas formas.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-20T10:00:00Z' },
  { id: 'm32', direction: 'outbound' as const, body: 'Entendemos. Si necesita algo en el futuro, aquí estamos.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-20T10:05:00Z' },
  { id: 'm33', direction: 'inbound' as const, body: 'No saben cómo funciona el sistema para una flota mixta. ¿Podrían explicarme?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:00:00Z' },
  { id: 'm34', direction: 'outbound' as const, body: 'Con gusto. Nuestra plataforma soporta camiones, autos y motos en una misma cuenta.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:10:00Z' },
  { id: 'm35', direction: 'inbound' as const, body: 'Pero es muy caro para 10 vehículos. No me conviene.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:20:00Z' },
  { id: 'm36', direction: 'outbound' as const, body: 'Entiendo, podemos ajustar el plan a sus necesidades.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-01T11:25:00Z' },
];

// Conversaciones mock representativas para el demo del engine
function buildMockConversations(): GHLConversationInput[] {
  return [
    {
      id: 'CONV-SOSER', contactId: 'c1', contactName: 'Sebastián Severino (Soser)',
      email: 'severino@soser.cl', phone: '+56912345678',
      lastMessageDate: Date.now() - 56 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'No me alcanza el presupuesto',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'high-value'],
      messages: [MOCK_MESSAGES[6], MOCK_MESSAGES[7], MOCK_MESSAGES[8], MOCK_MESSAGES[9], MOCK_MESSAGES[10], MOCK_MESSAGES[11], MOCK_MESSAGES[12], MOCK_MESSAGES[13], MOCK_MESSAGES[14], MOCK_MESSAGES[15]],
    },
    {
      id: 'CONV-EPYSA', contactId: 'c2', contactName: 'Maritza Gonzalez (EPYSA)',
      email: 'mgonzalez@epysa.cl', phone: '+56987654321',
      lastMessageDate: Date.now() - 1 * 86400000,
      lastMessageType: 'TYPE_EMAIL', lastMessageBody: 'El proyecto está en pausa',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'follow-up'],
      messages: [MOCK_MESSAGES[17], MOCK_MESSAGES[18], MOCK_MESSAGES[19]],
    },
    {
      id: 'CONV-CORACHI', contactId: 'c3', contactName: 'Jorge Muñoz (Corachi)',
      email: 'jmunoz@corachi.cl', phone: '+56911223344',
      lastMessageDate: Date.now() - 94 * 86400000,
      lastMessageType: 'TYPE_EMAIL', lastMessageBody: 'Reviso y te confirmo',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'cold'],
      messages: [MOCK_MESSAGES[20], MOCK_MESSAGES[21], MOCK_MESSAGES[22], MOCK_MESSAGES[23], MOCK_MESSAGES[24]],
    },
    {
      id: 'CONV-ETERNOX', contactId: 'c4', contactName: 'Ignacio Espinoza (Eternox)',
      email: 'iespinoza@eternox.cl', phone: '+56955443322',
      lastMessageDate: Date.now() - 34 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'Ya contraté con otra empresa',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'competitor'],
      messages: [MOCK_MESSAGES[25], MOCK_MESSAGES[26], MOCK_MESSAGES[27], MOCK_MESSAGES[28], MOCK_MESSAGES[29], MOCK_MESSAGES[30], MOCK_MESSAGES[31], MOCK_MESSAGES[32]],
    },
    {
      id: 'CONV-SERMAT', contactId: 'c5', contactName: 'Tabita Solis (Sermat)',
      email: 'tsolis@sermat.cl', phone: '+56999887766',
      lastMessageDate: Date.now() - 78 * 86400000,
      lastMessageType: 'TYPE_WHATSAPP', lastMessageBody: 'No me conviene para 10 vehículos',
      lastMessageDirection: 'inbound', unreadCount: 0,
      tags: ['lost', 'price-sensitive'],
      messages: [MOCK_MESSAGES[33], MOCK_MESSAGES[34], MOCK_MESSAGES[35]],
    },
  ];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'mock';

  if (mode === 'mock') {
    const conversations = buildMockConversations();
    const opps = conversations.map((c, i) => ({
      id: `OPP-FORENSIC-${i + 1}`,
      name: c.contactName,
      contactId: c.contactId,
      contactName: c.contactName,
      monetaryValue: [41116655, 4300000, 1431646, 140000, 59762][i],
      pipelineId: 'central-gps',
      pipelineStageId: 'lost-stage',
      pipelineStageName: 'Perdido',
      status: 'lost' as const,
      createdAt: '2026-01-15T00:00:00Z',
    }));

    const analyses = conversations.map((conv, i) =>
      analyzeConversation(conv, opps[i])
    );

    const batchResult: BatchAnalysisResult = generateBatchSummary(analyses, 'central-gps', 'Central GPS');

    return NextResponse.json({
      batchResult,
      _meta: {
        mode: 'mock',
        analyzedAt: new Date().toISOString(),
        conversationCount: conversations.length,
        note: 'Mock forense generado dinámicamente por el analysis-engine. Usa ?mode=live en Paperclip para análisis real.',
      },
    });
  }

  // Live mode requiere Paperclip runtime
  if (mode === 'live') {
    return NextResponse.json({
      error: 'Live mode requires Paperclip runtime with MCP access',
      hint: 'Run this from a Paperclip agent heartbeat',
    }, { status: 501 });
  }

  return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
}
