import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { LicenseProvider } from './context/LicenseContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LicenseProvider>
        <App />
      </LicenseProvider>
    </ErrorBoundary>
  </StrictMode>,
)
