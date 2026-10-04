// The platform copies d2.config.js `name` into the manifest `short_name`, and
// DHIS2 derives two identities from it (verified on 2.40–2.43): the app key
// (spaces become dashes) and the app's access authority (spaces become
// underscores, dashes are dropped). The first release after 1.0.0 moved the
// key from `DHIS2 Admin Toolbox` to the repo name, as reference-tool-conventions
// requires. From here on neither may change, or an upgrade installs a second
// app (key) or silently revokes access for users who get the app through a
// user role rather than ALL (authority).
import config from '../d2.config.js'

const shortName = config.name ?? ''

const appKey = (name: string) => name.replace(/ /g, '-')
const appAuthority = (name: string) =>
    `M_${name.replace(/ /g, '_').replace(/-/g, '')}`

describe('app identity', () => {
    it('uses the repo name as the app key', () => {
        expect(appKey(shortName)).toBe('tool-box')
    })

    it('keeps the app authority', () => {
        expect(appAuthority(shortName)).toBe('M_toolbox')
    })
})
