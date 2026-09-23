# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0]

Breaking: the app no longer asks for, stores or uses a GitHub personal access token. Minimum DHIS2 version is now 2.40.

* Read tool releases from a published index (`https://dhis2-utils.github.io/tool-box/releases.json`) instead of calling the GitHub API from the browser. The index is rebuilt daily by a GitHub Actions workflow in this repo.
* Migrate to the DHIS2 App Platform, TypeScript and `@dhis2/ui`. The platform shell provides the header bar on all supported versions.
* Add a status column: up to date, update available, not installed, no release yet.
* Warn users without the ALL authority that DHIS2 hides apps they cannot access.
* Warn when the index has not been updated for more than three days.
* Link a tool's release page when its latest release has no zip to download.
* Show the version of the latest published release rather than the version on the default branch.
* Remove the dataStore and userDataStore usage. Existing `dhis2-toolbox` namespaces are no longer read or written.

## [0.1.5]

* Show tools as a table
* Better handling when updating the token

## [0.1.4]

* Add support for global header bar in 42 and above
* Updated list of tools
