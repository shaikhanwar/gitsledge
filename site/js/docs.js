// docs.js — Solution Architecture artifacts for each record (use cases & patterns).
//
// One capability, two backends (mirrors store.js):
//   * SharePoint — files live in a real document library (SLEDSolutionArchitecture),
//                  one folder per record named by its id (UC-… or PAT-…). Read/
//                  upload/delete go through same-origin REST as the signed-in
//                  user, so SharePoint enforces real permissions and versioning.
//   * Local/demo — no SharePoint and localStorage is too small for binaries, so
//                  files are kept in IndexedDB keyed by record id. Upload, list,
//                  download and delete all work for the demo.
//
// Both backends return the same shape so the UI does not care which is active:
//   { name, size, modified, href, kind, _ref }

import { resolveSiteUrl, listName, inSharePointPage } from './spconfig.js';

// ---- Policy ---------------------------------------------------------------
export const ALLOWED_EXT = ['pptx', 'ppt', 'pdf', 'docx', 'xlsx', 'vsdx', 'vsd', 'png', 'jpg', 'jpeg', 'gif', 'svg'];
export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'svg'];
export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export function extOf(name) {
  const m = /\.([^.]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}
export function isAllowed(name) {
  return ALLOWED_EXT.includes(extOf(name));
}
export function isImage(name) {
  return IMAGE_EXT.includes(extOf(name));
}
// Keep a safe, SharePoint-legal file name (strip path + reserved characters).
export function safeName(name) {
  return String(name || 'file')
    .replace(/^.*[\\/]/, '')
    .replace(/["*:<>?/\\|#%]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'file';
}
export function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const onSharePoint = () => inSharePointPage();

// ===========================================================================
// SharePoint backend
// ===========================================================================
const LIB = () => listName('docs'); // e.g. "SLEDSolutionArchitecture"

let _digest = { value: '', exp: 0 };
async function digest(site) {
  const now = Date.now();
  if (_digest.value && now < _digest.exp) return _digest.value;
  const res = await fetch(`${site}/_api/contextinfo`, {
    method: 'POST',
    headers: { Accept: 'application/json;odata=nometadata' },
    credentials: 'same-origin'
  });
  if (!res.ok) throw new Error(`SharePoint ${res.status} requesting form digest`);
  const j = await res.json();
  const info = j.GetContextWebInformation || j;
  _digest = { value: info.FormDigestValue, exp: now + (info.FormDigestTimeoutSeconds - 60) * 1000 };
  return _digest.value;
}

function webServerRelative(site) {
  try { return new URL(site).pathname.replace(/\/+$/, ''); }
  catch { return ''; }
}
// Plain, un-encoded server-relative folder path for a use case.
function folderPath(site, useCaseId) {
  return `${webServerRelative(site)}/${LIB()}/${useCaseId}`;
}
const q = (s) => String(s).replace(/'/g, "''"); // escape single quotes for REST string literals

async function ensureFolder(site, dgst, useCaseId) {
  const path = folderPath(site, useCaseId);
  const res = await fetch(`${site}/_api/web/folders/addUsingPath(decodedurl='${q(path)}',overwrite=false)`, {
    method: 'POST',
    headers: { Accept: 'application/json;odata=nometadata', 'X-RequestDigest': dgst },
    credentials: 'same-origin'
  });
  // 200 = created, 4xx (already exists) is fine — only surface hard failures.
  if (!res.ok && res.status !== 409 && res.status !== 500 && res.status !== 400) {
    throw new Error(`SharePoint ${res.status} creating folder`);
  }
}

async function spList(useCaseId) {
  const site = resolveSiteUrl();
  const path = folderPath(site, useCaseId);
  const url = `${site}/_api/web/GetFolderByServerRelativeUrl('${q(path)}')/Files` +
    `?$select=Name,ServerRelativeUrl,TimeLastModified,Length`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json;odata=nometadata' },
    credentials: 'same-origin'
  });
  if (res.status === 404) return [];            // folder not created yet
  if (!res.ok) throw new Error(`SharePoint ${res.status} listing documents`);
  const j = await res.json();
  const origin = new URL(site).origin;
  return (j.value || []).map(f => ({
    name: f.Name,
    size: Number(f.Length) || 0,
    modified: f.TimeLastModified || '',
    href: origin + f.ServerRelativeUrl,
    kind: 'sharepoint',
    _ref: f.ServerRelativeUrl
  }));
}

async function spUpload(useCaseId, file) {
  const site = resolveSiteUrl();
  const dgst = await digest(site);
  await ensureFolder(site, dgst, useCaseId);
  const path = folderPath(site, useCaseId);
  const name = safeName(file.name);
  const buf = await file.arrayBuffer();
  const url = `${site}/_api/web/GetFolderByServerRelativeUrl('${q(path)}')` +
    `/Files/add(url='${q(name)}',overwrite=true)`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json;odata=nometadata', 'X-RequestDigest': dgst },
    credentials: 'same-origin',
    body: buf
  });
  if (!res.ok) throw new Error(`SharePoint ${res.status} uploading ${name}`);
}

async function spDelete(doc) {
  const site = resolveSiteUrl();
  const dgst = await digest(site);
  const res = await fetch(`${site}/_api/web/GetFileByServerRelativeUrl('${q(doc._ref)}')`, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=nometadata',
      'X-RequestDigest': dgst,
      'IF-MATCH': '*',
      'X-HTTP-Method': 'DELETE'
    },
    credentials: 'same-origin'
  });
  if (!res.ok) throw new Error(`SharePoint ${res.status} deleting ${doc.name}`);
}

// ===========================================================================
// Local backend (IndexedDB)
// ===========================================================================
const IDB_NAME = 'sled-docs';
const IDB_STORE = 'files';
let _idb = null;

function idb() {
  if (_idb) return _idb;
  _idb = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const dbi = req.result;
      if (!dbi.objectStoreNames.contains(IDB_STORE)) {
        const os = dbi.createObjectStore(IDB_STORE, { keyPath: 'key' });
        os.createIndex('byUseCase', 'useCaseId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _idb;
}
function tx(mode) {
  return idb().then(dbi => dbi.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
}

async function localList(useCaseId) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const out = [];
    const idx = store.index('byUseCase');
    const req = idx.openCursor(IDBKeyRange.only(useCaseId));
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(out); return; }
      const r = cur.value;
      out.push({
        name: r.name, size: r.size, modified: r.modified,
        href: URL.createObjectURL(r.blob), kind: 'local', _ref: r.key
      });
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

async function localUpload(useCaseId, file) {
  const name = safeName(file.name);
  const rec = {
    key: `${useCaseId}/${name}`,
    useCaseId, name, size: file.size, modified: new Date().toISOString(),
    blob: file
  };
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(rec);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function localDelete(doc) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(doc._ref);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===========================================================================
// Public API — backend chosen the same way the rest of the app chooses it.
// `recordId` is any record id (use case "UC-…" or pattern "PAT-…").
// ===========================================================================
export function listDocuments(recordId) {
  return onSharePoint() ? spList(recordId) : localList(recordId);
}
export function uploadDocument(recordId, file) {
  return onSharePoint() ? spUpload(recordId, file) : localUpload(recordId, file);
}
export function deleteDocument(doc) {
  return onSharePoint() ? spDelete(doc) : localDelete(doc);
}
