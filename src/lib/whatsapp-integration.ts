export async function sendWhatsAppMessage(contactId: string, message: string, isTemplate: boolean = false) {
  // Aquí iría la lógica para enviar el mensaje vía GHL MCP o API directa
  // Por ahora, simulamos el envío

  console.log(`Simulando envío a ${contactId}: ${message} (Template: ${isTemplate})`);

  // Validar horario hábil (Lu-Vi, 9-18h)
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  if (day === 0 || day === 6 || hour < 9 || hour >= 18) {
    console.log('Fuera de horario hábil. Se encolará para el próximo día.');
    return { success: true, status: 'queued', reason: 'out_of_hours' };
  }

  // Simular éxito
  return { success: true, status: 'sent' };
}
