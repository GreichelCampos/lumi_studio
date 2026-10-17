import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { IdeSettingsProvider } from './context/IdeSettingsContext';
import './index.css';

// Prevent harmless ResizeObserver loop notification warnings from disrupting runtime
window.addEventListener('error', (e) => {
  if (
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    e.message === 'ResizeObserver loop limit exceeded'
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdeSettingsProvider>
      <App />
    </IdeSettingsProvider>
  </StrictMode>,
);
