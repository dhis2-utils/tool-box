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

| Command                                | Purpose                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm lint`                            | eslint, prettier and TypeScript type-check                                 |
| `pnpm test`                            | Jest tests for the app                                                     |
| `pnpm test:index`                      | Tests for the index script                                                 |
| `pnpm build`                           | Production bundle at `build/bundle/tool-box-<version>.zip`                 |
| `node scripts/build-release-index.mjs` | Build `releases.json` locally (set `GITHUB_TOKEN` to raise the rate limit) |

## Releasing

Bump `version` in `package.json`, add a section to `CHANGELOG.md`, commit, then push a tag
`vX.Y.Z`. The release workflow builds the bundle and attaches it to a GitHub release with
the changelog section as notes.

## License

© Copyright University of Oslo 2025. See [LICENSE](LICENSE).
