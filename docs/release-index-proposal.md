# Proposal: drop the GitHub token from the Admin Toolbox

**Status:** draft for feedback, 2026-09-22

## Problem

The Toolbox app lists the DHIS2 admin tools and their latest releases by calling the GitHub API directly from the browser: releases, repo contents and package.json for each of the 11 tool repos, around 33 requests per refresh. That exceeds GitHub's unauthenticated limit of 60 requests/hour, so every user has to create a personal access token and paste it into the app. This is the main friction point in using the app.

## Proposal

Move the GitHub API calls out of the browser and into a scheduled GitHub Actions workflow in the tool-box repo.

1. A workflow runs daily (and on manual trigger) using the job's built-in `GITHUB_TOKEN`, which can read all the public tool repos with no extra secrets.
2. It builds a single `releases.json` index: repo, app name, latest release tag, publish date and download URL for each tool.
3. It commits the file to a `gh-pages` branch, served via GitHub Pages at `https://dhis2.github.io/tool-box/releases.json`.
4. The app fetches that one static file. GitHub Pages sends `Access-Control-Allow-Origin: *`, so this works from any DHIS2 host (verified).

## What changes in the app

- Remove the token modal, the userDataStore key, the dataStore cache and the "Update Releases" button. The app becomes: fetch index, fetch installed apps, render.
- Show the version from the actual release tag rather than package.json on main, which can be ahead of the last release.
- README loses the token section.

## Trade-offs

- **Freshness:** up to 24 hours between a tool release and it appearing in the index. Manual dispatch covers urgent cases. Per-repo `repository_dispatch` triggers could come later but need a PAT per tool repo, so not proposed now.
- **Inactivity rule:** GitHub disables scheduled workflows in public repos after 60 days without repository activity. Committing the index to a branch gives the repo daily activity, which is why we commit rather than use the Pages artifact deploy.
- **Setup:** GitHub Pages must be enabled once by a repo admin.

## Effort

One workflow file plus a small build script, a simplification of `src/app.js`, and a README update. Roughly a day including testing against a DHIS2 instance.

## Questions for reviewers

- Any reason to keep an optional token path (e.g. for firewalled or GitHub Enterprise setups)? Current recommendation: drop it entirely.
- Is a daily refresh acceptable, or should we wire up release-triggered updates from the start?
