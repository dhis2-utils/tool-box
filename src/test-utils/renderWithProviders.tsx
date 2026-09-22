import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import React from 'react'

type CustomData = React.ComponentProps<typeof CustomDataProvider>['data']

/**
 * Wraps a component or hook in the app-runtime and TanStack Query providers.
 * `data` is keyed by DHIS2 resource ('apps', 'me'); a value may be a
 * function that throws to simulate a failing endpoint. Any resource not in
 * `data` throws (failOnMiss), so tests declare exactly what they use.
 */
export const createTestWrapper = (data: CustomData = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <Provider
            config={{ baseUrl: 'http://localhost:8080', apiVersion: 42 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={() => undefined}
            showAlertsInPlugin={true}
        >
            <CustomDataProvider data={data} options={{ failOnMiss: true }}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
}

export const renderWithProviders = (
    ui: React.ReactElement,
    data: CustomData = {}
) => render(ui, { wrapper: createTestWrapper(data) })
