import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, download } from '../api';
import Modal, { ErrorBox } from '../components/Modal';
import { useChurches, useData, usePriests } from '../hooks';
import {
  civilStatusLabels, entries, fmtDate, fmtDateTime, memberStatusLabels, relationLabel, sacramentLabels, sourceLabels
} from '../labels';
import type { CivilStatus, MemberDetail, MemberStatus, RelationType, Sacrament, SacramentType } from '../types';

interface FormState {
  firstName: string; lastName: string; street: string; postalCode: string; postalTown: string;
  email: string; phone: string; personnummer: string; civilStatus: CivilStatus; status: MemberStatus;
  churchId: number | ''; notes: string;
}

const empty: FormState = {
  firstName: '', lastName: '', street: '', postalCode: '', postalTown: '', email: '', phone: '',
  personnummer: '', civilStatus: 'Unmarried', status: 'Active', churchId: '', notes: ''
};

export default function MemberPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const churches = useChurches();
  const member = useData<MemberDetail>(isNew ? null : `/api/members/${id}`);
  const m = member.data;

  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'relation' | 'sacrament' | 'delete' | 'reveal'>(null);
  const [editSacrament, setEditSacrament] = useState<Sacrament | null>(null);

  useEffect(() => {
    if (m) {
      setForm({
        firstName: m.firstName, lastName: m.lastName, street: m.street, postalCode: m.postalCode, postalTown: m.postalTown,
        email: m.email ?? '', phone: m.phone ?? '', personnummer: '', civilStatus: m.civilStatus, status: m.status,
        churchId: m.churchId, notes: m.notes ?? ''
      });
    } else if (isNew && churches.data?.length === 1) {
      setForm(f => ({ ...f, churchId: churches.data![0].id }));
    }
  }, [m, isNew, churches.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...form, personnummer: form.personnummer || null, email: form.email || null, phone: form.phone || null };
    try {
      if (isNew) {
        const res = await api.post<{ id: number }>('/api/members', body);
        navigate(`/members/${res.id}`, { replace: true });
      } else {
        await api.put(`/api/members/${id}`, body);
        setSaved(true);
        await member.reload();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    try { await api.post(`/api/members/${id}/approve`); await member.reload(); }
    catch (e) { setError((e as Error).message); }
  };

  if (!isNew && member.loading && !m) return <p>Laddar…</p>;
  if (!isNew && member.error) return <ErrorBox error={member.error} />;

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? 'Ny medlem' : `${m?.firstName} ${m?.lastName}`}</h1>
        {!isNew && (
          <div className="actions">
            <Link className="button" to={`/print/family/${id}`}>🖨 Familjerapport</Link>
            <button onClick={() => download(`/api/members/${id}/export`, 'registerutdrag.json').catch(e => setError(e.message))}>
              Registerutdrag (GDPR)
            </button>
            <button className="danger" onClick={() => setModal('delete')}>Radera</button>
          </div>
        )}
      </div>

      {m?.status === 'Pending' && (
        <div className="alert warning">
          Självregistrerad via {sourceLabels[m.source].toLowerCase()} {fmtDateTime(m.createdAt)} – väntar på godkännande.
          {m.possibleDuplicateOfId && (
            <> Personnumret finns redan hos <Link to={`/members/${m.possibleDuplicateOfId}`}>en befintlig medlem</Link>.</>
          )}
          <div className="actions">
            <button className="primary" onClick={approve}>Godkänn</button>
            <button className="danger" onClick={() => setModal('delete')}>Avvisa och radera</button>
          </div>
        </div>
      )}

      <ErrorBox error={error} />
      {saved && <div className="alert success">Sparat.</div>}

      <form className="card form-grid" onSubmit={save}>
        <label>Förnamn *<input value={form.firstName} onChange={e => set('firstName', e.target.value)} required maxLength={100} /></label>
        <label>Efternamn *<input value={form.lastName} onChange={e => set('lastName', e.target.value)} required maxLength={100} /></label>

        <label>
          Personnummer {isNew && '*'}
          {isNew ? (
            <input value={form.personnummer} onChange={e => set('personnummer', e.target.value)} placeholder="ÅÅÅÅMMDD-XXXX" required autoComplete="off" />
          ) : (
            <div className="pnr">
              <span className="mono">{revealed ?? m?.personnummerMasked}</span>
              {!revealed && <button type="button" className="link" onClick={() => setModal('reveal')}>Visa</button>}
              <input value={form.personnummer} onChange={e => set('personnummer', e.target.value)} placeholder="Nytt personnummer (lämna tomt)" autoComplete="off" />
            </div>
          )}
        </label>
        <label>Kyrka *
          <select value={form.churchId} onChange={e => set('churchId', Number(e.target.value))} required>
            <option value="">Välj kyrka…</option>
            {churches.data?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cityName})</option>)}
          </select>
        </label>

        <label className="span-2">Gatuadress<input value={form.street} onChange={e => set('street', e.target.value)} maxLength={200} /></label>
        <label>Postnummer<input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} maxLength={10} /></label>
        <label>Postort<input value={form.postalTown} onChange={e => set('postalTown', e.target.value)} maxLength={100} /></label>
        <label>E-post<input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
        <label>Telefon<input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></label>

        <label>Civilstånd
          <select value={form.civilStatus} onChange={e => set('civilStatus', e.target.value as CivilStatus)}>
            {entries(civilStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Status
          <select value={form.status} onChange={e => set('status', e.target.value as MemberStatus)}>
            {entries(memberStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="span-2">Anteckningar
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={2000}
            placeholder="Skriv inga känsliga uppgifter (t.ex. hälsa) här." />
        </label>
        <div className="span-2 actions">
          <button className="primary" disabled={busy}>{busy ? 'Sparar…' : 'Spara'}</button>
        </div>
      </form>

      {m && (
        <>
          <section className="card">
            <div className="section-header">
              <h2>Familj och relationer</h2>
              <button onClick={() => setModal('relation')}>+ Lägg till relation</button>
            </div>
            {m.relations.length === 0 ? <p className="muted">Inga relationer registrerade.</p> : (
              <table>
                <tbody>
                  {m.relations.map(r => (
                    <tr key={r.id}>
                      <td>{relationLabel(r.type, r.direction)}</td>
                      <td><Link to={`/members/${r.otherMemberId}`}>{r.otherMemberName}</Link></td>
                      <td className="muted">{r.fromDate ? `från ${fmtDate(r.fromDate)}` : ''}</td>
                      <td className="right">
                        <button className="link danger" onClick={async () => {
                          if (!confirm('Ta bort relationen?')) return;
                          try { await api.del(`/api/relations/${r.id}`); await member.reload(); }
                          catch (e) { setError((e as Error).message); }
                        }}>Ta bort</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <div className="section-header">
              <h2>Sakrament och kyrkliga handlingar</h2>
              <button onClick={() => { setEditSacrament(null); setModal('sacrament'); }}>+ Registrera</button>
            </div>
            {m.sacraments.length === 0 ? <p className="muted">Inga sakrament registrerade.</p> : (
              <table>
                <thead><tr><th>Typ</th><th>Datum</th><th>Kyrka</th><th>Präst</th><th>Övrigt</th><th></th></tr></thead>
                <tbody>
                  {m.sacraments.map(s => (
                    <tr key={s.id}>
                      <td>{sacramentLabels[s.type]}</td>
                      <td>{fmtDate(s.date)}</td>
                      <td>{s.churchName}</td>
                      <td>{s.priestName}</td>
                      <td className="muted">
                        {[s.spouseName && `Make/maka: ${s.spouseName}`, s.godparents && `Faddrar: ${s.godparents}`,
                          s.registerReference && `Ref: ${s.registerReference}`].filter(Boolean).join(' · ')}
                      </td>
                      <td className="right">
                        <button className="link" onClick={() => { setEditSacrament(s); setModal('sacrament'); }}>Ändra</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Samtycken och historik</h2>
            <p className="small muted">
              Registrerad via {sourceLabels[m.source].toLowerCase()} {fmtDateTime(m.createdAt)}. Senast ändrad {fmtDateTime(m.updatedAt)}.
            </p>
            {m.consents.length === 0 ? <p className="muted small">Inget samtycke registrerat (inlagd av administratör).</p> : (
              <ul className="small">
                {m.consents.map(c => (
                  <li key={c.id}>{fmtDateTime(c.givenAt)} – version {c.policyVersion} – {c.purpose}
                    {c.withdrawnAt && <strong> (återkallat {fmtDateTime(c.withdrawnAt)})</strong>}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {modal === 'reveal' && m && (
        <RevealModal memberId={m.id} onClose={() => setModal(null)} onRevealed={p => { setRevealed(p); setModal(null); }} />
      )}
      {modal === 'relation' && m && (
        <RelationModal memberId={m.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); void member.reload(); }} />
      )}
      {modal === 'sacrament' && m && (
        <SacramentModal memberId={m.id} existing={editSacrament} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); void member.reload(); }} />
      )}
      {modal === 'delete' && m && (
        <DeleteModal member={m} onClose={() => setModal(null)}
          onDeleted={() => navigate(m.status === 'Pending' ? '/pending' : '/members', { replace: true })} />
      )}
    </div>
  );
}

function RevealModal({ memberId, onClose, onRevealed }: { memberId: number; onClose: () => void; onRevealed: (p: string) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ personnummer: string }>(`/api/members/${memberId}/personnummer`, { reason });
      onRevealed(res.personnummer);
    } catch (err) { setError((err as Error).message); }
  };
  return (
    <Modal title="Visa personnummer" onClose={onClose}>
      <form onSubmit={submit}>
        <p>Personnumret är krypterat. Ange varför du behöver se det – visningen loggas.</p>
        <ErrorBox error={error} />
        <label>Anledning<input value={reason} onChange={e => setReason(e.target.value)} required minLength={5} autoFocus
          placeholder="t.ex. utfärda dopbevis" /></label>
        <div className="actions"><button type="button" onClick={onClose}>Avbryt</button><button className="primary">Visa</button></div>
      </form>
    </Modal>
  );
}

function MemberLookup({ onSelect, placeholder }: { onSelect: (m: { id: number; name: string }) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: number; name: string; birthDate: string; church: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get<typeof results>(`/api/members/lookup?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="lookup">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder ?? 'Sök medlem…'} autoFocus />
      {results.length > 0 && (
        <ul>
          {results.map(r => (
            <li key={r.id}><button type="button" onClick={() => { onSelect(r); setQ(r.name); setResults([]); }}>
              {r.name} <small className="muted">{fmtDate(r.birthDate)} · {r.church}</small>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RelationModal({ memberId, onClose, onSaved }: { memberId: number; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'spouse' | 'child' | 'parent' | 'godchild' | 'godparent'>('spouse');
  const [other, setOther] = useState<{ id: number; name: string } | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!other) return;
    // "outgoing" relation = medlemmen är förälder/gudförälder till den andra.
    const map: Record<typeof kind, { type: RelationType; outgoing: boolean }> = {
      spouse: { type: 'Spouse', outgoing: true },
      child: { type: 'Parent', outgoing: true },
      parent: { type: 'Parent', outgoing: false },
      godchild: { type: 'Godparent', outgoing: true },
      godparent: { type: 'Godparent', outgoing: false }
    };
    const { type, outgoing } = map[kind];
    try {
      await api.post('/api/relations', {
        memberId: outgoing ? memberId : other.id,
        relatedMemberId: outgoing ? other.id : memberId,
        type, fromDate: fromDate || null, toDate: null
      });
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title="Lägg till relation" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox error={error} />
        <label>Relation
          <select value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
            <option value="spouse">Make/maka</option>
            <option value="child">Barn</option>
            <option value="parent">Förälder</option>
            <option value="godchild">Gudbarn</option>
            <option value="godparent">Gudförälder</option>
          </select>
        </label>
        <label>Person<MemberLookup onSelect={setOther} /></label>
        {kind === 'spouse' && <label>Gifta sedan<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label>}
        <p className="small muted">Finns personen inte i registret? Lägg först till hen som ny medlem.</p>
        <div className="actions"><button type="button" onClick={onClose}>Avbryt</button>
          <button className="primary" disabled={!other}>Spara</button></div>
      </form>
    </Modal>
  );
}

function SacramentModal({ memberId, existing, onClose, onSaved }: {
  memberId: number; existing: Sacrament | null; onClose: () => void; onSaved: () => void;
}) {
  const churches = useChurches();
  const priests = usePriests();
  const [type, setType] = useState<SacramentType>(existing?.type ?? 'Baptism');
  const [date, setDate] = useState(existing?.date ?? '');
  const [churchId, setChurchId] = useState<string>(existing ? (existing.churchId?.toString() ?? 'other') : '');
  const [churchOther, setChurchOther] = useState(existing && !existing.churchId ? existing.churchName ?? '' : '');
  const [priestId, setPriestId] = useState<string>(existing ? (existing.priestId?.toString() ?? 'other') : '');
  const [priestOther, setPriestOther] = useState(existing && !existing.priestId ? existing.priestName ?? '' : '');
  const [spouse, setSpouse] = useState<{ id: number; name: string } | null>(
    existing?.spouseMemberId ? { id: existing.spouseMemberId, name: existing.spouseName ?? '' } : null);
  const [godparents, setGodparents] = useState(existing?.godparents ?? '');
  const [reference, setReference] = useState(existing?.registerReference ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      memberId, type, date,
      churchId: churchId && churchId !== 'other' ? Number(churchId) : null,
      churchNameOther: churchId === 'other' ? churchOther : null,
      priestId: priestId && priestId !== 'other' ? Number(priestId) : null,
      priestNameOther: priestId === 'other' ? priestOther : null,
      spouseMemberId: type === 'Marriage' ? spouse?.id ?? null : null,
      godparents: godparents || null, registerReference: reference || null, notes: notes || null
    };
    try {
      if (existing) await api.put(`/api/sacraments/${existing.id}`, body);
      else await api.post('/api/sacraments', body);
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  const remove = async () => {
    if (!existing || !confirm('Ta bort posten?')) return;
    try { await api.del(`/api/sacraments/${existing.id}`); onSaved(); }
    catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={existing ? 'Ändra sakrament' : 'Registrera sakrament'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <div className="span-2"><ErrorBox error={error} /></div>
        <label>Typ
          <select value={type} onChange={e => setType(e.target.value as SacramentType)}>
            {entries(sacramentLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Datum *<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
        <label>Kyrka
          <select value={churchId} onChange={e => setChurchId(e.target.value)}>
            <option value="">–</option>
            {churches.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="other">Annan kyrka…</option>
          </select>
        </label>
        {churchId === 'other'
          ? <label>Kyrkans namn<input value={churchOther} onChange={e => setChurchOther(e.target.value)} /></label>
          : <span />}
        <label>Präst
          <select value={priestId} onChange={e => setPriestId(e.target.value)}>
            <option value="">–</option>
            {priests.data?.filter(p => p.isActive || p.id === existing?.priestId)
              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="other">Annan präst…</option>
          </select>
        </label>
        {priestId === 'other'
          ? <label>Prästens namn<input value={priestOther} onChange={e => setPriestOther(e.target.value)} /></label>
          : <span />}
        {type === 'Marriage' && (
          <label className="span-2">Make/maka
            {spouse && <div className="small">Vald: <strong>{spouse.name}</strong></div>}
            <MemberLookup onSelect={setSpouse} placeholder="Sök make/maka…" />
            <small className="muted">Make/maka-relation skapas och civilstånd sätts till gift för båda.</small>
          </label>
        )}
        {(type === 'Baptism' || type === 'Confirmation') && (
          <label className="span-2">Faddrar / gudföräldrar<input value={godparents} onChange={e => setGodparents(e.target.value)} /></label>
        )}
        <label>Kyrkobokreferens<input value={reference} onChange={e => setReference(e.target.value)} placeholder="t.ex. bok 3, s. 41" /></label>
        <label>Anteckning<input value={notes} onChange={e => setNotes(e.target.value)} /></label>
        <div className="span-2 actions">
          {existing && <button type="button" className="danger" onClick={remove}>Ta bort</button>}
          <button type="button" onClick={onClose}>Avbryt</button>
          <button className="primary">Spara</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteModal({ member, onClose, onDeleted }: { member: MemberDetail; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = member.status === 'Pending';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.del(`/api/members/${member.id}?reason=${encodeURIComponent(reason)}`);
      onDeleted();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={pending ? 'Avvisa registrering' : 'Radera medlem permanent'} onClose={onClose}>
      <form onSubmit={submit}>
        {pending ? <p>Registreringen och personuppgifterna raderas.</p> : (
          <div className="alert warning">
            Alla uppgifter om <strong>{member.firstName} {member.lastName}</strong> – inklusive relationer och sakrament – raderas
            permanent (rätten att bli raderad, GDPR art. 17). Kontrollera först om sakramentsuppgifter måste bevaras i kyrkoboken.
            Om personen bara har lämnat församlingen kan du i stället sätta status <em>Inaktiv</em>.
          </div>
        )}
        <ErrorBox error={error} />
        <label>Anledning<input value={reason} onChange={e => setReason(e.target.value)} placeholder="t.ex. begäran från den registrerade" /></label>
        {!pending && (
          <label>Skriv <strong>RADERA</strong> för att bekräfta<input value={confirmText} onChange={e => setConfirmText(e.target.value)} /></label>
        )}
        <div className="actions">
          <button type="button" onClick={onClose}>Avbryt</button>
          <button className="danger" disabled={!pending && confirmText !== 'RADERA'}>{pending ? 'Avvisa' : 'Radera'}</button>
        </div>
      </form>
    </Modal>
  );
}
