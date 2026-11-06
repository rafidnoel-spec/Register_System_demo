import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { roleLabels } from '../labels';
import { useData } from '../hooks';
import type { MemberListItem } from '../types';

export default function Layout() {
  const { user, logout } = useAuth();
  const pending = useData<MemberListItem[]>('/api/members/pending');
  if (!user) return null;
  const pendingCount = pending.data?.length ?? 0;

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Kaldeisk-katolska missionen" />
          <div>
            <strong>Församlingsregister</strong>
            <small>Kaldeisk-katolska missionen</small>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>Översikt</NavLink>
          <NavLink to="/members">Medlemmar</NavLink>
          <NavLink to="/pending">
            Nya registreringar {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
          </NavLink>
          <NavLink to="/organization">Län, städer &amp; kyrkor</NavLink>
          <NavLink to="/priests">Präster</NavLink>
          {user.role !== 'Church' && <NavLink to="/users">Användare</NavLink>}
          {user.role === 'Root' && <NavLink to="/audit">Granskningslogg</NavLink>}
          <NavLink to="/account">Mitt konto</NavLink>
        </nav>
        <div className="user-box">
          <div><strong>{user.displayName}</strong></div>
          <small>{roleLabels[user.role]}{user.scopeName && user.role !== 'Root' ? ` – ${user.scopeName}` : ''}</small>
          <button className="link" onClick={logout}>Logga ut</button>
        </div>
      </aside>
      <main className="content">
        {import.meta.env.VITE_DEMO === 'true' && <DemoBanner />}
        <Outlet />
      </main>
    </div>
  );
}

function DemoBanner() {
  const reset = async () => {
    if (!confirm('Återställa all demodata till ursprungsläget?')) return;
    const { resetDemoData } = await import('../../../demo-mock/mockApi');
    resetDemoData();
    window.location.reload();
  };
  return (
    <div className="demo-banner no-print">
      <span><strong>DEMO</strong> – alla personer är påhittade. Ändringar sparas bara i din webbläsare och inga mejl skickas.</span>
      <span>
        <a href="../registrering/" target="_blank" rel="noreferrer">Öppna registreringsformuläret</a>
        <button className="link" onClick={reset}>Återställ demodata</button>
      </span>
    </div>
  );
}
