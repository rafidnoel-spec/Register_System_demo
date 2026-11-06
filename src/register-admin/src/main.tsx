import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import App from './App';
import './styles.css';

// I demoläget (GitHub Pages) körs API:t i webbläsaren och vi använder hash-routing
// eftersom statisk hosting inte kan hantera djupa länkar.
export const DEMO = import.meta.env.VITE_DEMO === 'true';
const Router = DEMO ? HashRouter : BrowserRouter;

async function start() {
  if (DEMO) {
    const { installMockApi } = await import('../../demo-mock/mockApi');
    installMockApi();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Router>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </StrictMode>
  );
}
void start();
