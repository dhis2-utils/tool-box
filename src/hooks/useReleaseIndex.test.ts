import { renderHook, waitFor } from '@testing-library/react'
import { fetchReleaseIndex, useReleaseIndex } from './useReleaseIndex'
import { createTestWrapper } from '@/test-utils/renderWithProviders'

declare const global: { fetch: typeof fetch }

const validIndex = {
    generated_at: '2026-09-22T03:00:12Z',
    tools: [
        {
            repo: 'dhis2/tool-box',
            name: 'DHIS2 Admin Toolbox',
            version: '0.1.5',
            tag: 'v0.1.5',
            published_at: '2026-08-01T10:12:00Z',
            download_url: 'https://example.invalid/tool-box.zip',
            release_url: 'https://example.invalid/v0.1.5',
        },
    ],
}

const responseWith = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as Response

describe('fetchReleaseIndex', () => {
    it('returns the parsed index on success', async () => {
        const fetchImpl = jest.fn(async () => responseWith(200, validIndex))
        await expect(
            fetchReleaseIndex('https://x/releases.json', fetchImpl)
        ).resolves.toEqual(validIndex)
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://x/releases.json',
            expect.objectContaining({ headers: { Accept: 'application/json' } })
        )
    })

    it('throws on a non-2xx response', async () => {
        const fetchImpl = jest.fn(async () => responseWith(503, {}))
        await expect(
            fetchReleaseIndex('https://x/releases.json', fetchImpl)
        ).rejects.toThrow('HTTP 503')
    })

    it('throws when the body is not a release index', async () => {
        const fetchImpl = jest.fn(async () =>
            responseWith(200, { hello: 'world' })
        )
        await expect(
            fetchReleaseIndex('https://x/releases.json', fetchImpl)
        ).rejects.toThrow('Unexpected index format')
    })

    it('throws when a tool entry is missing required fields', async () => {
        const fetchImpl = jest.fn(async () =>
            responseWith(200, {
                generated_at: '2026-09-22T03:00:12Z',
                tools: [{ repo: 'x' }],
            })
        )
        await expect(
            fetchReleaseIndex('https://x/releases.json', fetchImpl)
        ).rejects.toThrow('Unexpected index format')
    })
})

describe('useReleaseIndex', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('exposes the index through TanStack Query', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(200, validIndex)
        ) as unknown as typeof fetch
        const { result } = renderHook(() => useReleaseIndex(), {
            wrapper: createTestWrapper(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.tools[0].name).toBe('DHIS2 Admin Toolbox')
    })

    it('reports an error when the fetch fails', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(500, {})
        ) as unknown as typeof fetch
        const { result } = renderHook(() => useReleaseIndex(), {
            wrapper: createTestWrapper(),
        })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('HTTP 500')
    })
})
