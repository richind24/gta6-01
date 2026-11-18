// Cobalt Vice: Port Meridian — entrypoint for make.fun gta6-01.
// Copies the static game and the screenshots into the output directory and
// writes the dossier.json the judge reads, using the vendored make.fun library.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

mkdirSync(outDir, { recursive: true });
for (const folder of ['game', 'screenshots']) {
  cpSync(resolve(repoRoot, folder), resolve(outDir, folder), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// buildDossier returns the dossier bytes (a Uint8Array); write them raw.
writeFileSync(resolve(outDir, 'dossier.json'), dossier);
