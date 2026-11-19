// Vice City Cover Maker — the hand-in program (Node 22, standard library only).
// It stages the app for the grader: app/ and screenshots/ are copied from
// beside this file into the output directory, and dossier.json is written
// there with the vendored make.fun library. Run it twice and the two outputs
// are byte-identical, because nothing here depends on time or order.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function stageFolder(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return readdirSync(to).length;
}

function fail(message) {
  throw new Error(`vice-city-cover-maker: ${message}`);
}

mkdirSync(outputDir, { recursive: true });

// app/ is the entry: it must be present and hold index.html.
const appFiles = stageFolder('app');
if (appFiles === 0) fail('app/ is missing');
if (!existsSync(join(outputDir, 'app', 'index.html'))) fail('app/index.html is missing');

// screenshots/ is optional at staging time (the maker adds them), but when
// present it must hold real image files.
const shotCount = stageFolder('screenshots');
if (shotCount > 0) {
  for (const name of readdirSync(join(outputDir, 'screenshots'))) {
    const full = join(outputDir, 'screenshots', name);
    if (statSync(full).isFile() && !/\.(png|jpe?g)$/i.test(name)) {
      fail(`screenshots/${name} is not a PNG or JPEG`);
    }
  }
}

// The scorer's own caps (reference/gate.json): text_max_bytes is the only
// one that shapes the dossier's bytes; the rest refuse an entry the scorer
// would refuse anyway (too many screenshots, an oversized screenshot, an
// app/ over 993 files or 48 MiB, a path over 1000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
