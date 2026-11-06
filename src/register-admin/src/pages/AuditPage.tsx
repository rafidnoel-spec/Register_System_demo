import { useState } from 'react';
import { toQuery } from '../api';
import { ErrorBox } from '../components/Modal';
import { useData } from '../hooks';
import { fmtDateTime } from '../labels';
import type { AuditEntry, Paged } from '../types';

const actions = [
  'Login', 'LoginFailed', 'MemberViewed', 'MemberCreated', 'MemberUpdated', 'MemberErased', 'MemberExported',
  'PersonnummerRevealed', 'MemberListExported', 'MemberListEmailed', 'FamilyReport', 'PublicRegistration',
  'RegistrationApproved', 'RegistrationRejected', 'UserCreated', 'UserUpdated', 'RetentionPendingDeleted'
];

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [user, setUser] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useData<Paged<AuditEntry>>(`/api/audit${toQuery({ action, user, page })}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1>Granskningslogg</h1>
      <p className="muted">Visar vem som har läst, ändrat, exporterat eller skickat personuppgifter (GDPR art. 5.2 och 32).</p>
      <div className="filter-bar">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
          <option value="">Alla händelser</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input placeholder="Användare (e-post)" value={user} onChange={e => { setUser(e.target.value); setPage(1); }} />
      </div>
      <ErrorBox error={error} />
      <div className="card">
        <table>
          <thead><tr><th>Tid</th><th>Användare</th><th>Händelse</th><th>Objekt</th><th>Detaljer</th><th>IP</th></tr></thead>
          <tbody>
            {data?.items.map(a => (
              <tr key={a.id}>
                <td className="nowrap">{fmtDateTime(a.at)}</td>
                <td>{a.userEmail ?? <span className="muted">–</span>}</td>
                <td>{a.action}</td>
                <td>{a.entityType} {a.entityId}</td>
                <td className="small">{a.details}</td>
                <td className="muted small">{a.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span>Sida {page} av {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}
