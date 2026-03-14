import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import './select-styles.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { CurrencyProvider } from './currency/CurrencyContext.jsx'
import { AppModalProvider } from './components/AppModalProvider.jsx'

window.Buffer = Buffer

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CurrencyProvider>
          <AppModalProvider>
            <App />
          </AppModalProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
