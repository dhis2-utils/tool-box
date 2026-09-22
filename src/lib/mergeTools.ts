import { compareVersions } from '@/lib/compareVersions'
import {
    InstalledApp,
    ReleaseIndex,
    ToolRelease,
    ToolRow,
    ToolStatus,
} from '@/types'

const statusFor = (
    tool: ToolRelease,
    installed: InstalledApp | undefined,
    appsUnavailable: boolean
): ToolStatus => {
    if (appsUnavailable) {
        return 'unknown'
    }
    if (tool.version === null) {
        return 'no-release'
    }
    if (installed === undefined) {
        return 'not-installed'
    }
    const installedIsOlder =
        compareVersions(installed.version, tool.version) < 0
    return installedIsOlder ? 'update-available' : 'up-to-date'
}

/**
 * Joins the published release index with the apps installed on this
 * instance. `installedApps` is undefined when /api/apps could not be read;
 * every row is then 'unknown' rather than misleadingly 'not-installed'.
 */
export const mergeTools = (
    index: ReleaseIndex,
    installedApps: InstalledApp[] | undefined
): ToolRow[] => {
    const appsUnavailable = installedApps === undefined
    return [...index.tools]
        .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
        .map((tool) => {
            // DHIS2 reports the manifest name; tools.json carries the same
            // name, so a case-insensitive match is the join key.
            const installed = installedApps?.find(
                (app) => app.name.toLowerCase() === tool.name.toLowerCase()
            )
            return {
                repo: tool.repo,
                name: tool.name,
                latestVersion: tool.version,
                publishedAt: tool.published_at,
                downloadUrl: tool.download_url,
                releaseUrl: tool.release_url,
                installedVersion: installed?.version ?? null,
                status: statusFor(tool, installed, appsUnavailable),
            }
        })
}
