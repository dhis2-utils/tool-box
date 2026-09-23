// The platform copies d2.config.js `name` into the manifest `short_name`, and
// DHIS2 derives two identities from it (verified on 2.40–2.43): the app key
// (spaces become dashes) and the app's access authority (spaces become
// underscores, dashes are dropped). Both must match the 0.1.x releases, or
// an upgrade installs a second app (key) or silently revokes access for
// users who get the app through a user role rather than ALL (authority).
import config from '../d2.config.js'

const shortName = config.name ?? ''

const appKey = (name: string) => name.replace(/ /g, '-')
const appAuthority = (name: string) =>
    `M_${name.replace(/ /g, '_').replace(/-/g, '')}`

describe('app identity', () => {
    it('keeps the 0.1.x app key', () => {
        expect(appKey(shortName)).toBe('DHIS2-Admin-Toolbox')
    })

    it('keeps the 0.1.x app authority', () => {
        expect(appAuthority(shortName)).toBe('M_DHIS2_Admin_Toolbox')
    })
})
