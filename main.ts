// Leonida Poster Lab — entrypoint for gta6-cover-art-01 (Node 22, stdlib only).
//
// The app itself is plain static files under app/: index.html plus its
// scripts, styles, fonts and sample pictures, all loaded locally with no
// network. This program hands it in: it copies app/ and screenshots/ from
// beside this file into /output and writes /output/dossier.json, the summary
// the judge reads, using the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (see the kit's RULES.txt): only text_max_bytes
// shapes the dossier's bytes; the rest refuse an entry the scorer would
// refuse anyway (more than 4 screenshots or one over 256 KiB; more than
// 993 files in app/ or 48 MiB of app files in all).
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, buildDossier(out, DOSSIER_LIMITS));

// One build summary line for the terminal; the grader ignores stdout.
console.log(`Leonida Poster Lab: dossier ${statSync(dossierPath).size} bytes -> ${out}`);
