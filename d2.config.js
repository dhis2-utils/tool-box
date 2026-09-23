/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    // DHIS2 identifies an installed app by the manifest short_name (spaces
    // become dashes), which the platform takes from `name`. The pre-platform
    // releases were installed as "DHIS2-Admin-Toolbox", so `name` must stay
    // exactly this for 1.0.0 to upgrade them in place. `title` is only the
    // display name.
    name: 'DHIS2-Admin-Toolbox',
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
