import { renderHook, waitFor } from '@testing-library/react'
import { useCurrentUser } from './useCurrentUser'
import { createTestWrapper } from '@/test-utils/renderWithProviders'

describe('useCurrentUser', () => {
    it('returns the authorities of the current user', async () => {
        const me = { authorities: ['ALL'] }
        const { result } = renderHook(() => useCurrentUser(), {
            wrapper: createTestWrapper({ me }),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.authorities).toEqual(['ALL'])
    })
})
