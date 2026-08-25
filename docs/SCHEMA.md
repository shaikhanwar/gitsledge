# Record schema

One JSON file per record under `data/<entity>/<id>.json`. Fields mirror the canonical
builders in `site/js/factory.js` (the app fills any missing field with a safe default on
read, so partial records are valid). Lists are JSON arrays. Governance fields
(`approvalStatus`, `submitted*`, `reviewed*`) and audit stamps (`created*`, `modified*`)
are set by automation, not by contributors.

Common envelope (most entities): `id`, `recordStatus` (`Active`/`Archived`),
`approvalStatus` (`Approved`/`Pending`/`Rejected`), `submittedBy/At`, `reviewedBy/At`,
`reviewNote`, `createdBy/At`, `modifiedBy/At`. **Events have no approval envelope.**

## industries — `IND-###`
`name`, `description`

## verticals — `VER-###`
`name`, `industryId` (→ industries), `description`

## solutionplays — `PLAY-###`
`name`, `description`

## usecases — `UC-###`
`title`, `industryId` (→ industries), `verticalId` (→ verticals),
`status` (`Draft`/`In Review`/`Published`), `businessProblem`, `currentProcess`,
`challengeSummary`, `proposedSolution`, `beneficiaries`, `tags[]`, `components[]`,
`copilotRole`, `services[]`, `solutionPlay`, `patternId` (→ patterns),
`dataDependencies`, `compliance`, `risks`, `businessValue`, `estimatedImpact`,
`impactMetric`, `feasibility`, `reusability`, `ownerName`, `ownerEmail`,
`referenceUrl`, `repoUrl`

## patterns — `PAT-###`
`name`, `summary`, `repeatability` (`High`/`Medium`/`Low`), `solutionPlay`,
`components[]`, `acceleratorIds[]` (→ accelerators)

## accelerators — `ACC-###`
`name`, `type`, `patternId` (→ patterns), `url`
> Compiled into `patterns.json` alongside patterns (mirrors the app's seed layout).

## events — `EV-###` (no approval envelope)
`title`, `startDate`, `endDate`, `status`, `format`, `location`, `themes[]`,
`organizers[]`, `registrationUrl`, `notes`
