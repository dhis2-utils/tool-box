import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    buildIndex,
    fetchLatestRelease,
    stripV,
    toToolEntry,
} from './build-release-index.mjs'

const release = {
    tag_name: 'v0.1.5',
    published_at: '2026-08-01T10:12:00Z',
    html_url: 'https://github.com/dhis2/tool-box/releases/tag/v0.1.5',
    assets: [
        { name: 'checksums.txt', browser_download_url: 'https://example.invalid/checksums.txt' },
        { name: 'tool-box.zip', browser_download_url: 'https://github.com/dhis2/tool-box/releases/download/v0.1.5/tool-box.zip' },
    ],
}

// Maps repo -> either a release object, or { status } for an error response.
const mockFetch = (responses) => async (url, init) => {
    const repo = url.match(/repos\/(.+)\/releases\/latest$/)[1]
    const response = responses[repo]
    if (response === undefined) {
        return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) }
    }
    if (response.status) {
        return { ok: false, status: response.status, json: async () => ({}) }
    }
    mockFetch.lastInit = init
    return { ok: true, status: 200, json: async () => response }
}

test('stripV removes exactly one leading v', () => {
    assert.equal(stripV('v0.1.5'), '0.1.5')
    assert.equal(stripV('0.1.5'), '0.1.5')
    assert.equal(stripV('vv1'), 'v1')
})

test('toToolEntry maps a release to the index entry', () => {
    const entry = toToolEntry({ repo: 'dhis2/tool-box', name: 'DHIS2 Admin Toolbox' }, release)
    assert.deepEqual(entry, {
        repo: 'dhis2/tool-box',
        name: 'DHIS2 Admin Toolbox',
        version: '0.1.5',
        tag: 'v0.1.5',
        published_at: '2026-08-01T10:12:00Z',
        download_url: 'https://github.com/dhis2/tool-box/releases/download/v0.1.5/tool-box.zip',
        release_url: 'https://github.com/dhis2/tool-box/releases/tag/v0.1.5',
    })
})

test('toToolEntry uses null download_url when no zip asset exists', () => {
    const entry = toToolEntry(
        { repo: 'dhis2/x', name: 'X' },
        { ...release, assets: [release.assets[0]] }
    )
    assert.equal(entry.download_url, null)
    assert.equal(entry.version, '0.1.5')
})

test('toToolEntry emits nulls for a tool without releases', () => {
    const entry = toToolEntry({ repo: 'dhis2/x', name: 'X' }, null)
    assert.deepEqual(entry, {
        repo: 'dhis2/x',
        name: 'X',
        version: null,
        tag: null,
        published_at: null,
        download_url: null,
        release_url: null,
    })
})

test('fetchLatestRelease returns null on 404 and sends auth header when a token is given', async () => {
    const fetchImpl = mockFetch({ 'dhis2/tool-box': release })
    assert.equal(await fetchLatestRelease('dhis2/none', { fetchImpl, token: 't' }), null)
    const found = await fetchLatestRelease('dhis2/tool-box', { fetchImpl, token: 'secret' })
    assert.equal(found.tag_name, 'v0.1.5')
    assert.equal(mockFetch.lastInit.headers.Authorization, 'Bearer secret')
})

test('fetchLatestRelease omits the auth header without a token', async () => {
    const fetchImpl = mockFetch({ 'dhis2/tool-box': release })
    await fetchLatestRelease('dhis2/tool-box', { fetchImpl, token: undefined })
    assert.equal(mockFetch.lastInit.headers.Authorization, undefined)
})

test('fetchLatestRelease throws on any other error status', async () => {
    const fetchImpl = mockFetch({ 'dhis2/broken': { status: 500 } })
    await assert.rejects(
        () => fetchLatestRelease('dhis2/broken', { fetchImpl, token: undefined }),
        /GitHub API 500 for dhis2\/broken/
    )
})

test('buildIndex keeps tools.json order and stamps generated_at', async () => {
    const tools = [
        { repo: 'dhis2/none', name: 'None' },
        { repo: 'dhis2/tool-box', name: 'DHIS2 Admin Toolbox' },
    ]
    const fetchImpl = mockFetch({ 'dhis2/tool-box': release })
    const now = new Date('2026-09-22T03:00:12Z')
    const index = await buildIndex(tools, { fetchImpl, token: undefined, now })
    assert.equal(index.generated_at, '2026-09-22T03:00:12.000Z')
    assert.deepEqual(index.tools.map((t) => t.repo), ['dhis2/none', 'dhis2/tool-box'])
    assert.equal(index.tools[0].version, null)
    assert.equal(index.tools[1].version, '0.1.5')
})
