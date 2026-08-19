import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { startPWAUpdateNotificationMonitor } from './lib/pwaInstall'
import { syncPwaUiClass } from './lib/pwaDisplay'
import App from './App.tsx'

syncPwaUiClass()
startPWAUpdateNotificationMonitor()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
