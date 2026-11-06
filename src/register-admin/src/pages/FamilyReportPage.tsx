import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBox } from '../components/Modal';
import { useData } from '../hooks';
import { civilStatusLabels, fmtDate, sacramentLabels } from '../labels';
import type { FamilyMember, FamilyReport } from '../types';

function PersonBlock({ p }: { p: FamilyMember }) {
  return (
    <div className="family-person">
      <div className="family-person-head">
        <strong>{p.name}</strong>
        <span>{p.role}</span>
      </div>
      <div className="small">Född {fmtDate(p.birthDate)} · {civilStatusLabels[p.civilStatus]} · {p.churchName}</div>
      {p.sacraments.length > 0 ? (
        <table className="print-table compact">
          <thead><tr><th>Sakrament</th><th>Datum</th><th>Kyrka</th><th>Präst</th><th>Övrigt</th></tr></thead>
          <tbody>
            {p.sacraments.map(s => (
              <tr key={s.id}>
                <td>{sacramentLabels[s.type]}</td>
                <td>{fmtDate(s.date)}</td>
                <td>{s.churchName}</td>
                <td>{s.priestName}</td>
                <td>{[s.spouseName && `med ${s.spouseName}`, s.godparents && `faddrar: ${s.godparents}`, s.registerReference]
                  .filter(Boolean).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="small muted">Inga sakrament registrerade.</div>}
    </div>
  );
}

export default function FamilyReportPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data, error } = useData<FamilyReport>(`/api/reports/family/${id}`);

  return (
    <div className="print-page">
      <div className="no-print print-toolbar">
        <button onClick={() => navigate(-1)}>‹ Tillbaka</button>
        <button className="primary" onClick={() => window.print()} disabled={!data}>🖨 Skriv ut</button>
      </div>
      <ErrorBox error={error} />
      {data && (
        <>
          <header className="print-header">
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="" />
            <div>
              <h1>Familjerapport – {data.head.name}</h1>
              <p>{data.address}</p>
              <p className="small">Utskriven {new Date(data.generatedAt).toLocaleDateString('sv-SE')} av {data.generatedBy}</p>
            </div>
          </header>

          <PersonBlock p={data.head} />
          {data.spouses.map(p => <PersonBlock key={p.id} p={p} />)}
          {data.children.length > 0 && <h2>Barn</h2>}
          {data.children.map(p => <PersonBlock key={p.id} p={p} />)}
          {data.parents.length > 0 && <h2>Föräldrar</h2>}
          {data.parents.map(p => <PersonBlock key={p.id} p={p} />)}

          <footer className="print-footer">Innehåller personuppgifter – förvara säkert.</footer>
        </>
      )}
    </div>
  );
}
