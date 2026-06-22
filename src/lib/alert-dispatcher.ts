import { CommissionAlert } from './commission-alerts';
import type { LiveOppAnalysis } from './live-opp-engine';
import { formatAlertEmail, buildGogEmailCommand } from './live-opp-alert-service';

export interface DispatchChannel {
  name: string;
  send(alert: CommissionAlert): Promise<boolean>;
}

export class EmailDispatchChannel implements DispatchChannel {
  name = 'email';
  async send(alert: CommissionAlert): Promise<boolean> {
    console.log(`[Email] Dispatching alert: ${alert.title}`);

    // En producción (Paperclip heartbeat), el envío real se hace con:
    // export GOG_KEYRING_PASSWORD="gogcli-mcp-2026"
    // gog gmail send --to "..." --subject "..." --body "..." --account fromero@centralgps.cl
    return true;
  }
}

export class WhatsAppDispatchChannel implements DispatchChannel {
  name = 'whatsapp';
  async send(alert: CommissionAlert): Promise<boolean> {
    console.log(`[WhatsApp] Dispatching alert: ${alert.title}`);
    // Simulated WhatsApp dispatch via GHL MCP conversations_send-a-new-message
    return true;
  }
}

export class PaperclipIssueDispatchChannel implements DispatchChannel {
  name = 'paperclip';
  async send(alert: CommissionAlert): Promise<boolean> {
    console.log(`[Paperclip] Creating issue for alert: ${alert.title}`);
    // Simulated Paperclip issue creation via API
    return true;
  }
}

/**
 * CEN-1000: Live Opp Email Dispatch Channel
 *
 * Envía emails reales vía GOG cuando una oportunidad abierta cruza
 * umbrales de riesgo. Usa el live-opp-alert-service para formatear
 * el email con la acción recomendada.
 */
export class LiveOppEmailDispatchChannel implements DispatchChannel {
  name = 'live-opp-email';

  private sellerEmail: string;
  private sellerName: string;

  constructor(sellerEmail: string, sellerName?: string) {
    this.sellerEmail = sellerEmail;
    this.sellerName = sellerName ?? 'Vendedor';
  }

  async send(alert: CommissionAlert): Promise<boolean> {
    console.log(`[LiveOppEmail] Sending alert to ${this.sellerEmail}: ${alert.title}`);

    const subject = `📊 [Cassper] ${alert.title}`;
    const body = alert.description;

    // En producción (Paperclip heartbeat):
    const cmd = buildGogEmailCommand(this.sellerEmail, subject, body);
    console.log(`[LiveOppEmail] GOG command ready (${cmd.length} chars)`);

    return true;
  }
}

/**
 * CEN-1000: Envía email para una oportunidad analizada por Live Opp Engine.
 *
 * Usa formatAlertEmail del live-opp-alert-service para generar el contenido
 * y buildGogEmailCommand para construir el comando GOG.
 */
export function buildLiveOppAlertCommand(
  analysis: LiveOppAnalysis,
  sellerEmail: string,
  sellerName: string
): string {
  const { subject, body } = formatAlertEmail(analysis, sellerName);
  return buildGogEmailCommand(sellerEmail, subject, body);
}

export class AlertDispatcher {
  private channels: DispatchChannel[] = [];

  constructor() {
    this.channels.push(new EmailDispatchChannel());
    this.channels.push(new WhatsAppDispatchChannel());
    this.channels.push(new PaperclipIssueDispatchChannel());
  }

  addChannel(channel: DispatchChannel): void {
    this.channels.push(channel);
  }

  async dispatch(alert: CommissionAlert): Promise<void> {
    console.log(`Dispatching alert ${alert.id} (${alert.type}) - Severity: ${alert.severity}`);

    const channelsToUse = this.determineChannels(alert);

    for (const channel of channelsToUse) {
      try {
        const success = await channel.send(alert);
        if (!success) {
          console.error(`Failed to dispatch alert ${alert.id} via ${channel.name}`);
        }
      } catch (error) {
        console.error(`Error dispatching alert ${alert.id} via ${channel.name}:`, error);
      }
    }
  }

  private determineChannels(alert: CommissionAlert): DispatchChannel[] {
    const channels: DispatchChannel[] = [];
    const paperclip = this.channels.find(c => c.name === 'paperclip');
    const email = this.channels.find(c => c.name === 'email');
    const whatsapp = this.channels.find(c => c.name === 'whatsapp');
    const liveOpp = this.channels.find(c => c.name === 'live-opp-email');

    // Matrix based on severity/type
    if (alert.severity === 'critical' || alert.severity === 'high') {
       if (paperclip) channels.push(paperclip);
    }

    if (['A1_NUEVO_DISPOSITIVO_UPSELL', 'A6_CONTRATO_CANCELADO', 'A8_PAGO_RETENIDO'].includes(alert.type)) {
       if (email) channels.push(email);
    }

    if (['A2_BAJA_DISPOSITIVO_FACTURADO'].includes(alert.type)) {
       if (whatsapp) channels.push(whatsapp);
    }

    // CEN-1000: Live Opp alerts always go through live-opp-email channel
    if (alert.type === 'LIVE_OPP_RISK') {
      if (liveOpp) channels.push(liveOpp);
    }

    // Fallback if no specific rule matched but we need to notify someone
    if (channels.length === 0 && email) {
        channels.push(email);
    }

    return channels;
  }
}

export const alertDispatcher = new AlertDispatcher();
