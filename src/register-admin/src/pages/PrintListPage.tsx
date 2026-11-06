import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, toQuery } from '../api';
import { useAuth } from '../auth';
import { filterFromParams } from '../components/FilterBar';
import { ErrorBox } from '../components/Modal';
import { civilStatusLabels, fmtDate, memberStatusLabels } from '../labels';
import type { MemberListItem, Paged } from '../types';
import { listColumns } from './MembersPage';

const cell: Record<string, (m: MemberListItem) => string> = {
  name: m => `${m.lastName}, ${m.firstName}`,
  birthDate: m => fmtDate(m.birthDate),
  age: m => String(m.age),
  address: m => `${m.street}, ${m.postalCode} ${m.postalTown}`,
  civilStatus: m => civilStatusLabels[m.civilStatus],
  church: m => m.churchName,
  city: m => m.cityName,
  status: m => memberStatusLabels[m.status]
};

export default function PrintListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<MemberListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('Medlemsförteckning');
  const [columns, setColumns] = useState<string[]>(['name', 'birthDate', 'address', 'civilStatus', 'church']);

  useEffect(() => {
    (async () => {
      try {
        const filter = { ...filterFromParams(params), page: undefined };
        const all: MemberListItem[] = [];
        for (let page = 1; page <= 10; page++) {
          const res = await api.get<Paged<MemberListItem>>(`/api/members${toQuery({ ...filter, page, pageSize: 500 })}`);
          all.push(...res.items);
          if (all.length >= res.total) break;
        }
        setRows(all);
      } catch (e) { setError((e as Error).message); }
    })();
  }, [params]);

  const toggle = (k: string) => setColumns(c => (c.includes(k) ? c.filter(x => x !== k) : listColumns.map(l => l.key).filter(x => x === k || c.includes(x))));

  return (
    <div className="print-page">
      <div className="no-print print-toolbar">
        <button onClick={() => navigate(-1)}>‹ Tillbaka</button>
        <label>Rubrik <input value={title} onChange={e => setTitle(e.target.value)} /></label>
        <div className="checks">
          {listColumns.map(c => (
            <label key={c.key} className="check"><input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggle(c.key)} /> {c.label}</label>
          ))}
        </div>
        <button className="primary" onClick={() => window.print()} disabled={!rows}>🖨 Skriv ut</button>
      </div>
      <ErrorBox error={error} />

      <header className="print-header">
        <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="" />
        <div>
          <h1>{title}</h1>
          <p>{rows ? `${rows.length} medlemmar` : 'Laddar…'} · Utskrivet {new Date().toLocaleDateString('sv-SE')} av {user?.displayName}</p>
        </div>
      </header>

      {rows && (
        <table className="print-table">
          <thead><tr><th>#</th>{columns.map(c => <th key={c}>{listColumns.find(l => l.key === c)?.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.id}><td>{i + 1}</td>{columns.map(c => <td key={c}>{cell[c](m)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      <footer className="print-footer">Innehåller personuppgifter – förvara säkert och förstör när listan inte längre behövs.</footer>
    </div>
  );
}
