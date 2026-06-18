const fs = require('fs');
const file = 'src/lib/ghl-types.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('LossTrendMonth')) {
  code = code.replace(
    'export interface DashboardData {',
    `export interface LossTrendMonth {
  month: string;
  lostValue: number;
  lostCount: number;
  topReason: string;
}

export interface DashboardData {`
  );
  code = code.replace(
    'wonPatterns?: WonTrackPattern[];',
    'wonPatterns?: WonTrackPattern[];\n  lossTrends?: LossTrendMonth[];'
  );
  fs.writeFileSync(file, code);
  console.log('patched');
} else {
  console.log('already patched');
}
