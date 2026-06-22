/**
 * append-forensics-cache.ts
 *
 * Appends 5 new high-value lost opportunities to the forensics cache.
 * Run after fetching real conversation messages from GHL MCP.
 *
 * Usage: npx tsx scripts/append-forensics-cache.ts
 */

import { readForensicsCache, writeForensicsCache, buildForensicsCache } from '@/lib/forensics-cache';
import type { ForensicsCacheEntry } from '@/lib/forensics-cache';
import type { GHLConversationInput, GHLOpportunityInput, GHLMessage } from '@/lib/analysis-engine';

const CENTRAL_GPS_PIPELINE = {
  id: 'MNxYbS1kOg11IiU2QbMv',
  name: 'Central GPS',
};

interface McpRawMessage {
  id: string;
  direction: string;
  body: string;
  messageType: string;
  dateAdded: string;
  conversationId?: string;
}

function buildMessage(m: McpRawMessage): GHLMessage {
  return {
    id: m.id,
    direction: m.direction as 'inbound' | 'outbound',
    body: m.body,
    messageType: m.messageType,
    dateAdded: m.dateAdded,
  };
}

function buildConversation(
  convId: string,
  contactId: string,
  contactName: string,
  msgs: McpRawMessage[],
  email?: string,
  phone?: string,
): GHLConversationInput {
  const sorted = [...msgs].sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  );
  const lastMsg = sorted[0];

  return {
    id: convId,
    contactId,
    contactName,
    email: email || undefined,
    phone: phone || undefined,
    lastMessageDate: lastMsg ? new Date(lastMsg.dateAdded).getTime() : Date.now(),
    lastMessageType: lastMsg?.messageType || 'TYPE_SMS',
    lastMessageDirection: (lastMsg?.direction as 'inbound' | 'outbound') || 'inbound',
    lastMessageBody: lastMsg?.body || '',
    unreadCount: 0,
    messages: msgs.map(buildMessage),
  };
}

interface OppInput {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  pipelineStageName: string;
  status: string;
  createdAt: string;
}

interface DataEntry {
  opp: OppInput;
  convId: string;
  msgs: McpRawMessage[];
  email?: string;
  phone?: string;
}

const DATA: DataEntry[] = [
  // 1. Osvaldo Cadiz — $1,194,230 — Movecar Pro
  {
    opp: {
      id: '1K57AdV5yqqRavLoOpMn',
      name: 'Osvaldo Cadiz',
      contactId: 'YkgzW0pN7z0MLX0tF81j',
      contactName: 'Osvaldo Cadiz',
      monetaryValue: 1194230,
      pipelineId: 'MNxYbS1kOg11IiU2QbMv',
      pipelineStageId: '62d38776-ffcf-42ed-9ae3-95537c8bb3dc',
      pipelineStageName: 'Demo / Plataforma',
      status: 'lost',
      createdAt: '2026-03-04T15:26:01.826Z',
    },
    convId: '5lJqVOUU4t6wk25rcYEh',
    email: 'osvaldo.cadiz@movecar.pro',
    phone: '+56935967655',
    msgs: [
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'nRlzG1jX0W3ULOVlCXBx', direction: 'inbound', body: 'Buenas tardes,\n\nSoy Osvaldo Cádiz de MOVECAR.\n\nSomos una empresa de arriendo de vehículos y estamos iniciando operación con una flota de 5 vehículos, con proyección de crecimiento a 20 hacia fin de año y aproximadamente 100 el próximo año.\n\nQuisiera solicitar cotización para:\n• Plataforma de gestión de flota\n• GPS con telemetría en tiempo real\n• Dashboard con KPIs operativos\n• Integración tecnológica con sistema propio\n\nQuedo atento a la información y a coordinar una reunión si es necesario.\n\nMuchas gracias.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:22:26.309Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: '6dwRSQsWArFhbl1rgnrT', direction: 'outbound', body: 'te estoy transfiriendo con Bernardita que te ayudará con la cotización', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:22:42.299Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'EfdJbGeInrVI0ykS5k6d', direction: 'inbound', body: 'ok gracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:23:13.680Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'jZELa8KEW4fCCy4Iuwxu', direction: 'outbound', body: 'Hola, Osvaldo, cómo estás? Hablas con Bernardita', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:32:02.605Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'cgouBavhxUpyjPQmQEO0', direction: 'inbound', body: 'Bien gracias\nOk', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:38:01.424Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'i08gGu0SZTvV6pH5NC6C', direction: 'outbound', body: 'Perfecto, nuestro plan Pro cumple con tus requerimientos: \n\n- Plataforma y app móvil para monitoreo y gestión de flota\n- GPS con telemetría en tiempo real\n- Dashboard con métricas de conducción (acá te preguntaría qué KPIs necesitan)\n- Integraciones incluidas, sin costo en caso de tener que desarrollar', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:42:11.888Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'AX0E5HV5P7jxVJE2MWTz', direction: 'outbound', body: 'Te parece si nos reunimos 15 minutos para que me cuentes un poco más sobre lo que andas buscando y mostrarte la plataforma? Tengo disponibilidad mañana a las 12:30, te acomoda?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:43:48.857Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'jYe9tv1pDLVlBPg23ZgL', direction: 'inbound', body: 'ok, enviame cita  osvaldo.cadiz@movecar.pro\nGracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:52:37.910Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'eGxx2K9B5Shsr08zcjdn', direction: 'outbound', body: 'Agendo la reunión para mañana a las 12:30 online?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:54:39.176Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: '4rixB9k5U6vD5udnqUPK', direction: 'outbound', body: 'Por mientras te adelanto que el valor del plan es de 0,5 UF + IVA mensual por vehículo, incluyendo el GPS en comodato', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:55:18.820Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'mPSxxW8uvTnGh3oRFr2S', direction: 'outbound', body: 'Dónde están ubicados los vehículos?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:55:31.694Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'uohPr2UaY46cgB5BA9Gt', direction: 'outbound', body: 'Disculpa, leí mal tu mensaje. Acabo de enviar la invitación a tu email osvaldo.cadiz@movecar.pro', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T18:59:21.724Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'QEtVURRuUxZlV6VMZ0Ea', direction: 'inbound', body: 'Si por favor', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T19:08:59.305Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: '6hWjqBAfqNVHlx7Lhhx7', direction: 'inbound', body: 'Ok nos vemos mañana', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T19:09:07.438Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'iVjtePxiJ7j6SymUWPzJ', direction: 'outbound', body: 'Nos vemos mañana, saludos!', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T19:50:57.926Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: '2MFR1FmahzaRyOgILPOw', direction: 'inbound', body: '👍🏻', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-03-03T19:51:18.573Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'IyQoiW0O0uNoh30F1ueQ', direction: 'outbound', body: 'Hola, cómo estás?\n\nHablas con Bernardita de Central GPS 😊', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-09T15:26:23.620Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'TGWJDFpVgV5I9PUCSr6C', direction: 'outbound', body: 'Buen día, Osvaldo, espero que esté todo bien.\n\nTe escribo para saber si has tenido tiempo de revisar nuestra propuesta', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-09T15:37:14.007Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'MrmYmFJizQAhZH3MyFyr', direction: 'inbound', body: 'Hola Bernardita! 😊\nSí, estuve revisando la propuesta, muchas gracias por el envío.\nTodavía estoy en proceso de decisión con otros proveedores, así que debería estar definiendo durante este mes o a principios del próximo.\nApenas tenga novedades te aviso.\nGracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-09T15:39:14.562Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'XNo0PRUGkpSouXEV7FmX', direction: 'outbound', body: 'Perfecto, muchas gracias!\nQue tengas un buen día, saludos 😊', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-09T15:40:02.359Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: '8TUFVx0h8BAIt1ggObgN', direction: 'inbound', body: 'Igual tu!!!', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-09T15:40:20.833Z' },
      { conversationId: '5lJqVOUU4t6wk25rcYEh', id: 'o7LwjOH4TN11l4NsUiSe', direction: 'outbound', body: 'Gracias 😀', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-04-09T15:41:21.615Z' },
    ],
  },

  // 2. Jorge Caverlotti — $2,160,095
  {
    opp: {
      id: 'v9vWkigwRRLkk8tAQmUR',
      name: 'Jorge Caverlotti',
      contactId: 'E1U52tMIfLufWok91sZg',
      contactName: 'Jorge Caverlotti',
      monetaryValue: 2160095,
      pipelineId: 'MNxYbS1kOg11IiU2QbMv',
      pipelineStageId: 'dc05554e-7ed7-47d0-bb07-90d8fe1c829a',
      pipelineStageName: 'Calificado',
      status: 'lost',
      createdAt: '2026-01-16T18:12:11.939Z',
    },
    convId: 'm1Zwbxv583C79blgMpwd',
    email: 'jorgesoho_22@hotmail.com',
    phone: '+56937233813',
    msgs: [
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'da5cFLn1iGkJdSYICjN2', direction: 'inbound', body: 'Menos', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:09:30.580Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'qAPaVO954IK3GNyoZ8Ck', direction: 'inbound', body: 'De una semaba', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:09:33.274Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '2tQDrx6Ba7aUeMEZMhd6', direction: 'inbound', body: 'A lo mas 2 dias', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:09:40.057Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'odco3fF2Zzji9q4A30PN', direction: 'outbound', body: 'Perfecto, 2 días. Cuántas horas diarias están encendidos los buses?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:10:24.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'bA0HoqckHJBlDggG3nGV', direction: 'outbound', body: 'Perfecto, muchas gracias por la información', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:23:02.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'LQeiVEbkJSpkmxm8sbJI', direction: 'outbound', body: 'De todas maneras podemos ayudarte, nuestro plan de VSS (para monitoreo en tiempo real de las cámaras) funciona super bien, sin desfaces o intermitencias en la transmisión', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:25:30.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '6emyV9mV0h26kOfYJdcl', direction: 'outbound', body: 'Me podrías comentar dónde están ubicados tus buses, por favor?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:25:49.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'Hs6QYtEOG5l0cYCRHfJA', direction: 'inbound', body: 'Stgo', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:26:11.717Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'yIOkQygS8rQoJV3w0fmN', direction: 'outbound', body: 'Perfecto, la instalación en la región Metropolitana es gratuita', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:26:46.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'APXcfb20wug7mmvZDB5D', direction: 'outbound', body: 'Quieres que te envíe una cotización solo considerando una cámara? (cabina de conductor)', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:27:19.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'qQoWyzcoFSRu2luX5F2h', direction: 'inbound', body: 'Si', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:27:30.668Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'zrFPAwhmQtnJ6mdK0bjl', direction: 'outbound', body: 'Perfecto, te envío la información dentro de la tarde.\n\nPor mientras te adelanto que el plan de VSS tiene el valor de 0,99 + IVA por vehículo mensual', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:28:35.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'xooakZWqC6gDF20AAjEt', direction: 'inbound', body: 'Cuanto', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:29:08.478Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'Ny14ZgOI6KYD6EgjlgMp', direction: 'inbound', body: 'Es eso', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:29:11.460Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '6RpcV5KpPjln02Zz2Gsf', direction: 'outbound', body: 'Según el valor de la UF de hoy son 46.668 por vehículo mensual', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:34:27.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'tAauozVfPa8DymKHR8WR', direction: 'inbound', body: 'Mas iva', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:34:49.342Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'm3cOZlq6iWcrft6F5huV', direction: 'inbound', body: 'Osea es el arriendo del equipo sale eso', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:35:13.094Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'HzaMkc94S692imf22ZTB', direction: 'outbound', body: 'Este valor incluye el IVA', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:35:37.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '8J0l7gGsD4EMYzxZz0ID', direction: 'outbound', body: 'Ese valor es el valor del plan mensual que permite la transmisión en tiempo real', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:36:36.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'E82seQHp1RQiI31HFYS4', direction: 'inbound', body: 'Esta un poco alta', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:37:46.346Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'QJLJPRBbnd88lKjHDQHj', direction: 'inbound', body: 'En comparación a otras empresas', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:37:55.970Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'IfVzf2qCkhSXzL3cXsN2', direction: 'outbound', body: 'Entiendo que en comparación a otras empresas pueda ser elevado, pero la calidad de la transmisión, los planes de conectividad que utilizamos y la plataforma son los mejores del mercado', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:41:06.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '8Mp4HeDs3v469wqFjbP3', direction: 'inbound', body: 'K empresa de telecomunicaciones', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:43:02.867Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'He2V0qRYGvpoaFbi4RRs', direction: 'inbound', body: 'Es', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T18:43:03.535Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'RoExDJR6hRyxYK28lMmE', direction: 'outbound', body: 'Dame un momento, por favor', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:13:55.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'zQ8cAMPF2wT2TlO6pbQw', direction: 'outbound', body: 'Trabajamos con Entel, que es la compañía con mejor conectividad a lo largo de Chile y especialmente en la región Metropolitana', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:21:00.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'Ibz3LkabsK7F9rms96nj', direction: 'inbound', body: 'Bueno te aviso cualquier novedad igual estoy cotizando en otras empresas', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:21:56.562Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'Fu3ewYEQbGITnD0rHbRF', direction: 'inbound', body: 'Tiempo mínimo de contrato cuanto es', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:22:39.825Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '712QAk4NVtXrp9hPHgsm', direction: 'inbound', body: 'O en cualquier momento se puede dar de bajs', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:22:54.490Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'nYV6V4PZyRPpsE6FN7z1', direction: 'inbound', body: 'El servicio', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:23:02.630Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'jvsQHeibT9xSbRfJT7N0', direction: 'outbound', body: 'El contrato es anual, pero puedes darlo de baja en el momento que estimes conveniente avisando con 30 días de anticipación', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-16T20:26:18.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '2dxn3Q0jpAOxmeN6VtJz', direction: 'outbound', body: 'Hola, cómo estás?\n\nHablas con Bernardita de Central GPS 😊', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-19T19:19:34.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'kcRHNiWz5FXJoZvuPljn', direction: 'outbound', body: 'Hola, somos el equipo de Central GPS\n\nHablas con Berna, ¿cómo estás?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-09T16:22:49.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'N4hiuATlPl3N5Wwxv3eK', direction: 'inbound', body: 'Hola', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-09T16:37:50.014Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: '9TdQuq4vX7ZqhMBnPxN8', direction: 'inbound', body: 'Cuenteme', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-09T16:37:53.125Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'dcSMxlZvUUXDLAVEdYMo', direction: 'outbound', body: 'Buenas tardes, Jorge. Te escribo para saber si pudiste revisar la cotización por las cámaras?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-09T16:49:12.000Z' },
      { conversationId: 'm1Zwbxv583C79blgMpwd', id: 'An3InC9pDmOYJeL4TOmO', direction: 'outbound', body: 'Podemos reunirnos 20 minutos online para aclarar dudas y mostrarte cómo funciona nuestro sistema', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-09T16:50:53.000Z' },
    ],
  },

  // 3. Victor Fuentes — $1,906,383 — RIA Austral
  {
    opp: {
      id: 'mvfGHWB5y2YLiGXMclFT',
      name: 'Victor Fuentes',
      contactId: 'AUtQILGfUoF2bP2H32sY',
      contactName: 'Victor Fuentes',
      monetaryValue: 1906383,
      pipelineId: 'MNxYbS1kOg11IiU2QbMv',
      pipelineStageId: 'dc05554e-7ed7-47d0-bb07-90d8fe1c829a',
      pipelineStageName: 'Calificado',
      status: 'lost',
      createdAt: '2026-01-23T14:20:00.454Z',
    },
    convId: 'ROJr1jrZe9nhVHQyXokA',
    email: 'vfuentes@riaaustral.com',
    phone: '+56997485566',
    msgs: [
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'lshNwv6TIL3l2oLLLdrW', direction: 'inbound', body: 'Hola, quiero más información del servicio', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:39:22.892Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: '2H4xvBVgSmnyktc7joh4', direction: 'outbound', body: 'Perfecto. Central GPS ofrece monitoreo en tiempo real de vehículos, integración con sistemas logísticos y reportes personalizados. ¿Te interesa para flota, vehículo particular o cámaras?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:39:35.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'oziEXN2FiEOzHvHHZRj0', direction: 'inbound', body: 'me gustaría saber los valores', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:39:38.303Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'alagSDI5jSALSsAgG6lF', direction: 'outbound', body: 'Claro. Para entregarte los valores exactos, ¿me puedes indicar cuántos vehículos necesitas monitorear, en qué comuna están y para qué necesitas el servicio? Así te envío la cotización adecuada.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:39:51.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'ckufMSa9oBbbXnC8aPs9', direction: 'inbound', body: 'son 6 camionetas y dos furgones', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:40:24.487Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: '2eFnl6VBp6RFZiyUKxac', direction: 'outbound', body: 'Gracias por el detalle. ¿En qué comuna están ubicadas las camionetas y furgones? Además, ¿qué problema necesitas resolver con el GPS? Así te envío la propuesta adecuada.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:40:35.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'itSNYAiLpGhoYHW2WE1H', direction: 'inbound', body: 'estamos ubicados en llanquihue', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:41:06.705Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'Piquagc5vdGonvo9dRgp', direction: 'outbound', body: 'Entendido, están en Llanquihue. ¿Me puedes contar qué problema necesitas resolver con el GPS? Así te envío la propuesta más adecuada para tu flota.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:41:16.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'Gqc86GyIx2deC6c4AheW', direction: 'inbound', body: 'necsito saber  los recorridos', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:41:58.105Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: '3bQ2LZNJIXA4ILokCJW1', direction: 'outbound', body: 'Con Central GPS puedes monitorear en tiempo real los recorridos de tus vehículos, ver rutas, trayectos y acceder a reportes detallados desde la plataforma web o app.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:42:09.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'l1f3dynk0NoYByzzrKwl', direction: 'inbound', body: 'perfecto', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:42:26.537Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'qKNEUha5QkT5mAzJ5lol', direction: 'outbound', body: 'Perfecto. Para enviarte una cotización formal, ¿me puedes indicar el RUT de la empresa y un correo electrónico de contacto? Así te hago llegar toda la información detallada.', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:42:36.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'LuK4dm9qU7gUYsKJUmJ4', direction: 'inbound', body: 'me gustaria hablar con un ejecutivo', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:43:13.476Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'ebw8EPL2twLMchR5ghMK', direction: 'outbound', body: 'Te estoy transfiriendo con Sandra que te ayudará con la cotización', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:43:25.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'NmAhMMZE1KW1IRZXZQ5D', direction: 'outbound', body: 'Hola, Víctor, cómo estás? Hablas con Bernardita', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:49:41.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'bHV7NWFxaxL4liAi19Or', direction: 'outbound', body: 'Te parece bien que hablemos por acá o prefieres que te llame?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:50:12.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'eWYfBD2ZUP29Z8ZcYmwV', direction: 'inbound', body: 'mejor que me llame', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:54:59.827Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'W796URNhYsVem0N246ZW', direction: 'outbound', body: 'Perfecto, por favor dame unos 10 minutos y te llamo', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:56:35.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'dog4w531DCN5bNg7ZAPA', direction: 'inbound', body: 'ok', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T13:57:58.791Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'o1K0c5zl9yZchgBjGGWJ', direction: 'outbound', body: 'Víctor te voy a llamar ahora desde el número +56952222677', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T14:18:26.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'MRLeicnuVMwLO94rXRRP', direction: 'inbound', body: 'Un minuto porfa', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T14:18:53.443Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'attCNpOCIiak3Umnq8hy', direction: 'outbound', body: 'Claro, avísame cuando puedas hablar y te llamo', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T14:19:07.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'vJZ1ihAlSZ5Yl3iC47Xi', direction: 'inbound', body: 'Razón Social RiaAustral\nGiro Venta de productos de mar\nRut 77381500-3\nf/c 997485566\ndirección Avn Vicente Perez Rosales 713, Llanquigue', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T15:31:17.765Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'F6wJNK9kS1WkCx73ZvNA', direction: 'outbound', body: 'Muchas gracias, te cuento cuando tenga toda la información por mi lado', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-23T16:11:27.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'ZjhEyjS8koA84hHB7ZVX', direction: 'outbound', body: 'Hola, cómo estás?\n\nHablas con Bernardita de Central GPS 😊', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-01-29T16:30:02.000Z' },
      { conversationId: 'ROJr1jrZe9nhVHQyXokA', id: 'GHjz4bo5yYAJHQiINWPj', direction: 'outbound', body: 'Hola, somos el equipo de Central GPS\nHablas con Berna, ¿cómo estás?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-04T12:08:09.000Z' },
    ],
  },

  // 4. Sebastian Quiroga Transworld — $1,200,000
  {
    opp: {
      id: 'mQuc4mAdc9Y5zU4DTZ7q',
      name: 'Sebastian Quiroga Transworld',
      contactId: 'KmKV7smlfOV01rnwmgCe',
      contactName: 'Sebastian Quiroga Transworld',
      monetaryValue: 1200000,
      pipelineId: 'MNxYbS1kOg11IiU2QbMv',
      pipelineStageId: '2bfd0ea8-b816-4e1c-88de-4d25e2b535fb',
      pipelineStageName: 'Perdido',
      status: 'lost',
      createdAt: '2025-12-16T14:22:40.967Z',
    },
    convId: 'lGOFuAGluXgOYRPi0wTP',
    email: 'squiroga@transworld.cl',
    phone: '+56961925635',
    msgs: [
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: '5qYoAuIgTNMVKHvkfNlI', direction: 'inbound', body: 'Hola buenas tardes', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:16:29.799Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: '0vHsdHqKEUpPW2IXC96i', direction: 'outbound', body: '¡Hola! 👋 Bienvenido a Central GPS. Hablas con Alicia, cuéntame cómo te puedo ayudar?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:16:44.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'cTufKF9vo6IsBiKPA7Qm', direction: 'inbound', body: 'Me gustaria saber el costo de instalación de cámaras Dashcam', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:17:34.292Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: '32OU5zqACrbZgQin5UlJ', direction: 'outbound', body: 'El costo de instalación de cámaras Dashcam depende del tipo de vehículo y la cantidad de cámaras. ¿A qué tipo de vehículo quieres instalarle la cámara?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:17:51.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'gcAyvyPDPcFilALHQgNR', direction: 'inbound', body: 'Maxus eDeliver 3\nChevrolet Isuzu NPR 816', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:21:12.266Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'mEshsdECZpUjdPfy0Yo7', direction: 'inbound', body: 'Son solo dos vehiculos', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:21:24.984Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: '601mMQQ5NioRggPj1t3c', direction: 'outbound', body: 'Perfecto, ¿qué te gustaría grabar con las cámaras? Por ejemplo, la cabina, el frente o la carga. Así te puedo orientar mejor con la cotización.', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:21:42.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'yffp5IxfCqUBaA0KFjlt', direction: 'inbound', body: 'Idealmente cabina y al exterior del vehiculo (Frente)', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:22:45.412Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'lqxsL65iHM2m5EalqD89', direction: 'inbound', body: 'O solo al frente', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:22:51.950Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'CySTpY57q5oZWXpg2Kmq', direction: 'outbound', body: 'Entiendo, puedes instalar cámaras para grabar la cabina y el frente, o solo el frente. ¿Cuánto tiempo te gustaría guardar los videos?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:23:08.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'Hvdo4aIy9VE1sOZ2OKS8', direction: 'inbound', body: 'Cuanto es el tiempo que uds me recomiendan?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:23:58.370Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'tUIgM6rMzO9imUE4fxti', direction: 'outbound', body: 'Lo más recomendado es guardar los videos entre 7 y 30 días, dependiendo del uso y la rotación de los vehículos. ¿Te gustaría cotizar para 7, 15 o 30 días de almacenamiento?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:24:16.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'sJL0WMDejlGJdJigGcuu', direction: 'inbound', body: 'Para 15 dias por favor', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:26:36.215Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'umwcyRmksgbVLUwcpFS8', direction: 'outbound', body: 'Perfecto, te cotizaré para 15 días de almacenamiento de video. ¿Me puedes indicar el RUT de la empresa y un correo electrónico para enviarte la cotización formal?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:26:55.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'Xe2HfAIc7u8zSrmBMB2A', direction: 'inbound', body: '96.755.110-4 / squiroga@transworld.cl', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:27:35.516Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'ItOhnsAo4d1MBtax1qHa', direction: 'outbound', body: 'Te estoy transfiriendo con Sandra que te ayudará con la cotización', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:27:59.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: '228WvOD11lQKGx08AMFB', direction: 'inbound', body: 'Perfecto, gracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:28:23.850Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'gRQYrtL3hxbwqGaHkOY2', direction: 'outbound', body: 'Hola Sebastián en que comuna necesitas instalar?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:43:50.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'bF6E8ATzg3Y9a1cS7soC', direction: 'inbound', body: 'Hola, en Huechuraba', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:44:20.072Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: '6gxcjX8fZQinI5YkW9vE', direction: 'outbound', body: 'te envié cotizacion Plan Monitoreo Anual', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:51:13.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'KsmGmvVzDanZeeP2pvpD', direction: 'inbound', body: 'Perfecto, muchas gracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:54:31.667Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'cpLC8hFsyZPGLxtVRyXM', direction: 'inbound', body: 'Consulta, realizan venta del dispositivo mas instalación?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:58:00.983Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'j3PyFH6VbeJdLfk0hwuO', direction: 'outbound', body: 'si la cámara es en venta', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T19:59:05.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'MLgpw0v0KzqF6qRmK08r', direction: 'inbound', body: 'Y podría eventualmente solo comprar la cámara y además con Uds realizar la instalación?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T20:00:02.859Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'E9n2LWTytIOwMjHGqkbK', direction: 'outbound', body: 'primero debemos realizar una visita de diagnostico para evaluar la instalación y se determina el cobro normalmente se cobra 1 uf por vehículo', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T20:00:17.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'CYyNVuFTMmEsR1hWitp0', direction: 'inbound', body: 'Perfecto, voy a presentar la cotización que me envió y en caso de alguna cosa le comento… le respondo el mismo correo?', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T20:01:29.230Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'Md0nIp2X97aVjEql7oRp', direction: 'outbound', body: 'si,  o por este medio', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T20:06:00.000Z' },
      { conversationId: 'lGOFuAGluXgOYRPi0wTP', id: 'tmlH69cgzoVuSNOVECxh', direction: 'inbound', body: 'Perfecto, muchas gracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2025-11-12T20:06:24.462Z' },
    ],
  },

  // 5. CONSTRUCCIONES MC VARGAS — $1,300,571
  {
    opp: {
      id: 'fLpuL7wRRfjFz7cq0i6a',
      name: 'CONSTRUCCIONES MC VARGAS',
      contactId: 'PLoOsmLMZiuKQTdhDJxr',
      contactName: 'CONSTRUCCIONES MC VARGAS',
      monetaryValue: 1300571,
      pipelineId: 'MNxYbS1kOg11IiU2QbMv',
      pipelineStageId: '2bfd0ea8-b816-4e1c-88de-4d25e2b535fb',
      pipelineStageName: 'Perdido',
      status: 'lost',
      createdAt: '2026-02-18T15:53:03.409Z',
    },
    convId: 'wzmGfnVj2REL6IgVTqlN',
    email: 'jsanchez@maquinariasmcv.cl',
    phone: '+56934578899',
    msgs: [
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'cgACM3bgvoEREpjQ7pJy', direction: 'inbound', body: 'Buen día', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T13:32:59.928Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'b7oz1YnNoJ20Eye4xwsv', direction: 'outbound', body: '¡Hola! 👋 Bienvenido a Central GPS. Hablas con Alicia, cuéntame cómo te puedo ayudar?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T13:33:10.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'Wh8XZbVb0xmWieC1fTKK', direction: 'inbound', body: 'me podria ayudar con una cotización por favor', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T13:33:16.994Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'IhtfuYN9SooYzD7xRf5x', direction: 'outbound', body: 'Perfecto, te ayudo con la cotización. ¿Cuántos vehículos necesitas monitorear, en qué comuna están y para qué necesitas el GPS?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T13:33:28.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'WNjGQZsbxOKhBB9Bpljo', direction: 'inbound', body: 'ustedes tienen caramas dash cam?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T14:10:49.430Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'KL0K7JIubNBWppGsJndE', direction: 'outbound', body: 'si tenemos diferentes opciones', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T14:31:30.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'Nw0OLmjZe8BjzTIwqsOm', direction: 'inbound', body: 'jsanchez@maquinariasmcv.cl \n76.395.903-1', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T14:34:10.474Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'zlhpQKzvB5oWYd5HUJHQ', direction: 'inbound', body: 'Necesito cotizar para 3 camiones y 1 camioneta camaras, con cableado directo (la idea es que se encienda el vehiculo y se encienda la camara), con vista para el exterior e interior, saber cual es la vision exterior, saber si mide la velocidad y si tiene gps incluido por favor', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T14:33:56.967Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'dIkNlGI6ciYssBEDI87P', direction: 'outbound', body: 'te dejo el link para veas los planes \nhttps://www.centralgps.cl/planes-camaras-para-empresas/', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T14:45:26.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'dJyeejZipq31PHiaiqwr', direction: 'outbound', body: 'cámara dual frente y cabina', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:01:27.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'sJfi1H93vpajsLc3tqVn', direction: 'inbound', body: 'Muchas gracias!', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:05:50.447Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'ckrTqtui5fa3D6BenvKe', direction: 'outbound', body: 'son con cableado directo y se enciende con el vehículo, dual graba frente y cabina, tiene gps incluido, tienes la opción de integrarla a la plataforma', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:08:40.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'lJ3TLSu0plAqxWsWQkvh', direction: 'inbound', body: 'es posible que los planes y la información que me esta dando me la envie por correo?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:12:30.054Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'UtCnzLFb2OOLoXQA88EN', direction: 'outbound', body: 'le envié cotización al correo', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:15:23.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: '7k6RrxxxlpQMcddKiM0A', direction: 'outbound', body: 'en que comuna necesitas instalar?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:17:49.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'VDBKclVMkrYdFRSb6QY8', direction: 'inbound', body: 'pirque', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:18:06.256Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'kMLcsBvzyYfsrvFI1BCT', direction: 'inbound', body: 'muchas gracias!', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:18:12.866Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'dyOMqPYWvXWhGPUAAvuj', direction: 'outbound', body: 'Las instalaciones son sin costo en nuestro centro de atención en Av. Grecia Ñuñoa', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:20:59.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'kqmhjaFXEwHXtLwMgs5o', direction: 'inbound', body: 'perfecto!', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:21:55.189Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'eI8Jk7TmGqh6yvJ9ZVxg', direction: 'inbound', body: 'tienes algun video de referencia? y no tiene notificación o alarma en caso de que el conductor este hablando por telefono, señalar la velocidad, etc?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:24:11.275Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: '2EHIQaRYqXyJEnEVxoA9', direction: 'outbound', body: 'si tenemos \nesos planes son con IA deme unos minutos y le envío cotización', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:36:41.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'qjb6Iz17a8gZis0Xx5EJ', direction: 'inbound', body: 'yaaa super!', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:45:14.482Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'R1oOFsY7grrvlwYwi4la', direction: 'inbound', body: 'muchas gracias', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:45:18.511Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'Ft7Zi46f9Ua32MGaeBqP', direction: 'outbound', body: 'aca puedes ver como funciona \nhttps://www.centralgps.cl/dashcam/', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:47:40.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'O6bPV9ByFCAS0isCjWZe', direction: 'inbound', body: '🤩', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-17T15:51:47.151Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: '5r1k1SFhI35CVbrzpYhC', direction: 'outbound', body: 'Buenas tardes pudiste ver como funcionan las cámaras?', messageType: 'TYPE_SMS', dateAdded: '2026-02-24T19:52:27.000Z' },
      { conversationId: 'wzmGfnVj2REL6IgVTqlN', id: 'GzlQDRupT2H6o36iI6BH', direction: 'outbound', body: 'Hola, Soy *Sandra* de *Central GPS*, ¿cómo estás?', messageType: 'TYPE_WHATSAPP', dateAdded: '2026-02-24T20:16:15.000Z' },
    ],
  },
];

function main() {
  const existing = readForensicsCache();
  const existingEntries = existing?.entries || [];

  const newEntries: ForensicsCacheEntry[] = DATA.map((d) => ({
    opportunity: d.opp,
    conversation: buildConversation(d.convId, d.opp.contactId, d.opp.contactName, d.msgs, d.email, d.phone),
  }));

  // Dedupe by opportunity id
  const existingIds = new Set(existingEntries.map((e) => e.opportunity.id));
  const actualNew = newEntries.filter((e) => !existingIds.has(e.opportunity.id));
  const merged = [...existingEntries, ...actualNew];

  const cache = buildForensicsCache(merged, CENTRAL_GPS_PIPELINE.id, CENTRAL_GPS_PIPELINE.name);
  cache._meta.source = 'prod-ghl-mcp (Paperclip heartbeat CEN-998)';
  writeForensicsCache(cache);

  console.log(`[AppendCache] Existing: ${existingEntries.length}, New: ${actualNew.length}, Total: ${merged.length}`);
}

main();
