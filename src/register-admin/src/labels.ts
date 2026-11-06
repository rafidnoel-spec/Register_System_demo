import type { CivilStatus, MemberStatus, RegistrationSource, RelationType, SacramentType, UserRole } from './types';

export const roleLabels: Record<UserRole, string> = {
  Root: 'Root (hela organisationen)',
  County: 'Län',
  City: 'Stad',
  Church: 'Kyrka'
};

export const civilStatusLabels: Record<CivilStatus, string> = {
  Unmarried: 'Ogift',
  Married: 'Gift',
  Divorced: 'Skild',
  Widowed: 'Änka/änkling',
  Separated: 'Separerad'
};

export const memberStatusLabels: Record<MemberStatus, string> = {
  Pending: 'Väntar på godkännande',
  Active: 'Aktiv',
  Inactive: 'Inaktiv',
  Deceased: 'Avliden'
};

export const sourceLabels: Record<RegistrationSource, string> = {
  Admin: 'Administratör',
  PublicWeb: 'Webbformulär',
  Kiosk: 'Surfplatta i kyrkan'
};

export const sacramentLabels: Record<SacramentType, string> = {
  Baptism: 'Dop',
  FirstCommunion: 'Första kommunion',
  Confirmation: 'Konfirmation',
  Marriage: 'Vigsel',
  Ordination: 'Prästvigning',
  AnointingOfSick: 'De sjukas smörjelse',
  Funeral: 'Begravning'
};

export function relationLabel(type: RelationType, direction: 'outgoing' | 'incoming'): string {
  if (type === 'Spouse') return 'Make/maka';
  if (type === 'Parent') return direction === 'outgoing' ? 'Barn' : 'Förälder';
  return direction === 'outgoing' ? 'Gudbarn' : 'Gudförälder';
}

export const entries = <K extends string>(rec: Record<K, string>) => Object.entries(rec) as [K, string][];

export const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');
export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '';
