/**
 * CLI entry for the periodic reciter health check (item 9 of the roadmap).
 *
 * Usage:
 *   npx tsx scripts/check-reciters.ts            # pretty table, exit 1 if any broken
 *   npx tsx scripts/check-reciters.ts --json     # machine-readable report to stdout
 *
 * Writes the last report to scripts/.reciter-health.json for diffing over time.
 * Designed to run from CI (GitHub Actions workflow) or a cron job.
 */
import { writeFileSync } from 'node:fs';
import { checkAllRecitersHealth, renderHealthReport } from '../lib/reciter-health';

async function main() {
  const asJson = process.argv.includes('--json');
  const report = await checkAllRecitersHealth();

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log(renderHealthReport(report));
  }

  try {
    writeFileSync(new URL('./.reciter-health.json', import.meta.url), JSON.stringify(report, null, 2));
  } catch {
    // Non-fatal: report already printed.
  }

  if (report.broken > 0) {
    console.error(`\n✗ ${report.broken} reciter(s) broken — check folders/bitrates upstream.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Health check crashed:', err);
  process.exit(2);
});
