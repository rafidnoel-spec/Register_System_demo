export type UserRole = 'Root' | 'County' | 'City' | 'Church';
export type CivilStatus = 'Unmarried' | 'Married' | 'Divorced' | 'Widowed' | 'Separated';
export type MemberStatus = 'Pending' | 'Active' | 'Inactive' | 'Deceased';
export type RegistrationSource = 'Admin' | 'PublicWeb' | 'Kiosk';
export type RelationType = 'Spouse' | 'Parent' | 'Godparent';
export type SacramentType =
  | 'Baptism' | 'FirstCommunion' | 'Confirmation' | 'Marriage' | 'Ordination' | 'AnointingOfSick' | 'Funeral';

export interface User {
  id: number; email: string; displayName: string; role: UserRole;
  countyId: number | null; cityId: number | null; churchId: number | null;
  scopeName: string | null; isActive: boolean; lastLoginAt: string | null;
}

export interface County { id: number; name: string; cityCount: number }
export interface City { id: number; name: string; countyId: number; countyName: string; churchCount: number }
export interface Church {
  id: number; name: string; address: string | null; cityId: number; cityName: string; countyId: number; countyName: string;
  acceptsPublicRegistration: boolean; kioskCode: string; memberCount: number;
}
export interface Priest { id: number; name: string; churchId: number | null; churchName: string | null; isActive: boolean }

export interface MemberListItem {
  id: number; firstName: string; lastName: string; personnummerMasked: string; birthDate: string; age: number;
  street: string; postalCode: string; postalTown: string; civilStatus: CivilStatus; status: MemberStatus;
  churchId: number; churchName: string; cityName: string; source: RegistrationSource;
  possibleDuplicateOfId: number | null; createdAt: string;
}

export interface Relation {
  id: number; type: RelationType; direction: 'outgoing' | 'incoming'; otherMemberId: number; otherMemberName: string;
  fromDate: string | null; toDate: string | null;
}

export interface Sacrament {
  id: number; memberId: number; type: SacramentType; date: string; churchId: number | null; churchName: string | null;
  priestId: number | null; priestName: string | null; spouseMemberId: number | null; spouseName: string | null;
  godparents: string | null; registerReference: string | null; notes: string | null;
}

export interface Consent { id: number; policyVersion: string; purpose: string; givenAt: string; withdrawnAt: string | null; source: RegistrationSource }

export interface MemberDetail {
  id: number; firstName: string; lastName: string; personnummerMasked: string; birthDate: string;
  street: string; postalCode: string; postalTown: string; email: string | null; phone: string | null;
  civilStatus: CivilStatus; status: MemberStatus; churchId: number; churchName: string; notes: string | null;
  source: RegistrationSource; possibleDuplicateOfId: number | null; createdAt: string; updatedAt: string;
  relations: Relation[]; sacraments: Sacrament[]; consents: Consent[];
}

export interface MemberFilter {
  countyId?: number; cityId?: number; churchId?: number; civilStatus?: CivilStatus; status?: MemberStatus;
  hasSacrament?: SacramentType; missingSacrament?: SacramentType; minAge?: number; maxAge?: number;
  search?: string; sortBy?: string; page?: number; pageSize?: number;
}

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

export interface FamilyMember {
  id: number; name: string; role: string; birthDate: string; civilStatus: CivilStatus; churchName: string; sacraments: Sacrament[];
}
export interface FamilyReport {
  head: FamilyMember; spouses: FamilyMember[]; children: FamilyMember[]; parents: FamilyMember[];
  address: string; generatedAt: string; generatedBy: string;
}

export interface AuditEntry {
  id: number; at: string; userEmail: string | null; action: string; entityType: string; entityId: string | null;
  details: string | null; ipAddress: string | null;
}
