// constants.js — SLED choice sets and the canonical column maps shared by the
// local store and the SharePoint adapter. Keeping the value sets here means the
// forms, filters, seed data and list provisioning all agree on the same options.
//
// NOTE: Industries and their Verticals are NO LONGER hardcoded here — they are
// data-driven records (see the Industries + Verticals lists / seed data) so new
// industries and verticals can be added at runtime without a code change.

// Approval workflow states. Content created/edited by a Contributor is held as
// 'Pending' until an Owner/Approver (Curator) approves it. Curator changes and
// seed data are 'Approved' immediately.
export const APPROVAL_STATUS = ['Approved', 'Pending', 'Rejected'];

// Microsoft solution plays are now a data-driven, registrable entity (see the
// Solution Plays list / seed data) — no longer a hardcoded choice set here.

// Lifecycle status that replaces the old hackathon scoring band.
export const STATUSES = ['Draft', 'In Review', 'Published'];

// Keyword tags for filtering.
export const TAGS = [
  'AI', 'Copilot', 'Automation', 'Citizen Experience', 'Data & Analytics',
  'Security / Cybersecurity', 'Compliance', 'Cost Savings', 'Cloud Migration', 'Accessibility'
];

export const REPEATABILITY = ['High', 'Medium', 'Low'];

export const ACCELERATOR_TYPES = [
  'Solution accelerator', 'Repo template', 'Flow template', 'Sample app', 'Documentation'
];

export const EVENT_STATUS = ['Proposed', 'Confirmed', 'Open for registration', 'Closed'];
export const EVENT_FORMAT = ['In-person', 'Virtual', 'Hybrid'];

// Record lifecycle (soft archive) state, mirrors HCL.
export const RECORD_STATUS = ['Draft', 'Active', 'Archived'];

// Map of the status badge CSS class for a use-case status value.
export const STATUS_CLASS = {
  'Draft': 'draft',
  'In Review': 'review',
  'Published': 'published'
};
