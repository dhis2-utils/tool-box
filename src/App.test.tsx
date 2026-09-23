import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

declare const global: { fetch: typeof fetch }

it('mounts and starts loading', () => {
    global.fetch = jest.fn(
        () => new Promise(() => undefined)
    ) as unknown as typeof fetch
    render(
        <Provider
            config={{ baseUrl: 'http://localhost:8080', apiVersion: 42 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={() => undefined}
            showAlertsInPlugin={true}
        >
            <CustomDataProvider
                data={{ apps: [], me: { authorities: ['ALL'] } }}
            >
                <App />
            </CustomDataProvider>
        </Provider>
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
})
