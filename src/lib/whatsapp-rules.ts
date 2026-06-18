/**
 * WhatsApp Business API Rules and Logistics Enforcer
 */

export const WHATSAPP_RULES = {
  BUSINESS_HOURS: {
    START: 9, // 09:00
    END: 18,  // 18:00
    TIMEZONE: 'America/Santiago' // Chile Time
  },
  ALLOWED_DAYS: [1, 2, 3, 4, 5], // Monday to Friday (0 is Sunday, 6 is Saturday)
};

/**
 * Checks if current time in Chile is within business hours
 */
export function isWithinBusinessHours(date: Date = new Date()): boolean {
  // Use Intl.DateTimeFormat to get Chile time parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: WHATSAPP_RULES.BUSINESS_HOURS.TIMEZONE,
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric'
  });

  const parts = formatter.formatToParts(date);
  
  let currentHour = 0;
  let currentDay = date.getDay(); // 0 is Sunday
  
  // This is a simplified check, ideally we'd parse the Intl output more robustly
  // For now, we'll assume the server is running reasonably close or we do a manual offset
  // A better approach in Node is to use a library like luxon or date-fns-tz
  
  // Let's implement a safer check using standard JS dates assuming server is UTC
  const chileOffsetStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      timeZoneName: 'shortOffset'
  }).format(date); // e.g., "GMT-4" or "GMT-3"
  
  // Parse offset (e.g. "GMT-4" -> -4)
  const offsetMatch = chileOffsetStr.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : -4; // Default to -4 if parsing fails
  
  // Get Chile Date object
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const chileDate = new Date(utc + (3600000 * offsetHours));
  
  const hour = chileDate.getHours();
  const day = chileDate.getDay();

  // Check if it's a weekday
  if (!WHATSAPP_RULES.ALLOWED_DAYS.includes(day)) {
    return false;
  }

  // Check if it's within hours
  if (hour < WHATSAPP_RULES.BUSINESS_HOURS.START || hour >= WHATSAPP_RULES.BUSINESS_HOURS.END) {
    return false;
  }

  return true;
}

/**
 * Helper to determine if we need an HSM template
 * 
 * @param lastCustomerMessageDate Date of the last message received FROM the customer
 * @returns boolean True if a template is required, false if we can send free text
 */
export function requiresTemplate(lastCustomerMessageDate?: Date | null): boolean {
  if (!lastCustomerMessageDate) {
    return true; // No previous message, must use template
  }

  const now = new Date();
  const diffInMs = now.getTime() - lastCustomerMessageDate.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  // If more than 24 hours have passed, we need a template
  return diffInHours >= 24;
}

export type WhatsAppTemplate = {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY';
  language: string;
  components: any[];
};

export const RECOMMENDED_TEMPLATES = [
  {
    name: 'reactivacion_seguimiento_v1',
    category: 'MARKETING',
    body: 'Hola {{1}}, hace unos días conversamos sobre {{2}}. ¿Lograste resolverlo o te gustaría que te envíe más información? Quedo atento, saludos de Central GPS.'
  },
  {
    name: 'promocion_reactivacion_v1',
    category: 'MARKETING',
    body: 'Hola {{1}}, vimos que tenías interés en nuestro servicio de telemetría. Este mes tenemos un beneficio especial para sumar a tu flota. ¿Te interesa que te cuente más?'
  }
];
