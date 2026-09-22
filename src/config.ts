// The published index. Override for development and testing (or after the
// repos move organisation) with DHIS2_RELEASE_INDEX_URL; the platform only
// exposes env vars with the DHIS2_ prefix, on process.env.
export const RELEASE_INDEX_URL =
    process.env.DHIS2_RELEASE_INDEX_URL ??
    'https://dhis2.github.io/tool-box/releases.json'
