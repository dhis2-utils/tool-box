// Minimal semver-style comparison. Enough for release tags like v1.2.3 and
// 1.2.3-beta.1; deliberately not a full semver implementation, so no
// dependency is needed.
interface ParsedVersion {
    parts: number[]
    prerelease: string | null
}

const parseVersion = (version: string): ParsedVersion => {
    const cleaned = version.trim().replace(/^v/i, '')
    const dashIndex = cleaned.indexOf('-')
    const main = dashIndex === -1 ? cleaned : cleaned.slice(0, dashIndex)
    const prerelease = dashIndex === -1 ? null : cleaned.slice(dashIndex + 1)
    const parts = main.split('.').map((part) => {
        const parsed = parseInt(part, 10)
        return Number.isNaN(parsed) ? 0 : parsed
    })
    return { parts, prerelease }
}

export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
    const left = parseVersion(a)
    const right = parseVersion(b)
    const length = Math.max(left.parts.length, right.parts.length)
    for (let i = 0; i < length; i++) {
        const x = left.parts[i] ?? 0
        const y = right.parts[i] ?? 0
        if (x !== y) {
            return x < y ? -1 : 1
        }
    }
    if (left.prerelease !== null && right.prerelease === null) {
        return -1
    }
    if (left.prerelease === null && right.prerelease !== null) {
        return 1
    }
    if (left.prerelease !== null && right.prerelease !== null) {
        if (left.prerelease === right.prerelease) {
            return 0
        }
        return left.prerelease < right.prerelease ? -1 : 1
    }
    return 0
}
