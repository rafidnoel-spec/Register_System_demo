/**
 * DEMO-API som körs helt i webbläsaren.
 *
 * Fångar alla fetch-anrop till /api/* och svarar på samma sätt som C#-API:t i
 * src/RegisterSystem.Api. All data är påhittad och sparas bara i webbläsarens
 * localStorage – ingenting skickas till någon server. Används endast i demoläget
 * (VITE_DEMO=true) som publiceras på GitHub Pages.
 */

type Role = 'Root' | 'County' | 'City' | 'Church';
type Civil = 'Unmarried' | 'Married' | 'Divorced' | 'Widowed' | 'Separated';
type MStatus = 'Pending' | 'Active' | 'Inactive' | 'Deceased';
type Source = 'Admin' | 'PublicWeb' | 'Kiosk';
type RelType = 'Spouse' | 'Parent' | 'Godparent';
type SacType = 'Baptism' | 'FirstCommunion' | 'Confirmation' | 'Marriage' | 'Ordination' | 'AnointingOfSick' | 'Funeral';

interface County { id: number; name: string }
interface City { id: number; name: string; countyId: number }
interface Church { id: number; name: string; address: string | null; cityId: number; acceptsPublicRegistration: boolean; kioskCode: string }
interface Priest { id: number; name: string; churchId: number | null; isActive: boolean }
interface User {
  id: number; email: string; displayName: string; password: string; role: Role;
  countyId: number | null; cityId: number | null; churchId: number | null; isActive: boolean; lastLoginAt: string | null;
}
interface Member {
  id: number; firstName: string; lastName: string; street: string; postalCode: string; postalTown: string;
  email: string | null; phone: string | null; pnr: string; birthDate: string; civilStatus: Civil; status: MStatus;
  source: Source; churchId: number; notes: string | null; possibleDuplicateOfId: number | null; createdAt: string; updatedAt: string;
}
interface Relation { id: number; memberId: number; relatedMemberId: number; type: RelType; fromDate: string | null; toDate: string | null }
interface Sacrament {
  id: number; memberId: number; type: SacType; date: string; churchId: number | null; churchNameOther: string | null;
  priestId: number | null; priestNameOther: string | null; spouseMemberId: number | null; godparents: string | null;
  registerReference: string | null; notes: string | null;
}
interface Consent { id: number; memberId: number; policyVersion: string; purpose: string; givenAt: string; withdrawnAt: string | null; source: Source }
interface Audit { id: number; at: string; userEmail: string | null; action: string; entityType: string; entityId: string | null; details: string | null; ipAddress: string | null }

interface DB {
  version: number; seq: number;
  counties: County[]; cities: City[]; churches: Church[]; priests: Priest[]; users: User[];
  members: Member[]; relations: Relation[]; sacraments: Sacrament[]; consents: Consent[]; audit: Audit[];
}

const STORAGE_KEY = 'rs_demo_db';
const DB_VERSION = 1;
const POLICY_VERSION = '1.0';
export const DEMO_KIOSK_CODE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
export const DEMO_PASSWORD = 'demo';

// ------------------------------------------------------------------ Exempeldata

function luhnCheck(nine: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(nine[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}
const pnrFor = (birth: string, serial: string) => {
  const ymd = birth.replace(/-/g, '');
  return ymd + serial + luhnCheck(ymd.slice(2) + serial);
};

function seed(): DB {
  const now = new Date().toISOString();
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const db: DB = {
    version: DB_VERSION, seq: 1000,
    counties: [{ id: 1, name: 'Stockholms län' }, { id: 2, name: 'Västra Götalands län' }],
    cities: [{ id: 1, name: 'Södertälje', countyId: 1 }, { id: 2, name: 'Stockholm', countyId: 1 }, { id: 3, name: 'Göteborg', countyId: 2 }],
    churches: [
      { id: 1, name: 'Demokyrkan S:t Josef', address: 'Exempelvägen 1, 151 30 Södertälje', cityId: 1, acceptsPublicRegistration: true, kioskCode: DEMO_KIOSK_CODE },
      { id: 2, name: 'Demokyrkan S:ta Maria', address: 'Kyrkgatan 4, 152 40 Södertälje', cityId: 1, acceptsPublicRegistration: true, kioskCode: 'b2c3d4e5f60718293a4b5c6d7e8f90a1' },
      { id: 3, name: 'Demokyrkan S:t Thomas', address: 'Storgatan 10, 111 22 Stockholm', cityId: 2, acceptsPublicRegistration: true, kioskCode: 'c3d4e5f60718293a4b5c6d7e8f90a1b2' },
      { id: 4, name: 'Demokyrkan S:t Georg', address: 'Hamngatan 2, 411 06 Göteborg', cityId: 3, acceptsPublicRegistration: true, kioskCode: 'd4e5f60718293a4b5c6d7e8f90a1b2c3' }
    ],
    priests: [
      { id: 1, name: 'Fader Exempel', churchId: 1, isActive: true },
      { id: 2, name: 'Fader Demo', churchId: 2, isActive: true },
      { id: 3, name: 'Fader Test', churchId: 3, isActive: true },
      { id: 4, name: 'Biskop Exempelsson', churchId: null, isActive: true }
    ],
    users: [
      { id: 1, email: 'root@demo.se', displayName: 'Demo Root', password: DEMO_PASSWORD, role: 'Root', countyId: null, cityId: null, churchId: null, isActive: true, lastLoginAt: null },
      { id: 2, email: 'lan@demo.se', displayName: 'Demo Länsansvarig', password: DEMO_PASSWORD, role: 'County', countyId: 1, cityId: null, churchId: null, isActive: true, lastLoginAt: null },
      { id: 3, email: 'stad@demo.se', displayName: 'Demo Stadsansvarig', password: DEMO_PASSWORD, role: 'City', countyId: null, cityId: 1, churchId: null, isActive: true, lastLoginAt: null },
      { id: 4, email: 'kyrka@demo.se', displayName: 'Demo Kyrkoadministratör', password: DEMO_PASSWORD, role: 'Church', countyId: null, cityId: null, churchId: 1, isActive: true, lastLoginAt: null }
    ],
    members: [], relations: [], sacraments: [], consents: [], audit: []
  };

  let mid = 0;
  const addMember = (first: string, last: string, birth: string, serial: string, civil: Civil, churchId: number,
    street: string, postal: string, town: string, extra: Partial<Member> = {}) => {
    const m: Member = {
      id: ++mid, firstName: first, lastName: last, street, postalCode: postal, postalTown: town,
      email: null, phone: null, pnr: pnrFor(birth, serial), birthDate: birth, civilStatus: civil, status: 'Active',
      source: 'Admin', churchId, notes: null, possibleDuplicateOfId: null, createdAt: daysAgo(400 - mid * 7), updatedAt: daysAgo(30), ...extra
    };
    db.members.push(m);
    return m.id;
  };
  let rid = 0, sid = 0;
  const rel = (a: number, b: number, type: RelType, fromDate: string | null = null) =>
    db.relations.push({ id: ++rid, memberId: a, relatedMemberId: b, type, fromDate, toDate: null });
  const sac = (memberId: number, type: SacType, date: string, churchId: number | null, priestId: number | null, extra: Partial<Sacrament> = {}) =>
    db.sacraments.push({ id: ++sid, memberId, type, date, churchId, churchNameOther: null, priestId, priestNameOther: null,
      spouseMemberId: null, godparents: null, registerReference: null, notes: null, ...extra });

  // Familj 1 – Södertälje, S:t Josef
  const f1 = addMember('Yousef', 'Exempelsson', '1978-03-12', '123', 'Married', 1, 'Exempelgatan 5', '15130', 'Södertälje', { phone: '070-000 00 01' });
  const f1m = addMember('Maryam', 'Exempelsson', '1981-06-05', '246', 'Married', 1, 'Exempelgatan 5', '15130', 'Södertälje');
  const f1c1 = addMember('Daniel', 'Exempelsson', '2008-09-15', '135', 'Unmarried', 1, 'Exempelgatan 5', '15130', 'Södertälje');
  const f1c2 = addMember('Sara', 'Exempelsson', '2012-01-20', '248', 'Unmarried', 1, 'Exempelgatan 5', '15130', 'Södertälje');
  const f1c3 = addMember('Elias', 'Exempelsson', '2016-11-02', '157', 'Unmarried', 1, 'Exempelgatan 5', '15130', 'Södertälje');
  rel(f1, f1m, 'Spouse', '2006-06-10');
  for (const c of [f1c1, f1c2, f1c3]) { rel(f1, c, 'Parent'); rel(f1m, c, 'Parent'); }
  sac(f1, 'Marriage', '2006-06-10', 1, 1, { spouseMemberId: f1m, registerReference: 'Vigselbok 2, s. 14' });
  sac(f1, 'Baptism', '1978-05-01', null, null, { churchNameOther: 'Mar Gewargis, Bagdad', priestNameOther: 'Fader Okänd' });
  sac(f1c1, 'Baptism', '2008-11-02', 1, 1, { godparents: 'Exempel Gudfar, Exempel Gudmor', registerReference: 'Dopbok 3, s. 41' });
  sac(f1c1, 'FirstCommunion', '2017-05-14', 1, 1);
  sac(f1c1, 'Confirmation', '2022-05-22', 1, 4);
  sac(f1c2, 'Baptism', '2012-03-18', 1, 1, { godparents: 'Maria Gudmor' });
  sac(f1c2, 'FirstCommunion', '2021-05-16', 1, 1);
  sac(f1c3, 'Baptism', '2017-01-15', 1, 1);

  // Familj 2 – Södertälje, S:t Josef
  const f2 = addMember('Ninos', 'Demosson', '1965-02-28', '317', 'Married', 1, 'Testvägen 12', '15140', 'Södertälje', { email: 'ninos@example.org' });
  const f2m = addMember('Shamiram', 'Demosson', '1968-08-19', '426', 'Married', 1, 'Testvägen 12', '15140', 'Södertälje');
  const f2c1 = addMember('Rami', 'Demosson', '1992-04-07', '351', 'Married', 1, 'Provgatan 3', '15133', 'Södertälje');
  const f2c1w = addMember('Hanna', 'Provsdotter', '1994-10-30', '462', 'Married', 1, 'Provgatan 3', '15133', 'Södertälje');
  const f2gc = addMember('Mikael', 'Demosson', '2021-07-04', '375', 'Unmarried', 1, 'Provgatan 3', '15133', 'Södertälje');
  rel(f2, f2m, 'Spouse', '1990-09-01');
  rel(f2, f2c1, 'Parent'); rel(f2m, f2c1, 'Parent');
  rel(f2c1, f2c1w, 'Spouse', '2019-08-17');
  rel(f2c1, f2gc, 'Parent'); rel(f2c1w, f2gc, 'Parent');
  rel(f1, f2gc, 'Godparent');
  sac(f2, 'Marriage', '1990-09-01', null, null, { spouseMemberId: f2m, churchNameOther: 'Mar Yousif, Alqosh' });
  sac(f2c1, 'Baptism', '1992-06-14', 1, 4);
  sac(f2c1, 'Marriage', '2019-08-17', 1, 1, { spouseMemberId: f2c1w });
  sac(f2gc, 'Baptism', '2021-10-10', 1, 1, { godparents: 'Yousef Exempelsson' });

  // Övriga medlemmar
  addMember('Josef', 'Testsson', '1950-12-24', '139', 'Widowed', 1, 'Äldregatan 8', '15150', 'Södertälje');
  addMember('Martha', 'Provsson', '1987-03-03', '484', 'Divorced', 2, 'Kyrkgatan 20', '15240', 'Södertälje');
  addMember('Adam', 'Provsson', '2010-05-19', '193', 'Unmarried', 2, 'Kyrkgatan 20', '15240', 'Södertälje');
  rel(mid - 1, mid, 'Parent');
  sac(mid, 'Baptism', '2010-08-01', 2, 2);
  addMember('Lina', 'Exempeldotter', '1999-01-11', '262', 'Unmarried', 2, 'Ängsvägen 2', '15242', 'Södertälje', { status: 'Inactive' });
  addMember('Gabriel', 'Demovic', '1983-07-21', '115', 'Married', 3, 'Sveavägen 99', '11350', 'Stockholm');
  addMember('Rebecka', 'Demovic', '1985-09-09', '228', 'Married', 3, 'Sveavägen 99', '11350', 'Stockholm');
  rel(mid - 1, mid, 'Spouse', '2010-05-05');
  sac(mid - 1, 'Marriage', '2010-05-05', 3, 3, { spouseMemberId: mid });
  addMember('Tomas', 'Exempelberg', '1972-11-30', '177', 'Unmarried', 3, 'Götgatan 14', '11846', 'Stockholm');
  addMember('Ester', 'Västsson', '1990-02-14', '288', 'Married', 4, 'Avenyn 7', '41136', 'Göteborg');
  addMember('David', 'Västsson', '1988-06-06', '199', 'Married', 4, 'Avenyn 7', '41136', 'Göteborg');
  rel(mid, mid - 1, 'Spouse', '2015-06-20');

  // Två väntande självregistreringar
  const p1 = addMember('Natalie', 'Nysson', '2001-04-25', '244', 'Unmarried', 1, 'Nyvägen 1', '15160', 'Södertälje',
    { status: 'Pending', source: 'Kiosk', createdAt: daysAgo(1), email: 'natalie@example.org' });
  const p2 = addMember('Peter', 'Nyberg', '1979-08-08', '133', 'Married', 3, 'Nygatan 5', '11120', 'Stockholm',
    { status: 'Pending', source: 'PublicWeb', createdAt: daysAgo(3) });
  for (const id of [p1, p2]) {
    const m = db.members.find(x => x.id === id)!;
    db.consents.push({ id: id, memberId: id, policyVersion: POLICY_VERSION, purpose: 'Medlemsregister och kyrkobok (art. 6.1 a, 9.2 a, 9.2 d)', givenAt: m.createdAt, withdrawnAt: null, source: m.source });
  }

  db.audit.push({ id: 1, at: now, userEmail: null, action: 'DemoCreated', entityType: 'System', entityId: null, details: 'Demodata skapad', ipAddress: '127.0.0.1' });
  return db;
}

// ------------------------------------------------------------------ Lagring

let db: DB = load();

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch { /* trasig data – skapa ny */ }
  const fresh = seed();
  save(fresh);
  return fresh;
}
function save(d: DB = db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* full lagring – ignorera */ }
}
/** Återställ demodatan till ursprungsläget. */
export function resetDemoData() {
  db = seed();
  save();
}
const nextId = () => ++db.seq;

// ------------------------------------------------------------------ Hjälpfunktioner

class HttpError extends Error {
  constructor(public status: number, title: string, public extra?: Record<string, unknown>) { super(title); }
}
const fail = (status: number, title: string, extra?: Record<string, unknown>): never => { throw new HttpError(status, title, extra); };
const validation = (field: string, message: string): never => fail(400, message, { errors: { [field]: [message] } });

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const today = () => new Date().toISOString().slice(0, 10);
function ageOf(birth: string): number {
  const t = new Date(); const b = new Date(birth);
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}
const mask = (birth: string) => `${birth.replace(/-/g, '')}-****`;
const fmtPnr = (p: string) => `${p.slice(0, 8)}-${p.slice(8)}`;

function normalizePnr(input: string | null | undefined): { pnr: string; birth: string } | null {
  if (!input) return null;
  const m = /^(\d{2})?(\d{2})(\d{2})(\d{2})([-+]?)(\d{4})$/.exec(input.trim().replace(/\s/g, ''));
  if (!m) return null;
  const yy = Number(m[2]), month = Number(m[3]), day = Number(m[4]);
  let century: number;
  if (m[1]) century = Number(m[1]);
  else {
    const now = new Date().getFullYear();
    let year = Math.floor(now / 100) * 100 + yy;
    if (year > now) year -= 100;
    if (m[5] === '+') year -= 100;
    century = Math.floor(year / 100);
  }
  const fullYear = century * 100 + yy;
  const realDay = day > 60 ? day - 60 : day;
  const d = new Date(Date.UTC(fullYear, month - 1, realDay));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== realDay || d > new Date()) return null;
  const ten = `${m[2]}${m[3]}${m[4]}${m[6]}`;
  let sum = 0;
  for (let i = 0; i < 10; i++) { let x = Number(ten[i]); if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9; } sum += x; }
  if (sum % 10 !== 0) return null;
  return { pnr: `${fullYear}${m[3]}${m[4]}${m[6]}`, birth: d.toISOString().slice(0, 10) };
}

const civilLabel: Record<Civil, string> = { Unmarried: 'Ogift', Married: 'Gift', Divorced: 'Skild', Widowed: 'Änka/änkling', Separated: 'Separerad' };
const statusLabel: Record<MStatus, string> = { Pending: 'Väntar på godkännande', Active: 'Aktiv', Inactive: 'Inaktiv', Deceased: 'Avliden' };

// ------------------------------------------------------------------ Behörighet

interface Ctx { user: User | null; url: URL; body: any; params: string[] }

function requireUser(ctx: Ctx): User {
  if (!ctx.user) fail(401, 'Inte inloggad');
  return ctx.user!;
}
const cityOf = (churchId: number) => db.cities.find(c => c.id === db.churches.find(ch => ch.id === churchId)?.cityId);

function churchIdsInScope(u: User): number[] {
  return db.churches.filter(ch => {
    const city = db.cities.find(c => c.id === ch.cityId)!;
    switch (u.role) {
      case 'Root': return true;
      case 'County': return city.countyId === u.countyId;
      case 'City': return ch.cityId === u.cityId;
      case 'Church': return ch.id === u.churchId;
    }
  }).map(c => c.id);
}
const citiesInScope = (u: User) => {
  const ids = new Set(churchIdsInScope(u).map(id => db.churches.find(c => c.id === id)!.cityId));
  return db.cities.filter(c => u.role === 'Root' || (u.role === 'County' ? c.countyId === u.countyId : ids.has(c.id)));
};
const countiesInScope = (u: User) => {
  const ids = new Set(citiesInScope(u).map(c => c.countyId));
  return db.counties.filter(c => u.role === 'Root' || ids.has(c.id));
};
const membersInScope = (u: User) => { const ids = new Set(churchIdsInScope(u)); return db.members.filter(m => ids.has(m.churchId)); };
function memberInScope(u: User, id: number): Member {
  const m = membersInScope(u).find(x => x.id === id);
  if (!m) fail(404, 'Hittades inte');
  return m!;
}
const canAccessChurch = (u: User, id: number) => churchIdsInScope(u).includes(id);
const canManageCounty = (u: User, countyId: number) => u.role === 'Root' || (u.role === 'County' && u.countyId === countyId);
function canManageCity(u: User, cityId: number) {
  if (u.role === 'Root') return true;
  if (u.role === 'County') return db.cities.some(c => c.id === cityId && c.countyId === u.countyId);
  if (u.role === 'City') return u.cityId === cityId;
  return false;
}
const forbid = (): never => fail(403, 'Du saknar behörighet för detta.');

function audit(ctx: Ctx | null, action: string, entityType: string, entityId?: number | null, details?: string) {
  db.audit.unshift({
    id: nextId(), at: new Date().toISOString(), userEmail: ctx?.user?.email ?? null, action, entityType,
    entityId: entityId == null ? null : String(entityId), details: details ?? null, ipAddress: '127.0.0.1 (demo)'
  });
  if (db.audit.length > 500) db.audit.length = 500;
}

// ------------------------------------------------------------------ Mappning till DTO

const roleOrder: Role[] = ['Root', 'County', 'City', 'Church'];

function userDto(u: User) {
  const scopeName = u.role === 'Root' ? 'Hela organisationen'
    : u.role === 'County' ? db.counties.find(c => c.id === u.countyId)?.name
    : u.role === 'City' ? db.cities.find(c => c.id === u.cityId)?.name
    : db.churches.find(c => c.id === u.churchId)?.name;
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role, countyId: u.countyId, cityId: u.cityId,
    churchId: u.churchId, scopeName: scopeName ?? null, isActive: u.isActive, lastLoginAt: u.lastLoginAt };
}

function listItem(m: Member) {
  const church = db.churches.find(c => c.id === m.churchId)!;
  return {
    id: m.id, firstName: m.firstName, lastName: m.lastName, personnummerMasked: mask(m.birthDate), birthDate: m.birthDate,
    age: ageOf(m.birthDate), street: m.street, postalCode: m.postalCode, postalTown: m.postalTown, civilStatus: m.civilStatus,
    status: m.status, churchId: m.churchId, churchName: church.name, cityName: cityOf(m.churchId)?.name ?? '',
    source: m.source, possibleDuplicateOfId: m.possibleDuplicateOfId, createdAt: m.createdAt
  };
}

const nameOf = (id: number | null) => { const m = db.members.find(x => x.id === id); return m ? `${m.firstName} ${m.lastName}` : null; };

function sacramentDto(s: Sacrament) {
  return {
    id: s.id, memberId: s.memberId, type: s.type, date: s.date, churchId: s.churchId,
    churchName: s.churchId ? db.churches.find(c => c.id === s.churchId)?.name ?? null : s.churchNameOther,
    priestId: s.priestId, priestName: s.priestId ? db.priests.find(p => p.id === s.priestId)?.name ?? null : s.priestNameOther,
    spouseMemberId: s.spouseMemberId, spouseName: nameOf(s.spouseMemberId),
    godparents: s.godparents, registerReference: s.registerReference, notes: s.notes
  };
}
const sacramentsFor = (ids: number[]) =>
  db.sacraments.filter(s => ids.includes(s.memberId)).sort((a, b) => a.date.localeCompare(b.date)).map(sacramentDto);

function relationsFor(id: number) {
  return db.relations.filter(r => r.memberId === id || r.relatedMemberId === id).map(r => {
    const outgoing = r.memberId === id;
    const other = outgoing ? r.relatedMemberId : r.memberId;
    return { id: r.id, type: r.type, direction: outgoing ? 'outgoing' : 'incoming', otherMemberId: other,
      otherMemberName: nameOf(other) ?? '', fromDate: r.fromDate, toDate: r.toDate };
  });
}

// ------------------------------------------------------------------ Filter

function filterMembers(u: User, q: URLSearchParams | Record<string, any>) {
  const get = (k: string): string | undefined => {
    const v = q instanceof URLSearchParams ? q.get(k) : q[k];
    return v === null || v === undefined || v === '' ? undefined : String(v);
  };
  let list = membersInScope(u);
  const num = (k: string) => (get(k) ? Number(get(k)) : undefined);
  const county = num('countyId'), city = num('cityId'), church = num('churchId');
  if (county) list = list.filter(m => cityOf(m.churchId)?.countyId === county);
  if (city) list = list.filter(m => cityOf(m.churchId)?.id === city);
  if (church) list = list.filter(m => m.churchId === church);
  if (get('civilStatus')) list = list.filter(m => m.civilStatus === get('civilStatus'));
  list = get('status') ? list.filter(m => m.status === get('status')) : list.filter(m => m.status !== 'Pending');
  if (get('hasSacrament')) list = list.filter(m => db.sacraments.some(s => s.memberId === m.id && s.type === get('hasSacrament')));
  if (get('missingSacrament')) list = list.filter(m => !db.sacraments.some(s => s.memberId === m.id && s.type === get('missingSacrament')));
  const minAge = num('minAge'), maxAge = num('maxAge');
  if (minAge !== undefined) list = list.filter(m => ageOf(m.birthDate) >= minAge);
  if (maxAge !== undefined) list = list.filter(m => ageOf(m.birthDate) <= maxAge);
  const s = get('search')?.toLowerCase();
  if (s) list = list.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(s) || m.street.toLowerCase().includes(s) || m.postalTown.toLowerCase().includes(s));
  const sort = get('sortBy');
  const byName = (a: Member, b: Member) => a.lastName.localeCompare(b.lastName, 'sv') || a.firstName.localeCompare(b.firstName, 'sv');
  list = [...list].sort(sort === 'birth' ? (a, b) => a.birthDate.localeCompare(b.birthDate)
    : sort === 'created' ? (a, b) => b.createdAt.localeCompare(a.createdAt)
    : sort === 'church' ? (a, b) => (db.churches.find(c => c.id === a.churchId)!.name.localeCompare(db.churches.find(c => c.id === b.churchId)!.name)) || byName(a, b)
    : byName);
  return list;
}

const columns: Record<string, [string, (m: ReturnType<typeof listItem>) => string]> = {
  name: ['Namn', m => `${m.lastName}, ${m.firstName}`],
  birthDate: ['Födelsedatum', m => m.birthDate],
  age: ['Ålder', m => String(m.age)],
  address: ['Adress', m => `${m.street}, ${m.postalCode} ${m.postalTown}`],
  civilStatus: ['Civilstånd', m => civilLabel[m.civilStatus]],
  church: ['Kyrka', m => m.churchName],
  city: ['Stad', m => m.cityName],
  status: ['Status', m => statusLabel[m.status]]
};
function csv(rows: ReturnType<typeof listItem>[], cols: string[]) {
  const esc = (v: string) => {
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [cols.map(c => esc(columns[c][0])).join(';'), ...rows.map(r => cols.map(c => esc(columns[c][1](r))).join(';'))];
  return '﻿' + lines.join('\r\n');
}
const parseCols = (c?: string[] | null) => {
  const valid = (c ?? []).filter(x => x in columns);
  return valid.length ? valid : ['name', 'birthDate', 'address', 'civilStatus', 'church'];
};

// ------------------------------------------------------------------ Integritetstext

const privacyHtml = `
<h2>Så behandlar vi dina personuppgifter</h2>
<p><strong>DEMO:</strong> Detta är en demonstration. Uppgifter du skriver in sparas endast i din egen webbläsare och skickas inte någonstans.</p>
<p><strong>Personuppgiftsansvarig:</strong> Kaldeisk-katolska missionen i Sverige. Kontakt: <a href="mailto:dataskydd@example.org">dataskydd@example.org</a>.</p>
<h3>Varför vi behandlar uppgifterna</h3>
<p>För att administrera medlemskap i församlingen, föra kyrkobok över sakrament (t.ex. dop, konfirmation och vigsel) och kontakta medlemmar.</p>
<h3>Rättslig grund</h3>
<p>Ditt uttryckliga samtycke (art. 6.1 a och 9.2 a) samt art. 9.2 d för trossamfund. Personnumret används för säker identifiering.</p>
<h3>Dina rättigheter</h3>
<p>Du har rätt till registerutdrag, rättelse, radering, begränsning och dataportabilitet samt att återkalla samtycket. Du kan klaga hos IMY, www.imy.se.</p>`;

// ------------------------------------------------------------------ Rutter

type Handler = (ctx: Ctx) => unknown;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), h]);

// --- Auth
route('POST', '/api/auth/login', ctx => {
  const email = String(ctx.body?.email ?? '').trim().toLowerCase();
  const u = db.users.find(x => x.email === email && x.isActive);
  if (!u || u.password !== ctx.body?.password) fail(401, 'Fel e-post eller lösenord.');
  u!.lastLoginAt = new Date().toISOString();
  audit({ ...ctx, user: u! }, 'Login', 'AppUser', u!.id);
  return { token: `demo.${u!.id}.${Math.random().toString(36).slice(2)}`, expiresUtc: new Date(Date.now() + 3600e3).toISOString(), user: userDto(u!) };
});
route('GET', '/api/auth/me', ctx => userDto(requireUser(ctx)));
route('POST', '/api/auth/change-password', ctx => {
  const u = requireUser(ctx);
  if (ctx.body.currentPassword !== u.password) fail(400, 'Nuvarande lösenord är fel.');
  u.password = ctx.body.newPassword;
  audit(ctx, 'PasswordChanged', 'AppUser', u.id);
});

// --- Län
route('GET', '/api/counties', ctx => countiesInScope(requireUser(ctx)).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  .map(c => ({ id: c.id, name: c.name, cityCount: db.cities.filter(x => x.countyId === c.id).length })));
route('POST', '/api/counties', ctx => {
  if (requireUser(ctx).role !== 'Root') forbid();
  const c = { id: nextId(), name: String(ctx.body.name).trim() };
  db.counties.push(c); audit(ctx, 'CountyCreated', 'County', c.id, c.name);
  return { ...c, cityCount: 0 };
});
route('PUT', '/api/counties/:id', ctx => {
  if (requireUser(ctx).role !== 'Root') forbid();
  const c = db.counties.find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  c.name = String(ctx.body.name).trim(); audit(ctx, 'CountyUpdated', 'County', c.id, c.name);
});
route('DELETE', '/api/counties/:id', ctx => {
  if (requireUser(ctx).role !== 'Root') forbid();
  const id = Number(ctx.params[0]);
  if (db.cities.some(c => c.countyId === id) || db.users.some(u => u.countyId === id)) fail(409, 'Länet har städer eller användare och kan inte tas bort.');
  db.counties = db.counties.filter(c => c.id !== id); audit(ctx, 'CountyDeleted', 'County', id);
});

// --- Städer
route('GET', '/api/cities', ctx => {
  const countyId = ctx.url.searchParams.get('countyId');
  return citiesInScope(requireUser(ctx)).filter(c => !countyId || c.countyId === Number(countyId))
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    .map(c => ({ id: c.id, name: c.name, countyId: c.countyId, countyName: db.counties.find(x => x.id === c.countyId)?.name ?? '',
      churchCount: db.churches.filter(ch => ch.cityId === c.id).length }));
});
route('POST', '/api/cities', ctx => {
  if (!canManageCounty(requireUser(ctx), Number(ctx.body.countyId))) forbid();
  const c = { id: nextId(), name: String(ctx.body.name).trim(), countyId: Number(ctx.body.countyId) };
  db.cities.push(c); audit(ctx, 'CityCreated', 'City', c.id, c.name);
  return c;
});
route('PUT', '/api/cities/:id', ctx => {
  const u = requireUser(ctx);
  const c = db.cities.find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  if (!canManageCounty(u, c.countyId) || !canManageCounty(u, Number(ctx.body.countyId))) forbid();
  c.name = String(ctx.body.name).trim(); c.countyId = Number(ctx.body.countyId);
  audit(ctx, 'CityUpdated', 'City', c.id, c.name);
});
route('DELETE', '/api/cities/:id', ctx => {
  const u = requireUser(ctx); const id = Number(ctx.params[0]);
  const c = db.cities.find(x => x.id === id) ?? fail(404, 'Hittades inte');
  if (!canManageCounty(u, c.countyId)) forbid();
  if (db.churches.some(ch => ch.cityId === id) || db.users.some(x => x.cityId === id)) fail(409, 'Staden har kyrkor eller användare och kan inte tas bort.');
  db.cities = db.cities.filter(x => x.id !== id); audit(ctx, 'CityDeleted', 'City', id);
});

// --- Kyrkor
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
route('GET', '/api/churches', ctx => {
  const u = requireUser(ctx);
  const cityId = ctx.url.searchParams.get('cityId'), countyId = ctx.url.searchParams.get('countyId');
  const ids = new Set(churchIdsInScope(u));
  return db.churches.filter(c => ids.has(c.id))
    .filter(c => !cityId || c.cityId === Number(cityId))
    .filter(c => !countyId || cityOf(c.id)?.countyId === Number(countyId))
    .map(c => {
      const city = db.cities.find(x => x.id === c.cityId)!;
      return { id: c.id, name: c.name, address: c.address, cityId: c.cityId, cityName: city.name, countyId: city.countyId,
        countyName: db.counties.find(x => x.id === city.countyId)?.name ?? '', acceptsPublicRegistration: c.acceptsPublicRegistration,
        kioskCode: c.kioskCode, memberCount: db.members.filter(m => m.churchId === c.id && m.status !== 'Pending').length };
    })
    .sort((a, b) => a.cityName.localeCompare(b.cityName, 'sv') || a.name.localeCompare(b.name, 'sv'));
});
route('POST', '/api/churches', ctx => {
  if (!canManageCity(requireUser(ctx), Number(ctx.body.cityId))) forbid();
  const c: Church = { id: nextId(), name: String(ctx.body.name).trim(), address: ctx.body.address || null, cityId: Number(ctx.body.cityId),
    acceptsPublicRegistration: ctx.body.acceptsPublicRegistration ?? true, kioskCode: randomCode() };
  db.churches.push(c); audit(ctx, 'ChurchCreated', 'Church', c.id, c.name);
  return { id: c.id };
});
route('PUT', '/api/churches/:id', ctx => {
  const u = requireUser(ctx);
  const c = db.churches.find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  if (u.role === 'Church') { if (u.churchId !== c.id || Number(ctx.body.cityId) !== c.cityId) forbid(); }
  else if (!canManageCity(u, c.cityId) || !canManageCity(u, Number(ctx.body.cityId))) forbid();
  Object.assign(c, { name: String(ctx.body.name).trim(), address: ctx.body.address || null, cityId: Number(ctx.body.cityId),
    acceptsPublicRegistration: !!ctx.body.acceptsPublicRegistration });
  audit(ctx, 'ChurchUpdated', 'Church', c.id, c.name);
});
route('POST', '/api/churches/:id/kiosk-code', ctx => {
  const u = requireUser(ctx); const id = Number(ctx.params[0]);
  if (!canAccessChurch(u, id)) forbid();
  const c = db.churches.find(x => x.id === id)!;
  c.kioskCode = randomCode(); audit(ctx, 'KioskCodeRegenerated', 'Church', id);
  return { kioskCode: c.kioskCode };
});
route('DELETE', '/api/churches/:id', ctx => {
  const u = requireUser(ctx); const id = Number(ctx.params[0]);
  const c = db.churches.find(x => x.id === id) ?? fail(404, 'Hittades inte');
  if (!canManageCity(u, c.cityId)) forbid();
  if (db.members.some(m => m.churchId === id) || db.users.some(x => x.churchId === id)) fail(409, 'Kyrkan har medlemmar eller användare och kan inte tas bort.');
  db.churches = db.churches.filter(x => x.id !== id); audit(ctx, 'ChurchDeleted', 'Church', id);
});

// --- Präster
route('GET', '/api/priests', ctx => {
  const ids = new Set(churchIdsInScope(requireUser(ctx)));
  return db.priests.filter(p => p.churchId === null || ids.has(p.churchId)).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    .map(p => ({ ...p, churchName: p.churchId ? db.churches.find(c => c.id === p.churchId)?.name ?? null : null }));
});
const canSetPriestChurch = (u: User, churchId: number | null) =>
  churchId === null ? (u.role === 'Root' || u.role === 'County') : canAccessChurch(u, churchId);
route('POST', '/api/priests', ctx => {
  const u = requireUser(ctx); const churchId = ctx.body.churchId ?? null;
  if (!canSetPriestChurch(u, churchId)) forbid();
  const p: Priest = { id: nextId(), name: String(ctx.body.name).trim(), churchId, isActive: ctx.body.isActive ?? true };
  db.priests.push(p); audit(ctx, 'PriestCreated', 'Priest', p.id, p.name);
  return { ...p, churchName: null };
});
route('PUT', '/api/priests/:id', ctx => {
  const u = requireUser(ctx);
  const p = db.priests.find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  if (!canSetPriestChurch(u, p.churchId) || !canSetPriestChurch(u, ctx.body.churchId ?? null)) forbid();
  Object.assign(p, { name: String(ctx.body.name).trim(), churchId: ctx.body.churchId ?? null, isActive: !!ctx.body.isActive });
  audit(ctx, 'PriestUpdated', 'Priest', p.id, p.name);
});

// --- Användare
function usersInScope(me: User) {
  if (me.role === 'Root') return db.users;
  const churchIds = new Set(churchIdsInScope(me));
  return db.users.filter(u =>
    me.role === 'County'
      ? u.countyId === me.countyId || (u.cityId !== null && db.cities.some(c => c.id === u.cityId && c.countyId === me.countyId)) || (u.churchId !== null && churchIds.has(u.churchId))
      : me.role === 'City' ? u.cityId === me.cityId || (u.churchId !== null && churchIds.has(u.churchId)) : u.id === me.id);
}
function applyRole(me: User, target: User, body: any) {
  const role = body.role as Role;
  if (roleOrder.indexOf(role) < roleOrder.indexOf(me.role)) forbid();
  target.role = role; target.countyId = target.cityId = target.churchId = null;
  if (role === 'County') {
    if (!body.countyId || !countiesInScope(me).some(c => c.id === body.countyId)) fail(400, 'Välj ett län inom din behörighet.');
    if (me.role === 'County' && body.countyId !== me.countyId) forbid();
    target.countyId = body.countyId;
  } else if (role === 'City') {
    if (!body.cityId || !citiesInScope(me).some(c => c.id === body.cityId)) fail(400, 'Välj en stad inom din behörighet.');
    target.cityId = body.cityId;
  } else if (role === 'Church') {
    if (!body.churchId || !canAccessChurch(me, body.churchId)) fail(400, 'Välj en kyrka inom din behörighet.');
    target.churchId = body.churchId;
  }
}
route('GET', '/api/users', ctx => {
  const me = requireUser(ctx);
  if (me.role === 'Church') forbid();
  return [...usersInScope(me)].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.displayName.localeCompare(b.displayName, 'sv')).map(userDto);
});
route('POST', '/api/users', ctx => {
  const me = requireUser(ctx);
  const email = String(ctx.body.email).trim().toLowerCase();
  if (db.users.some(u => u.email === email)) fail(409, 'E-postadressen används redan.');
  if (String(ctx.body.password ?? '').length < 12) validation('password', 'Lösenordet måste vara minst 12 tecken.');
  const u: User = { id: nextId(), email, displayName: String(ctx.body.displayName).trim(), password: ctx.body.password, role: 'Church',
    countyId: null, cityId: null, churchId: null, isActive: true, lastLoginAt: null };
  applyRole(me, u, ctx.body);
  db.users.push(u); audit(ctx, 'UserCreated', 'AppUser', u.id, `Roll ${u.role}`);
  return userDto(u);
});
route('PUT', '/api/users/:id', ctx => {
  const me = requireUser(ctx);
  const u = usersInScope(me).find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  if (u.id === me.id && (ctx.body.role !== me.role || !ctx.body.isActive)) fail(400, 'Du kan inte ändra din egen roll eller inaktivera dig själv.');
  if (roleOrder.indexOf(u.role) < roleOrder.indexOf(me.role)) forbid();
  const copy = { ...u };
  applyRole(me, copy, ctx.body);
  Object.assign(u, copy, { displayName: String(ctx.body.displayName).trim(), isActive: !!ctx.body.isActive });
  if (ctx.body.newPassword) u.password = ctx.body.newPassword;
  audit(ctx, 'UserUpdated', 'AppUser', u.id, `Roll ${u.role}, aktiv ${u.isActive}`);
  return userDto(u);
});

// --- Medlemmar
route('GET', '/api/members', ctx => {
  const u = requireUser(ctx);
  const list = filterMembers(u, ctx.url.searchParams);
  const pageSize = Math.min(500, Math.max(1, Number(ctx.url.searchParams.get('pageSize') ?? 50)));
  const page = Math.max(1, Number(ctx.url.searchParams.get('page') ?? 1));
  return { items: list.slice((page - 1) * pageSize, page * pageSize).map(listItem), total: list.length, page, pageSize };
});
route('GET', '/api/members/pending', ctx =>
  membersInScope(requireUser(ctx)).filter(m => m.status === 'Pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(listItem));
route('GET', '/api/members/lookup', ctx => {
  const q = (ctx.url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return [];
  return membersInScope(requireUser(ctx)).filter(m => m.status !== 'Pending' && `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
    .slice(0, 20).map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, birthDate: m.birthDate, church: db.churches.find(c => c.id === m.churchId)?.name }));
});
route('GET', '/api/members/:id', ctx => {
  const u = requireUser(ctx); const m = memberInScope(u, Number(ctx.params[0]));
  audit(ctx, 'MemberViewed', 'Member', m.id);
  return {
    ...listItem(m), email: m.email, phone: m.phone, notes: m.notes, updatedAt: m.updatedAt,
    relations: relationsFor(m.id), sacraments: sacramentsFor([m.id]),
    consents: db.consents.filter(c => c.memberId === m.id).map(({ memberId: _m, ...c }) => c)
  };
});

function applyMember(m: Member, b: any) {
  Object.assign(m, {
    firstName: String(b.firstName ?? '').trim(), lastName: String(b.lastName ?? '').trim(), street: String(b.street ?? '').trim(),
    postalCode: String(b.postalCode ?? '').replace(/\s/g, ''), postalTown: String(b.postalTown ?? '').trim(),
    email: b.email || null, phone: b.phone || null, civilStatus: b.civilStatus, status: b.status, churchId: Number(b.churchId),
    notes: b.notes || null, updatedAt: new Date().toISOString()
  });
  if (!m.firstName) validation('firstName', 'Förnamn krävs.');
  if (!m.lastName) validation('lastName', 'Efternamn krävs.');
}
route('POST', '/api/members', ctx => {
  const u = requireUser(ctx);
  if (!canAccessChurch(u, Number(ctx.body.churchId))) forbid();
  const p = normalizePnr(ctx.body.personnummer) ?? validation('personnummer', 'Ogiltigt personnummer.');
  if (db.members.some(m => m.pnr === p.pnr && m.status !== 'Pending')) fail(409, 'Det finns redan en medlem med detta personnummer.');
  const m = { id: nextId(), pnr: p.pnr, birthDate: p.birth, source: 'Admin', possibleDuplicateOfId: null, createdAt: new Date().toISOString() } as Member;
  applyMember(m, ctx.body);
  db.members.push(m); audit(ctx, 'MemberCreated', 'Member', m.id);
  return { id: m.id };
});
route('PUT', '/api/members/:id', ctx => {
  const u = requireUser(ctx); const m = memberInScope(u, Number(ctx.params[0]));
  if (Number(ctx.body.churchId) !== m.churchId && !canAccessChurch(u, Number(ctx.body.churchId))) forbid();
  if (ctx.body.personnummer) {
    const p = normalizePnr(ctx.body.personnummer) ?? validation('personnummer', 'Ogiltigt personnummer.');
    if (p.pnr !== m.pnr) {
      if (db.members.some(x => x.id !== m.id && x.pnr === p.pnr && x.status !== 'Pending')) fail(409, 'Det finns redan en medlem med detta personnummer.');
      m.pnr = p.pnr; m.birthDate = p.birth;
    }
  }
  applyMember(m, ctx.body);
  audit(ctx, 'MemberUpdated', 'Member', m.id);
});
route('POST', '/api/members/:id/approve', ctx => {
  const u = requireUser(ctx); const m = memberInScope(u, Number(ctx.params[0]));
  if (m.status !== 'Pending') fail(404, 'Hittades inte');
  if (db.members.some(x => x.id !== m.id && x.pnr === m.pnr && x.status !== 'Pending'))
    fail(409, 'Personnumret finns redan som medlem. Uppdatera den befintliga medlemmen och avvisa registreringen.');
  m.status = 'Active'; m.updatedAt = new Date().toISOString();
  audit(ctx, 'RegistrationApproved', 'Member', m.id);
});
route('POST', '/api/members/:id/personnummer', ctx => {
  const u = requireUser(ctx); const m = memberInScope(u, Number(ctx.params[0]));
  if (String(ctx.body.reason ?? '').trim().length < 5) validation('reason', 'Ange en anledning (minst 5 tecken).');
  audit(ctx, 'PersonnummerRevealed', 'Member', m.id, `Anledning: ${ctx.body.reason}`);
  return { personnummer: fmtPnr(m.pnr) };
});
route('GET', '/api/members/:id/export', ctx => {
  const u = requireUser(ctx); const m = memberInScope(u, Number(ctx.params[0]));
  const church = db.churches.find(c => c.id === m.churchId)!; const city = cityOf(m.churchId)!;
  const data = {
    exportedAt: new Date().toISOString(),
    description: 'Registerutdrag enligt dataskyddsförordningen (GDPR) artikel 15 och 20. (DEMO – påhittade uppgifter)',
    personalData: {
      firstName: m.firstName, lastName: m.lastName, personnummer: fmtPnr(m.pnr), birthDate: m.birthDate,
      address: { street: m.street, postalCode: m.postalCode, postalTown: m.postalTown }, email: m.email, phone: m.phone,
      civilStatus: m.civilStatus, status: m.status, church: church.name, city: city.name,
      county: db.counties.find(c => c.id === city.countyId)?.name, notes: m.notes, registeredVia: m.source, createdAt: m.createdAt, updatedAt: m.updatedAt
    },
    relations: relationsFor(m.id), sacraments: sacramentsFor([m.id]),
    consents: db.consents.filter(c => c.memberId === m.id)
  };
  audit(ctx, 'MemberExported', 'Member', m.id, 'Registerutdrag (art. 15)');
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="registerutdrag-${m.id}-${today().replace(/-/g, '')}.json"` }
  });
});
route('DELETE', '/api/members/:id', ctx => {
  const u = requireUser(ctx); const m = memberInScope(u, Number(ctx.params[0]));
  db.relations = db.relations.filter(r => r.memberId !== m.id && r.relatedMemberId !== m.id);
  db.sacraments.forEach(s => { if (s.spouseMemberId === m.id) s.spouseMemberId = null; });
  db.sacraments = db.sacraments.filter(s => s.memberId !== m.id);
  db.consents = db.consents.filter(c => c.memberId !== m.id);
  db.members.forEach(x => { if (x.possibleDuplicateOfId === m.id) x.possibleDuplicateOfId = null; });
  db.members = db.members.filter(x => x.id !== m.id);
  const reason = ctx.url.searchParams.get('reason');
  audit(ctx, m.status === 'Pending' ? 'RegistrationRejected' : 'MemberErased', 'Member', m.id, reason ? `Anledning: ${reason}` : undefined);
});

// --- Relationer
function addRelation(a: number, b: number, type: RelType, from: string | null, to: string | null): Relation | null {
  if (type === 'Spouse' && a > b) [a, b] = [b, a];
  const exists = db.relations.some(r => r.type === type &&
    ((r.memberId === a && r.relatedMemberId === b) || (type === 'Spouse' && r.memberId === b && r.relatedMemberId === a)));
  if (exists) return null;
  const r = { id: nextId(), memberId: a, relatedMemberId: b, type, fromDate: from, toDate: to };
  db.relations.push(r);
  return r;
}
route('POST', '/api/relations', ctx => {
  const u = requireUser(ctx); const { memberId, relatedMemberId, type } = ctx.body;
  if (memberId === relatedMemberId) fail(400, 'En medlem kan inte ha en relation till sig själv.');
  memberInScope(u, memberId); memberInScope(u, relatedMemberId);
  if (type === 'Parent') {
    if (db.relations.some(r => r.type === 'Parent' && r.memberId === relatedMemberId && r.relatedMemberId === memberId)) fail(400, 'Det omvända förhållandet finns redan.');
    const a = db.members.find(m => m.id === memberId)!, b = db.members.find(m => m.id === relatedMemberId)!;
    if (a.birthDate >= b.birthDate) fail(400, 'Föräldern måste vara född före barnet.');
    if (db.relations.filter(r => r.type === 'Parent' && r.relatedMemberId === relatedMemberId).length >= 2) fail(400, 'Barnet har redan två registrerade föräldrar.');
  }
  const r = addRelation(memberId, relatedMemberId, type, ctx.body.fromDate ?? null, ctx.body.toDate ?? null) ?? fail(409, 'Relationen finns redan.');
  audit(ctx, 'RelationCreated', 'MemberRelation', r.id, `${memberId} ${type} ${relatedMemberId}`);
  return { id: r.id };
});
route('DELETE', '/api/relations/:id', ctx => {
  requireUser(ctx); const id = Number(ctx.params[0]);
  db.relations = db.relations.filter(r => r.id !== id); audit(ctx, 'RelationDeleted', 'MemberRelation', id);
});

// --- Sakrament
function applySacrament(ctx: Ctx, s: Sacrament) {
  const u = requireUser(ctx); const b = ctx.body;
  memberInScope(u, b.memberId);
  if (!b.date) validation('date', 'Datum krävs.');
  if (b.spouseMemberId && (b.type !== 'Marriage' || b.spouseMemberId === b.memberId)) fail(400, 'Ogiltig make/maka.');
  Object.assign(s, {
    type: b.type, date: b.date, churchId: b.churchId ?? null, churchNameOther: b.churchId ? null : b.churchNameOther ?? null,
    priestId: b.priestId ?? null, priestNameOther: b.priestId ? null : b.priestNameOther ?? null,
    spouseMemberId: b.spouseMemberId ?? null, godparents: b.godparents ?? null, registerReference: b.registerReference ?? null, notes: b.notes ?? null
  });
  if (s.type === 'Marriage' && s.spouseMemberId) {
    addRelation(s.memberId, s.spouseMemberId, 'Spouse', s.date, null);
    for (const m of db.members) if (m.id === s.memberId || m.id === s.spouseMemberId) m.civilStatus = 'Married';
  }
}
route('POST', '/api/sacraments', ctx => {
  const s = { id: nextId(), memberId: ctx.body.memberId } as Sacrament;
  applySacrament(ctx, s);
  db.sacraments.push(s); audit(ctx, 'SacramentCreated', 'SacramentEvent', s.id, `${s.type} för medlem ${s.memberId}`);
  return { id: s.id };
});
route('PUT', '/api/sacraments/:id', ctx => {
  const s = db.sacraments.find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  applySacrament(ctx, s); audit(ctx, 'SacramentUpdated', 'SacramentEvent', s.id);
});
route('DELETE', '/api/sacraments/:id', ctx => {
  const u = requireUser(ctx); const s = db.sacraments.find(x => x.id === Number(ctx.params[0])) ?? fail(404, 'Hittades inte');
  memberInScope(u, s.memberId);
  db.sacraments = db.sacraments.filter(x => x.id !== s.id); audit(ctx, 'SacramentDeleted', 'SacramentEvent', s.id);
});

// --- Rapporter
route('GET', '/api/reports/members.csv', ctx => {
  const rows = filterMembers(requireUser(ctx), ctx.url.searchParams).map(listItem);
  audit(ctx, 'MemberListExported', 'Member', null, `CSV, ${rows.length} rader`);
  return new Response(csv(rows, parseCols(ctx.url.searchParams.get('columns')?.split(','))), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="medlemmar-${today().replace(/-/g, '')}.csv"` }
  });
});
route('POST', '/api/reports/members/email', ctx => {
  const u = requireUser(ctx);
  const recipients: string[] = (ctx.body.recipients ?? []).map((r: string) => r.trim().toLowerCase()).filter(Boolean);
  if (recipients.length === 0 || recipients.length > 10) fail(400, 'Ange 1–10 mottagare.');
  const allowed = recipients.filter(r => db.users.some(x => x.isActive && x.email === r) || r.endsWith('@example.org') || r.endsWith('@demo.se'));
  const notAllowed = recipients.filter(r => !allowed.includes(r));
  if (notAllowed.length) fail(400, 'Av dataskyddsskäl får listor bara skickas till användare i systemet eller godkända domäner (i demon: @demo.se och @example.org).', { detail: `Ej tillåtna: ${notAllowed.join(', ')}` });
  const rows = filterMembers(u, ctx.body.filter ?? {});
  audit(ctx, 'MemberListEmailed', 'Member', null, `${rows.length} rader till ${recipients.join(', ')} (DEMO – inget mejl skickades)`);
  return { sent: rows.length };
});
route('GET', '/api/reports/family/:id', ctx => {
  const u = requireUser(ctx); const head = memberInScope(u, Number(ctx.params[0]));
  const scope = new Set(membersInScope(u).map(m => m.id));
  const spouseIds = db.relations.filter(r => r.type === 'Spouse' && (r.memberId === head.id || r.relatedMemberId === head.id))
    .map(r => (r.memberId === head.id ? r.relatedMemberId : r.memberId));
  const parentSide = [...spouseIds, head.id];
  const childIds = [...new Set(db.relations.filter(r => r.type === 'Parent' && parentSide.includes(r.memberId)).map(r => r.relatedMemberId))];
  const parentIds = db.relations.filter(r => r.type === 'Parent' && r.relatedMemberId === head.id).map(r => r.memberId);
  const make = (id: number, role: string) => {
    const m = db.members.find(x => x.id === id)!;
    return { id, name: `${m.firstName} ${m.lastName}`, role, birthDate: m.birthDate, civilStatus: m.civilStatus,
      churchName: db.churches.find(c => c.id === m.churchId)?.name ?? '', sacraments: sacramentsFor([id]) };
  };
  const inScope = (id: number) => scope.has(id);
  audit(ctx, 'FamilyReport', 'Member', head.id);
  return {
    head: make(head.id, 'Huvudperson'),
    spouses: spouseIds.filter(inScope).map(id => make(id, 'Make/maka')),
    children: childIds.filter(inScope).map(id => make(id, 'Barn')).sort((a, b) => a.birthDate.localeCompare(b.birthDate)),
    parents: parentIds.filter(inScope).map(id => make(id, 'Förälder')),
    address: `${head.street}, ${head.postalCode} ${head.postalTown}`,
    generatedAt: new Date().toISOString(), generatedBy: u.displayName
  };
});

// --- Granskningslogg
route('GET', '/api/audit', ctx => {
  if (requireUser(ctx).role !== 'Root') forbid();
  const p = ctx.url.searchParams;
  let list = db.audit;
  if (p.get('action')) list = list.filter(a => a.action === p.get('action'));
  if (p.get('user')) list = list.filter(a => a.userEmail?.includes(p.get('user')!));
  const page = Math.max(1, Number(p.get('page') ?? 1)), pageSize = Math.min(500, Number(p.get('pageSize') ?? 100));
  return { items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize };
});

// --- Publikt
route('GET', '/api/public/churches', () => db.churches.filter(c => c.acceptsPublicRegistration).map(c => {
  const city = db.cities.find(x => x.id === c.cityId)!;
  return { id: c.id, name: c.name, cityName: city.name, countyName: db.counties.find(x => x.id === city.countyId)?.name ?? '' };
}));
route('GET', '/api/public/kiosk/:code', ctx => {
  const c = db.churches.find(x => x.kioskCode === ctx.params[0]) ?? fail(404, 'Hittades inte');
  return { id: c.id, name: c.name, cityName: db.cities.find(x => x.id === c.cityId)?.name ?? '' };
});
route('GET', '/api/public/privacy', () => ({ version: POLICY_VERSION, controller: 'Kaldeisk-katolska missionen i Sverige', contactEmail: 'dataskydd@example.org', html: privacyHtml }));
route('POST', '/api/public/registrations', ctx => {
  const b = ctx.body;
  const ok = { message: 'Tack! Din registrering har tagits emot och kommer att granskas av församlingen.' };
  if (b.website) return ok;
  if (!b.consentGiven || b.policyVersion !== POLICY_VERSION) validation('consentGiven', 'Du behöver godkänna informationen om personuppgiftsbehandling.');
  const p = normalizePnr(b.personnummer) ?? validation('personnummer', 'Personnumret är inte giltigt. Skriv det som ÅÅÅÅMMDD-XXXX.');
  const church = b.kioskCode ? db.churches.find(c => c.kioskCode === b.kioskCode) : db.churches.find(c => c.id === b.churchId && c.acceptsPublicRegistration);
  if (!church) validation('churchId', 'Välj en kyrka.');
  for (const f of ['firstName', 'lastName', 'street', 'postalCode', 'postalTown']) if (!String(b[f] ?? '').trim()) validation(f, 'Obligatoriskt');
  const source: Source = b.kioskCode ? 'Kiosk' : 'PublicWeb';
  const existing = db.members.find(m => m.pnr === p.pnr && m.status !== 'Pending');
  let m = db.members.find(x => x.pnr === p.pnr && x.status === 'Pending');
  if (!m) { m = { id: nextId(), createdAt: new Date().toISOString() } as Member; db.members.push(m); }
  Object.assign(m, {
    firstName: b.firstName.trim(), lastName: b.lastName.trim(), street: b.street.trim(), postalCode: String(b.postalCode).replace(/\s/g, ''),
    postalTown: b.postalTown.trim(), email: b.email || null, phone: b.phone || null, pnr: p.pnr, birthDate: p.birth,
    civilStatus: b.civilStatus, status: 'Pending', source, churchId: church!.id, notes: null,
    possibleDuplicateOfId: existing?.id ?? null, updatedAt: new Date().toISOString()
  });
  db.consents.push({ id: nextId(), memberId: m.id, policyVersion: POLICY_VERSION, purpose: 'Medlemsregister och kyrkobok (art. 6.1 a, 9.2 a, 9.2 d)',
    givenAt: new Date().toISOString(), withdrawnAt: null, source });
  audit(null, 'PublicRegistration', 'Member', m.id, `Källa ${source}, kyrka ${church!.id}`);
  return ok;
});

// ------------------------------------------------------------------ fetch-avlyssning

async function handle(method: string, url: URL, headers: Headers, bodyText: string | null): Promise<Response> {
  db = load(); // läs om – en annan flik (t.ex. kiosken) kan ha ändrat datan
  const auth = headers.get('Authorization') ?? '';
  const tokenUserId = /^Bearer demo\.(\d+)\./.exec(auth)?.[1];
  const user = tokenUserId ? db.users.find(u => u.id === Number(tokenUserId) && u.isActive) ?? null : null;

  for (const [m, re, h] of routes) {
    if (m !== method) continue;
    const match = re.exec(url.pathname);
    if (!match) continue;
    const ctx: Ctx = { user, url, params: match.slice(1).map(decodeURIComponent), body: bodyText ? JSON.parse(bodyText) : {} };
    try {
      const result = h(ctx);
      save();
      if (result instanceof Response) return result;
      return result === undefined ? new Response(null, { status: 204 }) : json(result);
    } catch (e) {
      if (e instanceof HttpError) {
        save(); // spara t.ex. loggposter även vid fel
        return json({ title: e.message, status: e.status, ...e.extra }, e.status);
      }
      console.error('[demo-api]', e);
      return json({ title: 'Internt fel i demo-API:t' }, 500);
    }
  }
  return json({ title: `Okänd adress: ${method} ${url.pathname}` }, 404);
}

/** Installerar demo-API:t genom att ersätta window.fetch för anrop till /api/. */
export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input), window.location.href);
    const isApi = url.origin === window.location.origin && /\/api\//.test(url.pathname);
    if (!isApi) return realFetch(input, init);

    // Ta bort eventuell bas-sökväg (GitHub Pages: /Register_System_demo/admin/api/...).
    const apiUrl = new URL(url.pathname.slice(url.pathname.indexOf('/api/')) + url.search, window.location.origin);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers ?? req?.headers);
    const body = typeof init?.body === 'string' ? init.body : req ? await req.text() : null;
    await new Promise(r => setTimeout(r, 120)); // lite fördröjning så att det känns som ett riktigt API
    return handle(method, apiUrl, headers, body || null);
  };
  console.info('%cDemoläge: alla /api-anrop hanteras i webbläsaren med påhittad data.', 'color:#c9a04e;font-weight:bold');
}
