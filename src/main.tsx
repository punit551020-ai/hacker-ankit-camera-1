import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    const isEmbeddedIframe = window.self !== window.top;
    if (!isEmbeddedIframe) {
      registerSW({
        immediate: true,
        onOfflineReady() {
          // Offline shell & assets cached cleanly
        },
        onRegisterError() {
          // Ignore non-fatal SW registration issues in private browsing
        },
      });
    }
  } catch {
    // Ignore iframe origin restrictions
  }
}

createRoot(document.getElementById('root')!).render(<App />);
