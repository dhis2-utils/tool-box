import config from '@dhis2/config-eslint'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
    includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
    {
        extends: [config],
        settings: {
            // Named exports from @testing-library/react (e.g. `screen`) resolve
            // through TypeScript declarations, not eslint-plugin-import's default
            // CJS/ESM resolver.
            'import/resolver': {
                typescript: true,
                node: true,
            },
        },
    },
])
