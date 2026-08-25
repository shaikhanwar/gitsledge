// build-data.mjs — compile the git-as-database record files into the JSON
// bundles the SPA reads. Runs in GitHub Actions (Node is preinstalled) on every
// push/merge, before the site is published to GitHub Pages.
//
//   data/<entity>/<id>.json   (source of truth, one record per file)
//        └──────────────►      site/data/<bundle>.json   ({ "<key>": [ ...records ] })
//
// The bundle shape is IDENTICAL to the original SLEDEdge seed files, so the
// existing local backend (store.js `loadSeed`) reads them unchanged.
//
//   node scripts/build-data.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, 'site', 'data');

// entity folder -> [bundle file, JSON key]
const bundles = {
  industries:    ['industries.json',    'industries'],
  verticals:     ['verticals.json',     'verticals'],
  solutionplays: ['solutionplays.json', 'solutionPlays'],
  usecases:      ['usecases.json',      'useCases'],
  events:        ['events.json',        'events'],
  patterns:      ['patterns.json',      'patterns']   // accelerators merged in below
};

function readRecords(folder) {
  const dir = join(dataDir, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

mkdirSync(outDir, { recursive: true });

let total = 0;
for (const [folder, [file, key]] of Object.entries(bundles)) {
  const records = readRecords(folder);
  const bundle = { [key]: records };
  // patterns bundle also carries accelerators (mirrors the seed file layout)
  if (folder === 'patterns') {
    bundle.accelerators = readRecords('accelerators');
    total += bundle.accelerators.length;
  }
  writeFileSync(join(outDir, file), JSON.stringify(bundle, null, 2) + '\n');
  total += records.length;
  console.log(`${key.padEnd(14)} -> site/data/${file} (${records.length}${folder === 'patterns' ? ` + ${bundle.accelerators.length} accelerators` : ''})`);
}
console.log(`\nDONE. ${total} records compiled into ${outDir}`);
