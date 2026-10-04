/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    // The app key, matching the repo name (reference-tool-conventions,
    // NAMING.md). The platform copies `name` into the manifest short_name,
    // from which DHIS2 derives the app key and the app authority, so it never
    // changes again: a new key installs a second app and revokes access given
    // through user roles. src/appIdentity.test.ts guards it. `title` is the
    // display name, and tools.json matches installed apps on it.
    name: 'tool-box',
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
