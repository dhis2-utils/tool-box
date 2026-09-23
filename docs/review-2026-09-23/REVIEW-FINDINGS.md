# Review findings: DHIS2 Admin Toolbox v1.0.0

Reviewed: 2026-09-23 · Scope: code review + functional test (assumed; none specified) ·
Reviewer: agent (Claude Code, Opus 5.5)
Commit: `8028a97` (`origin/main`, "Merge pull request #8 from dhis2-utils/org-move")
DHIS2 versions tested: 2.40.12, 2.41.10, 2.42.6, 2.43.1 (installed production zip)

## Summary

The app is small, well-structured and behaves correctly on all four versions: the table, status
tags, the non-ALL warning and both error paths pass the browser suite everywhere
(see [UI-TEST-RESULTS.md](UI-TEST-RESULTS.md)). `pnpm lint`, `pnpm test` (41) and
`pnpm test:index` (9) pass. One issue should be fixed before tagging `v1.0.0`: upgrading
from 0.1.5 keeps the app key but **renames the app's access authority**, so users who reach the
Toolbox through a user role rather than `ALL` lose access after the upgrade (H1). A one-line fix
was verified on all four versions.

## Findings

### HIGH

#### H1. Upgrading from 0.1.x silently revokes role-based access to the app

- **Where**: `d2.config.js:9` (`name: 'DHIS2-Admin-Toolbox'`)
- **What**: DHIS2 derives both the app key and the app's `M_…` authority from the manifest
  `short_name`, but differently: the key turns spaces into dashes, and the authority turns spaces
  into underscores while dropping dashes. 0.1.5 ships `short_name: "DHIS2 Admin Toolbox"`
  (key `DHIS2-Admin-Toolbox`, authority `M_DHIS2_Admin_Toolbox`); 1.0.0 ships
  `short_name: "DHIS2-Admin-Toolbox"` (same key, authority **`M_DHIS2AdminToolbox`**). The
  upgrade happens in place as intended, but every user role that granted the old authority now
  grants nothing. Reproduced on 2.40, 2.41, 2.42 and 2.43: a user with only
  `M_DHIS2_Admin_Toolbox` saw the app in `/api/apps` and could open it on 0.1.5; after installing
  1.0.0 their `/api/apps` was empty and `/api/apps/DHIS2-Admin-Toolbox/index.html` returned 404
  (2.40/2.41). Superusers (`ALL`) are unaffected, which is why the earlier upgrade check
  (key only, as admin) did not catch it.
- **Fix**: set `name: 'DHIS2 Admin Toolbox'` (spaces, the same string as 0.1.x's manifest name).
  The platform copies it to `short_name`; DHIS2 still derives the key `DHIS2-Admin-Toolbox`,
  and the authority stays `M_DHIS2_Admin_Toolbox`. Verified with a variant build on all four
  versions: 0.1.5 → variant upgrades in place under the same key, the role-only user keeps
  access, the apps-menu entry and launch URL are unchanged, and the full browser suite passes
  (2.42 and 2.43 inside the global shell). Side effects to carry along:
  - the bundle becomes `build/bundle/DHIS2 Admin Toolbox-1.0.0.zip`. The workflows use the
    `build/bundle/*.zip` glob, so they keep working. GitHub stores asset names with spaces
    replaced (expect `DHIS2.Admin.Toolbox-1.0.0.zip`); the index picks the first `.zip`, so that
    is harmless;
  - update the comment in `d2.config.js`, the `CLAUDE.md` rule ("`name` must stay
    `DHIS2-Admin-Toolbox`") and spec §6.1, which state the key-only reasoning;
  - add a unit test or CI check asserting the manifest `short_name` (e.g. read
    `build/app/manifest.webapp` after `pnpm build`) so this cannot regress silently.

  If the dashed name is kept instead, the CHANGELOG must tell admins to re-grant the
  "DHIS2AdminToolbox app" authority to roles after upgrading, and the old authority lingers in
  those roles.

### MEDIUM

#### M1. A stale index looks just like a current one

- **Where**: `src/components/Toolbox.tsx:71-75`, `.github/workflows/release-index.yml`
- **What**: the app's whole value is being current, but nothing flags an index that has stopped
  updating. Any non-404 GitHub response for any one repo (rate limit, 5xx) makes
  `scripts/build-release-index.mjs:36-38` throw and the day's run fail, and a disabled or
  broken schedule fails the same way. In both cases gh-pages keeps serving the last good file,
  and the app shows it with only a small grey "Index updated …" line. Admins deciding
  "Up to date" would never notice a week-old index.
- **Fix**: in `Toolbox.tsx`, when `generated_at` is more than about 3 days old, show a warning
  `NoticeBox` ("The tool index has not been updated since …; newer releases may be missing").
  It is pure and easy to unit-test next to the existing notices. Optionally have the workflow
  keep the previous entry for a tool whose lookup fails, rather than failing the whole run.

### LOW

#### L1. `releaseUrl` is carried through but never shown — `src/types.ts:38`, `src/lib/mergeTools.ts:55`, `src/components/ToolsTable.tsx:109-117`

When a release has no `.zip` asset the Download column shows `-` and gives no route to the
release. Either render a "Release page" link from `releaseUrl` as the fallback in that cell,
or remove the field from `ToolRow`. Today all 12 tools have a zip, so this has no visible
effect yet.

## Claims investigated and rejected

- **Claim**: `pnpm lint` fails on `main` (Prettier rejects `README.md`).
  **Source**: baseline run on the local `main` checkout.
  **Refuted by**: the local checkout was at `3f98b20`, behind `origin/main`. `8028a97`
  reformatted the README and `pnpm lint` passes there.
- **Claim**: the name `DHIS2-Admin-Toolbox` is required to keep the app key stable.
  **Source**: `d2.config.js` comment, `CLAUDE.md`, spec §6.1.
  **Refuted by**: live install on 2.40–2.43. `name: 'DHIS2 Admin Toolbox'` yields the same key,
  because DHIS2 turns the spaces into dashes. Only the authority differs (H1).
- **Claim**: a `tools.json` name could silently mismatch a tool's manifest (the known
  limitation in spec §3).
  **Refuted by**: downloaded every tool's latest release zip from the live index. All 12
  manifest `name`s equal their `tools.json` names exactly.
- **Claim**: 404 and console errors during the admin flow.
  **Refuted by**: the 404 is the header bar requesting `/api/staticContent/logo_banner`, which
  instances without a custom logo always return. The console errors are the platform's PWA
  "not a secure context" warning, caused by serving test instances over plain HTTP on a
  non-localhost host. Neither comes from app code.
- **Claim**: when `/api/apps` fails, the app does not render on 2.42.
  **Refuted by**: a test artifact. Mocking every `/api/apps` request also broke the global
  shell, which reads that endpoint to find the app. With the failure limited to the app's
  frame, the "Could not read installed apps" warning and "Unknown" statuses render on 2.42 and
  2.43.

## Environment gaps

None material. The tests used empty DHIS2 instances (no seed), with an org unit, a user role
and a user created for the non-ALL check. The app reads no metadata, so demo data would add
nothing. HTTPS serving (and the PWA/secure-context path) was not tested.
