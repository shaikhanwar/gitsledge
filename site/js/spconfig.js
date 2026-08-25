// spconfig.js — the ONLY place that knows anything tenant- or site-specific.
// Keeping every site detail here is what makes the app portable: to move the
// library to a different SharePoint site you change nothing in code — you
// re-provision the lists on the new site and re-upload these files. The app
// always talks to whatever site it is hosted on.
//
// How the target site is resolved (first match wins):
//   1. window.SLED_SITE_URL              — optional global set on the host page.
//   2. SP_CONFIG.siteUrlOverride         — optional explicit URL set below.
//   3. _spPageContextInfo.webAbsoluteUrl — the site the app is hosted in.
//   4. derived from the path when served from a SharePoint library.
//   5. location.origin                   — last-resort same-origin fallback.

export const SP_CONFIG = {
  // Leave blank for the portable default (use the current SharePoint site).
  // Set to a full web URL only to point a locally served copy at a remote site,
  // e.g. "https://vw4gr.sharepoint.com/sites/SLEDUseCaseLibraryDEV".
  siteUrlOverride: '',

  // List internal-name prefix. The provisioning script creates the lists as
  // SLEDUseCases, SLEDIndustries, … Change only if your tenant requires it,
  // then re-provision to match.
  listPrefix: 'SLED',

  // Max items to request per page. SharePoint caps a single response at 5000;
  // the adapter follows paging automatically beyond this.
  pageSize: 5000
};

// Logical list keys -> internal name suffix (prefix is applied via listName()).
export const LISTS = {
  industries: 'Industries',
  verticals: 'Verticals',
  solutionPlays: 'SolutionPlays',
  useCases: 'UseCases',
  events: 'Events',
  patterns: 'Patterns',
  accelerators: 'Accelerators',
  audit: 'AuditLog',
  // Document LIBRARY (not a list) — per-record Solution Architecture artifacts
  // (use cases AND patterns) live in folders named by record id under this
  // library. See app/js/docs.js.
  docs: 'SolutionArchitecture'
};

function deriveWebUrlFromLocation() {
  if (typeof location === 'undefined') return '';
  const path = location.pathname || '';
  const m = path.match(/^(.*?)\/(?:siteassets|style%20library|sitepages|shared%20documents|documents|lists)\//i);
  const webPath = m ? m[1] : '';
  return `${location.origin}${webPath}`;
}

function onSharePointHost() {
  return typeof location !== 'undefined' && /\.sharepoint\.com$/i.test(location.hostname || '');
}

export function resolveSiteUrl() {
  const fromGlobal = (typeof window !== 'undefined' && window.SLED_SITE_URL) || '';
  const fromCtx = (typeof window !== 'undefined' && window._spPageContextInfo &&
    window._spPageContextInfo.webAbsoluteUrl) || '';
  const url = fromGlobal || SP_CONFIG.siteUrlOverride || fromCtx ||
    (onSharePointHost() ? deriveWebUrlFromLocation() : '') ||
    (typeof location !== 'undefined' ? location.origin : '');
  return String(url).replace(/\/+$/, '');
}

export function inSharePointPage() {
  if (typeof window !== 'undefined' && window._spPageContextInfo &&
    window._spPageContextInfo.webAbsoluteUrl) return true;
  return onSharePointHost();
}

// Full internal list name for a logical list key (applies the configured prefix).
export function listName(key) {
  return `${SP_CONFIG.listPrefix || ''}${LISTS[key] || key}`;
}
