#!/usr/bin/env node
// Builds releases.json, the index the DHIS2 Admin Toolbox reads instead of
// calling the GitHub API from the browser. Runs in GitHub Actions
// (.github/workflows/release-index.yml) and locally:
//
//   node scripts/build-release-index.mjs [tools.json] [releases.json]
//
// No dependencies on purpose: it must run on a bare `actions/setup-node`.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const GITHUB_API = 'https://api.github.com'

export const stripV = (tag) => tag.replace(/^v/, '')

export const fetchLatestRelease = async (
    repo,
    { fetchImpl = fetch, token = process.env.GITHUB_TOKEN } = {}
) => {
    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }
    const response = await fetchImpl(
        `${GITHUB_API}/repos/${repo}/releases/latest`,
        { headers }
    )
    // 404 means the repo has no releases yet (or was deleted). Both are
    // reported as "no release" rather than failing the whole index.
    if (response.status === 404) {
        return null
    }
    if (!response.ok) {
        throw new Error(`GitHub API ${response.status} for ${repo}`)
    }
    return response.json()
}

export const toToolEntry = (tool, release) => {
    if (release === null) {
        return {
            repo: tool.repo,
            name: tool.name,
            version: null,
            tag: null,
            published_at: null,
            download_url: null,
            release_url: null,
        }
    }
    const zipAsset = (release.assets ?? []).find((asset) =>
        asset.name.endsWith('.zip')
    )
    return {
        repo: tool.repo,
        name: tool.name,
        version: stripV(release.tag_name),
        tag: release.tag_name,
        published_at: release.published_at,
        download_url: zipAsset ? zipAsset.browser_download_url : null,
        release_url: release.html_url,
    }
}

export const buildIndex = async (
    tools,
    { fetchImpl = fetch, token = process.env.GITHUB_TOKEN, now = new Date() } = {}
) => {
    const entries = []
    // Sequential on purpose: eleven calls take a second or two, and it keeps
    // us clear of GitHub's secondary rate limits for concurrent requests.
    for (const tool of tools) {
        const release = await fetchLatestRelease(tool.repo, { fetchImpl, token })
        entries.push(toToolEntry(tool, release))
    }
    return { generated_at: now.toISOString(), tools: entries }
}

const main = async () => {
    const [toolsPath = 'tools.json', outputPath = 'releases.json'] =
        process.argv.slice(2)
    const tools = JSON.parse(await readFile(toolsPath, 'utf8'))
    const index = await buildIndex(tools)
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`)
    const withRelease = index.tools.filter((t) => t.version !== null).length
    console.log(
        `Wrote ${index.tools.length} tools (${withRelease} with a release) to ${outputPath}`
    )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error.message)
        process.exit(1)
    })
}
