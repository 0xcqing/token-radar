// Token Radar's entrypoint.
//
// The pipeline lives in lib/entry.ts; this file only starts it from the command
// line and prints the two summary lines a run leaves behind.

import { runPipeline, type RunReport } from './lib/entry.ts';

const argv = process.argv.slice(2);
const env = process.env;

function emit(line: string): void {
  process.stdout.write(`${line}\n`);
}

function describe(report: RunReport): { scored: string; written: string } {
  const totals = `${report.protocols} protocols, ${report.rows} rows ranked`;
  const groups = `${report.early} early finds, ${report.live} live tokens set aside`;
  const source = `${report.watchlist} watchlist slugs`;
  const files = `board.json, data.js, dashboard/, ${report.shots} screenshots, dossier.json`;
  return {
    scored: `token radar: ${totals} (${groups})`,
    written: `token radar: ${source} written to ${report.out}: ${files}`,
  };
}

const report = runPipeline(argv, env);
const lines = describe(report);

emit(lines.scored);
emit(lines.written);
