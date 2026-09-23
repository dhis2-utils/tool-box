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

One entry, `dhis2/tool-user-role-aggregator`, reflects a mid-project rename (renamed on GitHub; the API 301-redirects the old name).

Known limitation: `name` in `tools.json` is the join key against `/api/apps` and nothing enforces it; a typo or an upstream title change silently shows a tool as Not installed. Possible follow-up: have the index workflow read each repo's manifest name and warn when it diverges.

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
- Steps: checkout `main`; setup Node 22; run the script with `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`; checkout `gh-pages` into a subdirectory (create orphan branch if missing); copy `releases.json` and a `.nojekyll` file; commit on every run: `generated_at` changes each time, and the daily commit is what keeps the repository active so GitHub does not disable the schedule after 60 days without repository activity; push.
- Action SHAs pinned, matching the existing workflows.

Committing to a branch rather than using the Pages artifact deploy is deliberate: GitHub disables scheduled workflows in public repos after 60 days without repository activity, and the daily commit keeps the repo active. The branch history doubles as a log of tool releases.

Whether commits pushed with the default `GITHUB_TOKEN` count as repository activity for GitHub's 60-day schedule timer is not guaranteed. If the schedule stops after two months, re-enable it (`gh workflow enable "Release index"`) or trigger `workflow_dispatch`; a small human commit also resets the timer.

### 5.5 Manual step

A repo admin enables GitHub Pages: Settings, Pages, source "Deploy from a branch", branch `gh-pages`, folder `/`. Published URL: `https://dhis2.github.io/tool-box/releases.json`. Verified: `dhis2.github.io` serves `access-control-allow-origin: *` with a 10-minute cache.

## 6. Application

### 6.1 Platform and tooling

- `@dhis2/cli-app-scripts`, current major, TypeScript template.
- `d2.config.js`: `type: "app"`, `name: "DHIS2-Admin-Toolbox"`, `title: "DHIS2 Admin Toolbox"`, `minDHIS2Version: "2.40"`, `entryPoints.app: "./src/App.tsx"`. DHIS2 identifies an installed app by its key, which is the manifest `short_name` with spaces turned into dashes; the platform writes `short_name` from `name`. The 0.1.x releases were installed under the key `DHIS2-Admin-Toolbox`, so `name` must stay exactly that for 1.0.0 to upgrade in place (verified on 2.43.1: with `name: tool-box` the app installed as a second entry). The bundle is therefore `build/bundle/DHIS2-Admin-Toolbox-<version>.zip`.
- Custom icon: existing 96px logo copied to `public/dhis2-app-icon.png`.
- Lint and format: eslint 9 with `@dhis2/config-eslint` plus `eslint-import-resolver-typescript`, and prettier with `@dhis2/config-prettier` (the scaffold defaults). `pnpm lint` runs eslint, prettier and `tsc --noEmit`.
- Package manager: pnpm 10.13.1; `pnpm-workspace.yaml` declares darwin+linux / arm64+x64 so the host and the sandbox share one `node_modules`.
- Data access: TanStack Query 4; DHIS2 resources through `src/utils/useApiDataQuery.ts` (app-runtime engine inside `useQuery`), the index through plain `fetch`.
- Jest: root `jest.config.js` maps the `@/` alias and re-exports the platform's default moduleNameMapper (the platform's Jest has no alias mapping); `jest.setup.ts` loads jest-dom and sets `data-test` as the test id attribute.
- Tests: Jest via `d2-app-scripts test`.
- Node 22.

### 6.2 Configuration

`src/config.ts`:

```ts
export const RELEASE_INDEX_URL =
    process.env.DHIS2_RELEASE_INDEX_URL ??
    "https://dhis2.github.io/tool-box/releases.json"
```

The env var is `DHIS2_RELEASE_INDEX_URL`, read from `process.env`; the platform only exposes vars with the `DHIS2_` prefix. The override exists for development and testing before the index is published, and for the organisation move. `types/global.d.ts` declares the minimal `process.env` shape `config.ts` needs, since `@types/node` is not available to app code.

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
- Status rendered as `@dhis2/ui` `Tag`: `positive` "Up to date"; `neutral bold` "Update available"; default for "Not installed", "No release yet" and "Unknown".
- Installed column shows "-" when not installed and "Unknown" when apps are unavailable.
- Download is a link to `download_url` opening in a new tab, or "-" when null.
- No refresh button. Reload does the same job.

### 6.6 Error handling and notices

- Index fetch fails (network, non-2xx, invalid JSON): error `NoticeBox` titled "Could not load the tool index", body names `RELEASE_INDEX_URL` and suggests checking that the browser can reach `github.io` (firewall or proxy). Nothing else renders. Interpolated values in `i18n.t` must not be HTML-escaped (`interpolation: { escapeValue: false }`), otherwise the URL renders with `&#x2F;`; React already escapes rendered output, so i18next's own escaping would only double-escape it.
- Apps endpoint fails: warning `NoticeBox` "Could not read installed apps"; table renders with Installed "Unknown" and status `unknown`.
- Current user lacks `ALL` authority: warning `NoticeBox` titled "Limited view of installed apps": "You do not have the ALL authority. DHIS2 only lists apps you have access to, so tools you cannot open may appear here as not installed." Table renders normally. Verified on DHIS2 2.43.1: a user with only `M_dhis-web-dashboard` sees 4 apps in `/api/apps` while a superuser sees 31, and does not see the installed Toolbox.
- Current user fetch fails: no notice, treated as having `ALL`. It is advisory only.

### 6.7 Removed

`webpack.config.js`, `manifest.webapp`, `d2auth.json`, `d2auth.template.json`, `eslint.config.js`, `src/app.js`, `src/js/`, `src/resources/`, `src/css/`, `src/index.html`, `src/img/` (after copying the icon), `build/`, `compiled/`. The `dataStore/dhis2-toolbox` and `userDataStore/dhis2-toolbox` namespaces are no longer read or written; existing entries are left alone.

## 7. CI and release workflows

The untracked `ci.yml` and `release.yml` in the working tree are adopted with these changes. Pinned action SHAs are kept. pnpm is installed with `npm install -g pnpm@10.13.1` and dependencies with `pnpm install --frozen-lockfile`; `--ignore-scripts` is dropped because pnpm 10 already runs only the lifecycle scripts allowed in `pnpm-workspace.yaml`.

- CI: on pull requests and pushes to `main`: `pnpm lint` (eslint, prettier, `tsc --noEmit`), `pnpm test`, `pnpm test:index`, `pnpm build`, upload `build/bundle/*.zip` (resolves to `build/bundle/DHIS2-Admin-Toolbox-<version>.zip`, per §6.1).
- Release: same install and build; `gh release create` attaches `build/bundle/*.zip` (`DHIS2-Admin-Toolbox-<version>.zip`). Changelog extraction and tag-mismatch warning unchanged.
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
- Build the zip (`build/bundle/DHIS2-Admin-Toolbox-<version>.zip`). Install 0.1.5 then 1.0.0 via `POST /api/apps` and confirm in-place upgrade under the `DHIS2-Admin-Toolbox` key (one app, version 1.0.0).
- Dev-server login against a 2.43 instance required adding `http://localhost:3000` and `http://localhost:8080` to the instance's CORS allowlist (`POST /api/configuration/corsAllowlist`).

After this work: multi-version pass on DHIS2 2.40 to 2.43 using the `dhis2-app-review` skill. Out of scope for this spec.

## 9. Git plan

- Branch `release-index-platform` from `580ce04`.
- Commits: one commit per task (about ten), linear, fix-ups folded in; the host re-signs with `git rebase --exec 'git commit --amend --no-edit -S' 580ce04`.
- No merge commits. Base commit stated at handoff for host-side re-signing.
- `docs/release-index-proposal.md` is not committed.

## 10. Open items resolved during implementation

- Env-var prefix: `DHIS2_RELEASE_INDEX_URL`, read from `process.env` (the platform only exposes `DHIS2_`-prefixed vars).
- `/api/apps` visibility rule for non-superusers: confirmed on DHIS2 2.43.1 — a user with only `M_dhis-web-dashboard` sees 4 apps while a superuser sees 31 (see §6.6).
- `Tag` variant for "Update available": `neutral bold` (see §6.5).
- App identity: key from short_name, not title (see §6.1).
