import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox } from '../components/Modal';
import { roleLabels } from '../labels';

export default function AccountPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== repeat) { setError('Lösenorden matchar inte.'); return; }
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setDone(true);
      setCurrent(''); setNext(''); setRepeat('');
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <div>
      <h1>Mitt konto</h1>
      <section className="card narrow">
        <p><strong>{user?.displayName}</strong><br />{user?.email}<br />
          <span className="muted">{user && roleLabels[user.role]} {user?.scopeName && `– ${user.scopeName}`}</span></p>
      </section>
      <form className="card narrow" onSubmit={submit}>
        <h2>Byt lösenord</h2>
        <ErrorBox error={error} />
        {done && <div className="alert success">Lösenordet är bytt.</div>}
        <label>Nuvarande lösenord<input type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" /></label>
        <label>Nytt lösenord (minst 12 tecken)<input type="password" value={next} onChange={e => setNext(e.target.value)} minLength={12} required autoComplete="new-password" /></label>
        <label>Upprepa nytt lösenord<input type="password" value={repeat} onChange={e => setRepeat(e.target.value)} minLength={12} required autoComplete="new-password" /></label>
        <button className="primary">Spara</button>
      </form>
    </div>
  );
}
