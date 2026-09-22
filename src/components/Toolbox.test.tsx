import { screen } from '@testing-library/react'
import React from 'react'
import { Toolbox } from './Toolbox'
import { renderWithProviders } from '@/test-utils/renderWithProviders'

declare const global: { fetch: typeof fetch }

const index = {
    generated_at: '2026-09-22T03:00:12Z',
    tools: [
        {
            repo: 'dhis2/tool-box',
            name: 'DHIS2 Admin Toolbox',
            version: '0.1.5',
            tag: 'v0.1.5',
            published_at: '2026-08-01T10:12:00Z',
            download_url: 'https://example.invalid/tool-box.zip',
            release_url: 'https://example.invalid/v0.1.5',
        },
    ],
}

const responseWith = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as Response

const superuser = { authorities: ['ALL'] }
const apps = [{ name: 'DHIS2 Admin Toolbox', version: '0.1.4' }]

describe('Toolbox', () => {
    let originalFetch: typeof fetch

    beforeEach(() => {
        originalFetch = global.fetch
    })

    afterEach(() => {
        global.fetch = originalFetch
        jest.restoreAllMocks()
    })

    it('shows a loader, then the table with the index timestamp', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(200, index)
        ) as unknown as typeof fetch
        renderWithProviders(<Toolbox />, { apps, me: superuser })
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(
            await screen.findByRole('link', { name: 'DHIS2 Admin Toolbox' })
        ).toBeInTheDocument()
        expect(screen.getByText(/Index updated/)).toBeInTheDocument()
        expect(screen.getByTestId('tool-status')).toHaveTextContent(
            'Update available'
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows only an error notice naming the URL when the index cannot be loaded', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(500, {})
        ) as unknown as typeof fetch
        renderWithProviders(<Toolbox />, { apps, me: superuser })
        expect(
            await screen.findByText('Could not load the tool index')
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                (_, el) =>
                    el?.children.length === 0 &&
                    (el?.textContent?.includes(
                        'https://dhis2.github.io/tool-box/releases.json'
                    ) ??
                        false)
            )
        ).toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('still renders the table with a warning when installed apps cannot be read', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(200, index)
        ) as unknown as typeof fetch
        const failingApps = () => {
            throw new Error('forbidden')
        }
        renderWithProviders(<Toolbox />, { apps: failingApps, me: superuser })
        expect(
            await screen.findByText('Could not read installed apps')
        ).toBeInTheDocument()
        expect(screen.getByTestId('tool-status')).toHaveTextContent('Unknown')
    })

    it('warns a user without the ALL authority', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(200, index)
        ) as unknown as typeof fetch
        renderWithProviders(<Toolbox />, {
            apps,
            me: { authorities: ['M_dhis-web-maintenance'] },
        })
        expect(
            await screen.findByText('Limited view of installed apps')
        ).toBeInTheDocument()
        expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('does not warn when the current user cannot be read', async () => {
        global.fetch = jest.fn(async () =>
            responseWith(200, index)
        ) as unknown as typeof fetch
        const failingMe = () => {
            throw new Error('nope')
        }
        renderWithProviders(<Toolbox />, { apps, me: failingMe })
        expect(await screen.findByRole('table')).toBeInTheDocument()
        expect(
            screen.queryByText('Limited view of installed apps')
        ).not.toBeInTheDocument()
    })
})
