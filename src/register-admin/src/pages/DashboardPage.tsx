import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useChurches, useData } from '../hooks';
import type { MemberListItem, Paged } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const churches = useChurches();
  const pending = useData<MemberListItem[]>('/api/members/pending');
  const recent = useData<Paged<MemberListItem>>('/api/members?sortBy=created&pageSize=8');

  const totalMembers = churches.data?.reduce((s, c) => s + c.memberCount, 0) ?? 0;

  return (
    <div>
      <h1>Välkommen, {user?.displayName}</h1>
      <div className="stats">
        <div className="stat"><span>{totalMembers}</span>medlemmar</div>
        <div className="stat"><span>{churches.data?.length ?? 0}</span>kyrkor</div>
        <Link to="/pending" className="stat link-stat"><span>{pending.data?.length ?? 0}</span>nya registreringar att granska</Link>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Kyrkor</h2>
          <table>
            <thead><tr><th>Kyrka</th><th>Stad</th><th className="num">Medlemmar</th></tr></thead>
            <tbody>
              {churches.data?.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/members?churchId=${c.id}`}>{c.name}</Link></td>
                  <td>{c.cityName}</td>
                  <td className="num">{c.memberCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Senast registrerade</h2>
          <table>
            <tbody>
              {recent.data?.items.map(m => (
                <tr key={m.id}>
                  <td><Link to={`/members/${m.id}`}>{m.firstName} {m.lastName}</Link></td>
                  <td>{m.churchName}</td>
                  <td className="muted">{m.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
