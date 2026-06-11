import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LandingPage from './LandingPage.tsx'

export function Root() {
  // Start in CRM if the URL path is /app, otherwise show the landing page
  const [view, setView] = useState<'landing' | 'app'>(() =>
    window.location.pathname === '/app' ? 'app' : 'landing'
  )

  if (view === 'app') return <App />
  return <LandingPage onEnterCrm={() => setView('app')} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
