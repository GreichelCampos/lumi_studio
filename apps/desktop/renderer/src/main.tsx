import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ViewportWindowApp from './ViewportWindowApp.tsx';
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

const RootApp = new URLSearchParams(window.location.search).get('window') === 'viewport' ? ViewportWindowApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdeSettingsProvider>
      <RootApp />
    </IdeSettingsProvider>
  </StrictMode>,
);
