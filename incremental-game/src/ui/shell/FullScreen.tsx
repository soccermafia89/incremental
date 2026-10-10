import type { ReactNode } from 'react'
import { THEME } from '../sidebar/theme'

export function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: THEME.page,
      color: 'white',
    }}>
      {children}
    </div>
  )
}
