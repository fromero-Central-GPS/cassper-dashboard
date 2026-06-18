const fs = require('fs');
const file = 'src/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('ForensicsPanel')) {
  code = code.replace(
    "import { WonTrackPanel } from '@/components/dashboard/won-track-panel';",
    "import { WonTrackPanel } from '@/components/dashboard/won-track-panel';\nimport { ForensicsPanel } from '@/components/dashboard/forensics-panel';"
  );
  
  code = code.replace(
    "{activeTab === 'overview' && (",
    `{activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Diagnóstico Forense y Tendencias
              </h2>
              <ForensicsPanel lossTrends={data.lossTrends} lossByReason={data.lossByReason} />
            </div>`
  );
  
  // Clean up old overview stuff that is now in forensics or we can just append
  code = code.replace(
    '<div>\n              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">\n                El Invisible Pipeline\n              </h2>\n              <KPICards summary={data.summary} />\n            </div>',
    '<div>\n              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 mt-6">\n                El Invisible Pipeline\n              </h2>\n              <KPICards summary={data.summary} />\n            </div>'
  );
  
  code = code.replace(
    '<LossPhasesChart',
    '<div className="mt-6"><LossPhasesChart'
  );
  
  code = code.replace(
    'lossByReason={data.lossByReason}\n            />',
    'lossByReason={data.lossByReason}\n            /></div>'
  );

  code = code.replace(
    '          </>\n        )}',
    '          </div>\n        )}'
  );

  fs.writeFileSync(file, code);
  console.log('patched page');
} else {
  console.log('page already patched');
}
