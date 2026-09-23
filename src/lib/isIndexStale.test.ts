import { isIndexStale } from './isIndexStale'

const now = new Date('2026-09-23T12:00:00Z')

describe('isIndexStale', () => {
    it('treats an index from the last few days as current', () => {
        expect(isIndexStale('2026-09-23T03:00:00Z', now)).toBe(false)
        expect(isIndexStale('2026-09-20T12:00:01Z', now)).toBe(false)
    })

    it('treats an index older than three days as stale', () => {
        expect(isIndexStale('2026-09-20T11:59:59Z', now)).toBe(true)
        expect(isIndexStale('2025-01-01T00:00:00Z', now)).toBe(true)
    })

    it('does not flag an unparseable timestamp', () => {
        expect(isIndexStale('not a date', now)).toBe(false)
    })
})
