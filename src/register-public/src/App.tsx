import { useCallback, useEffect, useRef, useState } from 'react';
import { dictionaries, languages, type Dict, type Lang } from './i18n';
import RegistrationForm, { type PublicChurch } from './RegistrationForm';

function LanguagePicker({ lang, setLang, large }: { lang: Lang; setLang: (l: Lang) => void; large?: boolean }) {
  return (
    <div className={`langs ${large ? 'large' : ''}`}>
      {languages.map(l => (
        <button key={l.code} type="button" className={l.code === lang ? 'selected' : ''} onClick={() => setLang(l.code)} lang={l.code}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function useLang(): [Lang, (l: Lang) => void, Dict] {
  const [lang, setLang] = useState<Lang>('sv');
  useEffect(() => {
    const def = languages.find(l => l.code === lang)!;
    document.documentElement.lang = lang;
    document.documentElement.dir = def.dir;
  }, [lang]);
  return [lang, setLang, dictionaries[lang]];
}

export default function App() {
  // Stöder både /kiosk/<kod> och #/kiosk/<kod> (det senare används på GitHub Pages).
  const path = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : window.location.pathname;
  const match = /\/kiosk\/([a-f0-9]{16,64})\/?$/i.exec(path);
  return (
    <>
      {import.meta.env.VITE_DEMO === 'true' && <DemoBanner />}
      {match ? <KioskApp code={match[1]} /> : <WebApp />}
    </>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner">
      DEMO – påhittade uppgifter. Det du skriver sparas bara i din webbläsare och syns under
      {' '}<a href="../admin/#/pending">Nya registreringar i administrationen</a>.
    </div>
  );
}

/** Vanlig webbregistrering (länk från hemsida, QR-kod m.m.). */
function WebApp() {
  const [lang, setLang, t] = useLang();
  const [done, setDone] = useState(false);

  return (
    <div className="page">
      <header className="top">
        <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Kaldeisk-katolska missionen Södertälje" className="logo" />
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <LanguagePicker lang={lang} setLang={setLang} />
      </header>
      <main className="card">
        {done ? (
          <div className="thanks">
            <div className="check-icon">✓</div>
            <h2>{t.thanks}</h2>
            <p>{t.thanksText}</p>
            <button className="primary" onClick={() => setDone(false)}>{t.newRegistration}</button>
          </div>
        ) : (
          <RegistrationForm t={t} onDone={() => setDone(true)} />
        )}
      </main>
    </div>
  );
}

const IDLE_WARNING_MS = 90_000;   // varning efter 90 s utan aktivitet
const IDLE_RESET_MS = 20_000;     // rensa 20 s efter varningen
const THANKS_MS = 10_000;         // tackskärmen visas i 10 s

/**
 * Kioskläge för surfplattan vid kyrkdörren: stora knappar, kyrkan är förvald,
 * formuläret rensas automatiskt efter inaktivitet och efter varje registrering.
 */
function KioskApp({ code }: { code: string }) {
  const [lang, setLang, t] = useLang();
  const [church, setChurch] = useState<PublicChurch | null | 'invalid'>(null);
  const [screen, setScreen] = useState<'welcome' | 'form' | 'thanks'>('welcome');
  const [formKey, setFormKey] = useState(0);
  const [idleWarning, setIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const idleTimer = useRef<number>(0);
  const resetTimer = useRef<number>(0);

  useEffect(() => {
    fetch(`/api/public/kiosk/${code}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setChurch)
      .catch(() => setChurch('invalid'));
  }, [code]);

  const reset = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    window.clearTimeout(resetTimer.current);
    setIdleWarning(false);
    setFormKey(k => k + 1); // ny instans = alla fält tomma
    setScreen('welcome');
    setLang('sv');
    window.scrollTo(0, 0);
  }, [setLang]);

  const activity = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    window.clearTimeout(resetTimer.current);
    setIdleWarning(false);
    idleTimer.current = window.setTimeout(() => {
      setIdleWarning(true);
      resetTimer.current = window.setTimeout(reset, IDLE_RESET_MS);
    }, IDLE_WARNING_MS);
  }, [reset]);

  useEffect(() => {
    if (screen !== 'form') return;
    activity();
    const events = ['touchstart', 'keydown', 'mousedown'];
    events.forEach(e => window.addEventListener(e, activity, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, activity));
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(resetTimer.current);
    };
  }, [screen, activity]);

  useEffect(() => {
    if (screen !== 'thanks') return;
    setCountdown(THANKS_MS / 1000);
    const iv = window.setInterval(() => setCountdown(c => c - 1), 1000);
    const to = window.setTimeout(reset, THANKS_MS);
    return () => { window.clearInterval(iv); window.clearTimeout(to); };
  }, [screen, reset]);

  if (church === null) return <div className="kiosk center"><img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="" className="kiosk-logo" /></div>;
  if (church === 'invalid') return <div className="kiosk center"><p className="alert error">{t.invalidKiosk}</p></div>;

  return (
    <div className="kiosk">
      {screen === 'welcome' && (
        <div className="center welcome" onClick={() => setScreen('form')}>
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Kaldeisk-katolska missionen Södertälje" className="kiosk-logo" />
          <h1>{t.kioskWelcome}</h1>
          <p className="lead">{t.kioskSubtitle}</p>
          <p className="church-name">{church.name}</p>
          <div onClick={e => e.stopPropagation()}><LanguagePicker lang={lang} setLang={setLang} large /></div>
          <button className="primary huge" onClick={() => setScreen('form')}>{t.start}</button>
        </div>
      )}

      {screen === 'form' && (
        <div className="kiosk-form">
          <header className="kiosk-header">
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="" />
            <div><h1>{t.title}</h1><p>{church.name}</p></div>
            <button className="ghost" onClick={reset}>{t.cancel}</button>
          </header>
          <RegistrationForm key={formKey} t={t} kioskCode={code} fixedChurch={church}
            onActivity={activity} onDone={() => setScreen('thanks')} />
        </div>
      )}

      {screen === 'thanks' && (
        <div className="center thanks" onClick={reset}>
          <div className="check-icon">✓</div>
          <h1>{t.thanks}</h1>
          <p className="lead">{t.thanksText}</p>
          <p className="muted">{t.restartIn.replace('{s}', String(Math.max(0, countdown)))}</p>
        </div>
      )}

      {idleWarning && (
        <div className="modal-backdrop">
          <div className="modal center">
            <p className="lead">{t.stillThere}</p>
            <div className="row-buttons">
              <button className="ghost" onClick={reset}>{t.cancel}</button>
              <button className="primary" onClick={activity}>{t.continue}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
