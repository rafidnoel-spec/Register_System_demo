import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Dict } from './i18n';
import { formatPersonnummer, isValidPersonnummer } from './personnummer';

export interface PublicChurch { id: number; name: string; cityName: string; countyName?: string }
interface Privacy { version: string; html: string }

type CivilStatus = 'Unmarried' | 'Married' | 'Divorced' | 'Widowed' | 'Separated';

const emptyForm = {
  firstName: '', lastName: '', personnummer: '', street: '', postalCode: '', postalTown: '',
  email: '', phone: '', civilStatus: 'Unmarried' as CivilStatus, churchId: '' as number | '', consent: false, website: ''
};

export default function RegistrationForm({ t, kioskCode, fixedChurch, onDone, onActivity }: {
  t: Dict;
  kioskCode?: string;
  fixedChurch?: PublicChurch;
  onDone: () => void;
  onActivity?: () => void;
}) {
  const [form, setForm] = useState({ ...emptyForm, churchId: fixedChurch?.id ?? ('' as number | '') });
  const [churches, setChurches] = useState<PublicChurch[]>([]);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isKiosk = !!kioskCode;

  useEffect(() => {
    fetch('/api/public/privacy').then(r => r.json()).then(setPrivacy).catch(() => setPrivacy(null));
    if (!fixedChurch) fetch('/api/public/churches').then(r => r.json()).then(setChurches).catch(() => setChurches([]));
  }, [fixedChurch]);

  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
    onActivity?.();
  };

  const validate = () => {
    const e: Record<string, string> = {};
    for (const k of ['firstName', 'lastName', 'street', 'postalTown'] as const) if (!form[k].trim()) e[k] = t.required;
    if (!isValidPersonnummer(form.personnummer)) e.personnummer = t.invalidPnr;
    if (!/^\d{3}\s?\d{2}$/.test(form.postalCode.trim())) e.postalCode = t.invalidPostal;
    if (!form.churchId) e.churchId = t.required;
    if (!form.consent) e.consent = t.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate() || !privacy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/public/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName, street: form.street,
          postalCode: form.postalCode, postalTown: form.postalTown,
          email: form.email || null, phone: form.phone || null,
          personnummer: form.personnummer, civilStatus: form.civilStatus, churchId: Number(form.churchId),
          consentGiven: form.consent, policyVersion: privacy.version, website: form.website, kioskCode: kioskCode ?? null
        })
      });
      if (res.status === 429) { setServerError(t.tooMany); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { errors?: Record<string, string[]> } | null;
        if (data?.errors) {
          const fieldErrors: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) {
            const key = k.charAt(0).toLowerCase() + k.slice(1);
            fieldErrors[key === 'consentGiven' ? 'consent' : key] = v.join(' ');
          }
          setErrors(fieldErrors);
        }
        setServerError(t.error);
        return;
      }
      setForm({ ...emptyForm, churchId: fixedChurch?.id ?? '' }); // rensa uppgifterna direkt
      onDone();
    } catch {
      setServerError(t.error);
    } finally {
      setBusy(false);
    }
  };

  // I kioskläge: stäng av autofyll/sparade uppgifter så att nästa besökare inte ser något.
  const ac = (normal: string) => (isKiosk ? 'off' : normal);
  const field = (k: keyof typeof emptyForm) => ({ 'aria-invalid': !!errors[k] || undefined });

  return (
    <form className={`reg-form ${isKiosk ? 'kiosk' : ''}`} onSubmit={submit} noValidate autoComplete={isKiosk ? 'off' : 'on'}>
      {serverError && <div className="alert error" role="alert">{serverError}</div>}

      {/* Honeypot – dold för människor */}
      <div className="hp" aria-hidden="true">
        <label>Website<input tabIndex={-1} value={form.website} onChange={e => set('website', e.target.value)} autoComplete="off" /></label>
      </div>

      <div className="row">
        <Field label={t.firstName} error={errors.firstName}>
          <input value={form.firstName} onChange={e => set('firstName', e.target.value)} autoComplete={ac('given-name')} maxLength={100} {...field('firstName')} />
        </Field>
        <Field label={t.lastName} error={errors.lastName}>
          <input value={form.lastName} onChange={e => set('lastName', e.target.value)} autoComplete={ac('family-name')} maxLength={100} {...field('lastName')} />
        </Field>
      </div>

      <Field label={t.personnummer} hint={t.personnummerHint} error={errors.personnummer}>
        <input value={form.personnummer} onChange={e => set('personnummer', formatPersonnummer(e.target.value))}
          inputMode="numeric" placeholder="ÅÅÅÅMMDD-XXXX" autoComplete="off" dir="ltr" {...field('personnummer')} />
      </Field>

      <Field label={t.street} error={errors.street}>
        <input value={form.street} onChange={e => set('street', e.target.value)} autoComplete={ac('street-address')} maxLength={200} {...field('street')} />
      </Field>
      <div className="row">
        <Field label={t.postalCode} error={errors.postalCode} narrow>
          <input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} inputMode="numeric" autoComplete={ac('postal-code')} maxLength={6} dir="ltr" {...field('postalCode')} />
        </Field>
        <Field label={t.postalTown} error={errors.postalTown}>
          <input value={form.postalTown} onChange={e => set('postalTown', e.target.value)} autoComplete={ac('address-level2')} maxLength={100} {...field('postalTown')} />
        </Field>
      </div>

      <div className="row">
        <Field label={t.email}>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} autoComplete={ac('email')} dir="ltr" />
        </Field>
        <Field label={t.phone}>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} autoComplete={ac('tel')} dir="ltr" />
        </Field>
      </div>

      <Field label={t.civilStatus}>
        <div className="segmented">
          {(Object.keys(t.civil) as CivilStatus[]).map(k => (
            <button type="button" key={k} className={form.civilStatus === k ? 'selected' : ''} onClick={() => set('civilStatus', k)}>
              {t.civil[k]}
            </button>
          ))}
        </div>
      </Field>

      {!fixedChurch && (
        <Field label={t.church} error={errors.churchId}>
          <select value={form.churchId} onChange={e => set('churchId', e.target.value ? Number(e.target.value) : '')} {...field('churchId')}>
            <option value="">{t.chooseChurch}</option>
            {churches.map(c => <option key={c.id} value={c.id}>{c.name} – {c.cityName}</option>)}
          </select>
        </Field>
      )}

      <div className={`consent ${errors.consent ? 'invalid' : ''}`}>
        <label>
          <input type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)} />
          <span>{t.consent}</span>
        </label>
        <button type="button" className="link" onClick={() => setShowPrivacy(true)}>{t.readPrivacy}</button>
      </div>

      <button className="primary submit" disabled={busy || !privacy}>{busy ? t.sending : t.submit}</button>

      {showPrivacy && privacy && (
        <div className="modal-backdrop" onClick={() => setShowPrivacy(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={t.privacyTitle} dir="ltr" lang="sv">
            <div className="privacy" dangerouslySetInnerHTML={{ __html: privacy.html }} />
            <p className="small muted">Version {privacy.version}</p>
            <button type="button" className="primary" onClick={() => setShowPrivacy(false)}>{t.close}</button>
          </div>
        </div>
      )}
    </form>
  );
}

function Field({ label, hint, error, narrow, children }: {
  label: string; hint?: string; error?: string; narrow?: boolean; children: ReactNode;
}) {
  return (
    <label className={`field ${narrow ? 'narrow' : ''} ${error ? 'has-error' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="error-text">{error}</span> : hint && <span className="hint">{hint}</span>}
    </label>
  );
}
