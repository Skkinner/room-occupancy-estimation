import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './i18n'
import { DemoProvider } from './state/DemoStore'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <DemoProvider>
          <App />
        </DemoProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
