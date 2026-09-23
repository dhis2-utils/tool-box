import 'react'

declare module 'react' {
    interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
        jsx?: boolean
        global?: boolean
    }
}

// @types/node isn't a dependency here; the App Platform only exposes
// process.env.DHIS2_* (stringified at build time), so declare the minimal
// shape config.ts needs rather than pulling in full Node typings.
declare global {
    const process: {
        env: Record<string, string | undefined>
    }
}
