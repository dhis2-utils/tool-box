# Release Index and App Platform Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the GitHub token requirement from the DHIS2 Admin Toolbox by publishing a daily release index to GitHub Pages, and rewrite the app on the DHIS2 App Platform in TypeScript to consume it.

**Architecture:** A scheduled GitHub Actions workflow in this repo runs a dependency-free Node script that reads a curated `tools.json`, asks GitHub for each tool's latest release, and commits `releases.json` to the `gh-pages` branch. The app is a single-view App Platform app: three queries (index over plain fetch, `/api/apps` and `/api/me` through the app runtime), one pure merge function producing table rows with a status, and a `@dhis2/ui` DataTable.

**Tech Stack:** Node 22, pnpm 10, `@dhis2/cli-app-scripts` 12.10 (Vite 7, React 18), TypeScript 5, `@dhis2/ui` 10, `@dhis2/app-runtime` 3, `@tanstack/react-query` 4, Jest + React Testing Library, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-22-release-index-and-platform-migration-design.md`

## Global Constraints

- Branch `release-index-platform`, cut from `580ce04`. Linear history, no merge commits. Fix-up commits are squashed into the task commit they fix before handoff.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and never a `Claude-Session:` trailer.
- `d2.config.js` keeps `title: 'DHIS2 Admin Toolbox'` exactly. DHIS2 identifies the installed app by this title, so 1.0.0 must upgrade 0.1.5 in place.
- `minDHIS2Version: '2.40'`. React 18 only. `@dhis2/ui` for every UI element. `i18n.t()` from `@dhis2/d2-i18n` for every user-facing string.
- Custom env vars must start with `DHIS2_` to reach the app; read them from `process.env`. The index URL override is `DHIS2_RELEASE_INDEX_URL`.
- Production index URL: `https://dhis2.github.io/tool-box/releases.json`.
- GitHub Actions: pin every action to a full commit SHA with a `# vX.Y.Z` comment. The two existing SHAs are `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0` and `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`.
- Node 22 in every workflow. pnpm installed with `npm install -g pnpm@10.13.1` (no third-party action, so nothing new to pin).
- Verify after each code change: `pnpm lint` (eslint, prettier, `tsc --noEmit`) and `pnpm test`. No output from tsc means no errors.
- Sandbox rules: start dev servers with the shell tool's background mode and record the PID. Never `pkill -f` a server's own command line. `pnpm install` is safe here because Task 3 deletes the host-mounted yarn `node_modules` first and `pnpm-workspace.yaml` declares both darwin and linux architectures.
- Verified facts to rely on, not re-derive: `dhis2.github.io` sends `access-control-allow-origin: *`; the platform copies `public/` into the shell so `public/dhis2-app-icon.png` overrides the icon; the generated `manifest.webapp` sets `name` to `config.title`; `d2-app-scripts test` merges a `jest` block from `package.json` and roots tests at `./src`; `d2-app-scripts start` takes `--port`, `--proxy`, `--proxyPort`; the production bundle lands at `build/bundle/tool-box-<version>.zip`.

---

## File structure

Created:

| Path | Responsibility |
| --- | --- |
| `tools.json` | Curated list of tool repos and display names. The only file to edit when repos move organisation or a tool is added. |
| `scripts/build-release-index.mjs` | Pure Node script: `tools.json` in, `releases.json` out. Exports its functions for tests. |
| `scripts/build-release-index.test.mjs` | `node:test` tests for the script with an injected fetch. |
| `.github/workflows/release-index.yml` | Daily, manual and on-change trigger; runs the script; commits to `gh-pages`. |
| `.github/workflows/ci.yml` | Lint, test, build on PRs and pushes to `main`. Adapted from the untracked draft. |
| `.github/workflows/release.yml` | On `v*.*.*` tags: build and create a GitHub release with the bundle. Adapted from the untracked draft. |
| `d2.config.js`, `viteConfigExtensions.mts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.mjs`, `.prettierignore`, `pnpm-workspace.yaml`, `types/*.d.ts`, `jest.setup.ts` | Platform and tooling configuration. |
| `public/dhis2-app-icon.png` | App icon (the existing 96px logo). |
| `src/config.ts` | `RELEASE_INDEX_URL`. |
| `src/types.ts` | Shared types: index format, installed app, table row, status. |
| `src/lib/compareVersions.ts` (+ test) | Dependency-free semver-ish comparison. |
| `src/lib/mergeTools.ts` (+ test) | Pure: index + installed apps to sorted rows with status. |
| `src/interfaces/apiQueryTypes.ts`, `src/utils/useApiDataQuery.ts` | App-runtime query through TanStack Query, as the dhis2-apps skill prescribes. |
| `src/hooks/useReleaseIndex.ts` (+ test) | Fetch and validate the index. |
| `src/hooks/useInstalledApps.ts` (+ test) | `/api/apps`. |
| `src/hooks/useCurrentUser.ts` (+ test) | `/api/me?fields=authorities`. |
| `src/components/ToolsTable.tsx` (+ test, + `.module.css`) | The DataTable with status tags. |
| `src/components/Toolbox.tsx` (+ test, + `.module.css`) | Composes hooks, notices, loader, table. |
| `src/App.tsx` (+ test) | Providers around `Toolbox`. |
| `src/test-utils/renderWithProviders.tsx` | Shared test wrapper. |
| `CLAUDE.md` | Short orientation for future sessions. |

Deleted (tracked): `.github/workflows/webpack.yml`, `d2auth.template.json`, `eslint.config.js`, `webpack.config.js`, `yarn.lock`, everything under `src/` (after copying the icon). Deleted (untracked or ignored): `node_modules/`, `build/`, `compiled/`, `d2auth.json`, `manifest.webapp`, `.DS_Store`.

Modified: `package.json` (rewritten), `.gitignore`, `CHANGELOG.md`, `README.md`, the spec (deviations recorded in Task 13).

---

### Task 1: Release index script

**Files:**
- Create: `tools.json`
- Create: `scripts/build-release-index.mjs`
- Test: `scripts/build-release-index.test.mjs`

**Interfaces:**
- Produces: `releases.json` in the exact format of spec section 5.3, consumed by Task 2 (workflow) and Task 6 (`useReleaseIndex`). Exports `stripV(tag)`, `toToolEntry(tool, release)`, `fetchLatestRelease(repo, {fetchImpl, token})`, `buildIndex(tools, {fetchImpl, token, now})`.

- [ ] **Step 1: Write `tools.json`**

Names are the exact `manifest.webapp.name` from each repo's current package.json, checked on 2026-09-22. `dhis2/user-role-aggregator` was renamed on GitHub; the new name is used.

```json
[
    { "repo": "dhis2/tool-box", "name": "DHIS2 Admin Toolbox" },
    { "repo": "dhis2/tool-category-dimension-disabler", "name": "Category dimension disabler" },
    { "repo": "dhis2/tool-dashboard-pruner", "name": "Dashboard pruner tool" },
    { "repo": "dhis2/tool-deprecated-authorities", "name": "Deprecated Authorities" },
    { "repo": "dhis2/tool-job-status", "name": "Job Status Tool" },
    { "repo": "dhis2/tool-option-sorter", "name": "OptionSet Sort Order Correction Tool" },
    { "repo": "dhis2/tool-prv-validator", "name": "Program Rule Validator Tool" },
    { "repo": "dhis2/tool-translation-deduplicator", "name": "Translation Deduplicator Tool" },
    { "repo": "dhis2/tool-user-disabler", "name": "User Disabler" },
    { "repo": "dhis2/tool-user-role-aggregator", "name": "User Admin Role Aggregator" },
    { "repo": "dhis2/tool-whitespace-remover", "name": "Whitespace Cleaner Tool" }
]
```

- [ ] **Step 2: Write the failing tests**

`scripts/build-release-index.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    buildIndex,
    fetchLatestRelease,
    stripV,
    toToolEntry,
} from './build-release-index.mjs'

const release = {
    tag_name: 'v0.1.5',
    published_at: '2026-08-01T10:12:00Z',
    html_url: 'https://github.com/dhis2/tool-box/releases/tag/v0.1.5',
    assets: [
        { name: 'checksums.txt', browser_download_url: 'https://example.invalid/checksums.txt' },
        { name: 'tool-box.zip', browser_download_url: 'https://github.com/dhis2/tool-box/releases/download/v0.1.5/tool-box.zip' },
    ],
}

// Maps repo -> either a release object, or { status } for an error response.
const mockFetch = (responses) => async (url, init) => {
    const repo = url.match(/repos\/(.+)\/releases\/latest$/)[1]
    const response = responses[repo]
    if (response === undefined) {
        return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) }
    }
    if (response.status) {
        return { ok: false, status: response.status, json: async () => ({}) }
    }
    mockFetch.lastInit = init
    return { ok: true, status: 200, json: async () => response }
}

test('stripV removes exactly one leading v', () => {
    assert.equal(stripV('v0.1.5'), '0.1.5')
    assert.equal(stripV('0.1.5'), '0.1.5')
    assert.equal(stripV('vv1'), 'v1')
})

test('toToolEntry maps a release to the index entry', () => {
    const entry = toToolEntry({ repo: 'dhis2/tool-box', name: 'DHIS2 Admin Toolbox' }, release)
    assert.deepEqual(entry, {
        repo: 'dhis2/tool-box',
        name: 'DHIS2 Admin Toolbox',
        version: '0.1.5',
        tag: 'v0.1.5',
        published_at: '2026-08-01T10:12:00Z',
        download_url: 'https://github.com/dhis2/tool-box/releases/download/v0.1.5/tool-box.zip',
        release_url: 'https://github.com/dhis2/tool-box/releases/tag/v0.1.5',
    })
})

test('toToolEntry uses null download_url when no zip asset exists', () => {
    const entry = toToolEntry(
        { repo: 'dhis2/x', name: 'X' },
        { ...release, assets: [release.assets[0]] }
    )
    assert.equal(entry.download_url, null)
    assert.equal(entry.version, '0.1.5')
})

test('toToolEntry emits nulls for a tool without releases', () => {
    const entry = toToolEntry({ repo: 'dhis2/x', name: 'X' }, null)
    assert.deepEqual(entry, {
        repo: 'dhis2/x',
        name: 'X',
        version: null,
        tag: null,
        published_at: null,
        download_url: null,
        release_url: null,
    })
})

test('fetchLatestRelease returns null on 404 and sends auth header when a token is given', async () => {
    const fetchImpl = mockFetch({ 'dhis2/tool-box': release })
    assert.equal(await fetchLatestRelease('dhis2/none', { fetchImpl, token: 't' }), null)
    const found = await fetchLatestRelease('dhis2/tool-box', { fetchImpl, token: 'secret' })
    assert.equal(found.tag_name, 'v0.1.5')
    assert.equal(mockFetch.lastInit.headers.Authorization, 'Bearer secret')
})

test('fetchLatestRelease omits the auth header without a token', async () => {
    const fetchImpl = mockFetch({ 'dhis2/tool-box': release })
    await fetchLatestRelease('dhis2/tool-box', { fetchImpl, token: undefined })
    assert.equal(mockFetch.lastInit.headers.Authorization, undefined)
})

test('fetchLatestRelease throws on any other error status', async () => {
    const fetchImpl = mockFetch({ 'dhis2/broken': { status: 500 } })
    await assert.rejects(
        () => fetchLatestRelease('dhis2/broken', { fetchImpl, token: undefined }),
        /GitHub API 500 for dhis2\/broken/
    )
})

test('buildIndex keeps tools.json order and stamps generated_at', async () => {
    const tools = [
        { repo: 'dhis2/none', name: 'None' },
        { repo: 'dhis2/tool-box', name: 'DHIS2 Admin Toolbox' },
    ]
    const fetchImpl = mockFetch({ 'dhis2/tool-box': release })
    const now = new Date('2026-09-22T03:00:12Z')
    const index = await buildIndex(tools, { fetchImpl, token: undefined, now })
    assert.equal(index.generated_at, '2026-09-22T03:00:12.000Z')
    assert.deepEqual(index.tools.map((t) => t.repo), ['dhis2/none', 'dhis2/tool-box'])
    assert.equal(index.tools[0].version, null)
    assert.equal(index.tools[1].version, '0.1.5')
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test scripts/`
Expected: FAIL with `Cannot find module .../build-release-index.mjs`.

- [ ] **Step 4: Write the script**

`scripts/build-release-index.mjs`:

```js
#!/usr/bin/env node
// Builds releases.json, the index the DHIS2 Admin Toolbox reads instead of
// calling the GitHub API from the browser. Runs in GitHub Actions
// (.github/workflows/release-index.yml) and locally:
//
//   node scripts/build-release-index.mjs [tools.json] [releases.json]
//
// No dependencies on purpose: it must run on a bare `actions/setup-node`.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const GITHUB_API = 'https://api.github.com'

export const stripV = (tag) => tag.replace(/^v/, '')

export const fetchLatestRelease = async (
    repo,
    { fetchImpl = fetch, token = process.env.GITHUB_TOKEN } = {}
) => {
    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }
    const response = await fetchImpl(
        `${GITHUB_API}/repos/${repo}/releases/latest`,
        { headers }
    )
    // 404 means the repo has no releases yet (or was deleted). Both are
    // reported as "no release" rather than failing the whole index.
    if (response.status === 404) {
        return null
    }
    if (!response.ok) {
        throw new Error(`GitHub API ${response.status} for ${repo}`)
    }
    return response.json()
}

export const toToolEntry = (tool, release) => {
    if (release === null) {
        return {
            repo: tool.repo,
            name: tool.name,
            version: null,
            tag: null,
            published_at: null,
            download_url: null,
            release_url: null,
        }
    }
    const zipAsset = (release.assets ?? []).find((asset) =>
        asset.name.endsWith('.zip')
    )
    return {
        repo: tool.repo,
        name: tool.name,
        version: stripV(release.tag_name),
        tag: release.tag_name,
        published_at: release.published_at,
        download_url: zipAsset ? zipAsset.browser_download_url : null,
        release_url: release.html_url,
    }
}

export const buildIndex = async (
    tools,
    { fetchImpl = fetch, token = process.env.GITHUB_TOKEN, now = new Date() } = {}
) => {
    const entries = []
    // Sequential on purpose: eleven calls take a second or two, and it keeps
    // us clear of GitHub's secondary rate limits for concurrent requests.
    for (const tool of tools) {
        const release = await fetchLatestRelease(tool.repo, { fetchImpl, token })
        entries.push(toToolEntry(tool, release))
    }
    return { generated_at: now.toISOString(), tools: entries }
}

const main = async () => {
    const [toolsPath = 'tools.json', outputPath = 'releases.json'] =
        process.argv.slice(2)
    const tools = JSON.parse(await readFile(toolsPath, 'utf8'))
    const index = await buildIndex(tools)
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`)
    const withRelease = index.tools.filter((t) => t.version !== null).length
    console.log(
        `Wrote ${index.tools.length} tools (${withRelease} with a release) to ${outputPath}`
    )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error.message)
        process.exit(1)
    })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/`
Expected: 8 tests, all pass.

- [ ] **Step 6: Run the script for real**

Run: `node scripts/build-release-index.mjs tools.json /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/releases.json && cat /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/releases.json`
Expected: `Wrote 11 tools (11 with a release)`. Spot-check: `dhis2/tool-box` has version `0.1.5` and a `tool-box.zip` download URL; `dhis2/tool-user-role-aggregator` has version `0.3.1`. Keep this file: Tasks 11 and 12 serve it locally.

- [ ] **Step 7: Commit**

```bash
git add tools.json scripts/
git commit -m "Add release index script and curated tool list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Release index workflow

**Files:**
- Create: `.github/workflows/release-index.yml`

**Interfaces:**
- Consumes: `scripts/build-release-index.mjs` CLI from Task 1.
- Produces: branch `gh-pages` containing `releases.json` and `.nojekyll`, served by GitHub Pages at the production index URL.

- [ ] **Step 1: Write the workflow**

Design note: the index is committed on every run, even when no tool changed, because `generated_at` changes and because the daily commit is what keeps the repo "active" so GitHub does not disable the schedule after 60 days. Spec section 5.4 said "only if changed"; Task 13 corrects the spec.

```yaml
name: Release index

# Publishes releases.json (the list of admin tools and their latest GitHub
# releases) to the gh-pages branch, where GitHub Pages serves it with open
# CORS. The Toolbox app reads that one file instead of calling the GitHub API
# from the browser. See scripts/build-release-index.mjs.

on:
    schedule:
        - cron: '0 3 * * *'
    workflow_dispatch:
    push:
        branches:
            - main
        paths:
            - tools.json
            - scripts/build-release-index.mjs
            - .github/workflows/release-index.yml

permissions:
    contents: write

concurrency:
    group: release-index
    cancel-in-progress: false

jobs:
    publish:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0

            - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
              with:
                  node-version: 22

            - name: Build index
              env:
                  # The default token can read public repos at 1000 req/hour;
                  # no personal token needed.
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              run: node scripts/build-release-index.mjs tools.json "$RUNNER_TEMP/releases.json"

            - name: Publish to gh-pages
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              run: |
                  set -euo pipefail
                  REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
                  mkdir "$RUNNER_TEMP/pages"
                  cd "$RUNNER_TEMP/pages"
                  git init -q -b gh-pages
                  git config user.name "github-actions[bot]"
                  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
                  # Keep history when the branch exists; start fresh otherwise.
                  if git fetch -q "$REMOTE" gh-pages 2>/dev/null; then
                    git reset -q --hard FETCH_HEAD
                  fi
                  cp "$RUNNER_TEMP/releases.json" releases.json
                  touch .nojekyll
                  git add releases.json .nojekyll
                  # Always commit: generated_at changes every run, and the daily
                  # commit keeps the repo active so GitHub does not disable this
                  # schedule after 60 days without activity.
                  git commit -q -m "Update release index $(date -u +%Y-%m-%dT%H:%MZ)"
                  git push -q "$REMOTE" gh-pages
```

- [ ] **Step 2: Validate the YAML parses**

Run: `node -e "const y=require('/tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/scaffold/tool-box/node_modules/yaml'); y.parse(require('fs').readFileSync('.github/workflows/release-index.yml','utf8')); console.log('ok')"`
Expected: `ok`. (If `yaml` is not resolvable from that path, use `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release-index.yml')); print('ok')"`.)

- [ ] **Step 3: Dry-run the publish step locally against a bare repo**

This proves the shell logic for both the "branch missing" and "branch exists" paths without touching GitHub.

```bash
SCRATCH=/tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad
rm -rf "$SCRATCH/remote.git" "$SCRATCH/pages1" "$SCRATCH/pages2"
git init -q --bare "$SCRATCH/remote.git"
for run in pages1 pages2; do
  mkdir "$SCRATCH/$run" && cd "$SCRATCH/$run"
  git init -q -b gh-pages
  git config user.name bot; git config user.email bot@example.invalid
  if git fetch -q "$SCRATCH/remote.git" gh-pages 2>/dev/null; then git reset -q --hard FETCH_HEAD; fi
  cp "$SCRATCH/releases.json" releases.json; touch .nojekyll
  git add releases.json .nojekyll
  git commit -q -m "Update release index $run"
  git push -q "$SCRATCH/remote.git" gh-pages
done
git -C "$SCRATCH/remote.git" log --oneline gh-pages
cd /Users/olavpo/Repos/tool-box
```

Expected: two commits on `gh-pages` in the bare repo, second on top of first.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-index.yml
git commit -m "Publish release index to gh-pages daily

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Replace the vanilla app with an App Platform TypeScript scaffold

**Files:**
- Delete (git rm): `.github/workflows/webpack.yml`, `d2auth.template.json`, `eslint.config.js`, `webpack.config.js`, `yarn.lock`, `src/**`
- Delete (untracked): `node_modules/`, `build/`, `compiled/`, `d2auth.json`, `manifest.webapp`, `.DS_Store`
- Create: `public/dhis2-app-icon.png`, `d2.config.js`, `viteConfigExtensions.mts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.mjs`, `.prettierignore`, `pnpm-workspace.yaml`, `types/global.d.ts`, `types/modules.d.ts`, `jest.setup.ts`, `src/App.tsx`, `src/App.test.tsx`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: a building, testing, linting platform app with a placeholder `App`. Scripts `pnpm lint`, `pnpm test`, `pnpm test:index`, `pnpm build`, `pnpm start`. Test setup with `@testing-library/jest-dom` and `data-test` as the test id attribute.

- [ ] **Step 1: Preserve the icon, remove the old app**

```bash
cd /Users/olavpo/Repos/tool-box
mkdir -p public && cp src/img/icons/app_logo_96x96.png public/dhis2-app-icon.png
git rm -r -q .github/workflows/webpack.yml d2auth.template.json eslint.config.js webpack.config.js yarn.lock src
rm -rf node_modules build compiled d2auth.json manifest.webapp .DS_Store
git status --short
```

Expected: `D` lines for the tracked files, `??` for `public/`. The untracked `ci.yml` and `release.yml` remain and are handled in Task 9.

- [ ] **Step 2: Scaffold a reference app in the scratchpad and copy its configuration**

A reference scaffold already exists at `/tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/scaffold/tool-box`. If it is missing, recreate it: `cd /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/scaffold && pnpm create @dhis2/app@latest tool-box --typescript --yes`.

```bash
REF=/tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/scaffold/tool-box
cd /Users/olavpo/Repos/tool-box
cp "$REF/viteConfigExtensions.mts" "$REF/eslint.config.mjs" "$REF/.prettierrc.mjs" .
mkdir -p types && cp "$REF/types/global.d.ts" "$REF/types/modules.d.ts" types/
```

- [ ] **Step 3: Write `d2.config.js`**

```js
/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'tool-box',
    // Must stay exactly this: DHIS2 identifies the installed app by this
    // title, and 1.0.0 has to upgrade the installed 0.1.5 in place.
    title: 'DHIS2 Admin Toolbox',
    description:
        'Lists the DHIS2 admin tools, their latest releases, and the versions installed on this instance',
    author: 'HISP Centre, University of Oslo',
    minDHIS2Version: '2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    viteConfigExtensions: './viteConfigExtensions.mts',
}

module.exports = config
```

- [ ] **Step 4: Write `package.json`**

Check the licence first: `head -3 LICENSE`. Use `BSD-3-Clause` if the header says BSD 3-Clause; otherwise use the SPDX id that matches.

```json
{
    "name": "tool-box",
    "version": "1.0.0",
    "description": "Lists the DHIS2 admin tools, their latest releases, and the versions installed on this instance",
    "license": "BSD-3-Clause",
    "private": true,
    "author": "HISP Centre, University of Oslo",
    "repository": "github:dhis2/tool-box",
    "packageManager": "pnpm@10.13.1",
    "scripts": {
        "build": "d2-app-scripts build",
        "start": "d2-app-scripts start",
        "test": "d2-app-scripts test",
        "test:index": "node --test scripts/",
        "deploy": "d2-app-scripts deploy",
        "lint": "eslint && prettier -c . && tsc --noEmit",
        "format": "prettier . -w"
    },
    "dependencies": {
        "@dhis2/app-runtime": "^3.15.1",
        "@dhis2/ui": "^10.11.0",
        "@tanstack/react-query": "^4.36.1",
        "react": "^18.3.1",
        "react-dom": "^18.3.1"
    },
    "devDependencies": {
        "@dhis2/cli-app-scripts": "12.10.3",
        "@dhis2/config-eslint": "^0.2.2",
        "@dhis2/config-prettier": "^0.2.2",
        "@eslint/compat": "^2.0.0",
        "@testing-library/jest-dom": "^6.6.3",
        "@testing-library/react": "^16.1.0",
        "@testing-library/user-event": "^14.5.2",
        "@types/jest": "^30.0.0",
        "@types/react": "^18.3.12",
        "@types/react-dom": "^18.3.1",
        "eslint": "^9.39.2",
        "prettier": "^3.7.4",
        "typescript": "^5.9.3",
        "vite": "^7.3.0"
    },
    "jest": {
        "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"]
    }
}
```

Note: the scaffold pins `@types/react` 19; this app is React 18, so the 18 types are used.

- [ ] **Step 5: Write `pnpm-workspace.yaml`**

The scaffold's hoisting and build-script allowlist, plus both architectures so the host (macOS) and the sandbox (Linux) share one `node_modules` without breaking each other.

```yaml
# Hoists needed by @dhis2/app-shell, which reaches directly into libraries
# that yarn 1 used to hoist. Preferable to pnpm's shamefullyHoist.
publicHoistPattern:
    - '@dhis2/ui'
    - 'typeface-roboto'
    - '@dhis2/app-adapter'
    - 'prop-types'
    - '@dhis2/d2-i18n'
    - 'post-robot'
    - 'styled-jsx'
    - '@dhis2/pwa'

# pnpm 10 runs no dependency lifecycle scripts except these.
onlyBuiltDependencies:
    - '@dhis2/cli-helpers-engine'
    - core-js-pure
    - esbuild

# The repo is developed on macOS and inside a Linux sandbox from the same
# checkout; install native binaries for both.
supportedArchitectures:
    os: [darwin, linux]
    cpu: [arm64, x64]
```

- [ ] **Step 6: Write `tsconfig.json`, `.gitignore`, `.prettierignore`, `jest.setup.ts`**

`tsconfig.json`:

```json
{
    "compilerOptions": {
        "noEmit": true,
        "strict": true,
        "skipLibCheck": true,
        "allowJs": true,
        "jsx": "react",
        "esModuleInterop": true,
        "target": "ESNext",
        "module": "esnext",
        "moduleResolution": "node",
        "baseUrl": ".",
        "paths": {
            "@/*": ["src/*"]
        },
        "types": ["jest", "@testing-library/jest-dom"]
    },
    "include": ["src", "types", "jest.setup.ts"]
}
```

`.gitignore`:

```
# DHIS2 App Platform
node_modules
.d2
src/locales
build

# Local
.DS_Store
.vscode
```

`.prettierignore`:

```
pnpm-lock.yaml
CHANGELOG.md
LICENSE
docs
build
.d2
src/locales
```

`jest.setup.ts`:

```ts
import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// @dhis2/ui components expose data-test, not data-testid.
configure({ testIdAttribute: 'data-test' })
```

- [ ] **Step 7: Write the placeholder app and its test**

`src/App.tsx`:

```tsx
import i18n from '@dhis2/d2-i18n'
import React from 'react'

const App = () => <h1>{i18n.t('DHIS2 Admin Toolbox')}</h1>

export default App
```

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

it('renders the title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'DHIS2 Admin Toolbox' })).toBeInTheDocument()
})
```

- [ ] **Step 8: Install and verify all scripts**

```bash
pnpm install
pnpm format
pnpm lint
pnpm test
pnpm test:index
pnpm build
unzip -l build/bundle/tool-box-1.0.0.zip | grep -E "manifest.webapp|dhis2-app-icon.png"
unzip -p build/bundle/tool-box-1.0.0.zip manifest.webapp | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);console.log(m.name, m.version, m.icons)})'
```

Expected: lint clean (no output from tsc), 1 jest test passing, 8 node tests passing, zip present, manifest `name` is `DHIS2 Admin Toolbox`, version `1.0.0`, icons point at `dhis2-app-icon.png`. If `pnpm install` warns about ignored build scripts beyond the three allowed, leave them ignored.

If `pnpm format` reformatted `tools.json` or the workflow files, that is fine; they are committed in this task.

- [ ] **Step 9: Commit**

```bash
git add -A
git reset -q docs/release-index-proposal.md .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "Migrate to DHIS2 App Platform with TypeScript

Replaces the webpack/vanilla JS app with an App Platform scaffold. The
GitHub token flow, dataStore cache and header-bar detection are gone;
the platform shell provides the header on all supported versions.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git status --short
```

Expected: only `?? .github/workflows/ci.yml`, `?? .github/workflows/release.yml`, `?? docs/release-index-proposal.md` remain untracked.

---

### Task 4: compareVersions

**Files:**
- Create: `src/lib/compareVersions.ts`
- Test: `src/lib/compareVersions.test.ts`

**Interfaces:**
- Produces: `compareVersions(a: string, b: string): -1 | 0 | 1`, consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
import { compareVersions } from './compareVersions'

describe('compareVersions', () => {
    it('treats equal versions as equal', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    })

    it('orders by major, then minor, then patch', () => {
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
        expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
        expect(compareVersions('1.1.0', '1.2.0')).toBe(-1)
        expect(compareVersions('1.2.10', '1.2.9')).toBe(1)
    })

    it('ignores a leading v', () => {
        expect(compareVersions('v1.2.3', '1.2.3')).toBe(0)
        expect(compareVersions('1.2.3', 'V1.2.4')).toBe(-1)
    })

    it('treats missing parts as zero', () => {
        expect(compareVersions('1.2', '1.2.0')).toBe(0)
        expect(compareVersions('1', '1.0.1')).toBe(-1)
    })

    it('treats a prerelease as older than the release', () => {
        expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1)
        expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
        expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
        expect(compareVersions('1.0.0-beta', '1.0.0-beta')).toBe(0)
    })

    it('treats non-numeric parts as zero instead of throwing', () => {
        expect(compareVersions('abc', '0.0.0')).toBe(0)
        expect(compareVersions('1.x.3', '1.0.3')).toBe(0)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test compareVersions`
Expected: FAIL, cannot find module `./compareVersions`.

- [ ] **Step 3: Implement**

```ts
// Minimal semver-style comparison. Enough for release tags like v1.2.3 and
// 1.2.3-beta.1; deliberately not a full semver implementation, so no
// dependency is needed.
interface ParsedVersion {
    parts: number[]
    prerelease: string | null
}

const parseVersion = (version: string): ParsedVersion => {
    const cleaned = version.trim().replace(/^v/i, '')
    const dashIndex = cleaned.indexOf('-')
    const main = dashIndex === -1 ? cleaned : cleaned.slice(0, dashIndex)
    const prerelease = dashIndex === -1 ? null : cleaned.slice(dashIndex + 1)
    const parts = main.split('.').map((part) => {
        const parsed = parseInt(part, 10)
        return Number.isNaN(parsed) ? 0 : parsed
    })
    return { parts, prerelease }
}

export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
    const left = parseVersion(a)
    const right = parseVersion(b)
    const length = Math.max(left.parts.length, right.parts.length)
    for (let i = 0; i < length; i++) {
        const x = left.parts[i] ?? 0
        const y = right.parts[i] ?? 0
        if (x !== y) {
            return x < y ? -1 : 1
        }
    }
    if (left.prerelease !== null && right.prerelease === null) {
        return -1
    }
    if (left.prerelease === null && right.prerelease !== null) {
        return 1
    }
    if (left.prerelease !== null && right.prerelease !== null) {
        if (left.prerelease === right.prerelease) {
            return 0
        }
        return left.prerelease < right.prerelease ? -1 : 1
    }
    return 0
}
```

- [ ] **Step 4: Run the tests and lint**

Run: `pnpm test compareVersions && pnpm lint`
Expected: 6 tests pass; lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compareVersions.ts src/lib/compareVersions.test.ts
git commit -m "Add dependency-free version comparison

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Types and mergeTools

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/mergeTools.ts`
- Test: `src/lib/mergeTools.test.ts`

**Interfaces:**
- Consumes: `compareVersions` from Task 4.
- Produces: types `ToolRelease`, `ReleaseIndex`, `InstalledApp`, `ToolStatus`, `ToolRow`; function `mergeTools(index: ReleaseIndex, installedApps: InstalledApp[] | undefined): ToolRow[]`. Used by Tasks 6, 7, 8.

- [ ] **Step 1: Write `src/types.ts`**

```ts
/** One entry in releases.json, produced by scripts/build-release-index.mjs. */
export interface ToolRelease {
    repo: string
    name: string
    version: string | null
    tag: string | null
    published_at: string | null
    download_url: string | null
    release_url: string | null
}

/** The published index at RELEASE_INDEX_URL. */
export interface ReleaseIndex {
    generated_at: string
    tools: ToolRelease[]
}

/** The subset of GET /api/apps that this app reads. */
export interface InstalledApp {
    name: string
    version: string
}

export type ToolStatus =
    | 'up-to-date'
    | 'update-available'
    | 'not-installed'
    | 'no-release'
    | 'unknown'

/** One row of the tools table. */
export interface ToolRow {
    repo: string
    name: string
    latestVersion: string | null
    publishedAt: string | null
    downloadUrl: string | null
    releaseUrl: string | null
    installedVersion: string | null
    status: ToolStatus
}
```

- [ ] **Step 2: Write the failing tests**

```ts
import { ReleaseIndex, ToolRelease } from '@/types'
import { mergeTools } from './mergeTools'

const tool = (overrides: Partial<ToolRelease>): ToolRelease => ({
    repo: 'dhis2/tool-x',
    name: 'Tool X',
    version: '1.2.0',
    tag: 'v1.2.0',
    published_at: '2026-08-01T10:12:00Z',
    download_url: 'https://example.invalid/tool-x.zip',
    release_url: 'https://example.invalid/releases/v1.2.0',
    ...overrides,
})

const index = (tools: ToolRelease[]): ReleaseIndex => ({
    generated_at: '2026-09-22T03:00:12Z',
    tools,
})

describe('mergeTools', () => {
    it('marks a tool up to date when the installed version equals the latest', () => {
        const rows = mergeTools(index([tool({})]), [{ name: 'Tool X', version: '1.2.0' }])
        expect(rows[0]).toMatchObject({ installedVersion: '1.2.0', status: 'up-to-date' })
    })

    it('marks a tool up to date when installed is newer than the index', () => {
        const rows = mergeTools(index([tool({})]), [{ name: 'Tool X', version: '2.0.0' }])
        expect(rows[0].status).toBe('up-to-date')
    })

    it('marks an update available when installed is older', () => {
        const rows = mergeTools(index([tool({})]), [{ name: 'Tool X', version: '1.1.9' }])
        expect(rows[0]).toMatchObject({ installedVersion: '1.1.9', status: 'update-available' })
    })

    it('marks not installed when no app matches', () => {
        const rows = mergeTools(index([tool({})]), [{ name: 'Other', version: '1.0.0' }])
        expect(rows[0]).toMatchObject({ installedVersion: null, status: 'not-installed' })
    })

    it('marks no release when the index has no version, even if installed', () => {
        const rows = mergeTools(
            index([tool({ version: null, tag: null, published_at: null, download_url: null, release_url: null })]),
            [{ name: 'Tool X', version: '0.9.0' }]
        )
        expect(rows[0]).toMatchObject({ installedVersion: '0.9.0', status: 'no-release' })
    })

    it('marks unknown when installed apps are unavailable', () => {
        const rows = mergeTools(index([tool({})]), undefined)
        expect(rows[0]).toMatchObject({ installedVersion: null, status: 'unknown' })
    })

    it('matches installed apps case-insensitively', () => {
        const rows = mergeTools(index([tool({})]), [{ name: 'tool x', version: '1.2.0' }])
        expect(rows[0].status).toBe('up-to-date')
    })

    it('copies release fields onto the row', () => {
        const rows = mergeTools(index([tool({})]), [])
        expect(rows[0]).toEqual({
            repo: 'dhis2/tool-x',
            name: 'Tool X',
            latestVersion: '1.2.0',
            publishedAt: '2026-08-01T10:12:00Z',
            downloadUrl: 'https://example.invalid/tool-x.zip',
            releaseUrl: 'https://example.invalid/releases/v1.2.0',
            installedVersion: null,
            status: 'not-installed',
        })
    })

    it('sorts rows by name', () => {
        const rows = mergeTools(
            index([tool({ repo: 'dhis2/b', name: 'Beta' }), tool({ repo: 'dhis2/a', name: 'alpha' })]),
            []
        )
        expect(rows.map((r) => r.name)).toEqual(['alpha', 'Beta'])
    })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test mergeTools`
Expected: FAIL, cannot find module `./mergeTools`.

- [ ] **Step 4: Implement**

```ts
import { compareVersions } from '@/lib/compareVersions'
import { InstalledApp, ReleaseIndex, ToolRelease, ToolRow, ToolStatus } from '@/types'

const statusFor = (
    tool: ToolRelease,
    installed: InstalledApp | undefined,
    appsUnavailable: boolean
): ToolStatus => {
    if (appsUnavailable) {
        return 'unknown'
    }
    if (tool.version === null) {
        return 'no-release'
    }
    if (installed === undefined) {
        return 'not-installed'
    }
    const installedIsOlder = compareVersions(installed.version, tool.version) < 0
    return installedIsOlder ? 'update-available' : 'up-to-date'
}

/**
 * Joins the published release index with the apps installed on this
 * instance. `installedApps` is undefined when /api/apps could not be read;
 * every row is then 'unknown' rather than misleadingly 'not-installed'.
 */
export const mergeTools = (
    index: ReleaseIndex,
    installedApps: InstalledApp[] | undefined
): ToolRow[] => {
    const appsUnavailable = installedApps === undefined
    return [...index.tools]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((tool) => {
            // DHIS2 reports the manifest name; tools.json carries the same
            // name, so a case-insensitive match is the join key.
            const installed = installedApps?.find(
                (app) => app.name.toLowerCase() === tool.name.toLowerCase()
            )
            return {
                repo: tool.repo,
                name: tool.name,
                latestVersion: tool.version,
                publishedAt: tool.published_at,
                downloadUrl: tool.download_url,
                releaseUrl: tool.release_url,
                installedVersion: installed?.version ?? null,
                status: statusFor(tool, installed, appsUnavailable),
            }
        })
}
```

- [ ] **Step 5: Run the tests and lint**

Run: `pnpm test mergeTools && pnpm lint`
Expected: 9 tests pass; lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/mergeTools.ts src/lib/mergeTools.test.ts
git commit -m "Add mergeTools: join release index with installed apps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Config, query plumbing and the three data hooks

**Files:**
- Create: `src/config.ts`
- Create: `src/interfaces/apiQueryTypes.ts`
- Create: `src/utils/useApiDataQuery.ts`
- Create: `src/test-utils/renderWithProviders.tsx`
- Create: `src/hooks/useReleaseIndex.ts`, `src/hooks/useInstalledApps.ts`, `src/hooks/useCurrentUser.ts`
- Test: `src/hooks/useReleaseIndex.test.ts`, `src/hooks/useInstalledApps.test.tsx`, `src/hooks/useCurrentUser.test.tsx`

**Interfaces:**
- Consumes: `ReleaseIndex`, `InstalledApp` from Task 5.
- Produces:
  - `RELEASE_INDEX_URL: string`
  - `fetchReleaseIndex(url: string, fetchImpl?: typeof fetch): Promise<ReleaseIndex>` and `useReleaseIndex(): UseQueryResult<ReleaseIndex, Error>`
  - `useInstalledApps(): UseQueryResult<InstalledApp[], Error>`
  - `CurrentUser { authorities: string[] }`, `useCurrentUser(): UseQueryResult<CurrentUser, Error>`
  - `createTestWrapper(data)`, `renderWithProviders(ui, data)` for tests. `data` is the `CustomDataProvider` map keyed by resource (`apps`, `me`).

- [ ] **Step 1: Write `src/config.ts`**

```ts
// The published index. Override for development and testing (or after the
// repos move organisation) with DHIS2_RELEASE_INDEX_URL; the platform only
// exposes env vars with the DHIS2_ prefix, on process.env.
export const RELEASE_INDEX_URL =
    process.env.DHIS2_RELEASE_INDEX_URL ??
    'https://dhis2.github.io/tool-box/releases.json'
```

- [ ] **Step 2: Write the query plumbing (from the dhis2-apps skill, verbatim)**

`src/interfaces/apiQueryTypes.ts`:

```ts
export type PossiblyDynamic<Type, InputType> =
    | Type
    | ((input: InputType) => Type)
export type QueryVariables = Record<string, unknown>

type QueryParameterSingularValue = string | number | boolean
interface QueryParameterAliasedValue {
    [name: string]: QueryParameterSingularValue
}
type QueryParameterSingularOrAliasedValue =
    | QueryParameterSingularValue
    | QueryParameterAliasedValue
type QueryParameterMultipleValue = QueryParameterSingularOrAliasedValue[]
export type QueryParameterValue =
    | QueryParameterSingularValue
    | QueryParameterAliasedValue
    | QueryParameterMultipleValue
    | undefined

export interface QueryParameters {
    pageSize?: number
    [key: string]: QueryParameterValue
}

export interface ResourceQuery {
    resource: string
    id?: PossiblyDynamic<string, QueryVariables>
    data?: PossiblyDynamic<unknown, QueryVariables>
    params?: PossiblyDynamic<QueryParameters, QueryVariables>
}
```

`src/utils/useApiDataQuery.ts`:

```ts
import { useDataEngine } from '@dhis2/app-runtime'
import {
    useQuery,
    QueryFunction,
    UseQueryOptions,
    QueryKey,
} from '@tanstack/react-query'
import { ResourceQuery } from '@/interfaces/apiQueryTypes'

type UseApiDataQueryProps<
    TResultData,
    TError = Error,
    TData = TResultData,
    TQueryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<TResultData, TError, TData, TQueryKey>, 'queryFn'> & {
    query: ResourceQuery
}

export const useApiDataQuery = <
    TResultData,
    TError = Error,
    TData = TResultData,
    TQueryKey extends QueryKey = QueryKey,
>({
    query,
    queryKey,
    ...options
}: UseApiDataQueryProps<TResultData, TError, TData, TQueryKey>) => {
    const dataEngine = useDataEngine()

    const queryFn: QueryFunction<TResultData, TQueryKey> = async () => {
        const response = await dataEngine.query({ apiDataQuery: query })
        return response.apiDataQuery as TResultData
    }

    return useQuery<TResultData, TError, TData, TQueryKey>({
        queryKey,
        queryFn,
        ...options,
    })
}
```

- [ ] **Step 3: Write the test wrapper**

`src/test-utils/renderWithProviders.tsx`:

```tsx
import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import React from 'react'

type CustomData = React.ComponentProps<typeof CustomDataProvider>['data']

/**
 * Wraps a component or hook in the app-runtime and TanStack Query providers.
 * `data` is keyed by DHIS2 resource ('apps', 'me'); a value may be a
 * function that throws to simulate a failing endpoint. Any resource not in
 * `data` throws (failOnMiss), so tests declare exactly what they use.
 */
export const createTestWrapper = (data: CustomData = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <Provider
            config={{ baseUrl: 'http://localhost:8080', apiVersion: 42 }}
            plugin={false}
            parentAlertsAdd={() => undefined}
            showAlertsInPlugin={true}
        >
            <CustomDataProvider data={data} options={{ failOnMiss: true }}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
}

export const renderWithProviders = (ui: React.ReactElement, data: CustomData = {}) =>
    render(ui, { wrapper: createTestWrapper(data) })
```

If `tsc` rejects a `Provider` prop (`plugin`, `parentAlertsAdd`, `showAlertsInPlugin`), read `node_modules/@dhis2/app-runtime/build/types/provider/Provider.d.ts` and keep only the props it declares; `config` is the one that matters.

- [ ] **Step 4: Write the failing tests for useReleaseIndex**

`src/hooks/useReleaseIndex.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { createTestWrapper } from '@/test-utils/renderWithProviders'
import { fetchReleaseIndex, useReleaseIndex } from './useReleaseIndex'

const validIndex = {
    generated_at: '2026-09-22T03:00:12Z',
    tools: [
        {
            repo: 'dhis2/tool-box',
            name: 'DHIS2 Admin Toolbox',
            version: '0.1.5',
            tag: 'v0.1.5',
            published_at: '2026-08-01T10:12:00Z',
            download_url: 'https://example.invalid/tool-box.zip',
            release_url: 'https://example.invalid/v0.1.5',
        },
    ],
}

const responseWith = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

describe('fetchReleaseIndex', () => {
    it('returns the parsed index on success', async () => {
        const fetchImpl = jest.fn(async () => responseWith(200, validIndex))
        await expect(fetchReleaseIndex('https://x/releases.json', fetchImpl)).resolves.toEqual(validIndex)
        expect(fetchImpl).toHaveBeenCalledWith('https://x/releases.json', expect.objectContaining({ headers: { Accept: 'application/json' } }))
    })

    it('throws on a non-2xx response', async () => {
        const fetchImpl = jest.fn(async () => responseWith(503, {}))
        await expect(fetchReleaseIndex('https://x/releases.json', fetchImpl)).rejects.toThrow('HTTP 503')
    })

    it('throws when the body is not a release index', async () => {
        const fetchImpl = jest.fn(async () => responseWith(200, { hello: 'world' }))
        await expect(fetchReleaseIndex('https://x/releases.json', fetchImpl)).rejects.toThrow('Unexpected index format')
    })
})

describe('useReleaseIndex', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('exposes the index through TanStack Query', async () => {
        global.fetch = jest.fn(async () => responseWith(200, validIndex)) as unknown as typeof fetch
        const { result } = renderHook(() => useReleaseIndex(), { wrapper: createTestWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.tools[0].name).toBe('DHIS2 Admin Toolbox')
    })

    it('reports an error when the fetch fails', async () => {
        global.fetch = jest.fn(async () => responseWith(500, {})) as unknown as typeof fetch
        const { result } = renderHook(() => useReleaseIndex(), { wrapper: createTestWrapper() })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('HTTP 500')
    })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test useReleaseIndex`
Expected: FAIL, cannot find module `./useReleaseIndex`.

- [ ] **Step 6: Implement useReleaseIndex**

```ts
import { useQuery } from '@tanstack/react-query'
import { RELEASE_INDEX_URL } from '@/config'
import { ReleaseIndex } from '@/types'

const isReleaseIndex = (value: unknown): value is ReleaseIndex => {
    if (typeof value !== 'object' || value === null) {
        return false
    }
    const candidate = value as Partial<ReleaseIndex>
    return typeof candidate.generated_at === 'string' && Array.isArray(candidate.tools)
}

export const fetchReleaseIndex = async (
    url: string,
    fetchImpl: typeof fetch = fetch
): Promise<ReleaseIndex> => {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
    }
    const body: unknown = await response.json()
    if (!isReleaseIndex(body)) {
        throw new Error('Unexpected index format')
    }
    return body
}

export const useReleaseIndex = () =>
    useQuery<ReleaseIndex, Error>({
        queryKey: ['release-index', RELEASE_INDEX_URL],
        queryFn: () => fetchReleaseIndex(RELEASE_INDEX_URL),
        staleTime: 5 * 60 * 1000,
    })
```

- [ ] **Step 7: Run the useReleaseIndex tests**

Run: `pnpm test useReleaseIndex`
Expected: 5 tests pass. If `global.fetch` assignment fails type-checking, declare `declare const global: { fetch: typeof fetch }` at the top of the test file.

- [ ] **Step 8: Write the failing tests for useInstalledApps and useCurrentUser**

`src/hooks/useInstalledApps.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { createTestWrapper } from '@/test-utils/renderWithProviders'
import { useInstalledApps } from './useInstalledApps'

describe('useInstalledApps', () => {
    it('returns the apps list', async () => {
        const apps = [{ name: 'DHIS2 Admin Toolbox', version: '0.1.5' }]
        const { result } = renderHook(() => useInstalledApps(), { wrapper: createTestWrapper({ apps }) })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(apps)
    })

    it('reports an error when the endpoint fails', async () => {
        const apps = () => {
            throw new Error('forbidden')
        }
        const { result } = renderHook(() => useInstalledApps(), { wrapper: createTestWrapper({ apps }) })
        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
```

`src/hooks/useCurrentUser.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { createTestWrapper } from '@/test-utils/renderWithProviders'
import { useCurrentUser } from './useCurrentUser'

describe('useCurrentUser', () => {
    it('returns the authorities of the current user', async () => {
        const me = { authorities: ['ALL'] }
        const { result } = renderHook(() => useCurrentUser(), { wrapper: createTestWrapper({ me }) })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.authorities).toEqual(['ALL'])
    })
})
```

- [ ] **Step 9: Run them to verify they fail**

Run: `pnpm test useInstalledApps useCurrentUser`
Expected: FAIL, modules not found.

- [ ] **Step 10: Implement the two hooks**

`src/hooks/useInstalledApps.ts`:

```ts
import { InstalledApp } from '@/types'
import { useApiDataQuery } from '@/utils/useApiDataQuery'

// DHIS2 returns only the apps the current user may open (ALL or the app's
// own M_<key> authority). Toolbox.tsx warns non-superusers about this.
export const useInstalledApps = () =>
    useApiDataQuery<InstalledApp[]>({
        queryKey: ['installed-apps'],
        query: { resource: 'apps' },
    })
```

`src/hooks/useCurrentUser.ts`:

```ts
import { useApiDataQuery } from '@/utils/useApiDataQuery'

export interface CurrentUser {
    authorities: string[]
}

export const useCurrentUser = () =>
    useApiDataQuery<CurrentUser>({
        queryKey: ['me', 'authorities'],
        query: { resource: 'me', params: { fields: 'authorities' } },
    })
```

- [ ] **Step 11: Run all tests and lint**

Run: `pnpm test && pnpm lint`
Expected: all suites pass; lint clean.

- [ ] **Step 12: Commit**

```bash
git add src/config.ts src/interfaces src/utils src/test-utils src/hooks
git commit -m "Add data hooks for the release index, installed apps and current user

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: ToolsTable component

**Files:**
- Create: `src/components/ToolsTable.tsx`, `src/components/ToolsTable.module.css`
- Test: `src/components/ToolsTable.test.tsx`

**Interfaces:**
- Consumes: `ToolRow`, `ToolStatus` from Task 5.
- Produces: `ToolsTable({ rows }: { rows: ToolRow[] })`, `formatDate(iso: string | null): string`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ToolRow } from '@/types'
import { ToolsTable } from './ToolsTable'

const row = (overrides: Partial<ToolRow>): ToolRow => ({
    repo: 'dhis2/tool-x',
    name: 'Tool X',
    latestVersion: '1.2.0',
    publishedAt: '2026-08-01T10:12:00Z',
    downloadUrl: 'https://example.invalid/tool-x.zip',
    releaseUrl: 'https://example.invalid/v1.2.0',
    installedVersion: '1.1.0',
    status: 'update-available',
    ...overrides,
})

describe('ToolsTable', () => {
    it('renders one row per tool with a repo link, versions and download link', () => {
        render(<ToolsTable rows={[row({})]} />)
        const link = screen.getByRole('link', { name: 'Tool X' })
        expect(link).toHaveAttribute('href', 'https://github.com/dhis2/tool-x')
        expect(screen.getByText('1.1.0')).toBeInTheDocument()
        expect(screen.getByText('1.2.0')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://example.invalid/tool-x.zip')
    })

    it.each([
        ['up-to-date', 'Up to date'],
        ['update-available', 'Update available'],
        ['not-installed', 'Not installed'],
        ['no-release', 'No release yet'],
        ['unknown', 'Unknown'],
    ] as const)('renders the %s status as "%s"', (status, label) => {
        render(<ToolsTable rows={[row({ status })]} />)
        expect(screen.getByTestId('tool-status')).toHaveTextContent(label)
    })

    it('shows a dash for installed version when not installed and no download when there is no asset', () => {
        render(<ToolsTable rows={[row({ installedVersion: null, status: 'not-installed', downloadUrl: null })]} />)
        const cells = screen.getAllByRole('cell')
        expect(cells[1]).toHaveTextContent('-')
        expect(screen.queryByRole('link', { name: 'Download' })).not.toBeInTheDocument()
    })

    it('shows Unknown for installed version when apps could not be read', () => {
        render(<ToolsTable rows={[row({ installedVersion: null, status: 'unknown' })]} />)
        const cells = screen.getAllByRole('cell')
        expect(cells[1]).toHaveTextContent('Unknown')
    })

    it('shows a dash for a missing release date and version', () => {
        render(<ToolsTable rows={[row({ latestVersion: null, publishedAt: null, status: 'no-release' })]} />)
        const cells = screen.getAllByRole('cell')
        expect(cells[2]).toHaveTextContent('-')
        expect(cells[3]).toHaveTextContent('-')
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test ToolsTable`
Expected: FAIL, cannot find module `./ToolsTable`.

- [ ] **Step 3: Implement**

`src/components/ToolsTable.module.css`:

```css
.table {
    margin-top: var(--spacers-dp8);
}

.link {
    color: var(--colors-blue700);
}
```

`src/components/ToolsTable.tsx`:

```tsx
import i18n from '@dhis2/d2-i18n'
import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
    Tag,
} from '@dhis2/ui'
import React from 'react'
import { ToolRow, ToolStatus } from '@/types'
import classes from './ToolsTable.module.css'

export const formatDate = (iso: string | null): string => {
    if (iso === null || Number.isNaN(Date.parse(iso))) {
        return '-'
    }
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

const StatusTag = ({ status }: { status: ToolStatus }) => {
    switch (status) {
        case 'up-to-date':
            return <Tag positive dataTest="tool-status">{i18n.t('Up to date')}</Tag>
        case 'update-available':
            return <Tag neutral bold dataTest="tool-status">{i18n.t('Update available')}</Tag>
        case 'not-installed':
            return <Tag dataTest="tool-status">{i18n.t('Not installed')}</Tag>
        case 'no-release':
            return <Tag dataTest="tool-status">{i18n.t('No release yet')}</Tag>
        case 'unknown':
            return <Tag dataTest="tool-status">{i18n.t('Unknown')}</Tag>
    }
}

const installedLabel = (row: ToolRow): string => {
    if (row.installedVersion !== null) {
        return row.installedVersion
    }
    return row.status === 'unknown' ? i18n.t('Unknown') : '-'
}

export const ToolsTable = ({ rows }: { rows: ToolRow[] }) => (
    <DataTable className={classes.table}>
        <DataTableHead>
            <DataTableRow>
                <DataTableColumnHeader>{i18n.t('Tool')}</DataTableColumnHeader>
                <DataTableColumnHeader>{i18n.t('Installed')}</DataTableColumnHeader>
                <DataTableColumnHeader>{i18n.t('Latest')}</DataTableColumnHeader>
                <DataTableColumnHeader>{i18n.t('Released')}</DataTableColumnHeader>
                <DataTableColumnHeader>{i18n.t('Status')}</DataTableColumnHeader>
                <DataTableColumnHeader>{i18n.t('Download')}</DataTableColumnHeader>
            </DataTableRow>
        </DataTableHead>
        <DataTableBody>
            {rows.map((row) => (
                <DataTableRow key={row.repo}>
                    <DataTableCell>
                        <a
                            className={classes.link}
                            href={`https://github.com/${row.repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {row.name}
                        </a>
                    </DataTableCell>
                    <DataTableCell>{installedLabel(row)}</DataTableCell>
                    <DataTableCell>{row.latestVersion ?? '-'}</DataTableCell>
                    <DataTableCell>{formatDate(row.publishedAt)}</DataTableCell>
                    <DataTableCell>
                        <StatusTag status={row.status} />
                    </DataTableCell>
                    <DataTableCell>
                        {row.downloadUrl !== null ? (
                            <a
                                className={classes.link}
                                href={row.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {i18n.t('Download')}
                            </a>
                        ) : (
                            '-'
                        )}
                    </DataTableCell>
                </DataTableRow>
            ))}
        </DataTableBody>
    </DataTable>
)
```

- [ ] **Step 4: Run the tests and lint**

Run: `pnpm test ToolsTable && pnpm lint`
Expected: 9 tests pass; lint clean. If `getAllByRole('cell')` also returns header cells in this DataTable implementation, switch the indices to `screen.getAllByRole('cell').slice(-6)` in the three index-based tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ToolsTable.tsx src/components/ToolsTable.module.css src/components/ToolsTable.test.tsx
git commit -m "Add tools table with status tags

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Toolbox view and App composition

**Files:**
- Create: `src/components/Toolbox.tsx`, `src/components/Toolbox.module.css`
- Modify: `src/App.tsx`
- Test: `src/components/Toolbox.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: the three hooks (Task 6), `mergeTools` (Task 5), `ToolsTable` (Task 7), `RELEASE_INDEX_URL`.
- Produces: `Toolbox()` and default export `App()`.

- [ ] **Step 1: Write the failing tests for Toolbox**

```tsx
import { screen } from '@testing-library/react'
import React from 'react'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { Toolbox } from './Toolbox'

const index = {
    generated_at: '2026-09-22T03:00:12Z',
    tools: [
        {
            repo: 'dhis2/tool-box',
            name: 'DHIS2 Admin Toolbox',
            version: '0.1.5',
            tag: 'v0.1.5',
            published_at: '2026-08-01T10:12:00Z',
            download_url: 'https://example.invalid/tool-box.zip',
            release_url: 'https://example.invalid/v0.1.5',
        },
    ],
}

const responseWith = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

const superuser = { authorities: ['ALL'] }
const apps = [{ name: 'DHIS2 Admin Toolbox', version: '0.1.4' }]

describe('Toolbox', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('shows a loader, then the table with the index timestamp', async () => {
        global.fetch = jest.fn(async () => responseWith(200, index)) as unknown as typeof fetch
        renderWithProviders(<Toolbox />, { apps, me: superuser })
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(await screen.findByRole('link', { name: 'DHIS2 Admin Toolbox' })).toBeInTheDocument()
        expect(screen.getByText(/Index updated/)).toBeInTheDocument()
        expect(screen.getByTestId('tool-status')).toHaveTextContent('Update available')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows only an error notice naming the URL when the index cannot be loaded', async () => {
        global.fetch = jest.fn(async () => responseWith(500, {})) as unknown as typeof fetch
        renderWithProviders(<Toolbox />, { apps, me: superuser })
        expect(await screen.findByText('Could not load the tool index')).toBeInTheDocument()
        expect(screen.getByText(/releases\.json/)).toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('still renders the table with a warning when installed apps cannot be read', async () => {
        global.fetch = jest.fn(async () => responseWith(200, index)) as unknown as typeof fetch
        const failingApps = () => {
            throw new Error('forbidden')
        }
        renderWithProviders(<Toolbox />, { apps: failingApps, me: superuser })
        expect(await screen.findByText('Could not read installed apps')).toBeInTheDocument()
        expect(screen.getByTestId('tool-status')).toHaveTextContent('Unknown')
    })

    it('warns a user without the ALL authority', async () => {
        global.fetch = jest.fn(async () => responseWith(200, index)) as unknown as typeof fetch
        renderWithProviders(<Toolbox />, { apps, me: { authorities: ['M_dhis-web-maintenance'] } })
        expect(await screen.findByText('Limited view of installed apps')).toBeInTheDocument()
        expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('does not warn when the current user cannot be read', async () => {
        global.fetch = jest.fn(async () => responseWith(200, index)) as unknown as typeof fetch
        const failingMe = () => {
            throw new Error('nope')
        }
        renderWithProviders(<Toolbox />, { apps, me: failingMe })
        expect(await screen.findByRole('table')).toBeInTheDocument()
        expect(screen.queryByText('Limited view of installed apps')).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test Toolbox`
Expected: FAIL, cannot find module `./Toolbox`.

- [ ] **Step 3: Implement Toolbox**

`src/components/Toolbox.module.css`:

```css
.container {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--spacers-dp16);
    display: flex;
    flex-direction: column;
    gap: var(--spacers-dp12);
}

.meta {
    margin: 0;
    color: var(--colors-grey700);
    font-size: 14px;
}

.loader {
    padding: var(--spacers-dp48);
}
```

`src/components/Toolbox.tsx`:

```tsx
import i18n from '@dhis2/d2-i18n'
import { Center, CircularLoader, NoticeBox } from '@dhis2/ui'
import React from 'react'
import { RELEASE_INDEX_URL } from '@/config'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useInstalledApps } from '@/hooks/useInstalledApps'
import { useReleaseIndex } from '@/hooks/useReleaseIndex'
import { mergeTools } from '@/lib/mergeTools'
import { ToolsTable } from './ToolsTable'
import classes from './Toolbox.module.css'

const formatDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })

export const Toolbox = () => {
    const index = useReleaseIndex()
    const apps = useInstalledApps()
    const me = useCurrentUser()

    if (index.isError) {
        return (
            <div className={classes.container}>
                <NoticeBox error title={i18n.t('Could not load the tool index')}>
                    {i18n.t(
                        'The index at {{url}} could not be loaded ({{reason}}). Check that this browser can reach github.io; a firewall or proxy may be blocking it.',
                        { url: RELEASE_INDEX_URL, reason: index.error.message }
                    )}
                </NoticeBox>
            </div>
        )
    }

    // Wait for the index and the apps; the current-user query is advisory
    // and must never hold up the table.
    if (index.data === undefined || (apps.data === undefined && !apps.isError)) {
        return (
            <Center className={classes.loader}>
                <CircularLoader />
            </Center>
        )
    }

    const rows = mergeTools(index.data, apps.isError ? undefined : apps.data)
    const lacksAllAuthority =
        me.data !== undefined && !me.data.authorities.includes('ALL')

    return (
        <div className={classes.container}>
            <p className={classes.meta}>
                {i18n.t('Index updated {{when}}', {
                    when: formatDateTime(index.data.generated_at),
                })}
            </p>
            {apps.isError && (
                <NoticeBox warning title={i18n.t('Could not read installed apps')}>
                    {i18n.t(
                        'Installed versions cannot be shown. The list of tools and releases is still current.'
                    )}
                </NoticeBox>
            )}
            {lacksAllAuthority && (
                <NoticeBox warning title={i18n.t('Limited view of installed apps')}>
                    {i18n.t(
                        'You do not have the ALL authority. DHIS2 only lists apps you have access to, so tools you cannot open may appear here as not installed.'
                    )}
                </NoticeBox>
            )}
            <ToolsTable rows={rows} />
        </div>
    )
}
```

If `Center` does not accept `className`, wrap it in a `div` with the class instead. If `CircularLoader` does not render `role="progressbar"`, change the test to `screen.getByTestId('dhis2-uicore-circularloader')`.

- [ ] **Step 4: Run the Toolbox tests**

Run: `pnpm test Toolbox`
Expected: 5 tests pass.

- [ ] **Step 5: Rewrite App.tsx and its test**

`src/App.tsx`:

```tsx
import { CssReset, CssVariables } from '@dhis2/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Toolbox } from '@/components/Toolbox'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
})

const App = () => (
    <QueryClientProvider client={queryClient}>
        <CssReset />
        <CssVariables theme spacers colors elevations />
        <Toolbox />
    </QueryClientProvider>
)

export default App
```

`src/App.test.tsx`:

```tsx
import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

it('mounts and starts loading', () => {
    global.fetch = jest.fn(() => new Promise(() => undefined)) as unknown as typeof fetch
    render(
        <Provider config={{ baseUrl: 'http://localhost:8080', apiVersion: 42 }}>
            <CustomDataProvider data={{ apps: [], me: { authorities: ['ALL'] } }}>
                <App />
            </CustomDataProvider>
        </Provider>
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run everything**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all suites pass; lint clean; bundle built. Check the i18n extraction updated `i18n/en.pot` with the new strings (`git status` shows it modified or created).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/Toolbox.tsx src/components/Toolbox.module.css src/components/Toolbox.test.tsx i18n
git commit -m "Compose the toolbox view: index, installed apps, notices

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: CI and release workflows, version and changelog

**Files:**
- Create (from the untracked drafts): `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `pnpm lint`, `pnpm test`, `pnpm test:index`, `pnpm build` from Task 3; bundle path `build/bundle/tool-box-<version>.zip`.

- [ ] **Step 1: Write `ci.yml`**

```yaml
name: CI

on:
    pull_request:
    push:
        branches:
            - main

jobs:
    verify:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0

            - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
              with:
                  node-version: 22

            - name: Install pnpm
              run: npm install -g pnpm@10.13.1

            - name: Install dependencies
              # pnpm 10 runs no dependency lifecycle scripts except those in
              # onlyBuiltDependencies (pnpm-workspace.yaml), so no --ignore-scripts.
              run: pnpm install --frozen-lockfile

            - name: Lint and type-check
              run: pnpm lint

            - name: Test
              run: pnpm test && pnpm test:index

            - name: Build
              run: pnpm build

            - name: Upload bundle
              uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
              with:
                  name: app-bundle
                  path: build/bundle/*.zip
```

- [ ] **Step 2: Write `release.yml`**

```yaml
name: Release

on:
    push:
        tags:
            - 'v*.*.*'

permissions:
    contents: write

jobs:
    release:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0

            - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
              with:
                  node-version: 22

            - name: Install pnpm
              run: npm install -g pnpm@10.13.1

            # Warn, never fail: a wrong release can be deleted and recreated, but a
            # protected tag cannot be moved, so exiting here would burn the version.
            - name: Check tag against package.json version
              run: |
                  VERSION=$(node -p "require('./package.json').version")
                  TAG="${GITHUB_REF_NAME#v}"
                  if [ "$VERSION" != "$TAG" ]; then
                    echo "::warning::Tag $GITHUB_REF_NAME does not match package.json version $VERSION; the attached bundle will carry $VERSION"
                  fi

            - name: Install dependencies
              run: pnpm install --frozen-lockfile

            - name: Build
              run: pnpm build

            - name: Extract changelog section
              # Tags are protected: they cannot be deleted or moved. So a missing
              # changelog section must NOT fail the job — that would burn the
              # version number with no way to retry it. Warn and fall back to a
              # generic note instead.
              run: |
                  VERSION="${GITHUB_REF_NAME#v}"
                  awk -v ver="$VERSION" '
                    BEGIN { pat = ver; gsub(/\./, "\\.", pat) }
                    # Accept both "## [1.2.3] - date" and "## 1.2.3 - date"
                    $0 ~ "^## \\[?" pat "\\]?([^0-9]|$)" { found = 1; next }
                    found && /^## / { exit }
                    found { print }
                  ' CHANGELOG.md > release-notes.md
                  if [ ! -s release-notes.md ]; then
                    echo "::warning::No CHANGELOG.md section for $VERSION; using a generic note"
                    echo "Release $GITHUB_REF_NAME" > release-notes.md
                  fi

            - name: Create GitHub release
              env:
                  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              run: |
                  gh release create "$GITHUB_REF_NAME" \
                    --title "$GITHUB_REF_NAME" \
                    --notes-file release-notes.md \
                    build/bundle/*.zip
```

- [ ] **Step 3: Update `CHANGELOG.md`**

Insert above `## [0.1.4]`:

```markdown
## [1.0.0]

Breaking: the app no longer asks for, stores or uses a GitHub personal access token. Minimum DHIS2 version is now 2.40.

* Read tool releases from a published index (`https://dhis2.github.io/tool-box/releases.json`) instead of calling the GitHub API from the browser. The index is rebuilt daily by a GitHub Actions workflow in this repo.
* Migrate to the DHIS2 App Platform, TypeScript and `@dhis2/ui`. The platform shell provides the header bar on all supported versions.
* Add a status column: up to date, update available, not installed, no release yet.
* Warn users without the ALL authority that DHIS2 hides apps they cannot access.
* Show the version of the latest published release rather than the version on the default branch.
* Remove the dataStore and userDataStore usage. Existing `dhis2-toolbox` namespaces are no longer read or written.
```

Also add a `## [0.1.5]` heading with `* Show tools as a table` and `* Better handling when updating the token` if the file lacks it, so the history is continuous.

- [ ] **Step 4: Validate and test the changelog extraction locally**

```bash
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/ci.yml','.github/workflows/release.yml']]; print('yaml ok')"
awk -v ver="1.0.0" 'BEGIN { pat = ver; gsub(/\./, "\\.", pat) } $0 ~ "^## \\[?" pat "\\]?([^0-9]|$)" { found = 1; next } found && /^## / { exit } found { print }' CHANGELOG.md
pnpm lint
```

Expected: `yaml ok`; the awk prints exactly the 1.0.0 section; prettier accepts the workflow files (4-space indent).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml CHANGELOG.md
git commit -m "Add CI and release workflows for the platform build; changelog for 1.0.0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: README and CLAUDE.md

**Files:**
- Modify: `README.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Rewrite `README.md`**

```markdown
# DHIS2 Admin Toolbox

Central place to see the admin tools released by the DHIS2 implementation team, their latest versions, and what is installed on your DHIS2 instance.

> **WARNING**
> These tools are intended for system administrators, not end users. They are available as DHIS2 apps but have not been through the same testing as core apps. Use with care and always try them in a development environment first.

## How it works

The app reads one static file, the release index, published at
`https://dhis2.github.io/tool-box/releases.json`. A GitHub Actions workflow in this repo
([release-index.yml](.github/workflows/release-index.yml)) rebuilds that file every day, and
whenever `tools.json` changes, by asking GitHub for each tool's latest release. Nothing is
fetched from the GitHub API by the browser, so no token or account is needed.

For each tool the app shows the installed version, the latest released version, the release
date, a status (up to date, update available, not installed, no release yet) and a download
link. Because of CORS restrictions on GitHub release assets, tools cannot be installed from
inside the app: download the zip and install it with the App Management app.

Only apps you have access to are listed by DHIS2. Users without the `ALL` authority see a
warning, because tools they cannot open appear as not installed.

## Adding or moving a tool

Edit [`tools.json`](tools.json). Each entry has the GitHub `repo` and the app's exact
manifest `name` (that is how installed apps are matched). Pushing the change to `main`
rebuilds the index. When the repositories move to another organisation, update the `repo`
values here and `RELEASE_INDEX_URL` in `src/config.ts`.

## Repository setup (one-time)

GitHub Pages must be enabled for this repo: Settings, Pages, source "Deploy from a branch",
branch `gh-pages`, folder `/`. The first index appears after the workflow has run once
(Actions, "Release index", "Run workflow").

## Development

Requires Node 22 and pnpm 10 (`npm install -g pnpm@10`).

```
pnpm install
pnpm start --proxy https://play.im.dhis2.org/dev-2-43
```

`pnpm start` serves the app on port 3000 with a CORS proxy on port 8080 pointed at the
given DHIS2 instance; log in at `http://localhost:3000` with `http://localhost:8080` as the
server. Before the index is published, or to test against a different index, set
`DHIS2_RELEASE_INDEX_URL`:

```
DHIS2_RELEASE_INDEX_URL=http://localhost:8099/releases.json pnpm start
```

Other scripts:

| Command | Purpose |
| --- | --- |
| `pnpm lint` | eslint, prettier and TypeScript type-check |
| `pnpm test` | Jest tests for the app |
| `pnpm test:index` | Tests for the index script |
| `pnpm build` | Production bundle at `build/bundle/tool-box-<version>.zip` |
| `node scripts/build-release-index.mjs` | Build `releases.json` locally (set `GITHUB_TOKEN` to raise the rate limit) |

## Releasing

Bump `version` in `package.json`, add a section to `CHANGELOG.md`, commit, then push a tag
`vX.Y.Z`. The release workflow builds the bundle and attaches it to a GitHub release with
the changelog section as notes.

## License

© Copyright University of Oslo 2025. See [LICENSE](LICENSE).
```

- [ ] **Step 2: Write `CLAUDE.md`**

```markdown
# DHIS2 Admin Toolbox

DHIS2 App Platform app (TypeScript, React 18, `@dhis2/ui`, TanStack Query 4) with one view.

- `tools.json` + `scripts/build-release-index.mjs` + `.github/workflows/release-index.yml`
  publish `releases.json` to the `gh-pages` branch daily. The app never calls the GitHub API.
- `src/config.ts` holds the index URL; override with `DHIS2_RELEASE_INDEX_URL` (env vars need
  the `DHIS2_` prefix and are read from `process.env`).
- `src/lib/mergeTools.ts` is the only business logic: index + `/api/apps` to rows with a status.
  Keep it pure and tested.
- `d2.config.js` `title` must stay `DHIS2 Admin Toolbox`; DHIS2 uses it to upgrade the app in place.
- Data access goes through `src/utils/useApiDataQuery.ts` (app-runtime engine inside TanStack
  Query), never `useDataQuery` directly. Tests wrap with `src/test-utils/renderWithProviders.tsx`.
- Verify with `pnpm lint && pnpm test && pnpm test:index`. Design spec and plan under `docs/superpowers/`.
```

- [ ] **Step 3: Lint (prettier checks markdown) and commit**

```bash
pnpm format && pnpm lint
git add README.md CLAUDE.md
git commit -m "Rewrite README for the index-based platform app

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Manual verification against a DHIS2 test instance

**Files:** none committed, except a possible wording fix in `src/components/Toolbox.tsx` and its test.

**Interfaces:**
- Consumes: `releases.json` generated in Task 1 step 6; the dev server; the `dhis2-instances` and `playwright-cli` skills.

- [ ] **Step 1: Create a test instance**

Invoke the `dhis2-instances` skill to create an instance named `agent-toolbox` with label `Admin Toolbox 1.0.0 verification (olav, 2026-09-22)` from the newest 2.4x seed in `GET /seeds`. Poll until running. Record its dev-net URL (`http://dhis2-agent-toolbox:8080`) and `http_port`. Confirm login:

```bash
curl -s -u admin:district http://dhis2-agent-toolbox:8080/api/system/info | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))'
```

- [ ] **Step 2: Serve the local index with CORS**

Write `/tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/serve-index.mjs`:

```js
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
const file = process.argv[2]
const port = Number(process.argv[3] ?? 8099)
createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    if (req.url !== '/releases.json') { res.statusCode = 404; return res.end('{}') }
    res.end(await readFile(file))
}).listen(port, () => console.log(`serving ${file} on ${port}`))
```

Start it in the background (record the PID): `node /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/serve-index.mjs /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/releases.json 8099`. Check: `curl -si http://localhost:8099/releases.json | head -5` shows `Access-Control-Allow-Origin: *`.

- [ ] **Step 3: Start the dev server**

Background, record PID:

```bash
cd /Users/olavpo/Repos/tool-box && DHIS2_RELEASE_INDEX_URL=http://localhost:8099/releases.json pnpm start --proxy http://dhis2-agent-toolbox:8080 --port 3000 --proxyPort 8080
```

Wait until the log says the app is available on port 3000.

- [ ] **Step 4: Drive it with Playwright**

Invoke the `playwright-cli` skill. Open `http://localhost:3000`, on the login screen enter server `http://localhost:8080`, user `admin`, password `district`. Then verify and screenshot to the scratchpad:

1. The table renders 11 rows sorted by name, "Index updated" shows a date, no alerts. Screenshot `01-table.png`.
2. Every row shows "Not installed" (fresh instance) except none; download links have `href` on github.com; the `User Admin Role Aggregator` row has version `0.3.1`.
3. Install the current toolbox release to get an "Up to date" row: `curl -sL -o /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/tool-box-0.1.5.zip https://github.com/dhis2/tool-box/releases/download/v0.1.5/tool-box.zip` then `curl -s -u admin:district -F file=@/tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/tool-box-0.1.5.zip http://dhis2-agent-toolbox:8080/api/apps`. If the asset download is blocked by the egress firewall (redirect to `objects.githubusercontent.com`), build 0.1.5 instead: `git worktree add /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/v015 v0.1.5 && cd /tmp/claude-1000/-Users-olavpo-Repos-tool-box/330c62ad-8542-4a57-80f0-36d439dd6ce3/scratchpad/v015 && yarn install --frozen-lockfile --ignore-scripts && yarn zip` and upload `compiled/tool-box.zip`. Reload the page: the toolbox row shows installed `0.1.5`, status "Up to date". Screenshot `02-up-to-date.png`.
4. Error notice: stop the index server, reload. The page shows only the red "Could not load the tool index" notice naming `http://localhost:8099/releases.json`. Screenshot `03-index-error.png`. Restart the index server.

- [ ] **Step 5: Verify the /api/apps visibility rule with a non-superuser**

```bash
H=http://dhis2-agent-toolbox:8080
ROLE=$(curl -s -u admin:district -H 'Content-Type: application/json' -d '{"name":"Toolbox limited","authorities":["M_dhis-web-dashboard"]}' "$H/api/userRoles" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).response.uid))')
OU=$(curl -s -u admin:district "$H/api/organisationUnits?level=1&fields=id" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).organisationUnits[0].id))')
curl -s -u admin:district -H 'Content-Type: application/json' -d "{\"username\":\"limited\",\"password\":\"Limited1!x\",\"firstName\":\"Limited\",\"surname\":\"User\",\"userRoles\":[{\"id\":\"$ROLE\"}],\"organisationUnits\":[{\"id\":\"$OU\"}]}" "$H/api/users" | head -c 300; echo
echo "admin sees:";   curl -s -u admin:district      "$H/api/apps" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(a=>a.name+" "+a.version)))'
echo "limited sees:"; curl -s -u limited:Limited1!x  "$H/api/apps" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(a=>a.name+" "+a.version)))'
```

Expected: admin sees the installed toolbox 0.1.5; the limited user sees an empty list (or a list without it). Record the actual result. If the limited user does see all apps, the authority warning is wrong: remove the `lacksAllAuthority` notice and its test from Task 8, amend that commit, and note the finding for Task 13. If confirmed, log in to the app as `limited` in Playwright and screenshot the warning as `04-limited-user.png`. Also confirm the `/api/apps` items expose `name` and `version` fields as `InstalledApp` assumes.

- [ ] **Step 6: Stop the servers**

Kill the recorded dev-server and index-server PIDs. Leave the instance running for Task 12.

- [ ] **Step 7: Report**

Write the findings (versions seen, visibility result, screenshot paths) into the task report. If any wording changed, run `pnpm test && pnpm lint` and amend the Task 8 commit with `git commit --amend --no-edit` after `git add`.

---

### Task 12: Upgrade-in-place check

**Files:** none.

- [ ] **Step 1: Build 1.0.0 and install it over 0.1.5**

```bash
cd /Users/olavpo/Repos/tool-box && pnpm build
H=http://dhis2-agent-toolbox:8080
curl -s -o /dev/null -w "%{http_code}\n" -u admin:district -F file=@build/bundle/tool-box-1.0.0.zip "$H/api/apps"
curl -s -u admin:district "$H/api/apps" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const apps=JSON.parse(s).filter(a=>/toolbox/i.test(a.name));console.log(JSON.stringify(apps.map(a=>({name:a.name,version:a.version,key:a.key,launchUrl:a.launchUrl})),null,2))})'
```

Expected: HTTP 201 or 204; exactly one app named `DHIS2 Admin Toolbox` with version `1.0.0`. If two entries appear, the title mapping is wrong: stop and report, since the `d2.config.js` title decision must be revisited.

- [ ] **Step 2: Open the installed app once**

With Playwright, log in to `http://dhis2-agent-toolbox:8080` as admin and open the app's `launchUrl`. Expected: the platform header bar with the title, then the index error notice (the production URL is not published yet), which proves the production build reads `RELEASE_INDEX_URL` and not the dev override. Screenshot `05-installed.png`.

- [ ] **Step 3: Report**

State the result plainly. Do not delete the instance; the user decides when it goes.

---

### Task 13: Record deviations, squash fix-ups, hand off

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-release-index-and-platform-migration-design.md`

- [ ] **Step 1: Update the spec for decisions made during implementation**

Edit these lines in the spec; keep everything else:

- 5.1: repo `dhis2/user-role-aggregator` is now `dhis2/tool-user-role-aggregator` (renamed on GitHub).
- 5.4: replace "commit ... only if `git diff --quiet` reports a change" with "commit on every run; `generated_at` changes each time and the daily commit is what keeps the schedule alive".
- 6.1: lint and format are eslint + prettier with `@dhis2/config-eslint` and `@dhis2/config-prettier` (the scaffold default), not `@dhis2/cli-style`. Data fetching goes through TanStack Query 4 with the `useApiDataQuery` wrapper from the dhis2-apps skill, and plain `fetch` for the index.
- 6.2: env var is `DHIS2_RELEASE_INDEX_URL`, read from `process.env`.
- 6.5: Tag variants are `positive` for "Up to date", `neutral bold` for "Update available", default for the rest. Installed column shows "-" when not installed and "Unknown" when apps are unavailable.
- 6.6: paste the final authority-warning wording and the `/api/apps` visibility result from Task 11.
- 9: commits are one per task (about ten), linear, no fix-ups; re-signing on the host is `git rebase --exec 'git commit --amend --no-edit -S' 580ce04`.
- 10: mark all three open items resolved with their answers.

- [ ] **Step 2: Squash any fix-up commits**

Run `git log --oneline 580ce04..HEAD`. If any commit is a fix-up of an earlier one (message starts with "fixup", "oops", "fix lint" and the like), fold it into its parent task commit. Without interactive rebase: `git rebase --autosquash` is unavailable here, so use `git reset --soft <parent-of-fixup>^`, `git commit --amend --no-edit` for a fix-up that directly follows its target, or re-create the two commits by hand. Verify the tree is unchanged with `git diff <old-head>` printing nothing.

- [ ] **Step 3: Final verification**

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test && pnpm test:index && pnpm build
git status --short
git log --oneline 580ce04..HEAD
```

Expected: everything passes; only `docs/release-index-proposal.md` is untracked; the log is linear with one commit per task plus the spec commits.

- [ ] **Step 4: Commit the spec update**

```bash
git add docs/superpowers/specs/2026-09-22-release-index-and-platform-migration-design.md docs/superpowers/plans/2026-09-22-release-index-and-platform-migration.md
git commit -m "Record implementation decisions in the design spec

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off**

Report to the user: branch name, base commit `580ce04`, the commit list, the verification results, screenshot locations, the test instance name, and the two host-side actions they own: re-sign and push the branch, then enable GitHub Pages on `gh-pages` and run the "Release index" workflow once. Remind them the multi-version review on 2.40 to 2.43 with the `dhis2-app-review` skill is the agreed next step.
