# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-10-04

### Upgrading

- The app key changed from `DHIS2-Admin-Toolbox` to `tool-box`, the repo name, so DHIS2 installs this version as a separate app. Install it, then uninstall the old "DHIS2 Admin Toolbox" in App Management, or two entries remain in the menu.
- Add the new app to every user role that gave access to the old one. Until then, users without the ALL authority cannot open it.
- Bookmarks to the old app URL (`/api/apps/DHIS2-Admin-Toolbox/`) stop working.

### Changed

- List the tools from the `dhis2-utils` organisation that have a 1.x release, under their current display names. Adds Group Set Integrity Tool; removes Deprecated Authorities and OptionSet Sort Order Correction Tool, which have no `dhis2-utils` repository.
- The release bundle is now `tool-box-<version>.zip`.

## [1.0.0]

### Upgrading

- Requires DHIS2 2.40 or later.
- The app no longer asks for, stores or uses a GitHub personal access token. Existing `dhis2-toolbox` dataStore and userDataStore namespaces are no longer read or written, and can be deleted.

### Added

- A status column: up to date, update available, not installed, no release yet.
- A warning for users without the ALL authority that DHIS2 hides apps they cannot access.
- A warning when the index has not been updated for more than three days.
- A link to a tool's release page when its latest release has no zip to download.

### Changed

- Read tool releases from a published index (`https://dhis2-utils.github.io/tool-box/releases.json`) instead of calling the GitHub API from the browser. The index is rebuilt daily by a GitHub Actions workflow in this repo.
- Migrate to the DHIS2 App Platform, TypeScript and `@dhis2/ui`. The platform shell provides the header bar on all supported versions.
- Show the version of the latest published release rather than the version on the default branch.

### Removed

- The GitHub token prompt and the "Update Releases" button.
- dataStore and userDataStore usage.

## [0.1.5]

### Changed

- Show tools as a table.
- Better handling when updating the token.

## [0.1.4]

### Added

- Support for the global header bar in 2.42 and above.

### Changed

- Updated list of tools.
