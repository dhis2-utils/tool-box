import i18n from '@dhis2/d2-i18n'
import { Center, CircularLoader, NoticeBox } from '@dhis2/ui'
import React from 'react'
import classes from './Toolbox.module.css'
import { ToolsTable } from './ToolsTable'
import { RELEASE_INDEX_URL } from '@/config'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useInstalledApps } from '@/hooks/useInstalledApps'
import { useReleaseIndex } from '@/hooks/useReleaseIndex'
import { mergeTools } from '@/lib/mergeTools'

const formatDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })

export const Toolbox = () => {
    const index = useReleaseIndex()
    const apps = useInstalledApps()
    const me = useCurrentUser()

    if (index.isError) {
        return (
            <div className={classes.container}>
                <NoticeBox
                    error
                    title={i18n.t('Could not load the tool index')}
                >
                    {i18n.t(
                        'The index at {{url}} could not be loaded ({{reason}}). Check that this browser can reach github.io; a firewall or proxy may be blocking it.',
                        { url: RELEASE_INDEX_URL, reason: index.error.message }
                    )}
                </NoticeBox>
            </div>
        )
    }

    // Wait for the index and the apps; the current-user query is advisory
    // and must never hold up the table.
    if (
        index.data === undefined ||
        (apps.data === undefined && !apps.isError)
    ) {
        return (
            <Center className={classes.loader}>
                <CircularLoader />
            </Center>
        )
    }

    const rows = mergeTools(index.data, apps.isError ? undefined : apps.data)
    const lacksAllAuthority =
        me.data !== undefined && !me.data.authorities.includes('ALL')

    return (
        <div className={classes.container}>
            <p className={classes.meta}>
                {i18n.t('Index updated {{when}}', {
                    when: formatDateTime(index.data.generated_at),
                })}
            </p>
            {apps.isError && (
                <NoticeBox
                    warning
                    title={i18n.t('Could not read installed apps')}
                >
                    {i18n.t(
                        'Installed versions cannot be shown. The list of tools and releases is still current.'
                    )}
                </NoticeBox>
            )}
            {lacksAllAuthority && (
                <NoticeBox
                    warning
                    title={i18n.t('Limited view of installed apps')}
                >
                    {i18n.t(
                        'You do not have the ALL authority. DHIS2 only lists apps you have access to, so tools you cannot open may appear here as not installed.'
                    )}
                </NoticeBox>
            )}
            <ToolsTable rows={rows} />
        </div>
    )
}
