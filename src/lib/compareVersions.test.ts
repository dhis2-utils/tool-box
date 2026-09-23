import { compareVersions } from './compareVersions'

describe('compareVersions', () => {
    it('treats equal versions as equal', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    })

    it('orders by major, then minor, then patch', () => {
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
        expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
        expect(compareVersions('1.1.0', '1.2.0')).toBe(-1)
        expect(compareVersions('1.2.10', '1.2.9')).toBe(1)
    })

    it('ignores a leading v', () => {
        expect(compareVersions('v1.2.3', '1.2.3')).toBe(0)
        expect(compareVersions('1.2.3', 'V1.2.4')).toBe(-1)
    })

    it('treats missing parts as zero', () => {
        expect(compareVersions('1.2', '1.2.0')).toBe(0)
        expect(compareVersions('1', '1.0.1')).toBe(-1)
    })

    it('treats a prerelease as older than the release', () => {
        expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1)
        expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
        expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
        expect(compareVersions('1.0.0-beta', '1.0.0-beta')).toBe(0)
    })

    it('treats non-numeric parts as zero instead of throwing', () => {
        expect(compareVersions('abc', '0.0.0')).toBe(0)
        expect(compareVersions('1.x.3', '1.0.3')).toBe(0)
    })
})
