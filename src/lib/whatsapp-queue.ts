import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'cassper.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_queue (
    id TEXT PRIMARY KEY,
    opportunityId TEXT NOT NULL,
    contactName TEXT NOT NULL,
    phoneNumber TEXT NOT NULL,
    messageType TEXT NOT NULL, -- 'free_text' or 'hsm'
    templateId TEXT,
    messageBody TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'sent', 'failed'
    scheduledFor DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface QueueItem {
  id: string;
  opportunityId: string;
  contactName: string;
  phoneNumber: string;
  messageType: 'free_text' | 'hsm';
  templateId?: string;
  messageBody: string;
  status: 'draft' | 'approved' | 'sent' | 'failed';
  scheduledFor?: Date;
  createdAt: string;
  updatedAt: string;
}

export function getDraftMessages(): QueueItem[] {
  return db.prepare('SELECT * FROM whatsapp_queue WHERE status = ?').all('draft') as QueueItem[];
}

export function addMessageToQueue(item: Omit<QueueItem, 'createdAt' | 'updatedAt'>) {
  const stmt = db.prepare(`
    INSERT INTO whatsapp_queue (id, opportunityId, contactName, phoneNumber, messageType, templateId, messageBody, status, scheduledFor)
    VALUES (@id, @opportunityId, @contactName, @phoneNumber, @messageType, @templateId, @messageBody, @status, @scheduledFor)
  `);
  stmt.run(item);
}

export function updateMessageStatus(id: string, status: QueueItem['status']) {
  const stmt = db.prepare('UPDATE whatsapp_queue SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(status, id);
}

export function checkBusinessHours(): boolean {
  // Chile Time (UTC-4 or UTC-3 depending on DST, simpler to use standard Date logic relative to locale if possible, or force timezone)
  // For simplicity, checking if current UTC is within a sensible business window (e.g. 13:00 - 22:00 UTC -> 09:00 - 18:00 CLT)
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  
  const isWeekend = day === 0 || day === 6;
  const isBusinessHour = hour >= 13 && hour <= 22; // Approximation for Chile Time
  
  return !isWeekend && isBusinessHour;
}
