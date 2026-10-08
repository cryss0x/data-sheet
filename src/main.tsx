/**
 * main.tsx
 * ---------
 * The starting point of the app. It puts the app on the page and, in a built
 * (published) version, also switches on the small "offline" helper that makes
 * the app open even without an internet connection.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('The page is not set up correctly.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The service worker makes the app work offline after the first visit.
// It is only switched on in a published build, never while developing.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // If the browser will not register it, the app still works while online.
    })
  })
}
