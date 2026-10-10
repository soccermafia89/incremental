import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  label: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Contains a render or effect failure to one part of the UI.
 * This has to be a class: React has no hook equivalent for componentDidCatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label}] caught an error:`, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) return this.props.fallback
    return this.props.children
  }
}

export function ErrorFallback({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '40px',
      minWidth: '400px',
      minHeight: '200px',
      color: 'white',
      backgroundColor: '#16213e',
      border: '1px solid #a13636',
      borderRadius: '8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{title}</div>
      <div style={{ fontSize: '14px', opacity: 0.75, maxWidth: '460px' }}>{detail}</div>
    </div>
  )
}
