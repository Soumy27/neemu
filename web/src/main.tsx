import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { finishSignIn } from './api/auth'

// If Cognito has just sent the person back, finish that before the app reads the address bar.
finishSignIn().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
