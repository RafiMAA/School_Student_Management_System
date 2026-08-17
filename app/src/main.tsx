import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import './lib/pwaInstall'
import { syncPwaUiClass } from './lib/pwaDisplay'
import App from './App.tsx'

syncPwaUiClass()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
