import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox } from '../components/Modal';
import { useData } from '../hooks';
import { civilStatusLabels, fmtDateTime, sourceLabels } from '../labels';
import type { MemberListItem } from '../types';

export default function PendingPage() {
  const { data, reload, error: loadError } = useData<MemberListItem[]>('/api/members/pending');
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); await reload(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      <h1>Nya registreringar</h1>
      <p className="muted">
        Personer som har registrerat sig själva via webben eller surfplattan i kyrkan. Kontrollera uppgifterna och godkänn.
        Ej godkända registreringar raderas automatiskt efter en tid.
      </p>
      <ErrorBox error={error ?? loadError} />
      <div className="card">
        <table>
          <thead><tr><th>Namn</th><th>Personnummer</th><th>Adress</th><th>Civilstånd</th><th>Kyrka</th><th>Via</th><th>Inkom</th><th></th></tr></thead>
          <tbody>
            {data?.length === 0 && <tr><td colSpan={8} className="muted">Inga registreringar väntar.</td></tr>}
            {data?.map(m => (
              <tr key={m.id}>
                <td>
                  <Link to={`/members/${m.id}`}>{m.lastName}, {m.firstName}</Link>
                  {m.possibleDuplicateOfId && <div><Link className="tag warning" to={`/members/${m.possibleDuplicateOfId}`}>Finns redan?</Link></div>}
                </td>
                <td className="mono">{m.personnummerMasked}</td>
                <td>{m.street}, {m.postalCode} {m.postalTown}</td>
                <td>{civilStatusLabels[m.civilStatus]}</td>
                <td>{m.churchName}</td>
                <td>{sourceLabels[m.source]}</td>
                <td className="muted">{fmtDateTime(m.createdAt)}</td>
                <td className="right nowrap">
                  <button className="primary small" disabled={!!m.possibleDuplicateOfId}
                    title={m.possibleDuplicateOfId ? 'Öppna registreringen och jämför med den befintliga medlemmen' : ''}
                    onClick={() => act(() => api.post(`/api/members/${m.id}/approve`))}>Godkänn</button>{' '}
                  <button className="small danger" onClick={() => {
                    if (confirm(`Avvisa och radera registreringen för ${m.firstName} ${m.lastName}?`))
                      void act(() => api.del(`/api/members/${m.id}?reason=Avvisad`));
                  }}>Avvisa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
