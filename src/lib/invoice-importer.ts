/**
 * Invoice CSV Importer
 *
 * Importa facturas desde archivos CSV (formato Fineas para el dashboard financiero).
 * Soporta mapeo de columnas configurable para adaptarse a variaciones del formato.
 *
 * Formato esperado por defecto (columnas del CSV de Fineas):
 *   N° Factura | Cliente | RUT | Período | Emisión | Vencimiento | Monto | Estado | Fecha Pago
 *
 * El mapeo de columnas es configurable vía InvoiceColumnMapping.
 */

import type { Invoice } from './commission-types';
import { InvoiceRepository } from './db/repositories/invoices';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface InvoiceColumnMapping {
  /** Nombre de la columna que contiene el ID/número de factura */
  id: string;
  /** Nombre de la columna con el ID del cliente (o nombre si no hay ID) */
  clientId?: string;
  /** Nombre de la columna con el nombre del cliente */
  clientName: string;
  /** Nombre de la columna con el ID del contrato (opcional) */
  contractId?: string;
  /** Nombre de la columna con el monto */
  amount: string;
  /** Nombre de la columna con el estado */
  status: string;
  /** Nombre de la columna con la fecha de emisión */
  issuedAt: string;
  /** Nombre de la columna con la fecha de pago (opcional) */
  paidAt?: string;
  /** Nombre de la columna con el período (YYYY-MM) */
  period: string;
}

export interface ImportResult {
  /** Total de filas en el CSV (excluyendo header) */
  totalRows: number;
  /** Facturas importadas exitosamente */
  imported: number;
  /** Facturas actualizadas (ya existían) */
  updated: number;
  /** Filas con errores */
  errors: ImportError[];
  /** IDs de las facturas importadas/actualizadas */
  invoiceIds: string[];
}

export interface ImportError {
  row: number;
  message: string;
  data?: Record<string, string>;
}

// ─── Mapeo por defecto (formato Fineas) ───────────────────────────────────────

export const FINEAS_COLUMN_MAPPING: InvoiceColumnMapping = {
  id: 'N° Factura',
  clientName: 'Cliente',
  amount: 'Monto',
  status: 'Estado',
  issuedAt: 'Emisión',
  paidAt: 'Fecha Pago',
  period: 'Período',
};

// Columnas alternativas comunes
const ALTERNATIVE_COLUMNS: Record<string, string[]> = {
  id: ['N° Factura', 'Numero Factura', 'Folio', 'Invoice', 'ID Factura', 'id', 'numero', 'n_factura'],
  clientName: ['Cliente', 'Razon Social', 'Nombre', 'Client', 'cliente', 'razon_social', 'nombre'],
  amount: ['Monto', 'Total', 'Amount', 'Valor', 'monto', 'total', 'valor', 'importe'],
  status: ['Estado', 'Status', 'estado', 'status', 'situacion'],
  issuedAt: ['Emisión', 'Fecha Emision', 'Fecha', 'Issued', 'emision', 'fecha_emision', 'fecha'],
  paidAt: ['Fecha Pago', 'Pagado', 'Paid', 'fecha_pago', 'pagado', 'paid_at'],
  period: ['Período', 'Periodo', 'Period', 'Mes', 'periodo', 'period', 'mes'],
};

// ─── Parseo CSV ───────────────────────────────────────────────────────────────

/**
 * Parsea un string CSV en un array de objetos.
 * Soporta:
 * - Delimitadores: coma (,) y punto y coma (;)
 * - BOM (UTF-8)
 * - Campos entrecomillados
 * - Líneas vacías
 */
export function parseCSV(csvString: string): { headers: string[]; rows: Record<string, string>[] } {
  // Detectar delimitador
  const firstLine = csvString.split('\n')[0] ?? '';
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // Split lines, handle quoted fields
  const lines = csvString
    .replace(/^﻿/, '') // Remove BOM
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = splitCSVLine(lines[0]!, delimiter).map((h) => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]!, delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Splits a CSV line respecting quoted fields.
 */
function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// ─── Mapeo de Columnas ────────────────────────────────────────────────────────

/**
 * Encuentra el mejor mapeo de columnas para un CSV dado.
 * Prueba el mapeo por defecto (Fineas) y busca alternativas.
 */
export function detectColumnMapping(
  headers: string[],
  providedMapping?: Partial<InvoiceColumnMapping>
): { mapping: InvoiceColumnMapping; unmapped: string[] } {
  const mapping = { ...FINEAS_COLUMN_MAPPING, ...providedMapping };
  const unmapped: string[] = [];

  // Para cada campo requerido, buscar la columna en los headers
  for (const [field, columnName] of Object.entries(mapping) as [string, string][]) {
    if (!columnName) continue;
    if (!headers.includes(columnName)) {
      // Buscar alternativas
      const alternatives = ALTERNATIVE_COLUMNS[field] ?? [];
      const found = alternatives.find((alt) => headers.includes(alt));
      if (found) {
        (mapping as Record<string, string>)[field] = found;
      } else if (field !== 'clientId' && field !== 'contractId' && field !== 'paidAt') {
        // Solo marcar como unmapped si es un campo requerido
        unmapped.push(field);
      }
    }
  }

  return { mapping, unmapped };
}

// ─── Validación y Transformación ──────────────────────────────────────────────

/**
 * Normaliza el estado de factura a los valores esperados.
 */
function normalizeStatus(raw: string): Invoice['status'] {
  const normalized = raw.toLowerCase().trim();

  if (['pagada', 'pagado', 'paid', 'pago', 'pagada '].some((s) => normalized.includes(s))) {
    return 'pagada';
  }
  if (['emitida', 'emitido', 'issued', 'emision', 'pendiente'].some((s) => normalized.includes(s))) {
    return 'emitida';
  }
  if (['vencida', 'vencido', 'overdue', 'vencida '].some((s) => normalized.includes(s))) {
    return 'vencida';
  }
  if (['anulada', 'anulado', 'cancelled', 'cancelada', 'nula'].some((s) => normalized.includes(s))) {
    return 'anulada';
  }

  // Default: si no se reconoce, asumir emitida
  return 'emitida';
}

/**
 * Parsea un monto a número, manejando formatos chilenos.
 * Ej: "$1.234.567" -> 1234567, "1234567,89" -> 1234567.89
 */
function parseAmount(raw: string): number {
  let cleaned = raw
    .replace(/[$USDCLP\s]/gi, '')
    .replace(/\./g, '') // Remove thousands separator
    .replace(/,/g, '.'); // Replace decimal comma with dot

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parsea una fecha en formato chileno (DD-MM-YYYY o DD/MM/YYYY) a ISO.
 */
function parseDate(raw: string): string | undefined {
  if (!raw || raw.trim() === '') return undefined;

  const trimmed = raw.trim();

  // Ya está en ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.split('T')[0] + 'T00:00:00Z';
  }

  // Formato DD-MM-YYYY o DD/MM/YYYY
  const parts = trimmed.split(/[-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d && m && y && d <= 31 && m <= 12) {
      const year = y! < 100 ? 2000 + y! : y!;
      return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00Z`;
    }
  }

  // Intentar Date.parse nativo
  const ms = Date.parse(trimmed);
  if (!isNaN(ms)) {
    return new Date(ms).toISOString();
  }

  return undefined;
}

/**
 * Normaliza el período a formato YYYY-MM.
 */
function normalizePeriod(raw: string): string {
  const trimmed = raw.trim();

  // Ya está en YYYY-MM?
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Formato MM/YYYY
  const slashParts = trimmed.split('/');
  if (slashParts.length === 2) {
    const [m, y] = slashParts.map(Number);
    if (m && y && m <= 12) {
      const year = y! < 100 ? 2000 + y! : y!;
      return `${year}-${String(m).padStart(2, '0')}`;
    }
  }

  // Formato YYYYMM
  if (/^\d{6}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}`;
  }

  // Intentar extraer año y mes de una fecha completa
  const dateMatch = trimmed.match(/(\d{4})-(\d{2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}`;
  }

  return trimmed;
}

// ─── Servicio Principal ───────────────────────────────────────────────────────

export interface ImportOptions {
  /** Mapeo de columnas (partial override sobre el default Fineas) */
  columnMapping?: Partial<InvoiceColumnMapping>;
  /** Si es true, solo valida sin insertar */
  dryRun?: boolean;
  /** Función para resolver clientId desde el nombre del cliente */
  resolveClientId?: (clientName: string, row: Record<string, string>) => string | undefined;
  /** Función para resolver contractId desde el ID/nombre del cliente */
  resolveContractId?: (clientName: string, row: Record<string, string>) => string | undefined;
}

/**
 * Importa facturas desde un string CSV.
 *
 * Flujo:
 * 1. Parsear CSV
 * 2. Detectar mapeo de columnas
 * 3. Validar y transformar cada fila
 * 4. Insertar/actualizar en la base de datos
 */
export function importInvoicesFromCSV(
  csvString: string,
  options: ImportOptions = {}
): ImportResult {
  const { columnMapping, dryRun = false, resolveClientId, resolveContractId } = options;

  const { headers, rows } = parseCSV(csvString);
  const { mapping, unmapped } = detectColumnMapping(headers, columnMapping);

  const result: ImportResult = {
    totalRows: rows.length,
    imported: 0,
    updated: 0,
    errors: [],
    invoiceIds: [],
  };

  // Verificar columnas requeridas
  if (unmapped.length > 0) {
    result.errors.push({
      row: 0,
      message: `No se encontraron columnas para: ${unmapped.join(', ')}. Columnas disponibles: ${headers.join(', ')}`,
    });
    return result;
  }

  const invoiceRepo = dryRun ? null : new InvoiceRepository();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // +2 porque fila 1 es header, fila 2 es la primera de datos

    try {
      // Extraer y validar campos
      const rawId = row[mapping.id];
      if (!rawId || rawId.trim() === '') {
        result.errors.push({ row: rowNum, message: 'ID de factura vacío', data: row });
        continue;
      }

      const rawClientName = row[mapping.clientName];
      if (!rawClientName || rawClientName.trim() === '') {
        result.errors.push({ row: rowNum, message: 'Nombre de cliente vacío', data: row });
        continue;
      }

      const clientId =
        (mapping.clientId ? row[mapping.clientId] : undefined) ??
        resolveClientId?.(rawClientName, row) ??
        `CLI-${rawClientName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      const contractId =
        (mapping.contractId ? row[mapping.contractId] : undefined) ??
        resolveContractId?.(rawClientName, row);

      const amount = parseAmount(row[mapping.amount] ?? '0');
      if (amount <= 0) {
        result.errors.push({
          row: rowNum,
          message: `Monto inválido: "${row[mapping.amount]}"`,
          data: row,
        });
        continue;
      }

      const status = normalizeStatus(row[mapping.status] ?? '');
      const issuedAt = parseDate(row[mapping.issuedAt] ?? '');
      if (!issuedAt) {
        result.errors.push({
          row: rowNum,
          message: `Fecha de emisión inválida: "${row[mapping.issuedAt]}"`,
          data: row,
        });
        continue;
      }

      const paidAt = mapping.paidAt ? parseDate(row[mapping.paidAt] ?? '') : undefined;
      const period = normalizePeriod(row[mapping.period] ?? '');

      // Construir invoice
      const invoice: Invoice = {
        id: rawId.trim(),
        clientId,
        clientName: rawClientName.trim(),
        contractId,
        amount,
        status,
        issuedAt,
        paidAt,
        period,
      };

      if (!dryRun) {
        const existing = invoiceRepo?.findById(invoice.id);
        if (existing) {
          invoiceRepo?.update(invoice.id, invoice);
          result.updated++;
        } else {
          invoiceRepo?.create(invoice);
          result.imported++;
        }
      } else {
        result.imported++;
      }

      result.invoiceIds.push(invoice.id);
    } catch (err) {
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : 'Error desconocido',
        data: row,
      });
    }
  }

  return result;
}

/**
 * Genera un reporte descriptivo de la importación.
 */
export function formatImportReport(result: ImportResult): string {
  const lines: string[] = [
    `📊 Reporte de Importación de Facturas`,
    `─────────────────────────────────`,
    `Total de filas:      ${result.totalRows}`,
    `✅ Importadas:        ${result.imported}`,
    `🔄 Actualizadas:      ${result.updated}`,
    `❌ Errores:           ${result.errors.length}`,
  ];

  if (result.errors.length > 0) {
    lines.push(``, `Detalle de errores:`);
    for (const err of result.errors) {
      lines.push(`  Fila ${err.row}: ${err.message}`);
    }
  }

  if (result.invoiceIds.length > 0) {
    lines.push(``, `IDs importados: ${result.invoiceIds.join(', ')}`);
  }

  return lines.join('\n');
}
