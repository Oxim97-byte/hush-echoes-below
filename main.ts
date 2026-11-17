// HUSH — Echoes Below. The entry program (main.ts, Node 22, standard
// library only): it hands the game in. It copies the playable game and
// its screenshots into the output directory and writes dossier.json
// with the kit's library, exactly as the scorer rebuilds it.
//
// Run locally:  MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader: /output is the writable directory, /bot the repo.
import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) fail('game/ is missing');
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) fail('screenshots/ is missing');

// The output directory is already empty when the grader runs this
// (an empty writable /output). Never delete it: in the grader it is a
// bind-mount, and removing a mount point fails (EBUSY). Just make sure
// it exists, then write into it.
mkdirSync(outDir, { recursive: true });

// The whole game, as static files, and every screenshot, byte for byte.
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The dossier: the scorer rebuilds it from the same files with the
// same library and requires the two to match byte for byte.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`main.ts: wrote ${outDir} (dossier.json, ${dossier.length} bytes)`);
