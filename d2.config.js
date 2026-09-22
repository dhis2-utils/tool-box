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
