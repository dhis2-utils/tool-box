/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    // The platform copies `name` into the manifest short_name, from which
    // DHIS2 derives the app key (spaces become dashes: DHIS2-Admin-Toolbox)
    // and the app authority (spaces become underscores, dashes are dropped:
    // M_DHIS2_Admin_Toolbox). Both must match the 0.1.x releases, whose
    // short_name was "DHIS2 Admin Toolbox": a dashed name keeps the key but
    // renames the authority, revoking access granted through user roles.
    // src/appIdentity.test.ts guards this. `title` is only the display name.
    name: 'DHIS2 Admin Toolbox',
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
