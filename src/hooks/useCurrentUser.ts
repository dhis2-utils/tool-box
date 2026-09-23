import { useApiDataQuery } from '@/utils/useApiDataQuery'

export interface CurrentUser {
    authorities: string[]
}

export const useCurrentUser = () =>
    useApiDataQuery<CurrentUser>({
        queryKey: ['me', 'authorities'],
        query: { resource: 'me', params: { fields: 'authorities' } },
    })
