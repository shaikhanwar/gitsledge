// store.js — persistence for the SLED Use Case Library.
//
// Two backends behind one shared column map:
//   * Local  — seed JSON from data/ on first load, then read/write the browser's
//              localStorage so edits survive a reload during a demo.
//   * SharePoint — read every list via same-origin REST and write changes back
//              by reconciling each list against the in-memory db (create new,
//              update changed, delete removed) keyed on a business-key column.
//
// All SharePoint columns are Text / Note / Choice only (booleans stored as the
// text "Yes"/"No", multi-values as "; "-joined text) so a single string-based
// mapping round-trips with no type friction and provisioning stays simple.

import {
  buildIndustry, buildVertical, buildSolutionPlay, buildUseCase, buildEvent, buildPattern, buildAccelerator
} from './factory.js';
import { resolveSiteUrl, listName, SP_CONFIG } from './spconfig.js';

const LOCAL_KEY = 'sled.library.v2';

// Approval workflow columns shared by Industries, Verticals and Use Cases.
const APPROVAL_COLS = [
  ['ApprovalStatus', 'approvalStatus', 'text'],
  ['SubmittedByName', 'submittedBy', 'text'],
  ['SubmittedAtText', 'submittedAt', 'text'],
  ['ReviewedByName', 'reviewedBy', 'text'],
  ['ReviewedAtText', 'reviewedAt', 'text'],
  ['ReviewNote', 'reviewNote', 'text']
];

// ---- Column maps ----------------------------------------------------------
// kind: 'text' (string), 'list' (array <-> "; " text), 'bool' (boolean <-> Yes/No)
// One spec per list. `key` is the business-key column used for reconciliation.
const MAPS = {
  industries: {
    list: 'industries', key: 'IndustryId', build: buildIndustry,
    cols: [
      ['Title', 'name', 'text', true],
      ['IndustryId', 'id', 'text'],
      ['Description', 'description', 'text'],
      ['RecordStatus', 'recordStatus', 'text'],
      ...APPROVAL_COLS,
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  verticals: {
    list: 'verticals', key: 'VerticalId', build: buildVertical,
    cols: [
      ['Title', 'name', 'text', true],
      ['VerticalId', 'id', 'text'],
      ['IndustryId', 'industryId', 'text'],
      ['Description', 'description', 'text'],
      ['RecordStatus', 'recordStatus', 'text'],
      ...APPROVAL_COLS,
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  solutionPlays: {
    list: 'solutionPlays', key: 'SolutionPlayId', build: buildSolutionPlay,
    cols: [
      ['Title', 'name', 'text', true],
      ['SolutionPlayId', 'id', 'text'],
      ['Description', 'description', 'text'],
      ['RecordStatus', 'recordStatus', 'text'],
      ...APPROVAL_COLS,
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  useCases: {
    list: 'useCases', key: 'UseCaseId', build: buildUseCase,
    cols: [
      ['Title', 'title', 'text', true],
      ['UseCaseId', 'id', 'text'],
      ['IndustryId', 'industryId', 'text'],
      ['VerticalId', 'verticalId', 'text'],
      ['UCStatus', 'status', 'text'],
      ['BusinessProblem', 'businessProblem', 'text'],
      ['CurrentProcess', 'currentProcess', 'text'],
      ['ChallengeSummary', 'challengeSummary', 'text'],
      ['ProposedSolution', 'proposedSolution', 'text'],
      ['Beneficiaries', 'beneficiaries', 'text'],
      ['Tags', 'tags', 'list'],
      ['Components', 'components', 'list'],
      ['CopilotRole', 'copilotRole', 'text'],
      ['Services', 'services', 'list'],
      ['SolutionPlay', 'solutionPlay', 'text'],
      ['PatternId', 'patternId', 'text'],
      ['DataDependencies', 'dataDependencies', 'text'],
      ['Compliance', 'compliance', 'text'],
      ['Risks', 'risks', 'text'],
      ['BusinessValue', 'businessValue', 'text'],
      ['EstimatedImpact', 'estimatedImpact', 'text'],
      ['ImpactMetric', 'impactMetric', 'text'],
      ['Feasibility', 'feasibility', 'text'],
      ['Reusability', 'reusability', 'text'],
      ['OwnerName', 'ownerName', 'text'],
      ['OwnerEmail', 'ownerEmail', 'text'],
      ['ReferenceUrl', 'referenceUrl', 'text'],
      ['RepoUrl', 'repoUrl', 'text'],
      ['RecordStatus', 'recordStatus', 'text'],
      ...APPROVAL_COLS,
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  events: {
    list: 'events', key: 'EventId', build: buildEvent,
    cols: [
      ['Title', 'title', 'text', true],
      ['EventId', 'id', 'text'],
      ['StartDate', 'startDate', 'text'],
      ['EndDate', 'endDate', 'text'],
      ['EventStatus', 'status', 'text'],
      ['Format', 'format', 'text'],
      ['Location', 'location', 'text'],
      ['Themes', 'themes', 'list'],
      ['Organizers', 'organizers', 'list'],
      ['RegistrationUrl', 'registrationUrl', 'text'],
      ['Notes', 'notes', 'text'],
      ['RecordStatus', 'recordStatus', 'text'],
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  patterns: {
    list: 'patterns', key: 'PatternId', build: buildPattern,
    cols: [
      ['Title', 'name', 'text', true],
      ['PatternId', 'id', 'text'],
      ['Summary', 'summary', 'text'],
      ['Repeatability', 'repeatability', 'text'],
      ['SolutionPlay', 'solutionPlay', 'text'],
      ['Components', 'components', 'list'],
      ['AcceleratorIds', 'acceleratorIds', 'list'],
      ['RecordStatus', 'recordStatus', 'text'],
      ...APPROVAL_COLS,
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  accelerators: {
    list: 'accelerators', key: 'AcceleratorId', build: buildAccelerator,
    cols: [
      ['Title', 'name', 'text', true],
      ['AcceleratorId', 'id', 'text'],
      ['AccType', 'type', 'text'],
      ['PatternId', 'patternId', 'text'],
      ['Url', 'url', 'text'],
      ['RecordStatus', 'recordStatus', 'text'],
      ...APPROVAL_COLS,
      ['CreatedByName', 'createdBy', 'text'],
      ['CreatedAtText', 'createdAt', 'text'],
      ['ModifiedByName', 'modifiedBy', 'text'],
      ['ModifiedAtText', 'modifiedAt', 'text']
    ]
  },
  audit: {
    list: 'audit', key: 'AuditId', build: (p) => ({ ...p }),
    cols: [
      ['Title', 'recordTitle', 'text', true],
      ['AuditId', 'id', 'text'],
      ['RecordId', 'recordId', 'text'],
      ['RecordType', 'recordType', 'text'],
      ['Action', 'action', 'text'],
      ['Summary', 'summary', 'text'],
      ['ByName', 'by', 'text'],
      ['AtText', 'at', 'text']
    ]
  }
};

export const STORE_MAPS = MAPS;

// ---- Cell encode / decode -------------------------------------------------
function decode(value, kind) {
  if (kind === 'list') {
    if (Array.isArray(value)) return value;
    return String(value || '').split(/\s*;\s*/).map(s => s.trim()).filter(Boolean);
  }
  if (kind === 'bool') return value === true || /^(yes|true|1)$/i.test(String(value || ''));
  return value == null ? '' : String(value);
}
function encode(value, kind) {
  if (kind === 'list') return (Array.isArray(value) ? value : []).join('; ');
  if (kind === 'bool') return value ? 'Yes' : 'No';
  return value == null ? '' : String(value);
}

// Build a factory record from a plain row keyed by record-field names.
function rowToRecord(map, row) {
  const p = {};
  for (const [, field, kind] of map.cols) p[field] = decode(row[field], kind);
  return map.build(p);
}

// ---- Local backend (seed JSON + localStorage) -----------------------------
const SEED_FILES = {
  industries: 'data/industries.json',
  verticals: 'data/verticals.json',
  solutionPlays: 'data/solutionplays.json',
  useCases: 'data/usecases.json',
  events: 'data/events.json',
  patterns: 'data/patterns.json'
};

function emptyDb() {
  return { industries: [], verticals: [], solutionPlays: [], useCases: [], events: [], patterns: [], accelerators: [], audit: [] };
}

async function loadSeed() {
  const db = emptyDb();
  const entries = Object.entries(SEED_FILES);
  const results = await Promise.all(entries.map(([, url]) =>
    fetch(url).then(r => r.ok ? r.json() : null).catch(() => null)));
  entries.forEach(([key], i) => {
    const data = results[i];
    if (!data) return;
    if (key === 'patterns') {
      (data.patterns || []).forEach(p => db.patterns.push(buildPattern(p)));
      (data.accelerators || []).forEach(a => db.accelerators.push(buildAccelerator(a)));
    } else {
      const coll = data[key] || data[Object.keys(data)[0]] || [];
      const build = MAPS[key].build;
      coll.forEach(r => db[key].push(build(r)));
    }
  });
  return db;
}

export async function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const db = emptyDb();
      for (const key of Object.keys(db)) {
        const coll = saved[key] || [];
        const build = (MAPS[key] && MAPS[key].build) || ((x) => x);
        db[key] = coll.map(r => key === 'audit' ? r : build(r));
      }
      return db;
    }
  } catch { /* fall through to seed */ }
  return loadSeed();
}

export function saveLocal(db) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      industries: db.industries, verticals: db.verticals, solutionPlays: db.solutionPlays, useCases: db.useCases, events: db.events,
      patterns: db.patterns, accelerators: db.accelerators, audit: db.audit
    }));
    return true;
  } catch (e) { return false; }
}

export function resetLocal() {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
}

// ---- SharePoint backend (same-origin REST) --------------------------------
let _digest = { value: '', exp: 0 };

async function spFetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json;odata=nometadata', ...(init && init.headers) },
    credentials: 'same-origin'
  });
  if (!res.ok) throw new Error(`SharePoint ${res.status} ${res.statusText} on ${url}`);
  return res.json();
}

async function getDigest(site) {
  const now = Date.now();
  if (_digest.value && now < _digest.exp) return _digest.value;
  const j = await spFetchJson(`${site}/_api/contextinfo`, { method: 'POST' });
  const info = j.GetContextWebInformation || j;
  _digest = { value: info.FormDigestValue, exp: now + (info.FormDigestTimeoutSeconds - 60) * 1000 };
  return _digest.value;
}

async function readList(site, internal, map) {
  const select = map.cols.map(c => c[0]).concat('Id').join(',');
  let url = `${site}/_api/web/lists/getbytitle('${internal}')/items?$select=${select}&$top=${SP_CONFIG.pageSize}`;
  const rows = [];
  while (url) {
    const j = await spFetchJson(url);
    for (const it of (j.value || [])) {
      const row = { _spId: it.Id };
      for (const [col, field, kind] of map.cols) row[field] = decode(it[col], kind);
      rows.push(row);
    }
    url = j['odata.nextLink'] || j['@odata.nextLink'] || '';
  }
  return rows;
}

export async function loadSharePoint() {
  const site = resolveSiteUrl();
  const db = emptyDb();
  for (const [key, map] of Object.entries(MAPS)) {
    const internal = listName(key);
    const rows = await readList(site, internal, map);
    db[key] = rows.map(r => {
      const rec = key === 'audit' ? { ...r } : map.build(r);
      rec._spId = r._spId;
      return rec;
    });
  }
  return db;
}

function itemPayload(map, rec) {
  const body = {};
  for (const [col, field, kind] of map.cols) body[col] = encode(rec[field], kind);
  return body;
}

// SharePoint REST tunnels updates/deletes through POST using X-HTTP-Method.
async function spWrite(site, digest, url, body, method = 'POST') {
  const headers = {
    'Content-Type': 'application/json;odata=nometadata',
    Accept: 'application/json;odata=nometadata',
    'X-RequestDigest': digest
  };
  if (method === 'MERGE' || method === 'DELETE') {
    headers['IF-MATCH'] = '*';
    headers['X-HTTP-Method'] = method;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: method === 'DELETE' ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`SharePoint ${res.status} on ${url}`);
}

// Reconcile every list: create new records, update changed ones, delete those
// removed from the db. Matched on the business-key column.
export async function saveSharePoint(db) {
  const site = resolveSiteUrl();
  const digest = await getDigest(site);
  for (const [key, map] of Object.entries(MAPS)) {
    const internal = listName(key);
    const itemsUrl = `${site}/_api/web/lists/getbytitle('${internal}')/items`;
    const existing = await readList(site, internal, map);
    const keyField = map.cols.find(c => c[0] === map.key)[1];
    const byKey = new Map(existing.map(r => [String(r[keyField]), r]));
    const wantKeys = new Set();

    for (const rec of db[key]) {
      const k = String(rec[keyField]);
      wantKeys.add(k);
      const body = itemPayload(map, rec);
      const prior = byKey.get(k);
      if (!prior) {
        await spWrite(site, digest, itemsUrl, body, 'POST');
      } else {
        await spWrite(site, digest, `${itemsUrl}(${prior._spId})`, body, 'MERGE');
      }
    }
    for (const [k, prior] of byKey) {
      if (!wantKeys.has(k)) await spWrite(site, digest, `${itemsUrl}(${prior._spId})`, null, 'DELETE');
    }
  }
  return true;
}
