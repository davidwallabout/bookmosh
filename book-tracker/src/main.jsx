import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import PrivacyPolicy from './PrivacyPolicy.jsx'

const renderFatal = (error) => {
  try {
    const message = error?.message ? String(error.message) : String(error)
    const stack = error?.stack ? String(error.stack) : ''
    const html = `
      <div style="min-height:100vh;background:#020617;color:#fff;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
        <div style="max-width:900px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:24px;background:rgba(255,255,255,0.04);padding:20px;">
          <div style="font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:10px;">Fatal client error</div>
          <div style="font-size:20px;font-weight:800;margin-bottom:10px;">BookMosh crashed while loading</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.75);margin-bottom:12px;">Open DevTools Console for more details.</div>
          <pre style="white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px;font-size:12px;color:rgba(255,255,255,0.85);">${message}${stack ? `\n\n${stack}` : ''}</pre>
        </div>
      </div>
    `.trim()
    document.body.innerHTML = html
  } catch {
    // eslint-disable-next-line no-alert
    alert('BookMosh crashed while loading. Check console for details.')
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event?.error) renderFatal(event.error)
    else renderFatal(new Error(event?.message || 'Unknown error'))
  })
  window.addEventListener('unhandledrejection', (event) => {
    renderFatal(event?.reason || new Error('Unhandled promise rejection'))
  })
}

try {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Missing #root element')
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/book" element={<App />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  )
} catch (error) {
  renderFatal(error)
}
