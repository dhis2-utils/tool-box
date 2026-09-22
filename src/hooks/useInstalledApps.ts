import { InstalledApp } from '@/types'
import { useApiDataQuery } from '@/utils/useApiDataQuery'

// DHIS2 returns only the apps the current user may open (ALL or the app's
// own M_<key> authority). Toolbox.tsx warns non-superusers about this.
export const useInstalledApps = () =>
    useApiDataQuery<InstalledApp[]>({
        queryKey: ['installed-apps'],
        query: { resource: 'apps' },
    })
