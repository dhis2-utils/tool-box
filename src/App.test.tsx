import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

it('renders the title', () => {
    render(<App />)
    expect(
        screen.getByRole('heading', { name: 'DHIS2 Admin Toolbox' })
    ).toBeInTheDocument()
})
