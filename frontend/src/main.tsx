import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { LicenseProvider } from './context/LicenseContext'

// Global print override for Electron to bypass Print Preview limitations
if ((window as any).api && (window as any).api.send) {
  window.print = () => {
    // Send full document HTML to Electron native print handler
    const html = document.documentElement.outerHTML;
    (window as any).api.send('print-html', html);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LicenseProvider>
        <App />
      </LicenseProvider>
    </ErrorBoundary>
  </StrictMode>,
)
