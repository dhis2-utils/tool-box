import i18n from '@dhis2/d2-i18n'
import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
    Tag,
} from '@dhis2/ui'
import React from 'react'
import classes from './ToolsTable.module.css'
import { ToolRow, ToolStatus } from '@/types'

export const formatDate = (iso: string | null): string => {
    if (iso === null || Number.isNaN(Date.parse(iso))) {
        return '-'
    }
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

const StatusTag = ({ status }: { status: ToolStatus }) => {
    switch (status) {
        case 'up-to-date':
            return (
                <Tag positive dataTest="tool-status">
                    {i18n.t('Up to date')}
                </Tag>
            )
        case 'update-available':
            return (
                <Tag neutral bold dataTest="tool-status">
                    {i18n.t('Update available')}
                </Tag>
            )
        case 'not-installed':
            return <Tag dataTest="tool-status">{i18n.t('Not installed')}</Tag>
        case 'no-release':
            return <Tag dataTest="tool-status">{i18n.t('No release yet')}</Tag>
        case 'unknown':
            return <Tag dataTest="tool-status">{i18n.t('Unknown')}</Tag>
    }
}

const installedLabel = (row: ToolRow): string => {
    if (row.installedVersion !== null) {
        return row.installedVersion
    }
    return row.status === 'unknown' ? i18n.t('Unknown') : '-'
}

export const ToolsTable = ({ rows }: { rows: ToolRow[] }) => (
    <DataTable className={classes.table}>
        <DataTableHead>
            <DataTableRow>
                <DataTableColumnHeader>{i18n.t('Tool')}</DataTableColumnHeader>
                <DataTableColumnHeader>
                    {i18n.t('Installed')}
                </DataTableColumnHeader>
                <DataTableColumnHeader>
                    {i18n.t('Latest')}
                </DataTableColumnHeader>
                <DataTableColumnHeader>
                    {i18n.t('Released')}
                </DataTableColumnHeader>
                <DataTableColumnHeader>
                    {i18n.t('Status')}
                </DataTableColumnHeader>
                <DataTableColumnHeader>
                    {i18n.t('Download')}
                </DataTableColumnHeader>
            </DataTableRow>
        </DataTableHead>
        <DataTableBody>
            {rows.map((row) => (
                <DataTableRow key={row.repo}>
                    <DataTableCell>
                        <a
                            className={classes.link}
                            href={`https://github.com/${row.repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {row.name}
                        </a>
                    </DataTableCell>
                    <DataTableCell>{installedLabel(row)}</DataTableCell>
                    <DataTableCell>{row.latestVersion ?? '-'}</DataTableCell>
                    <DataTableCell>{formatDate(row.publishedAt)}</DataTableCell>
                    <DataTableCell>
                        <StatusTag status={row.status} />
                    </DataTableCell>
                    <DataTableCell>
                        {row.downloadUrl !== null ? (
                            <a
                                className={classes.link}
                                href={row.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {i18n.t('Download')}
                            </a>
                        ) : (
                            '-'
                        )}
                    </DataTableCell>
                </DataTableRow>
            ))}
        </DataTableBody>
    </DataTable>
)
