// Solara Bay — entry program for the make.fun GTA 6 bounty (Node 22,
// standard library only). It hands the game in: copy this repository's
// game/ and screenshots/ into the output directory and write the dossier
// the judge reads, using the kit's vendored library. Run it locally with
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it twice with /output and requires byte-identical runs.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function handIn(): void {
  mkdirSync(outDir, { recursive: true });
  // Start from a clean output so a stale file can never leak into a run.
  rmSync(join(outDir, 'game'), { recursive: true, force: true });
  rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  }
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
