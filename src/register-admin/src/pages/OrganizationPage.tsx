import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Modal, { ErrorBox } from '../components/Modal';
import { useChurches, useCities, useCounties } from '../hooks';
import type { Church, City, County } from '../types';

// Adressen till den publika registreringsappen (för kiosklänkar).
// I demoläget ligger registreringsappen bredvid admin-appen: ../registrering/#
const PUBLIC_APP_URL: string = import.meta.env.VITE_PUBLIC_APP_URL
  ?? (import.meta.env.VITE_DEMO === 'true' ? new URL('../registrering/#', window.location.href).href : 'http://localhost:5174');

type Editing =
  | { kind: 'county'; item?: County }
  | { kind: 'city'; item?: City }
  | { kind: 'church'; item?: Church }
  | null;

export default function OrganizationPage() {
  const { user } = useAuth();
  const counties = useCounties();
  const cities = useCities();
  const churches = useChurches();
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [kioskFor, setKioskFor] = useState<Church | null>(null);

  const reloadAll = () => Promise.all([counties.reload(), cities.reload(), churches.reload()]);
  const remove = async (url: string, name: string) => {
    if (!confirm(`Ta bort ${name}?`)) return;
    setError(null);
    try { await api.del(url); await reloadAll(); } catch (e) { setError((e as Error).message); }
  };

  const role = user!.role;
  const canCounty = role === 'Root';
  const canCity = role === 'Root' || role === 'County';
  const canChurch = role !== 'Church';

  return (
    <div>
      <h1>Län, städer &amp; kyrkor</h1>
      <ErrorBox error={error} />
      <div className="grid-3">
        <section className="card">
          <div className="section-header"><h2>Län</h2>{canCounty && <button onClick={() => setEditing({ kind: 'county' })}>+ Nytt</button>}</div>
          <ul className="list">
            {counties.data?.map(c => (
              <li key={c.id}>
                <span>{c.name} <small className="muted">({c.cityCount} städer)</small></span>
                {canCounty && <span>
                  <button className="link" onClick={() => setEditing({ kind: 'county', item: c })}>Ändra</button>
                  <button className="link danger" onClick={() => remove(`/api/counties/${c.id}`, c.name)}>Ta bort</button>
                </span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="section-header"><h2>Städer</h2>{canCity && <button onClick={() => setEditing({ kind: 'city' })}>+ Ny</button>}</div>
          <ul className="list">
            {cities.data?.map(c => (
              <li key={c.id}>
                <span>{c.name} <small className="muted">{c.countyName} · {c.churchCount} kyrkor</small></span>
                {canCity && <span>
                  <button className="link" onClick={() => setEditing({ kind: 'city', item: c })}>Ändra</button>
                  <button className="link danger" onClick={() => remove(`/api/cities/${c.id}`, c.name)}>Ta bort</button>
                </span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="section-header"><h2>Kyrkor</h2>{canChurch && <button onClick={() => setEditing({ kind: 'church' })}>+ Ny</button>}</div>
          <ul className="list">
            {churches.data?.map(c => (
              <li key={c.id}>
                <span>{c.name} <small className="muted">{c.cityName} · {c.memberCount} medl.</small></span>
                <span>
                  <button className="link" onClick={() => setKioskFor(c)}>Surfplatta</button>
                  <button className="link" onClick={() => setEditing({ kind: 'church', item: c })}>Ändra</button>
                  {canChurch && <button className="link danger" onClick={() => remove(`/api/churches/${c.id}`, c.name)}>Ta bort</button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editing && (
        <EditModal editing={editing} counties={counties.data ?? []} cities={cities.data ?? []}
          canMove={role !== 'Church'} onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reloadAll(); }} />
      )}

      {kioskFor && <KioskModal church={kioskFor} onClose={() => setKioskFor(null)} onChanged={async () => {
        const updated = await api.get<Church[]>('/api/churches');
        churches.setData(updated);
        setKioskFor(updated.find(c => c.id === kioskFor.id) ?? null);
      }} />}
    </div>
  );
}

function EditModal({ editing, counties, cities, canMove, onClose, onSaved }: {
  editing: NonNullable<Editing>; counties: County[]; cities: City[]; canMove: boolean; onClose: () => void; onSaved: () => void;
}) {
  const item = editing.item as (County & City & Church) | undefined;
  const [name, setName] = useState(item?.name ?? '');
  const [countyId, setCountyId] = useState<number | ''>(item?.countyId ?? (counties.length === 1 ? counties[0].id : ''));
  const [cityId, setCityId] = useState<number | ''>(item?.cityId ?? (cities.length === 1 ? cities[0].id : ''));
  const [address, setAddress] = useState(item?.address ?? '');
  const [publicReg, setPublicReg] = useState(item?.acceptsPublicRegistration ?? true);
  const [error, setError] = useState<string | null>(null);

  const titles = { county: 'län', city: 'stad', church: 'kyrka' };
  const urls = { county: '/api/counties', city: '/api/cities', church: '/api/churches' };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = editing.kind === 'county' ? { name }
      : editing.kind === 'city' ? { name, countyId }
      : { name, address: address || null, cityId, acceptsPublicRegistration: publicReg };
    try {
      if (item) await api.put(`${urls[editing.kind]}/${item.id}`, body);
      else await api.post(urls[editing.kind], body);
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={`${item ? 'Ändra' : 'Ny'} ${titles[editing.kind]}`} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox error={error} />
        <label>Namn<input value={name} onChange={e => setName(e.target.value)} required autoFocus /></label>
        {editing.kind === 'city' && (
          <label>Län
            <select value={countyId} onChange={e => setCountyId(Number(e.target.value))} required>
              <option value="">Välj…</option>
              {counties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {editing.kind === 'church' && (
          <>
            <label>Stad
              <select value={cityId} onChange={e => setCityId(Number(e.target.value))} required disabled={!canMove}>
                <option value="">Välj…</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.countyName})</option>)}
              </select>
            </label>
            <label>Adress<input value={address} onChange={e => setAddress(e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={publicReg} onChange={e => setPublicReg(e.target.checked)} />
              Visas i den publika registreringen</label>
          </>
        )}
        <div className="actions"><button type="button" onClick={onClose}>Avbryt</button><button className="primary">Spara</button></div>
      </form>
    </Modal>
  );
}

function KioskModal({ church, onClose, onChanged }: { church: Church; onClose: () => void; onChanged: () => Promise<void> }) {
  const url = `${PUBLIC_APP_URL}/kiosk/${church.kioskCode}`;
  const [error, setError] = useState<string | null>(null);
  const regenerate = async () => {
    if (!confirm('Skapa en ny länk? Surfplattor med den gamla länken slutar fungera.')) return;
    try { await api.post(`/api/churches/${church.id}/kiosk-code`); await onChanged(); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal title={`Surfplatta vid dörren – ${church.name}`} onClose={onClose}>
      <ErrorBox error={error} />
      <p>Öppna länken nedan i Safari på surfplattan och välj <em>Dela → Lägg till på hemskärmen</em>. Starta sedan
        appen från hemskärmen och aktivera <em>Guidad åtkomst</em> (Inställningar → Hjälpmedel) så att besökare inte kan lämna appen.</p>
      <div className="kiosk-link">
        <code>{url}</code>
        <button onClick={() => navigator.clipboard.writeText(url)}>Kopiera</button>
      </div>
      <p className="small muted">Länken innehåller en hemlig kod för kyrkan. Om en surfplatta försvinner – skapa en ny länk.</p>
      <div className="actions"><button className="danger" onClick={regenerate}>Skapa ny länk</button><button onClick={onClose}>Stäng</button></div>
    </Modal>
  );
}
