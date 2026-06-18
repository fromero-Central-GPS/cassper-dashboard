/**
 * POST /api/commissions/invoices/import
 *
 * Importa facturas desde un archivo CSV (formato Fineas).
 *
 * Body: FormData con campo 'file' (archivo CSV) o JSON con campo 'csv' (string).
 *
 * Query params:
 *   - dryRun=true: Solo valida sin insertar
 *
 * Response:
 *   { success: true, data: ImportResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import { importInvoicesFromCSV, formatImportReport, type ImportResult } from '@/lib/invoice-importer';
import { ClientRepository } from '@/lib/db/repositories/clients';

export async function POST(request: NextRequest) {
  ensureSchema();

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

  try {
    let csvString: string;
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: 'No se encontró el archivo CSV. Usa el campo "file" en el FormData.' },
          { status: 400 }
        );
      }

      csvString = await file.text();
    } else {
      // JSON body
      const body = await request.json();
      csvString = body.csv;

      if (!csvString || typeof csvString !== 'string') {
        return NextResponse.json(
          { success: false, error: 'El campo "csv" es requerido en el body JSON.' },
          { status: 400 }
        );
      }
    }

    if (csvString.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'El archivo CSV está vacío.' },
        { status: 400 }
      );
    }

    // Set up client resolution: look up client name in DB, create minimal record if not found
    const clientRepo = new ClientRepository();
    const resolveClientId = (clientName: string): string | undefined => {
      const existing = clientRepo.findByName(clientName);
      if (existing) return existing.id;

      // Create minimal client record for unknown names
      const newId = `CLI-EXT-${clientName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`;
      clientRepo.create({
        id: newId,
        name: clientName,
        email: `${clientName.toLowerCase().replace(/[^a-z0-9]/g, '-')}@importado`,
        acquiredBySellerId: 'SEL-001',
        createdAt: new Date().toISOString(),
      });
      return newId;
    };

    const result: ImportResult = importInvoicesFromCSV(csvString, {
      dryRun,
      resolveClientId,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalRows: result.totalRows,
        imported: result.imported,
        updated: result.updated,
        errors: result.errors,
        invoiceIds: result.invoiceIds,
      },
      report: formatImportReport(result),
      dryRun,
    });
  } catch (err) {
    console.error('Error importing invoices:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Error interno al procesar el CSV',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/commissions/invoices/import
 *
 * Retorna la estructura esperada del CSV para ayudar a los usuarios.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    help: {
      description: 'Importación de facturas desde CSV (formato Fineas)',
      expectedColumns: {
        'N° Factura': 'ID o número único de la factura (requerido)',
        'Cliente': 'Nombre del cliente / razón social (requerido)',
        'Monto': 'Monto de la factura en CLP (requerido)',
        'Estado': 'Estado: emitida, pagada, vencida, anulada (requerido)',
        'Emisión': 'Fecha de emisión DD-MM-YYYY o YYYY-MM-DD (requerido)',
        'Fecha Pago': 'Fecha de pago (opcional)',
        'Período': 'Período que cubre YYYY-MM (requerido)',
      },
      usage: {
        curl: `curl -X POST http://localhost:3000/api/commissions/invoices/import \\
  -H "Content-Type: application/json" \\
  -d '{"csv": "N° Factura;Cliente;Monto;Estado;Emisión;Período\\nINV-001;Cliente Ejemplo;150000;pagada;01-05-2026;2026-05"}'`,
        dryRun: 'Añade ?dryRun=true para validar sin insertar',
        fileUpload: 'Usa multipart/form-data con campo "file" para subir un archivo CSV',
      },
      columnAliases: {
        'N° Factura': ['Numero Factura', 'Folio', 'Invoice', 'ID Factura'],
        'Cliente': ['Razon Social', 'Nombre', 'Client'],
        'Monto': ['Total', 'Amount', 'Valor', 'Importe'],
        'Estado': ['Status'],
        'Emisión': ['Fecha Emision', 'Fecha', 'Issued'],
        'Fecha Pago': ['Pagado', 'Paid'],
        'Período': ['Periodo', 'Period', 'Mes'],
      },
    },
  });
}
