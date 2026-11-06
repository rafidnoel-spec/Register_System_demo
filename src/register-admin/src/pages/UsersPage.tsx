import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Modal, { ErrorBox } from '../components/Modal';
import { useChurches, useCities, useCounties, useData } from '../hooks';
import { fmtDateTime, roleLabels } from '../labels';
import type { User, UserRole } from '../types';

const roleOrder: UserRole[] = ['Root', 'County', 'City', 'Church'];

export default function UsersPage() {
  const users = useData<User[]>('/api/users');
  const [editing, setEditing] = useState<User | 'new' | null>(null);

  return (
    <div>
      <div className="page-header">
        <h1>Användare</h1>
        <button className="primary" onClick={() => setEditing('new')}>+ Ny användare</button>
      </div>
      <p className="muted">
        Behörigheten styr vilka medlemmar användaren ser: <strong>Root</strong> ser allt, <strong>Län</strong> ser alla kyrkor i länet,
        <strong> Stad</strong> ser kyrkorna i staden och <strong>Kyrka</strong> ser bara sin kyrka.
      </p>
      <ErrorBox error={users.error} />
      <div className="card">
        <table>
          <thead><tr><th>Namn</th><th>E-post</th><th>Behörighet</th><th>Område</th><th>Senast inloggad</th><th></th></tr></thead>
          <tbody>
            {users.data?.map(u => (
              <tr key={u.id} className={u.isActive ? '' : 'inactive'}>
                <td>{u.displayName}{!u.isActive && <small className="muted"> (inaktiv)</small>}</td>
                <td>{u.email}</td>
                <td>{roleLabels[u.role]}</td>
                <td>{u.scopeName}</td>
                <td className="muted">{fmtDateTime(u.lastLoginAt)}</td>
                <td className="right"><button className="link" onClick={() => setEditing(u)}>Ändra</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await users.reload(); }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const { user: me } = useAuth();
  const counties = useCounties();
  const cities = useCities();
  const churches = useChurches();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'Church');
  const [countyId, setCountyId] = useState<number | ''>(user?.countyId ?? '');
  const [cityId, setCityId] = useState<number | ''>(user?.cityId ?? '');
  const [churchId, setChurchId] = useState<number | ''>(user?.churchId ?? '');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  // Man kan bara ge behörighet på sin egen nivå eller lägre.
  const allowedRoles = roleOrder.filter(r => roleOrder.indexOf(r) >= roleOrder.indexOf(me!.role));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const scope = {
      countyId: role === 'County' ? countyId || null : null,
      cityId: role === 'City' ? cityId || null : null,
      churchId: role === 'Church' ? churchId || null : null
    };
    try {
      if (user) await api.put(`/api/users/${user.id}`, { displayName, role, ...scope, isActive, newPassword: password || null });
      else await api.post('/api/users', { email, displayName, password, role, ...scope });
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={user ? 'Ändra användare' : 'Ny användare'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox error={error} />
        <label>Namn<input value={displayName} onChange={e => setDisplayName(e.target.value)} required /></label>
        <label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!user} /></label>
        <label>Behörighet
          <select value={role} onChange={e => setRole(e.target.value as UserRole)}>
            {allowedRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
          </select>
        </label>
        {role === 'County' && (
          <label>Län
            <select value={countyId} onChange={e => setCountyId(Number(e.target.value))} required>
              <option value="">Välj…</option>
              {counties.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {role === 'City' && (
          <label>Stad
            <select value={cityId} onChange={e => setCityId(Number(e.target.value))} required>
              <option value="">Välj…</option>
              {cities.data?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.countyName})</option>)}
            </select>
          </label>
        )}
        {role === 'Church' && (
          <label>Kyrka
            <select value={churchId} onChange={e => setChurchId(Number(e.target.value))} required>
              <option value="">Välj…</option>
              {churches.data?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cityName})</option>)}
            </select>
          </label>
        )}
        <label>{user ? 'Nytt lösenord (lämna tomt för oförändrat)' : 'Lösenord'}
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12}
            required={!user} autoComplete="new-password" />
          <small className="muted">Minst 12 tecken.</small>
        </label>
        {user && <label className="check"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Aktiv</label>}
        <div className="actions"><button type="button" onClick={onClose}>Avbryt</button><button className="primary">Spara</button></div>
      </form>
    </Modal>
  );
}
