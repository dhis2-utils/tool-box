import { useQuery } from '@tanstack/react-query'
import { RELEASE_INDEX_URL } from '@/config'
import { ReleaseIndex } from '@/types'

const isReleaseIndex = (value: unknown): value is ReleaseIndex => {
    if (typeof value !== 'object' || value === null) {
        return false
    }
    const candidate = value as Partial<ReleaseIndex>
    return (
        typeof candidate.generated_at === 'string' &&
        Array.isArray(candidate.tools) &&
        candidate.tools.every(
            (tool) =>
                typeof tool === 'object' &&
                tool !== null &&
                typeof (tool as Partial<ReleaseIndex['tools'][number]>).repo ===
                    'string' &&
                typeof (tool as Partial<ReleaseIndex['tools'][number]>).name ===
                    'string'
        )
    )
}

export const fetchReleaseIndex = async (
    url: string,
    fetchImpl: typeof fetch = fetch
): Promise<ReleaseIndex> => {
    const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
    }
    const body: unknown = await response.json()
    if (!isReleaseIndex(body)) {
        throw new Error('Unexpected index format')
    }
    return body
}

export const useReleaseIndex = () =>
    useQuery<ReleaseIndex, Error>({
        queryKey: ['release-index', RELEASE_INDEX_URL],
        queryFn: () => fetchReleaseIndex(RELEASE_INDEX_URL),
        staleTime: 5 * 60 * 1000,
    })
