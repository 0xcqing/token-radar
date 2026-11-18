// The radar's output pipeline: everything between the command line and the files
// a judge reads. main.ts starts this module and narrates its report.
//
// The steps, in order: resolve --input (a snapshot file or a directory holding
// snapshot.json), load and validate that snapshot, score the board and refuse one
// the gate would not take, write board.json and data.js, copy dashboard/ and
// screenshots/ while checking their shape, and write dossier.json last.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot, SnapshotError, type Snapshot } from './model.ts';
import { buildDossier } from '../vendor/makefun-board.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXT_LIMIT = 65_536;
const SHOT_LIMITS = { max: 4, max_bytes: 524_288 };
const DASH_LIMITS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** What a completed run produced, for the caller's summary. */
export interface RunReport {
  protocols: number;
  watchlist: number;
  rows: number;
  early: number;
  live: number;
  shots: number;
  out: string;
}

/** Print a reason, then end the process with `code`. */
function stop(reason: string, code: number): never {
  process.stderr.write(`token radar: ${reason}\n`);
  process.exit(code);
}

/** The value of --name, as `--name value` or `--name=value`, else `fallback`. */
function flag(argv: string[], name: string, fallback: string): string {
  const key = `--${name}`;
  const at = argv.indexOf(key);
  if (at !== -1 && at + 1 < argv.length) return argv[at + 1]!;
  const inline = argv.find((value) => value.startsWith(`${key}=`));
  return inline === undefined ? fallback : inline.slice(key.length + 1);
}

/** The snapshot file named by an --input value: the file itself, or snapshot.json inside a directory. */
function snapshotFrom(input: string): string {
  return input.endsWith('.json') ? input : join(input, 'snapshot.json');
}

/** Read and parse the snapshot, ending the run with a stated reason when either step fails. */
function loadSnapshot(path: string): Snapshot {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return stop(`no snapshot at ${path}: pass --input <snapshot.json|directory> or mount the sealed /input`, 2);
  }
  try {
    return parseSnapshot(text);
  } catch (error) {
    if (error instanceof SnapshotError) stop(error.message, 1);
    throw error;
  }
}

/** Copy every regular file of `from` into `to`, skipping dot names, and return the copied names. */
function copyDirectory(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    names.push(name);
  }
  return names;
}

/** Run the whole pipeline: parse arguments, build the board, write every output file. */
export function runPipeline(argv: string[], env: Record<string, string | undefined>): RunReport {
  const requested = flag(argv, 'input', '/input');
  const inputFile = snapshotFrom(requested);
  if (!existsSync(inputFile)) {
    stop(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`, 2);
  }
  const out = flag(argv, 'output', env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshot = loadSnapshot(inputFile);
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) stop(`the model wrote a board the gate refuses: ${issue}`, 1);

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(out, 'data.js'), dataScript(radar));

  copyDirectory(join(ROOT, 'dashboard'), join(out, 'dashboard'));
  const shots = copyDirectory(join(ROOT, 'screenshots'), join(out, 'screenshots'));
  if (shots.length < 3) {
    stop(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`, 1);
  }
  for (const name of shots) {
    if (!IMAGE_NAME.test(name)) stop(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`, 1);
  }

  // The dossier is written last: the scorer rebuilds it from this out/ and compares bytes.
  writeFileSync(
    join(out, 'dossier.json'),
    buildDossier(out, { text_max_bytes: TEXT_LIMIT, screenshots: SHOT_LIMITS, dashboard: DASH_LIMITS }),
  );

  return {
    protocols: snapshot.protocols.length,
    watchlist: snapshot.watchlist.length,
    rows: board.length,
    early: radar.early_size,
    live: radar.live_size,
    shots: shots.length,
    out,
  };
}
