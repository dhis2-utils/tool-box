// The index workflow runs daily; a few missed runs are normal (a transient
// GitHub error fails the whole run), a longer gap means it has stopped.
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

export const isIndexStale = (generatedAt: string, now: Date): boolean => {
    const generated = Date.parse(generatedAt)
    if (Number.isNaN(generated)) {
        return false
    }
    return now.getTime() - generated > STALE_AFTER_MS
}
