/**
 * GET /api/commissions/report — Reporte mensual de comisiones
 *
 * Reemplazo directo de las planillas manuales.
 * Agrupado por vendedor con detalle de cada contrato.
 * Datos desde la base de datos SQLite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import {
  SellerRepository,
  ContractRepository,
  PaymentRepository,
} from '@/lib/db';
import { generateMonthlyReport } from '@/lib/commission-engine';

export async function GET(request: NextRequest) {
  ensureSchema();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
  const format = searchParams.get('format') || 'json';

  const sellerRepo = new SellerRepository();
  const contractRepo = new ContractRepository();
  const paymentRepo = new PaymentRepository();

  const sellers = sellerRepo.findAll();
  const payments = paymentRepo.findAll();
  const contracts = contractRepo.findAll();

  const report = generateMonthlyReport(period, payments, sellers);

  // Formato CSV para exportar (compatible con planillas actuales)
  if (format === 'csv') {
    const rows: string[] = [
      'Vendedor,Contratos,Comisión Total,Verificado,Pendiente,Cancelado',
    ];

    for (const seller of report.sellers) {
      rows.push(
        [
          seller.sellerName,
          seller.contracts,
          seller.totalCommission,
          seller.verifiedAmount,
          seller.pendingAmount,
          report.totalCancelled,
        ].join(',')
      );
    }

    rows.push('');
    rows.push(`TOTAL,,${report.totalToPay},${report.totalVerified},${report.totalPending},${report.totalCancelled}`);

    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="comisiones-${period}.csv"`,
      },
    });
  }

  // Detalle de contratos para cada vendedor
  const sellerDetails = report.sellers.map((seller) => {
    const sellerContracts = contracts.filter((c) => c.sellerId === seller.sellerId);
    return {
      ...seller,
      contracts: sellerContracts.map((c) => ({
        id: c.id,
        clientName: c.clientName,
        planName: c.planName,
        quantity: c.quantity,
        monthlyValue: c.monthlyValue,
        monthlyCommission: c.monthlyCommission,
        status: c.status,
        isUpsell: c.isUpsell,
        devicesActive: c.deviceImeis.length,
      })),
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      ...report,
      sellerDetails,
    },
  });
}
