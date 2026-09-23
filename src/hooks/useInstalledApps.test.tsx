import { renderHook, waitFor } from '@testing-library/react'
import { useInstalledApps } from './useInstalledApps'
import { createTestWrapper } from '@/test-utils/renderWithProviders'

describe('useInstalledApps', () => {
    it('returns the apps list', async () => {
        const apps = [{ name: 'DHIS2 Admin Toolbox', version: '0.1.5' }]
        const { result } = renderHook(() => useInstalledApps(), {
            wrapper: createTestWrapper({ apps }),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(apps)
    })

    it('reports an error when the endpoint fails', async () => {
        const apps = () => {
            throw new Error('forbidden')
        }
        const { result } = renderHook(() => useInstalledApps(), {
            wrapper: createTestWrapper({ apps }),
        })
        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
