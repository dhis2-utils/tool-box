import { render, screen } from '@testing-library/react'
import React from 'react'
import { formatDate, ToolsTable } from './ToolsTable'
import { ToolRow } from '@/types'

const row = (overrides: Partial<ToolRow>): ToolRow => ({
    repo: 'dhis2/tool-x',
    name: 'Tool X',
    latestVersion: '1.2.0',
    publishedAt: '2026-08-01T10:12:00Z',
    downloadUrl: 'https://example.invalid/tool-x.zip',
    releaseUrl: 'https://example.invalid/v1.2.0',
    installedVersion: '1.1.0',
    status: 'update-available',
    ...overrides,
})

describe('ToolsTable', () => {
    it('renders one row per tool with a repo link, versions and download link', () => {
        render(<ToolsTable rows={[row({})]} />)
        const link = screen.getByRole('link', { name: 'Tool X' })
        expect(link).toHaveAttribute('href', 'https://github.com/dhis2/tool-x')
        expect(screen.getByText('1.1.0')).toBeInTheDocument()
        expect(screen.getByText('1.2.0')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
            'href',
            'https://example.invalid/tool-x.zip'
        )
    })

    it.each([
        ['up-to-date', 'Up to date'],
        ['update-available', 'Update available'],
        ['not-installed', 'Not installed'],
        ['no-release', 'No release yet'],
        ['unknown', 'Unknown'],
    ] as const)('renders the %s status as "%s"', (status, label) => {
        render(<ToolsTable rows={[row({ status })]} />)
        expect(screen.getByTestId('tool-status')).toHaveTextContent(label)
    })

    it('shows a dash for installed version when not installed and no download when there is no asset', () => {
        render(
            <ToolsTable
                rows={[
                    row({
                        installedVersion: null,
                        status: 'not-installed',
                        downloadUrl: null,
                    }),
                ]}
            />
        )
        const cells = screen.getAllByRole('cell')
        expect(cells[1]).toHaveTextContent('-')
        expect(
            screen.queryByRole('link', { name: 'Download' })
        ).not.toBeInTheDocument()
    })

    it('shows Unknown for installed version when apps could not be read', () => {
        render(
            <ToolsTable
                rows={[row({ installedVersion: null, status: 'unknown' })]}
            />
        )
        const cells = screen.getAllByRole('cell')
        expect(cells[1]).toHaveTextContent('Unknown')
    })

    it('shows a dash for a missing release date and version', () => {
        render(
            <ToolsTable
                rows={[
                    row({
                        latestVersion: null,
                        publishedAt: null,
                        status: 'no-release',
                    }),
                ]}
            />
        )
        const cells = screen.getAllByRole('cell')
        expect(cells[2]).toHaveTextContent('-')
        expect(cells[3]).toHaveTextContent('-')
    })

    it('formats an invalid date as a dash', () => {
        expect(formatDate('not a date')).toBe('-')
    })

    it('links the release page when the release has no zip asset', () => {
        render(<ToolsTable rows={[row({ downloadUrl: null })]} />)
        expect(
            screen.queryByRole('link', { name: 'Download' })
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: 'Release page' })
        ).toHaveAttribute('href', 'https://example.invalid/v1.2.0')
    })

    it('renders no link and a dash for non-https download and release URLs', () => {
        render(
            <ToolsTable
                rows={[
                    row({
                        downloadUrl: 'javascript:alert(1)',
                        releaseUrl: 'javascript:alert(2)',
                    }),
                ]}
            />
        )
        expect(screen.getAllByRole('link')).toHaveLength(1)
        expect(
            screen.queryByRole('link', { name: 'Download' })
        ).not.toBeInTheDocument()
        const cells = screen.getAllByRole('cell')
        expect(cells[5]).toHaveTextContent('-')
    })
})
