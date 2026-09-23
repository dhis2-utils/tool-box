# DHIS2 Admin Toolbox

DHIS2 App Platform app (TypeScript, React 18, `@dhis2/ui`, TanStack Query 4) with one view.

- `tools.json` + `scripts/build-release-index.mjs` + `.github/workflows/release-index.yml`
  publish `releases.json` to the `gh-pages` branch daily. The app never calls the GitHub API.
- `src/config.ts` holds the index URL; override with `DHIS2_RELEASE_INDEX_URL` (env vars need
  the `DHIS2_` prefix and are read from `process.env`).
- `src/lib/mergeTools.ts` is the only business logic: index + `/api/apps` to rows with a status.
  Keep it pure and tested.
- `d2.config.js` `name` must stay `DHIS2 Admin Toolbox` (with spaces). The platform copies it to the manifest `short_name`, from which DHIS2 derives the app key (`DHIS2-Admin-Toolbox`) and the app authority (`M_DHIS2_Admin_Toolbox`); both must match 0.1.x or upgrades install a second app or revoke role-based access. `src/appIdentity.test.ts` guards it. `title` is only the display name.
- Data access goes through `src/utils/useApiDataQuery.ts` (app-runtime engine inside TanStack
  Query), never `useDataQuery` directly. Tests wrap with `src/test-utils/renderWithProviders.tsx`.
- Verify with `pnpm lint && pnpm test && pnpm test:index`. Design spec and plan under `docs/superpowers/`.
