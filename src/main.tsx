import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@simcity/tokens/tokens.css';
import '@simcity/styles/base.css';
import '@/app.css';
import { App } from '@/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
