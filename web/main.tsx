import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// ?theme=dark or ?theme=light forces a theme for one visit (used for screenshots).
const forced = new URLSearchParams(window.location.search).get('theme')
if (forced) document.documentElement.classList.toggle('dark', forced === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
