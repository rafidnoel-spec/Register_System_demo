import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Kaldeisk-katolska missionen Södertälje" className="login-logo" />
        <h1>Församlingsregister</h1>
        <p className="muted">Logga in för att administrera medlemmar</p>
        {error && <div className="alert error">{error}</div>}
        <label>
          E-post
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Lösenord
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="primary" disabled={busy}>{busy ? 'Loggar in…' : 'Logga in'}</button>
        <p className="small muted">Systemet innehåller känsliga personuppgifter. All åtkomst loggas.</p>
        {import.meta.env.VITE_DEMO === 'true' && (
          <div className="demo-accounts">
            <strong>Demokonton</strong> (lösenord: <code>demo</code>) – klicka för att logga in:
            {[
              ['root@demo.se', 'Root – hela organisationen'],
              ['lan@demo.se', 'Län – Stockholms län'],
              ['stad@demo.se', 'Stad – Södertälje'],
              ['kyrka@demo.se', 'Kyrka – Demokyrkan S:t Josef']
            ].map(([mail, label]) => (
              <button type="button" key={mail} onClick={async () => {
                setEmail(mail); setPassword('demo'); setError(null);
                try { await login(mail, 'demo'); } catch (err) { setError((err as Error).message); }
              }}>{label}<small>{mail}</small></button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
