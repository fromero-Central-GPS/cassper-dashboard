import { NextResponse } from 'next/server';

/**
 * POST /api/ghl/send-approval
 *
 * Endpoint que ejecuta el envío de un email de recuperación pre-aprobado.
 *
 * Body: { ticketId, contactEmail, subject, body }
 *
 * Usa gog CLI para enviar el email real via Gmail (fromero@centralgps.cl).
 * Solo se ejecuta cuando un humano hace clic en "Aprobar envío" en la UI.
 */

export async function POST(request: Request) {
  try {
    const { ticketId, contactEmail, subject, body } = await request.json();

    if (!ticketId || !contactEmail || !subject || !body) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: ticketId, contactEmail, subject, body',
      }, { status: 400 });
    }

    // En Paperclip runtime, usar gog CLI para enviar
    if (process.env.PAPERCLIP_RUN_ID) {
      const { execSync } = await import('child_process');
      const encodedBody = Buffer.from(body).toString('base64');

      try {
        const result = execSync(
          `export GOG_KEYRING_PASSWORD="gogcli-mcp-2026" && ` +
          `gog gmail send --to "${contactEmail}" --subject "${subject}" --body "$(echo ${encodedBody} | base64 -d)" --account fromero@centralgps.cl`,
          { encoding: 'utf-8', timeout: 15000 }
        );
        return NextResponse.json({
          success: true,
          ticketId,
          contactEmail,
          sentAt: new Date().toISOString(),
          output: result.trim(),
          mode: 'live',
        });
      } catch (sendErr: any) {
        return NextResponse.json({
          success: false,
          ticketId,
          error: sendErr.message || 'Error enviando email',
          hint: 'Verificar que gog CLI esté instalado y autenticado',
        }, { status: 500 });
      }
    }

    // Fuera de Paperclip: simular el envío (desarrollo/demo)
    return NextResponse.json({
      success: true,
      ticketId,
      contactEmail,
      subject,
      bodyPreview: body.substring(0, 100) + '...',
      sentAt: new Date().toISOString(),
      mode: 'simulated',
      note: 'Email simulado. En Paperclip runtime se envía realmente via gog CLI.',
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Error interno',
    }, { status: 500 });
  }
}
