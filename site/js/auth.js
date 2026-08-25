// auth.js — identity + role resolution and permission gating.
//
// Two layers of security:
//   1. SharePoint enforces the real permissions. The app talks to the lists as
//      the signed-in user, so any write the user isn't allowed to make fails
//      with a 403 regardless of what the UI shows.
//   2. This module mirrors those permissions in the UI so people only see the
//      buttons they can actually use, and applies the owner-based edit rule for
//      contributors (they may edit only the use cases they own).
//
// Roles (highest wins):
//   viewer       — read + download only.
//   contributor  — create use cases; edit/archive/upload on their OWN use cases.
//   curator       — edit anything; manage Industries, Patterns, Accelerators, Events.
//
// Role source:
//   SharePoint — IsSiteAdmin or a "Curator/Owner" group ⇒ curator;
//                a "Member/Contributor" group or AddListItems rights ⇒ contributor;
//                otherwise viewer.
//   Demo/local — ?role=viewer|contributor|curator or the saved demo role
//                (defaults to curator so the local demo stays fully editable).

import { resolveSiteUrl, inSharePointPage, listName } from './spconfig.js';

export const ROLES = ['viewer', 'contributor', 'curator'];
const DEMO_ROLE_KEY = 'sled-demo-role';

// SharePoint PermissionKind bit indices (1-based, all < 32 so they live in Low).
const ADD_LIST_ITEMS = 2;
const MANAGE_LISTS = 12;

let IDENTITY = {
  name: 'You',
  email: '',
  login: '',
  isAdmin: false,
  role: 'curator',     // safe default until loadIdentity() resolves
  groups: []
};

export const identity = () => IDENTITY;
export const role = () => IDENTITY.role;
export const isViewer = () => IDENTITY.role === 'viewer';
export const isContributor = () => IDENTITY.role === 'contributor';
export const isCurator = () => IDENTITY.role === 'curator';
export const currentUserName = () => IDENTITY.name || 'You';

function param(name) {
  const m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search);
  return m ? decodeURIComponent(m[1]) : '';
}

// ---- Demo role -----------------------------------------------------------
function readDemoRole() {
  const forced = (param('role') || '').toLowerCase();
  if (ROLES.includes(forced)) { try { localStorage.setItem(DEMO_ROLE_KEY, forced); } catch {} return forced; }
  try { const saved = localStorage.getItem(DEMO_ROLE_KEY); if (ROLES.includes(saved)) return saved; } catch {}
  return 'curator';
}
export function setDemoRole(r) {
  if (!ROLES.includes(r)) return;
  try { localStorage.setItem(DEMO_ROLE_KEY, r); } catch {}
  IDENTITY.role = r;
}

// ---- SharePoint role -----------------------------------------------------
function permHas(perms, kind) {
  if (!perms) return false;
  const low = Number(perms.Low) >>> 0;
  return (low & (1 << (kind - 1))) !== 0;
}

async function spJson(url, init) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json;odata=nometadata' },
    credentials: 'same-origin',
    ...init
  });
  if (!res.ok) throw new Error(`SharePoint ${res.status}`);
  return res.json();
}

async function loadSharePointIdentity() {
  const site = resolveSiteUrl();
  const me = await spJson(`${site}/_api/web/currentuser?$select=Title,Email,LoginName,IsSiteAdmin`);
  let groups = [];
  try {
    const g = await spJson(`${site}/_api/web/currentuser/groups?$select=Title`);
    groups = (g.value || []).map(x => x.Title || '');
  } catch { /* group read can be denied — fall back to permission probe */ }

  let perms = null;
  try {
    perms = await spJson(`${site}/_api/web/lists/getbytitle('${listName('useCases')}')/effectiveBasePermissions`);
  } catch { /* list may not exist yet */ }

  const isCuratorGroup = groups.some(t => /curator|owner/i.test(t));
  const isMemberGroup = groups.some(t => /member|contribut/i.test(t));

  // Group membership is authoritative when the user is in a recognizable SLED
  // group. The permission probe is only a FALLBACK for users who aren't in one.
  // (Important: the default SharePoint "Members" group has the *Edit* level,
  // which includes Manage Lists — so probing permissions first would wrongly
  // promote every Member to Curator and skip the approval workflow.)
  let resolved;
  if (me.IsSiteAdmin || isCuratorGroup) resolved = 'curator';
  else if (isMemberGroup) resolved = 'contributor';
  else if (permHas(perms, MANAGE_LISTS)) resolved = 'curator';
  else if (permHas(perms, ADD_LIST_ITEMS)) resolved = 'contributor';
  else resolved = 'viewer';

  IDENTITY = {
    name: me.Title || me.Email || 'User',
    email: me.Email || '',
    login: me.LoginName || '',
    isAdmin: !!me.IsSiteAdmin,
    role: resolved,
    groups
  };
}

// Resolve identity + role for the current backend. Never throws.
export async function loadIdentity() {
  if (inSharePointPage()) {
    try { await loadSharePointIdentity(); }
    catch (e) { console.warn('Identity lookup failed; defaulting to viewer.', e); IDENTITY = { ...IDENTITY, role: 'viewer' }; }
  } else {
    IDENTITY = {
      name: 'Demo User', email: 'demo.user@contoso.com', login: 'demo',
      isAdmin: false, role: readDemoRole(), groups: []
    };
  }
  return IDENTITY;
}

// ---- Ownership + permission helpers --------------------------------------
const sameEmail = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// A contributor "owns" a use case if the owner email matches their identity,
// or (handy in the demo) if they are the recorded creator.
export function isOwner(record) {
  if (!record) return false;
  return sameEmail(record.ownerEmail, IDENTITY.email) ||
    (!!IDENTITY.name && record.createdBy === IDENTITY.name);
}

// Can the current user create a record of this kind?
//   useCase / pattern / accelerator / solutionPlay ⇒ contributor or curator
//   (contributor items go to the approval queue). Everything else (industry,
//   vertical, event) ⇒ curator only.
export function canCreate(kind) {
  if (isViewer()) return false;
  if (kind === 'useCase' || kind === 'pattern' || kind === 'accelerator' || kind === 'solutionPlay') return true;
  return isCurator();
}

// Can the current user edit/archive this record?
//   use cases + patterns + solution plays: curator, or contributor who owns it.
//   Others: curator only.
export function canEdit(kind, record) {
  if (isCurator()) return true;
  if (kind === 'useCase' || kind === 'pattern' || kind === 'solutionPlay') return isContributor() && isOwner(record);
  return false;
}

// Uploading/removing Solution Architecture files follows the same rule as edit.
export const canUpload = (kind, record) => canEdit(kind, record);

// Managing the shared taxonomy (industries, patterns, accelerators, events).
export const canManageTaxonomy = () => isCurator();
export const canManageEvents = () => isCurator();

// Only Owners/Approvers (curators) review and approve/reject pending submissions.
export const canApprove = () => isCurator();

export function roleLabel() {
  return { viewer: 'Viewer', contributor: 'Contributor', curator: 'Curator' }[IDENTITY.role] || 'Viewer';
}
