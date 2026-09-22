import { mergeTools } from './mergeTools'
import { ReleaseIndex, ToolRelease } from '@/types'

const tool = (overrides: Partial<ToolRelease>): ToolRelease => ({
    repo: 'dhis2/tool-x',
    name: 'Tool X',
    version: '1.2.0',
    tag: 'v1.2.0',
    published_at: '2026-08-01T10:12:00Z',
    download_url: 'https://example.invalid/tool-x.zip',
    release_url: 'https://example.invalid/releases/v1.2.0',
    ...overrides,
})

const index = (tools: ToolRelease[]): ReleaseIndex => ({
    generated_at: '2026-09-22T03:00:12Z',
    tools,
})

describe('mergeTools', () => {
    it('marks a tool up to date when the installed version equals the latest', () => {
        const rows = mergeTools(index([tool({})]), [
            { name: 'Tool X', version: '1.2.0' },
        ])
        expect(rows[0]).toMatchObject({
            installedVersion: '1.2.0',
            status: 'up-to-date',
        })
    })

    it('marks a tool up to date when installed is newer than the index', () => {
        const rows = mergeTools(index([tool({})]), [
            { name: 'Tool X', version: '2.0.0' },
        ])
        expect(rows[0].status).toBe('up-to-date')
    })

    it('marks an update available when installed is older', () => {
        const rows = mergeTools(index([tool({})]), [
            { name: 'Tool X', version: '1.1.9' },
        ])
        expect(rows[0]).toMatchObject({
            installedVersion: '1.1.9',
            status: 'update-available',
        })
    })

    it('marks not installed when no app matches', () => {
        const rows = mergeTools(index([tool({})]), [
            { name: 'Other', version: '1.0.0' },
        ])
        expect(rows[0]).toMatchObject({
            installedVersion: null,
            status: 'not-installed',
        })
    })

    it('marks no release when the index has no version, even if installed', () => {
        const rows = mergeTools(
            index([
                tool({
                    version: null,
                    tag: null,
                    published_at: null,
                    download_url: null,
                    release_url: null,
                }),
            ]),
            [{ name: 'Tool X', version: '0.9.0' }]
        )
        expect(rows[0]).toMatchObject({
            installedVersion: '0.9.0',
            status: 'no-release',
        })
    })

    it('marks unknown when installed apps are unavailable', () => {
        const rows = mergeTools(index([tool({})]), undefined)
        expect(rows[0]).toMatchObject({
            installedVersion: null,
            status: 'unknown',
        })
    })

    it('matches installed apps case-insensitively', () => {
        const rows = mergeTools(index([tool({})]), [
            { name: 'tool x', version: '1.2.0' },
        ])
        expect(rows[0].status).toBe('up-to-date')
    })

    it('copies release fields onto the row', () => {
        const rows = mergeTools(index([tool({})]), [])
        expect(rows[0]).toEqual({
            repo: 'dhis2/tool-x',
            name: 'Tool X',
            latestVersion: '1.2.0',
            publishedAt: '2026-08-01T10:12:00Z',
            downloadUrl: 'https://example.invalid/tool-x.zip',
            releaseUrl: 'https://example.invalid/releases/v1.2.0',
            installedVersion: null,
            status: 'not-installed',
        })
    })

    it('sorts rows by name', () => {
        const rows = mergeTools(
            index([
                tool({ repo: 'dhis2/b', name: 'Beta' }),
                tool({ repo: 'dhis2/a', name: 'alpha' }),
            ]),
            []
        )
        expect(rows.map((r) => r.name)).toEqual(['alpha', 'Beta'])
    })
})
