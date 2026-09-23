/** One entry in releases.json, produced by scripts/build-release-index.mjs. */
export interface ToolRelease {
    repo: string
    name: string
    version: string | null
    tag: string | null
    published_at: string | null
    download_url: string | null
    release_url: string | null
}

/** The published index at RELEASE_INDEX_URL. */
export interface ReleaseIndex {
    generated_at: string
    tools: ToolRelease[]
}

/** The subset of GET /api/apps that this app reads. */
export interface InstalledApp {
    name: string
    version: string
}

export type ToolStatus =
    | 'up-to-date'
    | 'update-available'
    | 'not-installed'
    | 'no-release'
    | 'unknown'

/** One row of the tools table. */
export interface ToolRow {
    repo: string
    name: string
    latestVersion: string | null
    publishedAt: string | null
    downloadUrl: string | null
    releaseUrl: string | null
    installedVersion: string | null
    status: ToolStatus
}
