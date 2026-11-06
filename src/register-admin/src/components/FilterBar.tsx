import { useChurches, useCities, useCounties } from '../hooks';
import { civilStatusLabels, entries, memberStatusLabels, sacramentLabels } from '../labels';
import type { MemberFilter } from '../types';

export function filterFromParams(p: URLSearchParams): MemberFilter {
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  const str = <T,>(k: string) => (p.get(k) || undefined) as T | undefined;
  return {
    countyId: num('countyId'), cityId: num('cityId'), churchId: num('churchId'),
    civilStatus: str('civilStatus'), status: str('status'),
    hasSacrament: str('hasSacrament'), missingSacrament: str('missingSacrament'),
    minAge: num('minAge'), maxAge: num('maxAge'), search: str('search'), sortBy: str('sortBy'),
    page: num('page')
  };
}

export default function FilterBar({ filter, onChange }: { filter: MemberFilter; onChange: (f: MemberFilter) => void }) {
  const counties = useCounties();
  const cities = useCities();
  const churches = useChurches();

  const set = (patch: Partial<MemberFilter>) => onChange({ ...filter, ...patch, page: 1 });
  const numOrUndef = (v: string) => (v === '' ? undefined : Number(v));

  const visibleCities = cities.data?.filter(c => !filter.countyId || c.countyId === filter.countyId) ?? [];
  const visibleChurches = churches.data?.filter(c =>
    (!filter.countyId || c.countyId === filter.countyId) && (!filter.cityId || c.cityId === filter.cityId)) ?? [];

  return (
    <div className="filter-bar no-print">
      <input type="search" placeholder="Sök namn eller adress…" value={filter.search ?? ''}
        onChange={e => set({ search: e.target.value || undefined })} />

      {(counties.data?.length ?? 0) > 1 && (
        <select value={filter.countyId ?? ''} onChange={e => set({ countyId: numOrUndef(e.target.value), cityId: undefined, churchId: undefined })}>
          <option value="">Alla län</option>
          {counties.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {visibleCities.length > 1 && (
        <select value={filter.cityId ?? ''} onChange={e => set({ cityId: numOrUndef(e.target.value), churchId: undefined })}>
          <option value="">Alla städer</option>
          {visibleCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {visibleChurches.length > 1 && (
        <select value={filter.churchId ?? ''} onChange={e => set({ churchId: numOrUndef(e.target.value) })}>
          <option value="">Alla kyrkor</option>
          {visibleChurches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <select value={filter.civilStatus ?? ''} onChange={e => set({ civilStatus: (e.target.value || undefined) as MemberFilter['civilStatus'] })}>
        <option value="">Alla civilstånd</option>
        {entries(civilStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <select value={filter.status ?? ''} onChange={e => set({ status: (e.target.value || undefined) as MemberFilter['status'] })}>
        <option value="">Alla (utom väntande)</option>
        {entries(memberStatusLabels).filter(([k]) => k !== 'Pending').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <select value={filter.hasSacrament ?? ''} onChange={e => set({ hasSacrament: (e.target.value || undefined) as MemberFilter['hasSacrament'] })}>
        <option value="">Har sakrament…</option>
        {entries(sacramentLabels).map(([k, v]) => <option key={k} value={k}>Har: {v}</option>)}
      </select>

      <select value={filter.missingSacrament ?? ''} onChange={e => set({ missingSacrament: (e.target.value || undefined) as MemberFilter['missingSacrament'] })}>
        <option value="">Saknar sakrament…</option>
        {entries(sacramentLabels).map(([k, v]) => <option key={k} value={k}>Saknar: {v}</option>)}
      </select>

      <span className="age">
        Ålder
        <input type="number" min={0} max={130} placeholder="från" value={filter.minAge ?? ''} onChange={e => set({ minAge: numOrUndef(e.target.value) })} />
        –
        <input type="number" min={0} max={130} placeholder="till" value={filter.maxAge ?? ''} onChange={e => set({ maxAge: numOrUndef(e.target.value) })} />
      </span>

      <select value={filter.sortBy ?? ''} onChange={e => set({ sortBy: e.target.value || undefined })}>
        <option value="">Sortera: namn</option>
        <option value="birth">Sortera: födelsedatum</option>
        <option value="church">Sortera: kyrka</option>
        <option value="created">Sortera: senast registrerad</option>
      </select>

      <button className="link" onClick={() => onChange({})}>Rensa filter</button>
    </div>
  );
}
