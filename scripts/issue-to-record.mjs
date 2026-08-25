// issue-to-record.mjs — parse a "Register …" GitHub Issue Form submission into a
// validated record file under data/<entity>/. Security posture:
//   * ONLY whitelisted fields per entity are ever written (no arbitrary keys).
//   * The record id is generated server-side (never taken from user input).
//   * Values are stored as plain strings/arrays via JSON.stringify (no eval, no
//     template expansion) — the issue body is untrusted input.
//
// Invoked by .github/workflows/issue-to-pr.yml. Reads env, writes the file, and
// emits step outputs (file, entity, recordId, title) for the PR step.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const body = process.env.ISSUE_BODY || '';
const labels = (process.env.ISSUE_LABELS || '').split(',').map(s => s.trim());
const author = process.env.ISSUE_AUTHOR || 'unknown';
const now = new Date().toISOString();

// entity <- register:<entity> label. Each entity: id prefix, folder, and the
// allowed fields (issue-form label -> {key, type, [lookup]}).
const LIST = 'list';   // comma-separated -> array
const REF = 'ref';     // display name -> id via a lookup folder
const ENTITIES = {
  usecase: {
    folder: 'usecases', prefix: 'UC',
    fields: {
      'Use case title': { key: 'title' },
      'Industry': { key: 'industryId', type: REF, lookup: 'industries' },
      'Vertical': { key: 'verticalId', type: REF, lookup: 'verticals' },
      'Status': { key: 'status' },
      'Business problem': { key: 'businessProblem' },
      'Current process': { key: 'currentProcess' },
      'Proposed solution': { key: 'proposedSolution' },
      'Beneficiaries': { key: 'beneficiaries' },
      'Tags': { key: 'tags', type: LIST },
      'Components': { key: 'components', type: LIST },
      'Copilot role': { key: 'copilotRole' },
      'Services': { key: 'services', type: LIST },
      'Solution play': { key: 'solutionPlay' },
      'Business value': { key: 'businessValue' },
      'Estimated impact': { key: 'estimatedImpact' },
      'Owner name': { key: 'ownerName' },
      'Owner email': { key: 'ownerEmail' },
      'Reference URL': { key: 'referenceUrl' },
      'Repo URL': { key: 'repoUrl' }
    }
  },
  industry: {
    folder: 'industries', prefix: 'IND',
    fields: {
      'Industry name': { key: 'name' },
      'Description': { key: 'description' }
    }
  },
  vertical: {
    folder: 'verticals', prefix: 'VER',
    fields: {
      'Vertical name': { key: 'name' },
      'Industry': { key: 'industryId', type: REF, lookup: 'industries' },
      'Description': { key: 'description' }
    }
  },
  solutionplay: {
    folder: 'solutionplays', prefix: 'PLAY',
    fields: {
      'Solution play name': { key: 'name' },
      'Description': { key: 'description' }
    }
  },
  pattern: {
    folder: 'patterns', prefix: 'PAT',
    fields: {
      'Pattern name': { key: 'name' },
      'Summary': { key: 'summary' },
      'Repeatability': { key: 'repeatability' },
      'Solution play': { key: 'solutionPlay' },
      'Components': { key: 'components', type: LIST }
    }
  },
  event: {
    folder: 'events', prefix: 'EV',
    fields: {
      'Event title': { key: 'title' },
      'Start date': { key: 'startDate' },
      'End date': { key: 'endDate' },
      'Status': { key: 'status' },
      'Format': { key: 'format' },
      'Location': { key: 'location' },
      'Themes': { key: 'themes', type: LIST },
      'Organizers': { key: 'organizers', type: LIST },
      'Registration URL': { key: 'registrationUrl' },
      'Notes': { key: 'notes' }
    }
  }
};

function fail(msg) { console.error('issue-to-record:', msg); process.exit(0); } // exit 0 => no PR

const entityKey = (labels.find(l => l.startsWith('register:')) || '').split(':')[1];
const spec = ENTITIES[entityKey];
if (!spec) fail(`no register:<entity> label found (labels: ${labels.join(', ')})`);

// Parse "### Label\n\nvalue" blocks from the Issue Form body.
function parseForm(text) {
  const out = {};
  const parts = text.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const label = part.slice(0, nl < 0 ? part.length : nl).trim();
    let value = (nl < 0 ? '' : part.slice(nl + 1)).trim();
    if (value === '_No response_' || value === 'None') value = '';
    out[label] = value;
  }
  return out;
}

function lookupIdByName(folder, name) {
  const dir = join('data', folder);
  if (!existsSync(dir) || !name) return '';
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const rec = JSON.parse(readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, ''));
    if (String(rec.name).toLowerCase() === name.toLowerCase()) return rec.id;
  }
  return '';
}

function nextId(folder, prefix) {
  const dir = join('data', folder);
  let max = 0;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      const m = f.match(/-(\d+)\.json$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

const form = parseForm(body);
const rec = {};
for (const [label, def] of Object.entries(spec.fields)) {
  const raw = form[label];
  if (raw == null || raw === '') continue;
  if (def.type === LIST) {
    rec[def.key] = raw.split(',').map(s => s.trim()).filter(Boolean);
  } else if (def.type === REF) {
    const id = lookupIdByName(def.lookup, raw);
    if (id) rec[def.key] = id;
  } else {
    rec[def.key] = raw;
  }
}

// Server-side id + governance envelope (never from user input).
const id = nextId(spec.folder, spec.prefix);
rec.id = id;
rec.recordStatus = 'Active';
if (entityKey !== 'event') {           // events have no approval envelope
  rec.approvalStatus = 'Pending';
  rec.submittedBy = author;
  rec.submittedAt = now;
}
rec.createdBy = author;
rec.createdAt = now;
rec.modifiedBy = author;
rec.modifiedAt = now;

const dir = join('data', spec.folder);
mkdirSync(dir, { recursive: true });
const file = join(dir, `${id}.json`);
writeFileSync(file, JSON.stringify(rec, null, 2) + '\n');

const title = rec.title || rec.name || id;
const out = process.env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(out, `file=${file}\n`);
  appendFileSync(out, `entity=${entityKey}\n`);
  appendFileSync(out, `recordId=${id}\n`);
  appendFileSync(out, `title=${title.replace(/\n/g, ' ')}\n`);
}
console.log(`Wrote ${file}`);
