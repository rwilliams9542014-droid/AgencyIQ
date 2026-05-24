import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LandingPage from './LandingPage.tsx'

function Root() {
  const [view, setView] = useState<'landing' | 'app'>(() =>
    window.location.hash === '#app' ||
    window.location.search.includes('view=app') ||
    window.location.pathname === '/app'
      ? 'app'
      : 'landing'
  )

  const enterCrm = () => {
    window.location.hash = '#app'
    setView('app')
  }

  if (view === 'app') return <App />
  return <LandingPage onEnterCrm={enterCrm} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
