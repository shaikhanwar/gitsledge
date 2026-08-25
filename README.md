# SLED Use Case Library

An internal catalog of reusable SLED use cases, industries, verticals, solution
plays, patterns, accelerators and events — hosted entirely on **GitHub**
(GitHub Pages + Issues + Pull Requests + Actions). **No SharePoint, no database,
no server.**

- **Browse:** the published site (GitHub Pages) — see the Pages URL in repo Settings.
- **Contribute:** open a *Register …* issue (Issues → New issue). Automation turns it
  into a Pull Request.
- **Approve/Publish:** an approver **merges** the Pull Request. Merge = publish.
- **Audit:** the full history is the git commit / PR history.

---

## How it works (git-as-database)

```
data/<entity>/<id>.json   ← the database: one file per record (source of truth)
        │  (GitHub Action: scripts/build-data.mjs)
        ▼
site/data/<bundle>.json   ← compiled bundles the app reads
        │  (GitHub Action: actions/deploy-pages)
        ▼
GitHub Pages              ← the live website (the SLED SPA)
```

- **Read:** `scripts/build-data.mjs` compiles `data/**` into the JSON bundles the
  single-page app in `site/` already knows how to read.
- **Write:** an *Register …* Issue Form → `.github/workflows/issue-to-pr.yml` runs
  `scripts/issue-to-record.mjs` → writes a new `data/<entity>/<id>.json` on a branch →
  opens a Pull Request.
- **Approve:** `CODEOWNERS` + branch protection require the **SLED Approvers** to review
  before merge. Merging triggers `deploy.yml` to rebuild and publish.

## Roles (GitHub permissions map to the 5-tier model)

| SLED role | GitHub access |
|---|---|
| Viewer | Read (can view the internal Pages site) |
| Member / Contributor | Write / Triage (can open *Register* issues & PRs) |
| Approver | Listed in `CODEOWNERS` / Maintain (can merge) |
| Owner | Admin (repo settings, Pages, teams) |

## Local development

No Node required to preview (use the PowerShell mirror). To rebuild the data bundles
and preview:

```powershell
# from the tools folder in the planning package
powershell -File ..\tools\build-data.ps1        # compile data/** -> site/data
# then serve site/ with any static server and open index.html
```

CI uses the Node build (`node scripts/build-data.mjs`) — Node is preinstalled on the
GitHub Actions runner.

## First-time setup (repo owner)

1. Create the repo and push this folder.
2. **Settings → Pages →** Source = **GitHub Actions**; set visibility **Internal**.
3. Create teams (or use your username in DEV) and edit **`.github/CODEOWNERS`** to the
   real team slug.
4. **Settings → Branches →** protect `main`: require a pull request + **Require review
   from Code Owners**.
5. Update `ISSUE_TEMPLATE/config.yml` with the Pages URL.
6. Push to `main` → the **Deploy site** Action publishes Pages.

## Layout

| Path | Purpose |
|---|---|
| `data/<entity>/*.json` | The records (database). |
| `site/` | The app (HTML/CSS/JS). |
| `scripts/build-data.mjs` | Compile records → bundles (CI). |
| `scripts/issue-to-record.mjs` | Turn a *Register* issue into a record file. |
| `.github/ISSUE_TEMPLATE/*.yml` | Capture forms. |
| `.github/workflows/*.yml` | `deploy.yml` (publish), `issue-to-pr.yml` (submit). |
| `.github/CODEOWNERS` | Approver gate. |
| `docs/SCHEMA.md` | Record field reference. |
