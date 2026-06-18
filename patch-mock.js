const fs = require('fs');
const file = 'src/lib/mock-data.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('lossTrends')) {
  code = code.replace(
    '  campaigns: [',
    `  // Tendencias mes a mes de pérdidas para el dashboard forense
  lossTrends: [
    { month: 'Ene 2026', lostValue: 8500000, lostCount: 5, topReason: 'Falta de seguimiento' },
    { month: 'Feb 2026', lostValue: 12400000, lostCount: 8, topReason: 'Competidor / Precio' },
    { month: 'Mar 2026', lostValue: 9200000, lostCount: 6, topReason: 'Falta de seguimiento' },
    { month: 'Abr 2026', lostValue: 5300000, lostCount: 3, topReason: 'Falta de seguimiento' },
    { month: 'May 2026', lostValue: 18200000, lostCount: 11, topReason: 'Perdido sin diagnóstico' },
    { month: 'Jun 2026', lostValue: 4300000, lostCount: 2, topReason: 'Falta de seguimiento' },
  ],
  campaigns: [`
  );
  fs.writeFileSync(file, code);
  console.log('patched');
} else {
  console.log('already patched');
}
