# Release index and App Platform migration

**Date:** 2026-09-22
**Status:** approved design, pending implementation plan
**Target version:** 1.0.0
**Base commit:** `580ce04` (origin/main, v0.1.5)

## 1. Problem

The DHIS2 Admin Toolbox lists the admin tools maintained by the DHIS2 implementation team, their latest GitHub releases, and the versions installed on the current instance. It does this by calling the GitHub API directly from the browser: releases, repo contents and package.json for each of eleven repos, about 33 requests per refresh. That exceeds GitHub's unauthenticated limit of 60 requests per hour, so every user has to create a personal access token and paste it into the app. This is the main friction point in using the app.

The app is also a vanilla-JavaScript webpack app with its own header-bar detection and dev proxy. It should move to the DHIS2 App Platform so it gets the platform shell, standard tooling and the same review process as other platform apps.

## 2. Goals

- No GitHub token, no per-user setup. The app works on first open.
- One request to GitHub-hosted infrastructure per page load.
- App Platform, TypeScript, `@dhis2/ui` components.
- Moving the repos to a new GitHub organisation is a configuration change only.
- Ship as one release, 1.0.0.

## 3. Non-goals

- Release-triggered index updates from each tool repo (`repository_dispatch`). Needs a token per tool repo. Daily plus manual dispatch is enough for now.
- App Hub publication.
- Installing tools from inside the app. CORS on GitHub release assets rules this out, as before.
- An optional token fallback. Dropped entirely.

## 4. Architecture

Two independent parts joined by one static file.

```
tools.json ──> release-index.yml (daily) ──> gh-pages/releases.json
                                                    │
                                                    ▼ (one fetch, CORS *)
DHIS2 instance ──/api/apps, /api/me──> Toolbox app ──> table
```

## 5. Release index

### 5.1 `tools.json` (repo root)

Curated list, one entry per tool, maintained by hand:

```json
[
  { "repo": "dhis2/tool-box", "name": "DHIS2 Admin Toolbox" },
  { "repo": "dhis2/tool-dashboard-pruner", "name": "..." }
]
```

Seeded from the eleven repos in the current `src/app.js`, with `name` taken from each repo's current `package.json` `manifest.webapp.name`. `name` is what the app matches against installed apps, so it must equal the app's manifest name exactly (case-insensitive). Moving organisations means editing the `repo` values.

### 5.2 `scripts/build-release-index.mjs`

Node script, no dependencies. Accepts an injectable `fetch` for tests.

- Reads `tools.json`.
- For each tool, `GET https://api.github.com/repos/{repo}/releases/latest` with `Authorization: Bearer $GITHUB_TOKEN` when set, `Accept: application/vnd.github+json`.
- 404: the tool has no release. Emit the entry with `version`, `tag`, `published_at`, `download_url`, `release_url` all `null`.
- Any other non-2xx or network error: exit non-zero. A stale index must never be overwritten with a broken one.
- `version` is `tag_name` with one leading `v` stripped.
- `download_url` is `browser_download_url` of the first asset whose name ends in `.zip`, or `null`.
- Writes `releases.json` (path from argv, default `./releases.json`), pretty-printed, tools in `tools.json` order.

### 5.3 `releases.json` format

```json
{
  "generated_at": "2026-09-22T03:00:12Z",
  "tools": [
    {
      "repo": "dhis2/tool-box",
      "name": "DHIS2 Admin Toolbox",
      "version": "0.1.5",
      "tag": "v0.1.5",
      "published_at": "2026-08-01T10:12:00Z",
      "download_url": "https://github.com/dhis2/tool-box/releases/download/v0.1.5/tool-box.zip",
      "release_url": "https://github.com/dhis2/tool-box/releases/tag/v0.1.5"
    }
  ]
}
```

### 5.4 `.github/workflows/release-index.yml`

- Triggers: `schedule` daily at 03:00 UTC; `workflow_dispatch`; `push` to `main` with `paths: [tools.json, scripts/build-release-index.mjs]`.
- Permissions: `contents: write`.
- Steps: checkout `main`; setup Node 22; run the script with `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`; checkout `gh-pages` into a subdirectory (create orphan branch if missing); copy `releases.json` and a `.nojekyll` file; commit as `github-actions[bot]` only if `git diff --quiet` reports a change; push.
- Action SHAs pinned, matching the existing workflows.

Committing to a branch rather than using the Pages artifact deploy is deliberate: GitHub disables scheduled workflows in public repos after 60 days without repository activity, and the daily commit keeps the repo active. The branch history doubles as a log of tool releases.

### 5.5 Manual step

A repo admin enables GitHub Pages: Settings, Pages, source "Deploy from a branch", branch `gh-pages`, folder `/`. Published URL: `https://dhis2.github.io/tool-box/releases.json`. Verified: `dhis2.github.io` serves `access-control-allow-origin: *` with a 10-minute cache.

## 6. Application

### 6.1 Platform and tooling

- `@dhis2/cli-app-scripts`, current major, TypeScript template.
- `d2.config.js`: `type: "app"`, `name: "tool-box"`, `title: "DHIS2 Admin Toolbox"` (unchanged title so DHIS2 upgrades the installed 0.1.5 in place), `minDHIS2Version: "2.40"`, `entryPoints.app: "./src/App.tsx"`.
- Custom icon: existing 96px logo copied to `public/dhis2-app-icon.png`.
- Lint and format: `@dhis2/cli-style` (`d2-style check` / `d2-style apply`). The existing eslint config is removed.
- Tests: Jest via `d2-app-scripts test`.
- Node 22.

### 6.2 Configuration

`src/config.ts`:

```ts
export const RELEASE_INDEX_URL =
    process.env.DHIS2_APP_RELEASE_INDEX_URL ??
    "https://dhis2.github.io/tool-box/releases.json"
```

The environment override exists for development and testing before the index is published, and for the organisation move. The exact env-var prefix the platform exposes is confirmed during implementation and documented in the README.

### 6.3 Source layout

```
src/
  App.tsx                    composes hooks, renders notices, loader, table
  config.ts                  RELEASE_INDEX_URL
  types.ts                   ReleaseIndex, ToolRelease, InstalledApp, ToolRow, ToolStatus
  hooks/useReleaseIndex.ts   fetch(RELEASE_INDEX_URL) -> { data, error, loading }
  hooks/useInstalledApps.ts  useDataQuery({ apps: { resource: "apps" } })
  hooks/useCurrentUser.ts    useDataQuery({ me: { resource: "me", params: { fields: "authorities" } } })
  lib/mergeTools.ts          (index, installedApps | undefined) -> ToolRow[]
  lib/compareVersions.ts     (a, b) -> -1 | 0 | 1
  components/ToolsTable.tsx  @dhis2/ui DataTable
```

### 6.4 Data model

```ts
type ToolStatus = "up-to-date" | "update-available" | "not-installed" | "no-release" | "unknown"

interface ToolRow {
    repo: string
    name: string
    latestVersion: string | null
    publishedAt: string | null
    downloadUrl: string | null
    releaseUrl: string | null
    installedVersion: string | null   // null when not installed or apps unavailable
    status: ToolStatus
}
```

`mergeTools` rules, in order:

1. Installed match: first installed app whose `name` equals the tool `name` case-insensitively.
2. `installedApps` undefined (apps endpoint failed): `installedVersion` null, status `unknown`.
3. No release (`version` null): status `no-release`.
4. Not installed: `not-installed`.
5. `compareVersions(installed, latest) < 0`: `update-available`, else `up-to-date`.

Rows are sorted by `name`.

`compareVersions`: strips one leading `v`, splits on `.` and `-`; numeric parts compare numerically, missing parts are 0; a version with a prerelease suffix is older than the same version without one. Non-numeric garbage compares as 0. No dependency.

### 6.5 Behaviour

- On load, fetch the index, installed apps and current user in parallel. Show `CircularLoader` until the index and apps settle.
- Header: title, then "Index updated <generated_at as local date and time>".
- Table columns: Tool (name linked to `https://github.com/{repo}`), Installed, Latest, Released, Status, Download.
- Status rendered as `@dhis2/ui` `Tag`: `positive` "Up to date"; "Update available" in the most attention-drawing non-error variant the installed `Tag` offers (`bold`, or `neutral` if that is all there is); default "Not installed", "No release yet" and "Unknown".
- Download is a link to `download_url` opening in a new tab, or "-" when null.
- No refresh button. Reload does the same job.

### 6.6 Error handling and notices

- Index fetch fails (network, non-2xx, invalid JSON): error `NoticeBox` titled "Could not load the tool index", body names `RELEASE_INDEX_URL` and suggests checking that the browser can reach `github.io` (firewall or proxy). Nothing else renders.
- Apps endpoint fails: warning `NoticeBox` "Could not read installed apps"; table renders with Installed "Unknown" and status `unknown`.
- Current user lacks `ALL` authority: warning `NoticeBox` "You do not have the ALL authority. DHIS2 only lists apps you have access to, so tools you cannot open may appear here as Not installed." Table renders normally. Exact wording is adjusted to what a non-superuser actually sees on a test instance.
- Current user fetch fails: no notice, treated as having `ALL`. It is advisory only.

### 6.7 Removed

`webpack.config.js`, `manifest.webapp`, `d2auth.json`, `d2auth.template.json`, `eslint.config.js`, `src/app.js`, `src/js/`, `src/resources/`, `src/css/`, `src/index.html`, `src/img/` (after copying the icon), `build/`, `compiled/`. The `dataStore/dhis2-toolbox` and `userDataStore/dhis2-toolbox` namespaces are no longer read or written; existing entries are left alone.

## 7. CI and release workflows

The untracked `ci.yml` and `release.yml` in the working tree are adopted with these changes. Pinned SHAs and `--ignore-scripts` install are kept.

- CI: `yarn install --frozen-lockfile --ignore-scripts`, `yarn lint` (`d2-style check`), `yarn test`, `yarn build`, upload `build/bundle/*.zip`.
- Release: same install and build; `gh release create` attaches `build/bundle/*.zip`. Changelog extraction and tag-mismatch warning unchanged.
- `webpack.yml` stays deleted.

`package.json` version `1.0.0`. CHANGELOG `## [1.0.0]` entry: GitHub token removed; releases read from a published index; migrated to DHIS2 App Platform and TypeScript; status column; authority warning; minimum DHIS2 2.40.

## 8. Testing

Automated (test-first):

- `compareVersions`: equal, major/minor/patch ordering, leading `v`, missing parts, prerelease older than release, garbage input.
- `mergeTools`: each of the five statuses, case-insensitive match, apps undefined, sort order.
- `build-release-index.mjs` with injected fetch: happy path, 404 tool, release with no zip asset, 500 aborts with non-zero exit.
- CI runs lint, test, build on PRs and pushes to `main`.

Manual, in the sandbox:

- Run the index script for real against GitHub (allowed by the egress firewall; eleven unauthenticated calls fit the limit). Check the output shape.
- Dev server bound to `$SANDBOX_HOST_PORT` against a broker instance, index URL overridden to the local file. Check all statuses, the no-release row, and both error notices by breaking the URL.
- Verify `/api/apps` visibility with a non-superuser and finalise the authority warning text.
- Build the zip. Install 0.1.5 then 1.0.0 via `POST /api/apps` and confirm in-place upgrade (one app, version 1.0.0).

After this work: multi-version pass on DHIS2 2.40 to 2.43 using the `dhis2-app-review` skill. Out of scope for this spec.

## 9. Git plan

- Branch `release-index-platform` from `580ce04`.
- Commits, in order, each self-contained and linear:
  1. Release index: `tools.json`, script, tests, workflow.
  2. App Platform rewrite in TypeScript.
  3. CI and release workflows for the platform build; version 1.0.0; CHANGELOG.
  4. README.
- Fix-ups squashed before handoff. No merge commits. Base commit stated at handoff for host-side re-signing.
- `docs/release-index-proposal.md` is not committed.

## 10. Open items resolved during implementation

- Exact env-var prefix exposed by the current `cli-app-scripts` for the index URL override.
- Confirmed `/api/apps` visibility rule for non-superusers.
- `Tag` variant for "Update available" once the available `@dhis2/ui` props are checked.
