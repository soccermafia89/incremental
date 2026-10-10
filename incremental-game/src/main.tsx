import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary, ErrorFallback } from './ui/ErrorBoundary'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary
      label="App"
      fallback={<ErrorFallback
        title="Incremental failed to start"
        detail="Something went wrong while rendering the game. Check the browser console for details, then reload."
      />}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
