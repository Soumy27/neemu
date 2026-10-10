import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { finishSignIn } from './api/auth'

// Icons are a font spelt as words ("water_drop"); keep them hidden until the font is in,
// so a slow or blocked font never shows words in place of icons.
document.fonts?.load('24px "Material Symbols Outlined"').then(() => document.documentElement.classList.add('icons-ready')).catch(() => {})

// If Cognito has just sent the person back, finish that before the app reads the address bar.
finishSignIn().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
