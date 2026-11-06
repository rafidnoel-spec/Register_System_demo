import { useState, type FormEvent } from 'react';
import { api } from '../api';
import Modal, { ErrorBox } from '../components/Modal';
import { useChurches, usePriests } from '../hooks';
import type { Priest } from '../types';

export default function PriestsPage() {
  const priests = usePriests();
  const churches = useChurches();
  const [editing, setEditing] = useState<Priest | 'new' | null>(null);

  return (
    <div>
      <div className="page-header">
        <h1>Präster</h1>
        <button className="primary" onClick={() => setEditing('new')}>+ Ny präst</button>
      </div>
      <ErrorBox error={priests.error} />
      <div className="card">
        <table>
          <thead><tr><th>Namn</th><th>Kyrka</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {priests.data?.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.churchName ?? <span className="muted">Alla kyrkor</span>}</td>
                <td>{p.isActive ? 'Aktiv' : <span className="muted">Inaktiv</span>}</td>
                <td className="right"><button className="link" onClick={() => setEditing(p)}>Ändra</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <PriestModal priest={editing === 'new' ? null : editing} churches={churches.data ?? []}
          onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await priests.reload(); }} />
      )}
    </div>
  );
}

function PriestModal({ priest, churches, onClose, onSaved }: {
  priest: Priest | null; churches: { id: number; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(priest?.name ?? '');
  const [churchId, setChurchId] = useState<string>(priest?.churchId?.toString() ?? (churches.length === 1 ? String(churches[0].id) : ''));
  const [isActive, setIsActive] = useState(priest?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name, churchId: churchId ? Number(churchId) : null, isActive };
    try {
      if (priest) await api.put(`/api/priests/${priest.id}`, body);
      else await api.post('/api/priests', body);
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={priest ? 'Ändra präst' : 'Ny präst'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox error={error} />
        <label>Namn<input value={name} onChange={e => setName(e.target.value)} required autoFocus /></label>
        <label>Kyrka
          <select value={churchId} onChange={e => setChurchId(e.target.value)}>
            <option value="">Alla kyrkor (gemensam)</option>
            {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Aktiv</label>
        <div className="actions"><button type="button" onClick={onClose}>Avbryt</button><button className="primary">Spara</button></div>
      </form>
    </Modal>
  );
}
