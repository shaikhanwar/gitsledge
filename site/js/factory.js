// factory.js — canonical entity builders for the SLED Use Case Library.
// Single source of truth for record shapes. Every form and the seed data build
// records through these so the model stays consistent (no undefined fields on
// any render path). The SharePoint columns mirror these field-for-field.

// ---- ID sequence ----------------------------------------------------------
let seq = 1;
export function resetSeq(n = 1) { seq = n; }
export function nextId(prefix) { return `${prefix}-${String(seq++).padStart(3, '0')}`; }

// Small helpers
const str = (v, d = '') => (v == null ? d : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean));
const bool = (v) => v === true || v === 'true' || v === 'on';

// ---- Audit (mirrors SharePoint Author / Created / Editor / Modified) ------
function auditFields(p = {}) {
  const createdBy = str(p.createdBy, 'Seed');
  const createdAt = str(p.createdAt);
  return {
    createdBy,
    createdAt,
    modifiedBy: str(p.modifiedBy) || createdBy,
    modifiedAt: str(p.modifiedAt) || createdAt
  };
}

// ---- Approval (Contributor submissions await Owner/Approver review) --------
// Seed and curator-created records default to 'Approved' so nothing is hidden
// on first load. Contributor create/edit flips this to 'Pending' (see app.js).
function approvalFields(p = {}) {
  return {
    approvalStatus: str(p.approvalStatus, 'Approved'),
    submittedBy: str(p.submittedBy),
    submittedAt: str(p.submittedAt),
    reviewedBy: str(p.reviewedBy),
    reviewedAt: str(p.reviewedAt),
    reviewNote: str(p.reviewNote)
  };
}

// ---- Industry (top of the SLED taxonomy) ----------------------------------
// A data-driven record: name + description. Verticals hang off an Industry
// (one-to-many) and use cases link to one Industry + one Vertical by id.
export function buildIndustry(p = {}) {
  return {
    id: p.id || nextId('IND-NEW'),
    name: str(p.name, 'Untitled Industry'),
    description: str(p.description),
    recordStatus: str(p.recordStatus, 'Active'),
    ...approvalFields(p),
    ...auditFields(p)
  };
}

// ---- Vertical (child of an Industry) --------------------------------------
// The former "Segment" concept, promoted to its own registrable record so new
// verticals can be added under any industry at runtime.
export function buildVertical(p = {}) {
  return {
    id: p.id || nextId('VER-NEW'),
    name: str(p.name, 'Untitled Vertical'),
    industryId: p.industryId || null,
    description: str(p.description),
    recordStatus: str(p.recordStatus, 'Active'),
    ...approvalFields(p),
    ...auditFields(p)
  };
}

// ---- Solution Play (data-driven choice; was a hardcoded list) --------------
// A registrable record so new solution plays can be added/updated at runtime.
// Use cases + patterns store the play by NAME (kept simple, no FK migration).
export function buildSolutionPlay(p = {}) {
  return {
    id: p.id || nextId('PLAY-NEW'),
    name: str(p.name, 'Untitled Solution Play'),
    description: str(p.description),
    recordStatus: str(p.recordStatus, 'Active'),
    ...approvalFields(p),
    ...auditFields(p)
  };
}

// ---- Pattern / Accelerator ------------------------------------------------
export function buildPattern(p = {}) {
  return {
    id: p.id || nextId('PAT-NEW'),
    name: str(p.name, 'Untitled Pattern'),
    summary: str(p.summary),
    repeatability: str(p.repeatability, 'Medium'),
    solutionPlay: str(p.solutionPlay || p.play),
    components: list(p.components),
    acceleratorIds: arr(p.acceleratorIds),
    recordStatus: str(p.recordStatus, 'Active'),
    ...approvalFields(p),
    ...auditFields(p)
  };
}

export function buildAccelerator(p = {}) {
  return {
    id: p.id || nextId('ACC-NEW'),
    name: str(p.name, 'Untitled Accelerator'),
    type: str(p.type, 'Solution accelerator'),
    patternId: p.patternId || null,
    url: str(p.url, '#'),
    recordStatus: str(p.recordStatus, 'Active'),
    ...approvalFields(p),
    ...auditFields(p)
  };
}

// ---- Event (standalone — renamed from Calendar, NOT linked to use cases) ---
export function buildEvent(p = {}) {
  return {
    id: p.id || nextId('EV-NEW'),
    title: str(p.title || p.name, 'Untitled Event'),
    startDate: str(p.startDate),
    endDate: str(p.endDate),
    status: str(p.status, 'Proposed'),
    format: str(p.format, 'In-person'),
    location: str(p.location),
    themes: list(p.themes),
    organizers: list(p.organizers),
    registrationUrl: str(p.registrationUrl, '#'),
    notes: str(p.notes),
    recordStatus: str(p.recordStatus, 'Active'),
    ...auditFields(p)
  };
}

// ---- Use case -------------------------------------------------------------
export function buildUseCase(p = {}) {
  return {
    id: p.id || nextId('UC-NEW'),
    title: str(p.title, 'Untitled Use Case'),
    industryId: p.industryId || null,
    verticalId: p.verticalId || null,
    status: str(p.status, 'Draft'),
    // Overview
    businessProblem: str(p.businessProblem),
    currentProcess: str(p.currentProcess),
    challengeSummary: str(p.challengeSummary),
    proposedSolution: str(p.proposedSolution),
    beneficiaries: str(p.beneficiaries),
    tags: list(p.tags),
    // Solution & tech
    components: list(p.components),
    copilotRole: str(p.copilotRole),
    services: list(p.services),
    solutionPlay: str(p.solutionPlay),
    patternId: p.patternId || null,
    dataDependencies: str(p.dataDependencies),
    compliance: str(p.compliance),
    risks: str(p.risks),
    // Value & impact
    businessValue: str(p.businessValue),
    estimatedImpact: str(p.estimatedImpact),
    impactMetric: str(p.impactMetric),
    feasibility: str(p.feasibility),
    reusability: str(p.reusability),
    // Owner
    ownerName: str(p.ownerName),
    ownerEmail: str(p.ownerEmail),
    // Artifacts
    referenceUrl: str(p.referenceUrl, '#'),
    repoUrl: str(p.repoUrl, '#'),
    recordStatus: str(p.recordStatus, 'Active'),
    ...approvalFields(p),
    ...auditFields(p)
  };
}
