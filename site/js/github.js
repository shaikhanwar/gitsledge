// github.js - in-app GitHub sign-in + write path (Option B).
//
// Keeps the whole "Register" experience inside the SLED app: after a one-time
// GitHub sign-in, the branded forms create a record file on a branch and open a
// Pull Request via the GitHub REST API (api.github.com supports CORS from the
// browser). Publishing is still an approver merging the PR (CODEOWNERS-gated).
//
// The ONLY thing that cannot happen in the browser is the OAuth code->token
// exchange (GitHub's token endpoint has no CORS), so a tiny hosted proxy does
// just that one call. Configure it on the host page:
//   window.SLED_GITHUB = { repo:'owner/name', clientId:'...', authProxy:'https://.../token' };

const CFG = (typeof window !== 'undefined' && window.SLED_GITHUB) || {};
const REPO = CFG.repo || '';
const CLIENT_ID = CFG.clientId || '';
const AUTH_PROXY = CFG.authProxy || '';
const SCOPE = CFG.scope || 'public_repo';   // 'repo' if the repo is private
const TOKEN_KEY = 'sled.gh.token';
const STATE_KEY = 'sled.gh.state';
const RETURN_KEY = 'sled.gh.return';

// True only when the in-app write path is fully configured. When false, the app
// falls back to the GitHub Issue Form links.
export const ghConfigured = () => !!(REPO && CLIENT_ID && AUTH_PROXY);
export const ghToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const ghSignedIn = () => !!ghToken();
export function ghSignOut() { try { sessionStorage.removeItem(TOKEN_KEY); } catch {} }

// Redirect to GitHub's authorize page. Returns to this page with ?code=&state=.
export function ghSignIn(returnHash) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, returnHash || location.hash || '#/home');
  } catch {}
  const redirect = location.origin + location.pathname;   // page, no hash/query
  const url = 'https://github.com/login/oauth/authorize'
    + `?client_id=${encodeURIComponent(CLIENT_ID)}`
    + `&scope=${encodeURIComponent(SCOPE)}`
    + `&state=${encodeURIComponent(state)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}`;
  location.href = url;
}

// Call once at startup. If we came back from GitHub with a code, exchange it via
// the proxy, store the token, restore the prior view, and clean the URL.
export async function ghHandleRedirect() {
  let q;
  try { q = new URLSearchParams(location.search); } catch { return false; }
  const code = q.get('code');
  const state = q.get('state');
  if (!code) return false;
  const expected = (() => { try { return sessionStorage.getItem(STATE_KEY); } catch { return ''; } })();
  const ret = (() => { try { return sessionStorage.getItem(RETURN_KEY); } catch { return ''; } })() || '#/home';
  if (!state || state !== expected) { cleanUrl(ret); return false; }
  try {
    const res = await fetch(AUTH_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const j = await res.json().catch(() => ({}));
    if (j.access_token) { try { sessionStorage.setItem(TOKEN_KEY, j.access_token); } catch {} }
  } catch (e) { console.error('token exchange failed', e); }
  cleanUrl(ret);
  return ghSignedIn();
}

function cleanUrl(hash) {
  const base = location.origin + location.pathname + (hash || '#/home');
  try { history.replaceState({}, '', base); } catch {}
}

async function api(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': `Bearer ${ghToken()}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {})
    },
    body: opts.body
  });
  if (res.status === 401) { ghSignOut(); throw new Error('Your GitHub session expired - please sign in again.'); }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

export async function ghCurrentUser() { return api('/user'); }

// entity key -> data folder + id prefix (mirrors scripts/issue-to-record.mjs).
const ENTITY = {
  usecase:      { folder: 'usecases',      prefix: 'UC' },
  industry:     { folder: 'industries',    prefix: 'IND' },
  vertical:     { folder: 'verticals',     prefix: 'VER' },
  solutionplay: { folder: 'solutionplays', prefix: 'PLAY' },
  pattern:      { folder: 'patterns',      prefix: 'PAT' },
  event:        { folder: 'events',        prefix: 'EV' }
};

// Next id from ids already loaded in the app (e.g. existing IND-004 -> IND-005).
export function ghNextId(existingIds, prefix) {
  let max = 0;
  for (const id of existingIds || []) {
    const m = String(id).match(/-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

const b64 = (str) => btoa(unescape(encodeURIComponent(str)));

// Create a branch, commit the record file, and open a PR. Returns the PR URL.
// Governance fields (Pending status, author, timestamps) are stamped here using
// the signed-in GitHub identity, mirroring scripts/issue-to-record.mjs.
export async function ghSubmit(entityKey, record) {
  const spec = ENTITY[entityKey];
  if (!spec) throw new Error('unknown entity ' + entityKey);
  if (!ghSignedIn()) throw new Error('not signed in');
  const [owner, repo] = REPO.split('/');
  const login = await ghCurrentUser().then(u => u.login).catch(() => 'user');
  const now = new Date().toISOString();
  const rec = { ...record, recordStatus: 'Active', createdBy: login, createdAt: now, modifiedBy: login, modifiedAt: now };
  if (entityKey !== 'event') { rec.approvalStatus = 'Pending'; rec.submittedBy = login; rec.submittedAt = now; }
  const branch = `submission/${rec.id}-${Date.now().toString(36)}`;

  const ref = await api(`/repos/${owner}/${repo}/git/ref/heads/main`);
  const baseSha = ref.object.sha;
  await api(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
  });

  const path = `data/${spec.folder}/${rec.id}.json`;
  const content = b64(JSON.stringify(rec, null, 2) + '\n');
  await api(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Add ${entityKey} ${rec.id}`, content, branch })
  });

  const title = rec.title || rec.name || rec.id;
  const pr = await api(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `Register ${entityKey}: ${title}`,
      head: branch, base: 'main',
      body: `Submitted from the SLED app by @${login}. Merge to publish (approval enforced by CODEOWNERS).`
    })
  });
  return pr.html_url;
}
