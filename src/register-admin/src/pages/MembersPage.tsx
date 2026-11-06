import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, download, toQuery } from '../api';
import FilterBar, { filterFromParams } from '../components/FilterBar';
import Modal, { ErrorBox } from '../components/Modal';
import { useData } from '../hooks';
import { civilStatusLabels, memberStatusLabels } from '../labels';
import type { MemberFilter, MemberListItem, Paged } from '../types';

export const listColumns: { key: string; label: string }[] = [
  { key: 'name', label: 'Namn' },
  { key: 'birthDate', label: 'Födelsedatum' },
  { key: 'age', label: 'Ålder' },
  { key: 'address', label: 'Adress' },
  { key: 'civilStatus', label: 'Civilstånd' },
  { key: 'church', label: 'Kyrka' },
  { key: 'city', label: 'Stad' },
  { key: 'status', label: 'Status' }
];

const PAGE_SIZE = 50;

export default function MembersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = filterFromParams(params);
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = toQuery({ ...filter, pageSize: PAGE_SIZE });
  const { data, loading, error: loadError } = useData<Paged<MemberListItem>>(`/api/members${query}`);

  const setFilter = (f: MemberFilter) => setParams(toQuery(f).replace(/^\?/, ''));
  const filterQuery = toQuery({ ...filter, page: undefined });
  const page = filter.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const csv = async () => {
    try { await download(`/api/reports/members.csv${filterQuery}`, 'medlemmar.csv'); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Medlemmar {data && <small className="muted">({data.total})</small>}</h1>
        <div className="actions">
          <button onClick={() => navigate(`/print/members${filterQuery}`)}>🖨 Skriv ut lista</button>
          <button onClick={() => setShowEmail(true)}>✉ E-posta lista</button>
          <button onClick={csv}>⬇ CSV</button>
          <button className="primary" onClick={() => navigate('/members/new')}>+ Ny medlem</button>
        </div>
      </div>

      <FilterBar filter={filter} onChange={setFilter} />
      <ErrorBox error={error ?? loadError} />

      <div className="card">
        <table className="members">
          <thead>
            <tr>
              <th>Namn</th><th>Personnummer</th><th className="num">Ålder</th><th>Adress</th>
              <th>Civilstånd</th><th>Kyrka</th><th>Status</th><th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={8}>Laddar…</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan={8} className="muted">Inga medlemmar matchar filtret.</td></tr>}
            {data?.items.map(m => (
              <tr key={m.id}>
                <td><Link to={`/members/${m.id}`}>{m.lastName}, {m.firstName}</Link></td>
                <td className="mono">{m.personnummerMasked}</td>
                <td className="num">{m.age}</td>
                <td>{m.street}, {m.postalCode} {m.postalTown}</td>
                <td>{civilStatusLabels[m.civilStatus]}</td>
                <td>{m.churchName}</td>
                <td><span className={`tag ${m.status.toLowerCase()}`}>{memberStatusLabels[m.status]}</span></td>
                <td className="no-print"><Link to={`/print/family/${m.id}`}>Familj</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setFilter({ ...filter, page: page - 1 })}>‹ Föregående</button>
            <span>Sida {page} av {pages}</span>
            <button disabled={page >= pages} onClick={() => setFilter({ ...filter, page: page + 1 })}>Nästa ›</button>
          </div>
        )}
      </div>

      {showEmail && <EmailListModal filter={filter} total={data?.total ?? 0} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function EmailListModal({ filter, total, onClose }: { filter: MemberFilter; total: number; onClose: () => void }) {
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('Medlemslista');
  const [message, setMessage] = useState('');
  const [columns, setColumns] = useState<string[]>(['name', 'birthDate', 'address', 'civilStatus', 'church']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const toggle = (k: string) => setColumns(c => (c.includes(k) ? c.filter(x => x !== k) : [...c, k]));

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ sent: number }>('/api/reports/members/email', {
        filter: { ...filter, page: undefined },
        recipients: recipients.split(/[,;\s]+/).filter(Boolean),
        subject, message, columns
      });
      setDone(res.sent);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="E-posta medlemslista" onClose={onClose}>
      {done !== null ? (
        <>
          <div className="alert success">Listan med {done} medlemmar har skickats.</div>
          <button onClick={onClose}>Stäng</button>
        </>
      ) : (
        <>
          <p>Listan innehåller <strong>{total}</strong> medlemmar enligt det aktuella filtret. Personnummer skickas aldrig.</p>
          <div className="alert warning">
            Listan innehåller personuppgifter. Skicka bara till personer som behöver uppgifterna i sitt uppdrag.
            Utskicket loggas.
          </div>
          <ErrorBox error={error} />
          <label>Mottagare (kommaseparerade)
            <input value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="namn@exempel.se" />
          </label>
          <label>Ämne<input value={subject} onChange={e => setSubject(e.target.value)} /></label>
          <label>Meddelande<textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} /></label>
          <fieldset>
            <legend>Kolumner</legend>
            <div className="checks">
              {listColumns.map(c => (
                <label key={c.key} className="check">
                  <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggle(c.key)} /> {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="actions">
            <button onClick={onClose}>Avbryt</button>
            <button className="primary" disabled={busy || !recipients.trim() || columns.length === 0} onClick={send}>
              {busy ? 'Skickar…' : 'Skicka'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
