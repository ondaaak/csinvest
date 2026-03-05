import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './select-styles.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { CurrencyProvider } from './currency/CurrencyContext.jsx'
import { AppModalProvider } from './components/AppModalProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
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
