import { join } from "path";
import { readFileSync } from "fs";

// Simulate GOG connection / GHL tag updates
const GHL_TAG = "reactivation_email_sent";

export async function runReactivation(reportPath: string) {
  console.log(`[email-agent] Reading report from ${reportPath}`);
  let content = "";
  try {
    content = readFileSync(reportPath, "utf-8");
  } catch (err) {
    console.error(`[email-agent] Error reading report: ${err}`);
    return;
  }

  // Extract opportunity info (naive extraction for MVP)
  // In a real app we would parse the markdown or receive structured JSON data
  const matches = content.match(/\| \d+ \| \*\*([^\*]+)\*\* \|.*?\|.*?\/ Perdido \|.*?\|.*?\| (.*?) \|/g);
  
  if (!matches) {
    console.log("[email-agent] No opportunities found in report.");
    return;
  }

  console.log(`[email-agent] Found ${matches.length} opportunities to reactivate.`);
  
  for (const match of matches) {
    // Extract basic details using regex
    const nameMatch = match.match(/\| \d+ \| \*\*([^\*]+)\*\* \|/);
    const actionMatch = match.match(/\| .*? \| .*? \| .*? \| .*? \| .*? \| (.*?) \|/);
    
    if (nameMatch && actionMatch) {
       const contactName = nameMatch[1];
       const suggestedAction = actionMatch[1].replace(/🟢 |🟡 |🟠 /, "").trim();
       
       console.log(`\n--- Reactivating Contact: ${contactName} ---`);
       console.log(`[GHL MCP] Tagging contact with: ${GHL_TAG}`);
       console.log(`[GOG] Sending email based on suggested action: ${suggestedAction}`);
    }
  }

  console.log("\n[email-agent] Reactivation batch complete.");
}

// Execute if run directly
if (process.argv[1].endsWith("email_agent.ts") || process.argv[1].endsWith("email_agent.js")) {
    const defaultReport = join(process.cwd(), "reports", "recovery-2026-05-30.md");
    const reportToUse = process.argv[2] || defaultReport;
    runReactivation(reportToUse);
}
