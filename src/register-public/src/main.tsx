import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

async function start() {
  if (import.meta.env.VITE_DEMO === 'true') {
    const { installMockApi } = await import('../../demo-mock/mockApi');
    installMockApi();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
void start();
