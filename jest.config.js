const path = require('path')

// @dhis2/cli-app-scripts restricts deep imports through its "exports" map,
// so locate its bundled Jest defaults from the package's main entry. Our
// config is shallow-merged over those defaults by `d2-app-scripts test`, so
// moduleNameMapper must carry the defaults along or the CSS/file mocks vanish.
// The exact "12.10.3" pin of @dhis2/cli-app-scripts in package.json is what
// makes the deep config/jest.config.js require below safe; loosening the pin
// could move or restructure that file and silently break this config.
const scriptsRoot = path.resolve(
    path.dirname(require.resolve('@dhis2/cli-app-scripts')),
    '..'
)
const defaults = require(path.join(scriptsRoot, 'config/jest.config.js'))

module.exports = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        // Mirrors the "@/*" alias in tsconfig.json and viteConfigExtensions.mts
        '^@/(.*)$': '<rootDir>/src/$1',
        ...defaults.moduleNameMapper,
    },
}
