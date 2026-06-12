import React, { useEffect, useMemo, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { bedrockChatAnfrage, createAWS, deleteAWS, erstelleEinladungsauftrag, ftpUploadInserat, ladeAWSArbeitsdaten, ladeKontaktPersonenAWS, sendePushBenachrichtigung, sendeEmail, updateAWS } from './awsService';
import type { ChatMessage, KIAktion } from './awsService';
import { uploadData, getUrl } from 'aws-amplify/storage';
import './App.css';

type View = 'dashboard' | 'liegenschaften' | 'liegenschaftDetail' | 'personDetail' | 'faelle' | 'fallDetail' | 'kalender' | 'handwerker' | 'handwerkerDetail' | 'formulare' | 'inserate' | 'mitarbeiter' | 'myProfile' | 'internChat' | 'externChat' | 'urlaubskalender' | 'statistiken' | 'suche' | 'portal' | 'customerPicker' | 'kiAssistent' | 'papierkorb';
type RoleMode = 'staff' | 'customer';
type AnyRecord = Record<string, any>;

type PropertyTab = 'Übersicht' | 'Stammdaten' | 'Objekte' | 'Parteien' | 'Meldungen' | 'Termine' | 'Dokumente' | 'Abschlüsse' | 'Schlüssel' | 'Geräte' | 'Chat' | 'Historie';
type CaseTab = 'Übersicht' | 'Chat' | 'Bilder' | 'Handwerker' | 'Termine' | 'Dokumente' | 'Verlauf';
type WorkerTab = 'Stammdaten' | 'Auslastung' | 'Aktuell' | 'Verlauf' | 'Termine' | 'Schlüssel' | 'Dokumente';
type EmployeeTab = 'Übersicht' | 'Stammdaten' | 'Dokumente' | 'Lohn' | 'Rollen & Rechte' | 'Historie';

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();
const thisYear = new Date().getFullYear();
const belegIdForDocument = (doc: AnyRecord) => (
  doc.belegId ||
  (doc.personId ? `bel-${doc.personId}-${doc.id ?? uid()}` : undefined)
);
const deDate = (value?: string) => value ? new Date(value).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const initials = (name?: string) => (name || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

const seed = {
  Liegenschaft: [],
  KontaktPerson: [],
  Mitarbeiter: [
    { id: 'ma-bootstrap-admin', name: 'Systemadministration', funktion: 'Administration', email: 'admin@example.invalid', telefon: '', rolle: 'Admin', gruppe: 'CEO / Geschäftsführung', rechteExtra: ['*'], rechteEntzogen: [], status: 'Aktiv', teamSichtbar: false, teamSortierung: 1, photoUrl: '' },
  ],
  Rolle: [
    { id: 'r-ceo',           name: 'CEO / Geschäftsführung',  beschreibung: 'Vollzugriff — Geschäftsleitung und Administration', rechte: ['*'] },
    { id: 'r-bew',           name: 'Bewirtschaftung',          beschreibung: 'Liegenschaften, Meldungen, Termine, Handwerker, Kundenportal', rechte: ['dashboard:lesen','liegenschaften:lesen','liegenschaften:bearbeiten','parteien:bearbeiten','schluessel:bearbeiten','meldungen:lesen','meldungen:bearbeiten','meldungen:loeschen','meldungen:pdf','kalender:lesen','kalender:bearbeiten','handwerker:lesen','handwerker:bearbeiten','dokumente:lesen','dokumente:bearbeiten','kundenansicht:oeffnen','externchat:lesen','inserate:lesen','inserate:bearbeiten','suche:lesen'] },
    { id: 'r-hr',            name: 'HR',                       beschreibung: 'Personal, Lohn, Mitarbeiterdokumente und Urlaubsverwaltung', rechte: ['dashboard:lesen','mitarbeiter:lesen','mitarbeiter:bearbeiten','lohn:lesen','lohn:bearbeiten','dokumente:lesen','dokumente:bearbeiten','rechte:lesen','suche:lesen'] },
    { id: 'r-buchhaltung',   name: 'Buchhaltung',              beschreibung: 'Abschlüsse, Finanzdokumente und Liegenschaftsübersicht', rechte: ['dashboard:lesen','liegenschaften:lesen','dokumente:lesen','dokumente:bearbeiten','abschluesse:lesen','abschluesse:bearbeiten','suche:lesen'] },
    { id: 'r-support',       name: 'Support',                  beschreibung: 'Kundenansicht, App-Inhalte und einfache Meldungsbearbeitung', rechte: ['dashboard:lesen','liegenschaften:lesen','meldungen:lesen','meldungen:bearbeiten','dokumente:lesen','portal:lesen','portal:bearbeiten','kundenansicht:oeffnen','externchat:lesen','suche:lesen'] },
    { id: 'r-dev-buchhaltung', name: 'Buchhaltung & Entwicklung', beschreibung: 'Buchhaltung plus technische Administration und Portalpflege', rechte: ['dashboard:lesen','liegenschaften:lesen','liegenschaften:bearbeiten','meldungen:lesen','meldungen:bearbeiten','kalender:lesen','kalender:bearbeiten','handwerker:lesen','handwerker:bearbeiten','dokumente:lesen','dokumente:bearbeiten','abschluesse:lesen','abschluesse:bearbeiten','mitarbeiter:lesen','mitarbeiter:bearbeiten','lohn:lesen','rechte:lesen','portal:lesen','portal:bearbeiten','kundenansicht:oeffnen','suche:lesen','externchat:lesen','inserate:lesen','inserate:bearbeiten','system:entwicklung'] },
  ],
  Schadenfall: [],
  ChatMessage: [],
  Dokument: [],
  KalenderTermin: [],
  Handwerker: [],
  Schluessel: [],
  Abschluss: [],
  PortalInhalt: [],
  StammdatenAenderung: [],
  Einladung: [],
  MitarbeiterDokument: [],
  DokumentVorlage: [],
} as Record<string, AnyRecord[]>;

// ── Login-Modi: Landingpage → Kunde oder Mitarbeiter ──────────────────────────

type LoginModus = 'auswahl' | 'login';

const PortalLoginHeader = ({ onZurueck }: { onZurueck: () => void }) => (
  <div className="login-screen-header">
    <button onClick={onZurueck} style={{ background: 'none', border: 'none', color: '#8290a7', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
      ← Zurück
    </button>
    <img className="login-logo" src="/logo-immobilientool.svg" alt="Immobilientool" style={{ width: 160, background: '#fff', borderRadius: 12, padding: '8px 14px', marginBottom: 16 }} />
    <div className="login-copy">
      <h1>Anmelden</h1>
      <p>Melden Sie sich mit Ihren Zugangsdaten an. Mieter, Eigentümer und Mitarbeitende nutzen denselben Zugang.</p>
    </div>
  </div>
);

const LoginFooter = () => (
  <div className="login-screen-footer">
    <p>Noch kein Zugang? Kontaktieren Sie uns: <strong>+41 00 000 00 00</strong> · <strong>info@example.invalid</strong></p>
  </div>
);

const getPersistedState = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return (typeof fallback === 'string' ? raw : fallback) as T;
  }
};

const persistState = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

function PortalLandingPage({ onAnmelden }: { onAnmelden: () => void }) {
  return (
    <div className="landing-shell">
      <div className="landing-content">
        {/* Logo */}
        <img src="/logo-immobilientool.svg" alt="Immobilientool" className="landing-logo" />

        {/* Hero */}
        <div className="landing-hero">
          <span className="landing-kicker">Ihr persönliches Mieterportal</span>
          <h1 className="landing-h1">Willkommen bei<br />Immobilientool</h1>
          <p className="landing-sub">
            Verwalten Sie Ihre Unterlagen, stellen Sie Meldungen und bleiben Sie stets informiert — direkt online oder in der App.
          </p>
          <button className="landing-cta" onClick={onAnmelden}>
            Jetzt anmelden
            <span className="landing-cta-arrow">→</span>
          </button>
          <p className="landing-cta-hint">Für Mieter & Eigentümer · Zugangsdaten erhalten Sie von Ihrer Verwaltung</p>
        </div>

        {/* Feature-Cards */}
        <div className="landing-features">
          {[
            { icon: '📄', title: 'Unterlagen', text: 'Hausordnung, Nebenkostenabrechnung und weitere Dokumente jederzeit verfügbar.' },
            { icon: '⚠️', title: 'Meldungen', text: 'Schäden und Anliegen direkt und unkompliziert melden.' },
            { icon: '📅', title: 'Termine', text: 'Handwerker- und Verwaltungstermine auf einen Blick.' },
            { icon: '💬', title: 'Kontakt', text: 'Direkte Kommunikation mit der Verwaltung via Chat.' },
          ].map(f => (
            <div key={f.title} className="landing-feature-card">
              <span className="landing-feature-icon">{f.icon}</span>
              <strong>{f.title}</strong>
              <p>{f.text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <span>Immobilientool</span>
          <span>Musterstrasse 1, 4000 Basel</span>
          <a href="tel:+41000000000">+41 00 000 00 00</a>
          <a href="mailto:info@example.invalid">info@example.invalid</a>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>(() => getPersistedState<View>('portal:view', 'dashboard'));
  const [data, setData] = useState<Record<string, AnyRecord[]>>(seed);
  const [cloudStatus, setCloudStatus] = useState('AWS lädt ...');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(() => getPersistedState<string>('portal:selectedPropertyId', ''));
  const [propertyTab, setPropertyTab] = useState<PropertyTab>(() => getPersistedState<PropertyTab>('portal:propertyTab', 'Übersicht'));
  const [selectedPersonId, setSelectedPersonId] = useState<string>(() => getPersistedState<string>('portal:selectedPersonId', ''));
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(seed.Mitarbeiter[0].id);
  const [ownEmployeeId, setOwnEmployeeId] = useState<string>(() => getPersistedState<string>('portal:ownEmployeeId', seed.Mitarbeiter[0].id));
  const [actingEmployeeId, setActingEmployeeId] = useState<string>(() => getPersistedState<string>('portal:actingEmployeeId', seed.Mitarbeiter[0].id));
  const [customerViewId, setCustomerViewId] = useState<string>(() => getPersistedState<string>('portal:customerViewId', ''));
  const [mode, setMode] = useState<RoleMode>(() => getPersistedState<RoleMode>('portal:mode', 'staff'));
  const [search, setSearch] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<AnyRecord | null>(null);
  const [loginModus, setLoginModus] = useState<LoginModus>(() =>
    (localStorage.getItem('portal:loginModus') as LoginModus | null) ?? 'auswahl'
  );

  const setLoginModusPersist = (m: LoginModus) => {
    localStorage.setItem('portal:loginModus', m);
    setLoginModus(m);
  };

  useEffect(() => {
    persistState('portal:view', view);
    persistState('portal:selectedPropertyId', selectedPropertyId);
    persistState('portal:propertyTab', propertyTab);
    persistState('portal:selectedPersonId', selectedPersonId);
    persistState('portal:customerViewId', customerViewId);
    persistState('portal:mode', mode);
    persistState('portal:ownEmployeeId', ownEmployeeId);
    persistState('portal:actingEmployeeId', actingEmployeeId);
  }, [view, selectedPropertyId, propertyTab, selectedPersonId, customerViewId, mode, ownEmployeeId, actingEmployeeId]);

  useEffect(() => {
    let active = true;
    ladeAWSArbeitsdaten().then((result) => {
      if (!active) return;
      const merged = { ...seed } as Record<string, AnyRecord[]>;
      const failedModels = new Set(result.errors.map((error) => error.split(':')[0]));
      Object.entries(result.data).forEach(([key, value]) => {
        if (Array.isArray(value) && !failedModels.has(key)) {
          merged[key] = value;
        }
      });
      setData(merged);
      setCloudStatus(result.ok ? 'AWS verbunden' : 'AWS verbunden · Schema teilweise Fallback');
    }).catch(() => setCloudStatus('Lokaler Fallback'));
    return () => { active = false; };
  }, []);

  const staffData = data.Mitarbeiter?.length ? data.Mitarbeiter : seed.Mitarbeiter;
  const employeeIds = staffData.map((m: AnyRecord) => `${m.id}:${m.email ?? ''}:${m.name ?? ''}`).join('|');
  const ownEmployee = staffData.find((m: AnyRecord) => m.id === ownEmployeeId) ?? staffData[0];
  const currentEmployee = staffData.find((m: AnyRecord) => m.id === actingEmployeeId) ?? ownEmployee ?? staffData[0];
  const currentCustomer = data.KontaktPerson.find(p => p.id === customerViewId);
  const currentRights = effectiveRightsFor(data, currentEmployee);
  const isActingAsOther = Boolean(ownEmployee?.id && currentEmployee?.id && ownEmployee.id !== currentEmployee.id);
  const navStaff = STAFF_NAV.filter(([id]) => canAccessView(id, currentRights));

  const papierkorbCount = useMemo(() => {
    const istGeloescht = (item: AnyRecord, field: string) =>
      String(item[field] ?? '').startsWith('[GELÖSCHT]') || item.status === 'Gelöscht';
    return [
      ...(data.Handwerker ?? []).filter(h => istGeloescht(h, 'firma')),
      ...(data.Liegenschaft ?? []).filter(h => istGeloescht(h, 'name')),
      ...(data.KontaktPerson ?? []).filter(h => istGeloescht(h, 'name')),
      ...(data.Schadenfall ?? []).filter(h => String(h.titel ?? '').startsWith('[GELÖSCHT]')),
      ...(data.Mitarbeiter ?? []).filter(h => istGeloescht(h, 'name')),
      ...(data.Dokument ?? []).filter(h => String(h.titel ?? '').startsWith('[GELÖSCHT]')),
    ].length;
  }, [data]);
  const defaultStaffView = navStaff[0]?.[0] ?? 'dashboard';
  const canOpenCustomerPicker = hasRight(currentRights, 'kundenansicht:oeffnen');
  const canCreateCase = hasRight(currentRights, 'meldungen:bearbeiten');
  const canOpenEmployeeArea = hasRight(currentRights, 'mitarbeiter:lesen') || hasRight(currentRights, 'rechte:lesen');

  useEffect(() => {
    if (!staffData.some((m: AnyRecord) => m.id === actingEmployeeId) && ownEmployee?.id) {
      setActingEmployeeId(ownEmployee.id);
    }
  }, [employeeIds, ownEmployee?.id, ownEmployeeId, actingEmployeeId]);

  useEffect(() => {
    if (mode !== 'staff') return;
    if (!canAccessView(view, currentRights)) {
      setView(defaultStaffView);
    }
  }, [mode, view, defaultStaffView, currentRights.join('|')]);

  const upsertLocal = (model: string, item: AnyRecord) => setData((old) => ({
  ...old,
  [model]: old[model]?.some((x) => x.id === item.id)
    ? old[model].map((x) => x.id === item.id ? { ...x, ...item } : x)
    : [item, ...(old[model] ?? [])]
}));

const removeLocal = (model: string, id: string) => setData((old) => ({
  ...old,
  [model]: (old[model] ?? []).filter((item) => item.id !== id),
}));

const refreshKontaktPersonen = async () => {
  const personen = await ladeKontaktPersonenAWS();
  setData((old) => ({ ...old, KontaktPerson: personen }));
  setCloudStatus('AWS verbunden');
  return personen;
};

const cleanForAWS = (model: keyof typeof seed, item: AnyRecord) => {
  const {
    createdAt,
    updatedAt,
    __typename,
    ...clean
  } = item;

  const withBelegId = model === 'Dokument'
    ? { ...clean, belegId: belegIdForDocument(clean) }
    : clean;

  const payload = model === 'Liegenschaft'
    ? propertyPayload(withBelegId)
    : model === 'Schadenfall'
      ? casePayload(withBelegId)
      : model === 'KontaktPerson'
        ? personPayload(withBelegId)
      : withBelegId;

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
};

const save = async (model: keyof typeof seed, item: AnyRecord) => {
  const preparedItem = model === 'Dokument'
    ? { ...item, belegId: belegIdForDocument(item) }
    : item;
  const localPayload = { ...preparedItem, updatedAt: nowIso() };
  const existsBeforeSave = data[model]?.some((entry: AnyRecord) => entry.id === preparedItem.id);

  upsertLocal(model, localPayload);

  try {
    const awsPayload = cleanForAWS(model, preparedItem);

    let saved;

    if (existsBeforeSave) {
      try {
        saved = await updateAWS(model, awsPayload);
      } catch {
        saved = await createAWS(model, awsPayload);
      }
    } else {
      saved = await createAWS(model, awsPayload);
    }

    if (saved?.id) {
      upsertLocal(model, saved);
    }

    setCloudStatus('AWS verbunden');

    // ── Push-Benachrichtigungen ────────────────────────────────────────────
    try {
      if (model === 'Schadenfall' && item.personId) {
        const prevStatus = data['Schadenfall']?.find((f: AnyRecord) => f.id === item.id)?.status;
        const newStatus = statusValue(item.status);
        const statusChanged = prevStatus && statusValue(prevStatus) !== newStatus;
        if (statusChanged || !existsBeforeSave) {
          const label = statusLabel(newStatus);
          sendePushBenachrichtigung({
            empfaengerId: item.personId,
            empfaengerTyp: 'kunde',
            titel: `Meldung ${item.fallNummer ?? ''} · ${label}`,
            nachricht: item.titel ?? 'Ihr Status hat sich geändert.',
            daten: { fallId: item.id, status: newStatus },
          }).catch(() => {});
        }
      }

      if (model === 'ChatMessage') {
        if (item.absenderTyp === 'mitarbeiter' && item.personId) {
          sendePushBenachrichtigung({
            empfaengerId: item.personId,
            empfaengerTyp: 'kunde',
            titel: 'Neue Nachricht von Immobilientool',
            nachricht: String(item.nachricht ?? '').slice(0, 120),
            daten: { fallId: item.schadenfallId },
          }).catch(() => {});
        } else if (item.absenderTyp === 'kunde') {
          sendePushBenachrichtigung({
            empfaengerTyp: 'alle-mitarbeiter',
            titel: `Neue Kundennachricht`,
            nachricht: String(item.nachricht ?? '').slice(0, 120),
            daten: { fallId: item.schadenfallId },
          }).catch(() => {});
        }
      }

      if (model === 'PortalInhalt') {
        sendePushBenachrichtigung({
          empfaengerTyp: 'alle-mitarbeiter',
          titel: 'Portal Info aktualisiert',
          nachricht: `${item.titel ?? 'Inhalt'} wurde aktualisiert.`,
        }).catch(() => {});
      }
    } catch { /* Push-Fehler sind nicht kritisch */ }

    return { ok: true, saved };
  } catch (error) {
    setCloudStatus('Speichern fehlgeschlagen · AWS prüfen');
    console.error('AWS SAVE ERROR:', model, item, error);
    return { ok: false, error };
  }
};

const remove = async (model: keyof typeof seed, id: string) => {
  const existing = data[model]?.find((entry: AnyRecord) => entry.id === id);
  removeLocal(model, id);

  try {
    await deleteAWS(model, id);
    setCloudStatus('AWS verbunden');
    return { ok: true };
  } catch (error) {
    if (existing) upsertLocal(model, existing);
    setCloudStatus('Löschen fehlgeschlagen · AWS prüfen');
    console.error('AWS DELETE ERROR:', model, id, error);
    return { ok: false, error };
  }
};

  // Landingpage — vor dem Login
  if (loginModus === 'auswahl') {
    return <PortalLandingPage onAnmelden={() => setLoginModusPersist('login')} />;
  }

  return (
    <Authenticator
      hideSignUp
      components={{
        SignIn: {
          Header: () => <PortalLoginHeader onZurueck={() => setLoginModusPersist('auswahl')} />,
          Footer: () => <LoginFooter />,
        },
      }}
    >
      {({ signOut, user }) => {
        // Eingeloggten Mitarbeiter anhand der E-Mail eindeutig erkennen
        const userEmail = (user?.signInDetails?.loginId ?? '').toLowerCase();
        const matchedEmployee = staffData.find((m: AnyRecord) =>
          String(m.email ?? '').toLowerCase() === userEmail
        );
        if (matchedEmployee?.id && matchedEmployee.id !== ownEmployeeId) {
          Promise.resolve().then(() => {
            setOwnEmployeeId(matchedEmployee.id);
            setActingEmployeeId(matchedEmployee.id);
            setSelectedEmployeeId(matchedEmployee.id);
          });
        }

        // Auto-Rollen-Erkennung: Ist die eingeloggte Person ein Mitarbeiter oder Kunde?
        if (mode !== 'customer') {
          const istMitarbeiter = !!matchedEmployee;

          if (!istMitarbeiter) {
            const kundenPerson = data.KontaktPerson.find((p: AnyRecord) =>
              String(p.email ?? '').toLowerCase() === userEmail &&
              !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? '')
            );
            if (kundenPerson && !customerViewId) {
              setTimeout(() => {
                setCustomerViewId(kundenPerson.id);
                setMode('customer');
              }, 0);
            }
          }
        }

        return (
        <div className={`app-shell ${mode === 'customer' ? 'customer-mode' : ''}`}>
          {mode === 'staff' && <aside className="sidebar">
            <img className="logo" src="/logo-immobilientool.svg" alt="Immobilientool" />
            <nav>{navStaff.map(([id, label, icon]) => (
              <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
                <Icon name={icon} />{label}
                {id === 'papierkorb' && papierkorbCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{papierkorbCount}</span>
                )}
              </button>
            ))}</nav>
            <div className="sidebar-bottom">
              {currentEmployee && (
                <button className={`sidebar-profile ${view === 'myProfile' ? 'active' : ''}`} onClick={() => setView('myProfile')}>
                  <Avatar name={currentEmployee.name} url={currentEmployee.photoUrl} />
                  <span>
                    <strong>{currentEmployee.name}</strong>
                    <small>{currentEmployee.funktion || currentEmployee.gruppe || 'Mein Profil'}</small>
                  </span>
                </button>
              )}
              <div className="cloud">{cloudStatus}</div>
            </div>
          </aside>}
          <section className="main">
            <header className="topbar">
              <div className="top-title">
                <strong>{mode === 'customer' && currentCustomer ? `Kundenansicht: ${personDisplayName(currentCustomer)}` : isActingAsOther ? `Mitarbeiteransicht: ${currentEmployee?.name}` : 'Mitarbeiteransicht'}</strong>
                <span>{mode === 'customer' ? 'Sie sehen exakt die Kunden-/App-Sicht.' : isActingAsOther ? `Vorschau aktiv · zurück möglich zu ${ownEmployee?.name}` : 'Internes IMMOBILIENTOOL Verwaltungsportal'}</span>
              </div>
              <div className="top-actions">
                {mode === 'staff' && isActingAsOther && ownEmployee && (
                  <button className="return-self" onClick={() => { setActingEmployeeId(ownEmployee.id); setSelectedEmployeeId(ownEmployee.id); setView('dashboard'); }}>
                    Zurück zu mir
                  </button>
                )}
                {mode === 'staff' && canOpenCustomerPicker && <button onClick={() => setView('customerPicker')}>Eigentümer-/Mieteransicht wählen</button>}
                {mode === 'customer' && <button onClick={() => { setMode('staff'); setCustomerViewId(''); setView('dashboard'); }}>Zurück zur Mitarbeiteransicht</button>}
                {canCreateCase && <button onClick={() => setView('faelle')}>Neue Meldung</button>}
                {canOpenEmployeeArea ? (
                  <button className="profile" onClick={() => { setSelectedEmployeeId(currentEmployee?.id ?? selectedEmployeeId); setView('mitarbeiter'); }}><Avatar name={currentEmployee?.name ?? user?.signInDetails?.loginId ?? 'User'} url={currentEmployee?.photoUrl} /> <span>{currentEmployee?.name ?? user?.signInDetails?.loginId}</span></button>
                ) : (
                  <div className="profile"><Avatar name={currentEmployee?.name ?? user?.signInDetails?.loginId ?? 'User'} url={currentEmployee?.photoUrl} /> <span>{currentEmployee?.name ?? user?.signInDetails?.loginId}</span></div>
                )}
                <button onClick={() => {
                  // Alle account-spezifischen Zustände beim Abmelden zurücksetzen
                  localStorage.removeItem('portal:ownEmployeeId');
                  localStorage.removeItem('portal:actingEmployeeId');
                  localStorage.removeItem('portal:selectedEmployeeId');
                  setOwnEmployeeId(seed.Mitarbeiter[0].id);
                  setActingEmployeeId(seed.Mitarbeiter[0].id);
                  setLoginModusPersist('auswahl');
                  setMode('staff');
                  setCustomerViewId('');
                  signOut?.();
                }}>Abmelden</button>
              </div>
            </header>
            {mode === 'customer' && currentCustomer ? <CustomerPortal data={data} customer={currentCustomer} save={save} /> : <>
              {!canAccessView(view, currentRights) && <AccessDenied />}
              {view === 'dashboard' && canAccessView(view, currentRights) && <Dashboard data={data} rights={currentRights} employee={currentEmployee} setView={setView} setSelectedPropertyId={setSelectedPropertyId} setSelectedCaseId={setSelectedCaseId} />}
              {view === 'liegenschaften' && canAccessView(view, currentRights) && <PropertyList data={data} save={save} setView={setView} setSelectedPropertyId={setSelectedPropertyId} setPropertyDraft={setPropertyDraft} />}
              {view === 'liegenschaftDetail' && canAccessView(view, currentRights) && <PropertyDetailPage data={data} selectedPropertyId={selectedPropertyId} propertyDraft={propertyDraft} setPropertyDraft={setPropertyDraft} tab={propertyTab} setTab={setPropertyTab} save={save} remove={remove} refreshKontaktPersonen={refreshKontaktPersonen} setView={setView} setSelectedPersonId={setSelectedPersonId} setSelectedCaseId={setSelectedCaseId} setSelectedWorkerId={setSelectedWorkerId} setSelectedPropertyId={setSelectedPropertyId} />}
              {view === 'personDetail' && canAccessView(view, currentRights) && <PersonDetailPage data={data} personId={selectedPersonId} save={save} setMode={setMode} setCustomerViewId={setCustomerViewId} setView={setView} setSelectedCaseId={setSelectedCaseId} setSelectedPropertyId={setSelectedPropertyId} setPropertyTab={setPropertyTab} />}
              {view === 'faelle' && canAccessView(view, currentRights) && <CasesList data={data} save={save} setView={setView} setSelectedCaseId={setSelectedCaseId} />}
              {view === 'fallDetail' && canAccessView(view, currentRights) && <CaseDetailPage data={data} selectedCaseId={selectedCaseId} save={save} remove={remove} setSelectedWorkerId={setSelectedWorkerId} setView={setView} />}
              {view === 'kalender' && canAccessView(view, currentRights) && <Calendar data={data} save={save} />}
              {view === 'handwerker' && canAccessView(view, currentRights) && <ContractorList data={data} save={save} setView={setView} setSelectedWorkerId={setSelectedWorkerId} />}
              {view === 'handwerkerDetail' && canAccessView(view, currentRights) && <ContractorDetailPage data={data} selectedWorkerId={selectedWorkerId} save={save} setSelectedCaseId={setSelectedCaseId} setView={setView} />}
              {view === 'formulare' && canAccessView(view, currentRights) && <DocumentForms data={data} save={save} />}
              {view === 'inserate' && canAccessView(view, currentRights) && <InsérateView data={data} save={save} />}
              {view === 'statistiken' && canAccessView(view, currentRights) && <StatistikenView data={data} />}
              {view === 'mitarbeiter' && canAccessView(view, currentRights) && <Employees data={data} rights={currentRights} selectedEmployeeId={selectedEmployeeId} setSelectedEmployeeId={setSelectedEmployeeId} ownEmployeeId={ownEmployee?.id} actingEmployeeId={actingEmployeeId} setActingEmployeeId={setActingEmployeeId} save={save} setMode={setMode} />}
              {view === 'myProfile' && canAccessView(view, currentRights) && <MyEmployeeProfile data={data} employee={currentEmployee} save={save} />}
              {view === 'internChat' && canAccessView(view, currentRights) && <InternalChat data={data} employee={currentEmployee} save={save} setView={setView} setSelectedCaseId={setSelectedCaseId} setSelectedPersonId={setSelectedPersonId} setSelectedPropertyId={setSelectedPropertyId} setSelectedWorkerId={setSelectedWorkerId} />}
              {view === 'externChat' && canAccessView(view, currentRights) && <ExternChat data={data} employee={currentEmployee} save={save} setView={setView} setSelectedCaseId={setSelectedCaseId} setSelectedPersonId={setSelectedPersonId} />}
              {view === 'urlaubskalender' && canAccessView(view, currentRights) && <UrlaubskalenderView data={data} employee={currentEmployee} rights={currentRights} save={save} remove={remove} />}
              {view === 'portal' && canAccessView(view, currentRights) && <PortalContent data={data} save={save} />}
              {view === 'kiAssistent' && canAccessView(view, currentRights) && <KIAssistentView data={data} employee={currentEmployee} ownEmployeeId={ownEmployee?.id ?? seed.Mitarbeiter[0].id} save={save} remove={remove} />}
              {view === 'suche' && canAccessView(view, currentRights) && <Search data={data} search={search} setSearch={setSearch} setView={setView} setSelectedPropertyId={setSelectedPropertyId} setSelectedPersonId={setSelectedPersonId} setSelectedCaseId={setSelectedCaseId} setPropertyTab={setPropertyTab} />}
              {view === 'customerPicker' && canAccessView(view, currentRights) && <CustomerPicker data={data} setCustomerViewId={setCustomerViewId} setMode={setMode} />}
              {view === 'papierkorb' && canAccessView(view, currentRights) && <Papierkorb data={data} save={save} remove={remove} />}
            </>}
          </section>
          {mode === 'staff' && view !== 'kiAssistent' && <PortalKIAssistent systemPrompt={`Aktuell geöffnete Ansicht: ${view}. Mitarbeiter: ${currentEmployee?.name ?? ''}. Rolle: ${currentEmployee?.gruppe ?? ''}.`} />}
        </div>
        );
      }}
    </Authenticator>
  );
}

function Icon({ name }: { name: string }) {
  const labels: Record<string, string> = {
    'grid-2x2': '📊',
    'building-2': '🏢',
    'alert-triangle': '⚠️',
    'calendar-days': '📅',
    wrench: '🔧',
    'file-text': '📄',
    users: '👥',
    'message-square': '💬',
    smartphone: '📱',
    search: '🔎',
    'trash-2': '🗑',
  };
  return <span className={`nav-icon nav-icon-${name}`}>{labels[name] ?? '•'}</span>;
}
// ── KI Auto-Analyse für Schadensfälle ─────────────────────────────────────

function KIAutoAnalyse({ fall, data, save, remove }: {
  fall: AnyRecord;
  data: Record<string, AnyRecord[]>;
  save: (model: string, item: AnyRecord) => Promise<any>;
  remove: (model: string, id: string) => Promise<any>;
}) {
  const [phase, setPhase] = useState<'idle' | 'analysiert' | 'ok' | 'fehler'>('idle');
  const [antwort, setAntwort] = useState('');
  const [aktionen, setAktionen] = useState<KIAktion[]>([]);
  const [abgelehnte, setAbgelehnte] = useState<number[]>([]);
  const [alleBestaetigt, setAlleBestaetigt] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [zeigeFeedbackInput, setZeigeFeedbackInput] = useState(false);
  const hasRun = React.useRef(false);

  React.useEffect(() => {
    if (hasRun.current) return;
    if (fall.handwerkerId && fall.status !== 'OFFEN' && fall.status !== 'NEU') return;
    hasRun.current = true;
    analyseStarten();
  }, [fall.id]);

  const analyseStarten = async (feedbackArg?: string) => {
    setPhase('analysiert');
    setAktionen([]);
    setAbgelehnte([]);
    setAlleBestaetigt(false);
    setZeigeFeedbackInput(false);

    const liegenschaft = (data.Liegenschaft ?? []).find((l: AnyRecord) => l.id === fall.liegenschaftId);
    const liegenschaftOrt    = String(liegenschaft?.ort ?? fall.liegenschaftAdresse ?? '').split(',')[0].trim();
    const liegenschaftKanton = kantonVonPlz(liegenschaft?.plz) ||
      String(liegenschaft?.plzOrt ?? '').replace(/^\d+\s*/, '').trim();

    const handwerkerListe = (data.Handwerker ?? [])
      .filter((h: AnyRecord) => h.status !== 'Inaktiv' && !String(h.firma ?? '').startsWith('[GELÖSCHT]'))
      .map((h: AnyRecord) => {
        const aktiveFaelle = (data.Schadenfall ?? []).filter((f: AnyRecord) =>
          f.handwerkerId === h.id && ['OFFEN','IN_BEARBEITUNG'].includes(f.status ?? '')
        ).length;
        const naehe = handwerkerNaehePunktzahl(h, liegenschaftOrt, liegenschaftKanton);
        return { h, naehe, aktiveFaelle };
      })
      .sort((a, b) => b.naehe - a.naehe || a.aktiveFaelle - b.aktiveFaelle)
      .slice(0, 60)
      .map(({ h, naehe, aktiveFaelle }) =>
        `[${h.id}] ${h.firma ?? '?'} – Gewerk: ${h.gewerk ?? '?'} | ${h.adresse ?? '?'} | Tel: ${h.telefon ?? ''} | Email: ${h.email ?? ''} | ${naeheLabel(naehe)} | Fälle: ${aktiveFaelle}`
      ).join('\n');

    const kontakt = (data.KontaktPerson ?? []).find((k: AnyRecord) => k.id === fall.personId);
    const mitarbeiter = (data.Mitarbeiter ?? []).filter((m: AnyRecord) => m.status === 'Aktiv').map((m: AnyRecord) => `[${m.id}] ${m.name}`).join(', ');

    const feedbackHinweis = feedbackArg
      ? `\n\nFEEDBACK DES MITARBEITERS (unbedingt berücksichtigen):\n${feedbackArg}`
      : '';

    const ctx = `SCHADENFALL:\nID: ${fall.id}\nFallnummer: ${fall.fallNummer ?? '?'}\nTitel: ${fall.titel}\nBeschreibung: ${fall.beschreibung ?? 'keine'}\nStatus: ${fall.status}\nPriorität: ${fall.prioritaet ?? 'nicht gesetzt'}\nKategorie: ${fall.kategorie ?? 'nicht gesetzt'}\nHandwerker zugewiesen: ${fall.handwerkerId ? 'Ja ('+fall.handwerkerId+')' : 'NEIN – bitte zuweisen'}\n\nLIEGENSCHAFT:\n${liegenschaft ? `${liegenschaft.name ?? ''}, ${liegenschaft.strasse ?? ''}, ${liegenschaft.plzOrt ?? `${liegenschaft.plz ?? ''} ${liegenschaft.ort ?? ''}`.trim()}` : 'unbekannt'}\n\nMELDER:\n${kontakt ? `${kontakt.vorname ?? ''} ${kontakt.nachname ?? kontakt.name ?? ''}, ${kontakt.email ?? ''}, ${kontakt.telefon ?? ''}` : 'unbekannt'}\n\nVERFÜGBARE HANDWERKER:\n${handwerkerListe || 'keine'}\n\nMITARBEITER:\n${mitarbeiter}${feedbackHinweis}`;

    const prompt = `WICHTIG: Schreibe den <aktionen>-Block ZUERST, dann erst die Erklärung!

Analysiere diesen Schadenfall und bereite ALLE Aktionen vor:
1. Wähle den geographisch NÄCHSTEN geeigneten Handwerker:
   - Bevorzuge «📍 Gleiche Gemeinde» (${liegenschaftOrt || 'Schadenort'})
   - Falls keiner: «🟢 Gleicher Kanton» (${liegenschaftKanton || 'gleicher Kanton'})
   - Falls keiner: «🟡 Nachbarkanton»
   - Das Gewerk MUSS zur Schadenskategorie passen
   - Bei gleicher Nähe: wähle den mit weniger aktiven Fällen
2. Erstelle sofort diese Aktionen (alle erforderlich):
   a) HANDWERKER_ZUWEISEN – handwerkerId aus der Liste
   b) AUFTRAG_ERSTELLEN – Pflichtfelder: handwerkerId, handwerkerName, empfaengerEmail, betreff, text (vollständiger professioneller Auftragstext auf Deutsch)
   c) STATUS_AENDERN – setze Status auf IN_BEARBEITUNG
   d) Optional: DATENSATZ_AKTUALISIEREN für Priorität/Kategorie wenn nötig

Format der Antwort:
<aktionen>[...JSON...]</aktionen>

Dann kurze Zusammenfassung was du getan hast.${feedbackArg ? '\n\nACHTUNG: Berücksichtige unbedingt das Feedback: ' + feedbackArg : ''}`;

    const res = await bedrockChatAnfrage(
      [{ role: 'user', content: prompt }],
      'Du bist der IMMOBILIENTOOL KI Auto-Pilot. Du analysierst Schadensfälle vollständig und bereitest alle Aktionen vor.',
      ctx
    );

    setAntwort(res.antwort);
    setAktionen(res.aktionen);
    setPhase(res.ok ? 'ok' : 'fehler');
  };

  const alleBestaetigenFn = async () => {
    setAlleBestaetigt(true);
    document.dispatchEvent(new CustomEvent('ki-bestaetigen-alle'));
  };

  const offeneAktionen = aktionen.filter((_, i) => !abgelehnte.includes(i));

  if (phase === 'idle') return null;

  return (
    <div style={{ marginBottom: 20, border: '2px solid #1e293b', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ background: '#1e293b', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {phase === 'analysiert' && (
            <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
          {phase === 'ok' && <span style={{ fontSize: 16 }}>✦</span>}
          {phase === 'fehler' && <span style={{ fontSize: 16 }}>⚠</span>}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {phase === 'analysiert' ? 'KI analysiert Schadenfall …' : phase === 'ok' ? 'KI-Analyse abgeschlossen' : 'KI-Fehler'}
            </div>
            {phase === 'ok' && <div style={{ fontSize: 11, opacity: .7 }}>{offeneAktionen.length} Aktion{offeneAktionen.length !== 1 ? 'en' : ''} vorbereitet · Bitte prüfen und bestätigen</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {phase === 'ok' && offeneAktionen.length > 0 && !alleBestaetigt && (
            <button onClick={alleBestaetigenFn} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              ✓ Alles bestätigen ({offeneAktionen.length})
            </button>
          )}
          {phase === 'ok' && !zeigeFeedbackInput && (
            <button onClick={() => setZeigeFeedbackInput(true)} style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
              ↩ Feedback geben
            </button>
          )}
          <button onClick={() => analyseStarten()} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
            ↻ Neu analysieren
          </button>
        </div>
      </div>

      {(phase === 'ok' || phase === 'fehler') && (
        <div style={{ padding: 14, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {antwort && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', fontSize: 14, lineHeight: 1.6 }}>
              {renderMarkdown(antwort)}
            </div>
          )}
          {aktionen.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aktionen.map((a, i) => abgelehnte.includes(i) ? null : (
                <KIAutoAktionsKarte
                  key={`${fall.id}-${i}`}
                  aktion={a}
                  save={save}
                  remove={remove}
                  data={data}
                  autoBestaetigen={alleBestaetigt}
                  onAblehnen={() => setAbgelehnte(prev => [...prev, i])}
                />
              ))}
            </div>
          )}
          {zeigeFeedbackInput && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>Feedback für neue Analyse</div>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Was soll die KI anders machen? z.B. «Nimm lieber Handwerker XY» oder «Priorität ist Dringend, nicht Normal» oder «Der Auftragstext soll kürzer sein»"
                style={{ width: '100%', minHeight: 80, border: '1px solid #d1d5db', borderRadius: 8, padding: 10, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { analyseStarten(feedback); setFeedback(''); }}
                  disabled={!feedback.trim()}
                  style={{ background: feedback.trim() ? '#1e293b' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: feedback.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13 }}
                >
                  ↻ Neu analysieren mit Feedback
                </button>
                <button onClick={() => { setZeigeFeedbackInput(false); setFeedback(''); }} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KIAutoAktionsKarte({ aktion, save, remove, data, autoBestaetigen, onAblehnen }: {
  aktion: KIAktion;
  save: (model: string, item: AnyRecord) => Promise<any>;
  remove: (model: string, id: string) => Promise<any>;
  data: Record<string, AnyRecord[]>;
  autoBestaetigen: boolean;
  onAblehnen: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'fehler'>('idle');
  const [msg, setMsg] = useState('');
  const [zeigeEmailPopup, setZeigeEmailPopup] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailDaten, setEmailDaten] = useState<{ an: string; betreff: string; text: string } | null>(null);

  const MODEL_MAP: Record<string, string> = {
    Schadenfall: 'Schadenfall', Handwerker: 'Handwerker',
    Liegenschaft: 'Liegenschaft', KontaktPerson: 'KontaktPerson', Mitarbeiter: 'Mitarbeiter',
  };

  React.useEffect(() => {
    if (autoBestaetigen && status === 'idle' && aktion.typ !== 'DATENSATZ_LOESCHEN') {
      ausfuehren();
    }
  }, [autoBestaetigen]);

  const ausfuehren = async () => {
    if (status === 'ok' || status === 'loading') return;
    setStatus('loading'); setMsg('');
    try {
      const d = aktion.daten;
      const model = MODEL_MAP[d._model as string] ?? d._model as string;

      if (aktion.typ === 'AUFTRAG_ERSTELLEN') {
        const handwerker = (data.Handwerker ?? []).find((h: AnyRecord) => h.id === d.handwerkerId);
        const emailAn = d.empfaengerEmail || handwerker?.email || '';
        setEmailDaten({
          an: emailAn,
          betreff: d.betreff || d.titel || 'Auftragserteilung',
          text: d.text || d.auftragstext || d.inhalt || d.beschreibung || '',
        });
        setZeigeEmailPopup(true);
        setStatus('ok');
        setMsg('E-Mail bereit');
        return;
      }

      if (aktion.typ === 'DATENSATZ_LOESCHEN') {
        const existing = (data[model] ?? []).find((r: AnyRecord) => r.id === d._id);
        if (!existing) { setStatus('fehler'); setMsg('Nicht gefunden'); return; }
        await save(model, { ...existing, status: 'Gelöscht', name: `[GELÖSCHT] ${existing.name ?? existing.titel ?? ''}`, updatedAt: nowIso() });
        setStatus('ok'); setMsg('Gelöscht');
        return;
      }

      if (['DATENSATZ_AKTUALISIEREN','STATUS_AENDERN','HANDWERKER_ZUWEISEN'].includes(aktion.typ)) {
        const existing = (data[model] ?? []).find((r: AnyRecord) => r.id === d._id);
        if (!existing) { setStatus('fehler'); setMsg(`ID nicht gefunden`); return; }
        const { _model: _m, _id: _i, _name: _n, ...felder } = d;
        await save(model, { ...existing, ...felder, updatedAt: nowIso() });
        setStatus('ok'); setMsg('Aktualisiert');
        return;
      }

      const createModel = model || { SCHADENFALL_ERSTELLEN: 'Schadenfall', HANDWERKER_ERSTELLEN: 'Handwerker', LIEGENSCHAFT_ERSTELLEN: 'Liegenschaft', KONTAKT_ERSTELLEN: 'KontaktPerson' }[aktion.typ] || 'Schadenfall';
      const { _model: _m2, _id: _i2, _name: _n2, ...restDaten } = d;
      await save(createModel, { id: `ki-${uid()}`, ...restDaten, createdAt: nowIso(), updatedAt: nowIso() });
      setStatus('ok'); setMsg('Erstellt');
    } catch (e: any) { setStatus('fehler'); setMsg(e?.message ?? 'Fehler'); }
  };

  const autoSenden = async () => {
    if (!emailDaten) return;
    setEmailLoading(true);
    try {
      const result = await sendeEmail({ to: emailDaten.an, subject: emailDaten.betreff, textBody: emailDaten.text });
      if (result?.ok) {
        setMsg(`✉ Gesendet an ${emailDaten.an}`);
      } else {
        setMsg(`Fehler: ${result?.message ?? 'Unbekannt'}`);
      }
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message ?? 'E-Mail konnte nicht gesendet werden'}`);
    } finally {
      setEmailLoading(false);
      setZeigeEmailPopup(false);
    }
  };

  const TYP_ICONS: Record<string, string> = {
    DATENSATZ_AKTUALISIEREN: '✏️', STATUS_AENDERN: '🔄', HANDWERKER_ZUWEISEN: '🔧',
    SCHADENFALL_ERSTELLEN: '⚠️', AUFTRAG_ERSTELLEN: '✉️', DATENSATZ_LOESCHEN: '🗑️',
  };
  const icon = TYP_ICONS[aktion.typ] ?? '✦';
  const istLoeschen = aktion.typ === 'DATENSATZ_LOESCHEN';
  const istAuftrag = aktion.typ === 'AUFTRAG_ERSTELLEN';

  return (
    <>
      <div style={{ background: '#fff', border: `1px solid ${status === 'ok' ? '#bbf7d0' : istLoeschen ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{aktion.beschreibung}</div>
          {Object.entries(aktion.daten).filter(([k]) => !k.startsWith('_') && aktion.daten[k]).length > 0 && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              {Object.entries(aktion.daten).filter(([k, v]) => !k.startsWith('_') && v && k !== 'text').slice(0, 3).map(([k, v]) => `${k}: ${String(v).substring(0, 50)}`).join(' · ')}
            </div>
          )}
          {status === 'ok' && emailDaten && !zeigeEmailPopup && (
            <button onClick={() => setZeigeEmailPopup(true)} style={{ marginTop: 6, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              ✉ E-Mail anzeigen / erneut senden
            </button>
          )}
        </div>
        {status === 'ok' ? (
          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>✓ {msg}</span>
        ) : status === 'fehler' ? (
          <span style={{ color: '#dc2626', fontSize: 13 }}>⚠ {msg}</span>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {!istLoeschen && (
              <button onClick={ausfuehren} disabled={status === 'loading'} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {status === 'loading' ? '…' : istAuftrag ? '✉ E-Mail vorbereiten' : '✓'}
              </button>
            )}
            {istLoeschen && (
              <button onClick={ausfuehren} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
            )}
            <button onClick={onAblehnen} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>✕</button>
          </div>
        )}
      </div>
      {zeigeEmailPopup && emailDaten && (
        <EmailVersandPopup
          an={emailDaten.an}
          betreff={emailDaten.betreff}
          text={emailDaten.text}
          loading={emailLoading}
          onAutoSenden={autoSenden}
          onManuell={() => setZeigeEmailPopup(false)}
          onAbbrechen={() => setZeigeEmailPopup(false)}
        />
      )}
    </>
  );
}

function EmailVersandPopup({ an, betreff, text, loading, onAutoSenden, onManuell, onAbbrechen }: {
  an: string; betreff: string; text: string; loading: boolean;
  onAutoSenden: () => void; onManuell: () => void; onAbbrechen: () => void;
}) {
  const [editText, setEditText] = useState(text);
  const mailtoHref = `mailto:${encodeURIComponent(an)}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(editText)}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 25px 60px rgba(0,0,0,.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 10 }}>
          ✉️ E-Mail versenden
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
            <strong>An:</strong> {an || <span style={{ color: '#dc2626' }}>Keine E-Mail-Adresse hinterlegt — nur manuelle Sendung möglich</span>}
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
            <strong>Betreff:</strong> {betreff}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontWeight: 600, color: '#374151' }}>E-Mail-Text (bearbeitbar):</label>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              style={{ width: '100%', minHeight: 180, border: '1px solid #d1d5db', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onAutoSenden}
            disabled={loading || !an}
            style={{ background: an ? '#16a34a' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: an ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13, flex: 1, minWidth: 170 }}
          >
            {loading ? '…' : '✉ Automatisch senden (SES)'}
          </button>
          <a
            href={mailtoHref}
            onClick={onManuell}
            style={{ background: '#1e293b', color: '#fff', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13, flex: 1, minWidth: 170, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Selbst senden (E-Mail-Client)
          </a>
          <button
            onClick={onAbbrechen}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Markdown-Renderer für KI-Ausgaben ─────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  const parseInline = (s: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = s;
    let key = 0;
    while (remaining.length > 0) {
      const bold = remaining.match(/^\*\*(.+?)\*\*/);
      const italic = remaining.match(/^\*(.+?)\*/);
      const code = remaining.match(/^`(.+?)`/);
      if (bold) {
        parts.push(<strong key={key++}>{bold[1]}</strong>);
        remaining = remaining.slice(bold[0].length);
      } else if (italic) {
        parts.push(<em key={key++}>{italic[1]}</em>);
        remaining = remaining.slice(italic[0].length);
      } else if (code) {
        parts.push(<code key={key++} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{code[1]}</code>);
        remaining = remaining.slice(code[0].length);
      } else {
        const nextSpecial = remaining.search(/\*\*|\*|`/);
        if (nextSpecial === -1) { parts.push(remaining); remaining = ''; }
        else { parts.push(remaining.slice(0, nextSpecial)); remaining = remaining.slice(nextSpecial); }
      }
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 14, marginTop: 10, marginBottom: 2 }}>{parseInline(line.slice(4))}</div>);
    } else if (line.startsWith('## ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: 12, marginBottom: 3 }}>{parseInline(line.slice(3))}</div>);
    } else if (line.startsWith('# ')) {
      elements.push(<div key={i} style={{ fontWeight: 800, fontSize: 16, marginTop: 14, marginBottom: 4 }}>{parseInline(line.slice(2))}</div>);
    } else if (line.match(/^[-•] /)) {
      elements.push(<div key={i} style={{ paddingLeft: 14, position: 'relative', marginTop: 2 }}><span style={{ position: 'absolute', left: 0 }}>•</span>{parseInline(line.slice(2))}</div>);
    } else if (line.match(/^\d+\. /)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) elements.push(<div key={i} style={{ paddingLeft: 20, position: 'relative', marginTop: 2 }}><span style={{ position: 'absolute', left: 0, color: '#6b7280' }}>{match[1]}.</span>{parseInline(match[2])}</div>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      elements.push(<div key={i} style={{ marginTop: 2 }}>{parseInline(line)}</div>);
    }
  }
  return <>{elements}</>;
}

// ── KI-Flyout: kleiner einbettbarer Chat ──────────────────────────────────

function KIFlyout({ label, systemPrompt, kontext, schnellstarts }: {
  label?: string;
  systemPrompt?: string;
  kontext?: string;
  schnellstarts?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text?: string) => {
    const t = (text ?? input).trim(); if (!t || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: t }];
    setMessages(next); setInput(''); setLoading(true);
    const res = await bedrockChatAnfrage(next, systemPrompt, kontext);
    setMessages([...next, { role: 'assistant', content: res.antwort }]);
    setLoading(false);
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px' }}>
        <span>✦</span>{label ?? 'KI-Assistent'}
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 1000, width: 420, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.12)', overflow: 'hidden', marginTop: 4 }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>✦ IMMOBILIENTOOL KI-Assistent</div>
              <div style={{ fontSize: 10, opacity: .7 }}>{label ?? 'Kontext geladen'}</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          {schnellstarts && messages.length === 0 && (
            <div style={{ padding: '8px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6' }}>
              {schnellstarts.map(s => <button key={s} onClick={() => send(s)} style={{ fontSize: 11, padding: '4px 9px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>{s}</button>)}
            </div>
          )}
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Stelle eine Frage…</p>}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 2 }}>
                <div style={{ maxWidth: '90%', background: m.role === 'user' ? '#1e293b' : '#f1f5f9', color: m.role === 'user' ? '#fff' : '#111', borderRadius: 10, padding: '8px 11px', fontSize: 13, lineHeight: 1.5 }}>
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
                {m.role === 'assistant' && (
                  <button onClick={() => { navigator.clipboard.writeText(m.content); setCopied(i); setTimeout(() => setCopied(null), 2000); }} style={{ fontSize: 11, color: copied === i ? '#166534' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {copied === i ? '✓ Kopiert' : 'Kopieren'}
                  </button>
                )}
              </div>
            ))}
            {loading && <div style={{ color: '#9ca3af', fontSize: 13 }}>IMMOBILIENTOOL KI denkt nach …</div>}
            <div ref={endRef} />
          </div>
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 10px', display: 'flex', gap: 7 }}>
            {messages.length > 0 && <button onClick={() => setMessages([])} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>Neu</button>}
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} placeholder="Frage stellen…" style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
            <button onClick={() => send()} disabled={loading || !input.trim()} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', opacity: loading || !input.trim() ? .5 : 1 }}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IMMOBILIENTOOL KI-Assistent Hauptansicht ────────────────────────────────────────

const KI_MODI = [
  { id: 'chat',     label: '💬 Freier Chat',         prompt: 'Du bist IMMOBILIENTOOL KI, ein Assistent für Immobilientool.' },
  { id: 'schaden',  label: '🔧 Schadensmeldung',     prompt: 'Du hilfst beim Erfassen und Bearbeiten von Schadensmeldungen. Schlage Kategorie, Priorität, Beschreibung und Handwerker-Anweisung vor.' },
  { id: 'dokument', label: '📄 Dokument / Formular', prompt: 'Du hilfst Texte für Mietverträge, Anschreiben, Kündigungen und Formulare zu verfassen. Halte es professionell und auf Deutsch.' },
  { id: 'email',    label: '✉️ E-Mail / Anschreiben', prompt: 'Du hilfst professionelle E-Mails und Anschreiben für Immobilientool zu verfassen. Ton: freundlich, sachlich, professionell.' },
  { id: 'analyse',  label: '📊 Analyse / Auswertung', prompt: 'Du hilfst Daten zu interpretieren und Berichte für Immobilientool zu erstellen.' },
];

// ── Geografische Nähe-Logik ───────────────────────────────────────────────────

const NACHBARKANTONE_MAP: Record<string, string[]> = {
  'Basel-Stadt':       ['Basel-Landschaft', 'Aargau'],
  'Basel-Landschaft':  ['Basel-Stadt', 'Aargau', 'Solothurn', 'Jura'],
  'Aargau':            ['Basel-Stadt', 'Basel-Landschaft', 'Solothurn', 'Zürich', 'Zug', 'Luzern'],
  'Solothurn':         ['Basel-Landschaft', 'Aargau', 'Bern', 'Jura'],
  'Jura':              ['Basel-Landschaft', 'Solothurn', 'Bern'],
};

function kantonVonPlz(plz: string | number | undefined): string {
  const p = parseInt(String(plz ?? ''));
  if (isNaN(p)) return '';
  if (p >= 4000 && p <= 4056) return 'Basel-Stadt';
  if (p >= 4100 && p <= 4499 && p !== 4200 && p < 4300) return 'Basel-Landschaft';
  if ((p >= 5000 && p <= 5999) || (p >= 4300 && p <= 4499) || (p >= 4200 && p <= 4299)) return 'Aargau';
  if (p >= 4500 && p <= 4799) return 'Solothurn';
  return '';
}

function handwerkerNaehePunktzahl(h: AnyRecord, ort: string, kanton: string): number {
  const adresse = String(h.adresse ?? '').toLowerCase().trim();
  const einsatz = String(h.einsatzgebiet ?? '').toLowerCase().trim();
  const ortL    = ort.toLowerCase().trim();
  const kantonL = kanton.toLowerCase().trim();

  if (ortL && (adresse === ortL || adresse.startsWith(ortL) || adresse.includes(`, ${ortL}`))) return 100;
  if (ortL && (adresse.includes(ortL) || einsatz.includes(ortL))) return 85;
  if (kantonL && einsatz.includes(kantonL)) return 70;

  const nachbarn = NACHBARKANTONE_MAP[kanton] ?? [];
  if (nachbarn.some(n => einsatz.includes(n.toLowerCase()))) return 40;

  return 10;
}

function naeheLabel(punkte: number): string {
  if (punkte >= 90) return '📍 Gleiche Gemeinde';
  if (punkte >= 70) return '🟢 Gleicher Kanton';
  if (punkte >= 40) return '🟡 Nachbarkanton';
  return '⚪ Weiter entfernt';
}

function buildKontext(data: Record<string, AnyRecord[]>): string {
  const liegenschaften = (data.Liegenschaft ?? []).filter((l: AnyRecord) => l.status !== 'Gelöscht').slice(0, 40).map((l: AnyRecord) => `[${l.id}] ${l.name ?? l.strasse} – ${l.strasse ?? ''}, ${l.plzOrt ?? ''}`).join('\n');
  const handwerker = (data.Handwerker ?? [])
    .filter((h: AnyRecord) => h.status !== 'Inaktiv' && !String(h.firma ?? '').startsWith('[GELÖSCHT]'))
    .slice(0, 80)
    .map((h: AnyRecord) => `[${h.id}] ${h.firma ?? '?'} – Gewerk: ${h.gewerk ?? '?'} | Adresse: ${h.adresse ?? '?'} | Einsatzgebiet: ${h.einsatzgebiet ?? '?'} | Tel: ${h.telefon ?? ''} | Email: ${h.email ?? ''}`)
    .join('\n');
  const mitarbeiter = (data.Mitarbeiter ?? []).filter((m: AnyRecord) => m.status === 'Aktiv').slice(0, 20).map((m: AnyRecord) => `[${m.id}] ${m.name} – ${m.funktion ?? ''} | ${m.email ?? ''}`).join('\n');
  const offeneMeldungen = (data.Schadenfall ?? []).filter((f: AnyRecord) => f.status === 'OFFEN' || f.status === 'IN_BEARBEITUNG').slice(0, 20).map((f: AnyRecord) => `[${f.id}] #${f.fallNummer ?? '?'} – ${f.titel} | ${f.status} | Priorität: ${f.prioritaet ?? '?'} | Kategorie: ${f.kategorie ?? '?'}`).join('\n');
  const kontakte = (data.KontaktPerson ?? []).filter((k: AnyRecord) => !String(k.name ?? '').startsWith('[GELÖSCHT]')).slice(0, 30).map((k: AnyRecord) => `[${k.id}] ${k.vorname ?? ''} ${k.name ?? ''} – ${k.typ ?? ''} | ${k.email ?? ''} | Liegenschaft: ${k.liegenschaftId ?? ''}`).join('\n');
  return `LIEGENSCHAFTEN:\n${liegenschaften || 'keine'}\n\nHANDWERKER:\n${handwerker || 'keine'}\n\nMITARBEITER:\n${mitarbeiter || 'keine'}\n\nOFFENE MELDUNGEN:\n${offeneMeldungen || 'keine'}\n\nKONTAKTE/MIETER:\n${kontakte || 'keine'}`;
}

function AktionsKarte({ aktion, save, remove, data, onAblehnen }: {
  aktion: KIAktion;
  save: (model: string, item: AnyRecord) => Promise<any>;
  remove: (model: string, id: string) => Promise<any>;
  data: Record<string, AnyRecord[]>;
  onAblehnen: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'fehler'>('idle');
  const [msg, setMsg] = useState('');
  const [bestaetigung, setBestaetigung] = useState(false);

  const TYP_CFG: Record<string, { label: string; icon: string; tone: string; istLoeschen?: boolean }> = {
    SCHADENFALL_ERSTELLEN:    { label: 'Schadenfall erstellen',      icon: '⚠️',  tone: '#f59e0b' },
    DATENSATZ_AKTUALISIEREN:  { label: 'Datensatz aktualisieren',    icon: '✏️',  tone: '#3b82f6' },
    DATENSATZ_LOESCHEN:       { label: 'Datensatz löschen',          icon: '🗑️',  tone: '#ef4444', istLoeschen: true },
    STATUS_AENDERN:           { label: 'Status ändern',              icon: '🔄',  tone: '#8b5cf6' },
    HANDWERKER_ZUWEISEN:      { label: 'Handwerker zuweisen',        icon: '🔧',  tone: '#8b5cf6' },
    AUFTRAG_ERSTELLEN:        { label: 'Auftrag erstellen',          icon: '📋',  tone: '#10b981' },
    HANDWERKER_ERSTELLEN:     { label: 'Neuer Handwerker',           icon: '🏗️', tone: '#f97316' },
    LIEGENSCHAFT_ERSTELLEN:   { label: 'Neue Liegenschaft',          icon: '🏢',  tone: '#06b6d4' },
    KONTAKT_ERSTELLEN:        { label: 'Neuer Kontakt',              icon: '👤',  tone: '#ec4899' },
  };

  const MODEL_MAP: Record<string, string> = {
    Schadenfall: 'Schadenfall', Handwerker: 'Handwerker', Liegenschaft: 'Liegenschaft',
    KontaktPerson: 'KontaktPerson', Mitarbeiter: 'Mitarbeiter',
  };

  const cfg = TYP_CFG[aktion.typ] ?? { label: aktion.typ, icon: '✦', tone: '#6b7280' };

  const ausfuehren = async () => {
    setStatus('loading'); setMsg('Wird ausgeführt …');
    try {
      const d = aktion.daten;
      const model = MODEL_MAP[d._model as string] ?? d._model as string;

      if (aktion.typ === 'DATENSATZ_LOESCHEN') {
        const existing = (data[model] ?? []).find((r: AnyRecord) => r.id === d._id);
        if (!existing) { setStatus('fehler'); setMsg(`Datensatz nicht gefunden: ${d._id}`); return; }
        await save(model, { ...existing, status: 'Gelöscht', name: `[GELÖSCHT] ${existing.name ?? existing.titel ?? ''}`, titel: existing.titel ? `[GELÖSCHT] ${existing.titel}` : existing.titel, updatedAt: nowIso() });
        setStatus('ok'); setMsg('✓ Gelöscht');
        return;
      }

      if (aktion.typ === 'DATENSATZ_AKTUALISIEREN' || aktion.typ === 'STATUS_AENDERN' || aktion.typ === 'HANDWERKER_ZUWEISEN') {
        const id = d._id as string;
        const existing = (data[model] ?? []).find((r: AnyRecord) => r.id === id);
        if (!existing) { setStatus('fehler'); setMsg(`ID nicht gefunden: ${id}`); return; }
        const { _model: _m, _id: _i, _name: _n, ...felder } = d;
        await save(model, { ...existing, ...felder, updatedAt: nowIso() });
        setStatus('ok'); setMsg('✓ Aktualisiert');
        return;
      }

      // Erstellen
      const createModel = model || {
        SCHADENFALL_ERSTELLEN: 'Schadenfall', HANDWERKER_ERSTELLEN: 'Handwerker',
        LIEGENSCHAFT_ERSTELLEN: 'Liegenschaft', KONTAKT_ERSTELLEN: 'KontaktPerson', AUFTRAG_ERSTELLEN: 'Schadenfall',
      }[aktion.typ] || 'Schadenfall';
      const { _model: _m2, _id: _i2, _name: _n2, ...restDaten } = d;
      await save(createModel, { id: `ki-${uid()}`, ...restDaten, createdAt: nowIso(), updatedAt: nowIso() });
      setStatus('ok'); setMsg('✓ Erstellt');
    } catch (e: any) { setStatus('fehler'); setMsg(e?.message ?? 'Fehler'); }
  };

  const istLoeschen = cfg.istLoeschen;

  return (
    <div style={{ border: `1.5px solid ${cfg.tone}30`, borderLeft: `4px solid ${cfg.tone}`, borderRadius: 10, padding: '12px 14px', background: istLoeschen ? '#fff5f5' : '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cfg.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: cfg.tone }}>{cfg.label}</span>
          {istLoeschen && <Badge tone="red">Unwiderruflich</Badge>}
        </div>
        {status === 'idle' && <Badge tone="orange">Warte auf Bestätigung</Badge>}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{aktion.beschreibung}</p>
      {Object.keys(aktion.daten).filter(k => !k.startsWith('_')).length > 0 && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: '#475569', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {Object.entries(aktion.daten).filter(([k]) => !k.startsWith('_')).map(([k, v]) => v !== undefined && v !== null && v !== '' ? `${k}: ${v}` : null).filter(Boolean).join('\n')}
        </div>
      )}
      {status === 'ok' ? (
        <div style={{ color: '#166534', fontWeight: 600, fontSize: 13 }}>{msg}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {istLoeschen && !bestaetigung ? (
            <>
              <button onClick={() => setBestaetigung(true)} style={{ fontSize: 13, padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>🗑️ Löschen bestätigen</button>
              <button style={{ fontSize: 13, padding: '6px 14px', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', color: '#6b7280' }} onClick={onAblehnen}>Abbrechen</button>
            </>
          ) : (
            <>
              <button className={istLoeschen ? 'danger' : 'primary'} style={{ fontSize: 13, padding: '6px 14px' }} onClick={ausfuehren} disabled={status === 'loading'}>
                {status === 'loading' ? 'Läuft …' : istLoeschen ? '⚠️ Endgültig löschen' : '✓ Bestätigen & Ausführen'}
              </button>
              <button style={{ fontSize: 13, padding: '6px 14px', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', color: '#6b7280' }} onClick={onAblehnen}>Ablehnen</button>
              {msg && <span style={{ fontSize: 12, color: status === 'fehler' ? '#dc2626' : '#6b7280' }}>{msg}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type KIChatVerlauf = {
  id: string;
  titel: string;
  messages: ChatMessage[];
  aktionen: KIAktion[];
  erstelltAm: string;
  aktualisiertAm: string;
};

function KIAssistentView({ data, employee, ownEmployeeId, save, remove }: {
  data: Record<string, AnyRecord[]>;
  employee?: AnyRecord;
  ownEmployeeId: string;
  save: (model: string, item: AnyRecord) => Promise<any>;
  remove: (model: string, id: string) => Promise<any>;
}) {
  const STORAGE_KEY = `portal:ki:chats:${ownEmployeeId}`;

  const [sidebarOffen, setSidebarOffen] = useState(true);
  const [chatId, setChatId]             = useState(() => `kic-${uid()}`);
  const [verlauf, setVerlauf]           = useState<KIChatVerlauf[]>(() => {
    try { return JSON.parse(localStorage.getItem(`portal:ki:chats:${ownEmployeeId}`) ?? '[]'); }
    catch { return []; }
  });
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [aktionenListe, setAktionenListe] = useState<KIAktion[]>([]);
  const [abgelehnte, setAbgelehnte]       = useState<number[]>([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [copied, setCopied]               = useState<number | null>(null);
  const endRef   = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // Auto-Speichern nach jeder Antwort
  React.useEffect(() => {
    if (messages.length === 0) return;
    const titel = messages.find(m => m.role === 'user')?.content.substring(0, 55) ?? 'Chat';
    const record: KIChatVerlauf = {
      id: chatId,
      titel,
      messages,
      aktionen: aktionenListe,
      erstelltAm: verlauf.find(c => c.id === chatId)?.erstelltAm ?? nowIso(),
      aktualisiertAm: nowIso(),
    };
    setVerlauf(prev => {
      const neu = [record, ...prev.filter(c => c.id !== chatId)];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(neu.slice(0, 100))); } catch {}
      return neu;
    });
  }, [messages, aktionenListe]);

  const kontext = React.useMemo(() => buildKontext(data), [data]);

  const offeneSchaeden = (data.Schadenfall ?? [])
    .filter((f: AnyRecord) => ['OFFEN','IN_BEARBEITUNG'].includes(statusValue(f.status)))
    .sort((a: AnyRecord, b: AnyRecord) => {
      const prio: Record<string,number> = { Dringend: 0, Hoch: 1, Normal: 2, Niedrig: 3 };
      return (prio[a.prioritaet ?? 'Normal'] ?? 2) - (prio[b.prioritaet ?? 'Normal'] ?? 2);
    });

  const SYSTEM_PROMPT = `Du bist IMMOBILIENTOOL KI, der vollständige KI-Assistent von Immobilientool. Mitarbeiter: ${employee?.name ?? 'unbekannt'}, Funktion: ${employee?.funktion ?? ''}.
Du kannst alles: Schadensfälle analysieren und vorbereiten, Handwerker zuweisen, E-Mails und Anschreiben verfassen, Dokumente erstellen, Daten auswerten, Rechtsfragen zur Schweizer Mietgesetzgebung beantworten. Antworte immer auf Deutsch, präzise und professionell.`;

  const SCHNELLSTARTS = [
    { icon: '⚠️', text: 'Offene Meldungen priorisieren und Handwerker zuweisen' },
    { icon: '✉️', text: 'Professionelles Anschreiben an Mieter verfassen' },
    { icon: '🔧', text: 'Passenden Handwerker für einen Auftrag finden' },
    { icon: '📄', text: 'Kündigungsschreiben oder Mietvertrag-Vorlage erstellen' },
    { icon: '📊', text: 'Liegenschaften und Meldungen analysieren' },
    { icon: '⚖️', text: 'Rechtsfrage zum Schweizer Mietrecht beantworten' },
  ];

  const neuerChat = () => {
    setChatId(`kic-${uid()}`);
    setMessages([]); setAktionenListe([]); setAbgelehnte([]); setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const ladeChat = (c: KIChatVerlauf) => {
    setChatId(c.id);
    setMessages(c.messages);
    setAktionenListe(c.aktionen ?? []);
    setAbgelehnte([]);
    setInput('');
  };

  const loescheChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVerlauf(prev => {
      const neu = prev.filter(c => c.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(neu)); } catch {}
      return neu;
    });
    if (id === chatId) neuerChat();
  };

  const sendMsg = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: t }];
    setMessages(next); setInput(''); setLoading(true);
    const res = await bedrockChatAnfrage(next, SYSTEM_PROMPT, kontext);
    setMessages([...next, { role: 'assistant', content: res.antwort }]);
    if (res.aktionen.length > 0) setAktionenListe(prev => [...prev, ...res.aktionen]);
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const leer = messages.length === 0;

  // Verlauf gruppieren
  const heute    = new Date().toDateString();
  const gestern  = new Date(Date.now() - 86_400_000).toDateString();
  const vor7Tage = Date.now() - 7 * 86_400_000;
  const gruppen: { label: string; chats: KIChatVerlauf[] }[] = [
    { label: 'Heute',           chats: verlauf.filter(c => new Date(c.aktualisiertAm).toDateString() === heute) },
    { label: 'Gestern',         chats: verlauf.filter(c => new Date(c.aktualisiertAm).toDateString() === gestern) },
    { label: 'Letzte 7 Tage',   chats: verlauf.filter(c => { const t = new Date(c.aktualisiertAm).getTime(); return t < new Date(gestern).getTime() && t > vor7Tage; }) },
    { label: 'Älter',           chats: verlauf.filter(c => new Date(c.aktualisiertAm).getTime() <= vor7Tage) },
  ].filter(g => g.chats.length > 0);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)', overflow: 'hidden' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{ width: sidebarOffen ? 260 : 0, minWidth: sidebarOffen ? 260 : 0, background: '#0f172a', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .2s, min-width .2s', borderRight: '1px solid #1e293b' }}>
        {/* Sidebar-Header */}
        <div style={{ padding: '16px 12px 10px', flexShrink: 0 }}>
          <button onClick={neuerChat} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <span style={{ fontSize: 16 }}>✦</span> Neuer Chat
          </button>
        </div>

        {/* Chat-Verlauf */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {verlauf.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 8px' }}>Noch keine Chats gespeichert</div>
          ) : (
            gruppen.map(g => (
              <div key={g.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 8px 4px' }}>{g.label}</div>
                {g.chats.map(c => (
                  <div key={c.id} onClick={() => ladeChat(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: c.id === chatId ? 'rgba(255,255,255,.1)' : 'transparent', color: c.id === chatId ? '#fff' : '#94a3b8', fontSize: 12, marginBottom: 1 }}
                    onMouseEnter={e => { if (c.id !== chatId) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
                    onMouseLeave={e => { if (c.id !== chatId) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titel}</span>
                    <button onClick={e => loescheChat(c.id, e)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0, lineHeight: 1 }} title="Löschen">×</button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Mitarbeiter-Info */}
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#475569' }}>Gespeichert für</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{employee?.name ?? 'Mitarbeiter'}</div>
        </div>
      </div>

      {/* ── Hauptbereich ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f8fafc' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px 0', flexShrink: 0 }}>
          <button onClick={() => setSidebarOffen(o => !o)} title={sidebarOffen ? 'Sidebar schliessen' : 'Sidebar öffnen'}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 15, color: '#6b7280', flexShrink: 0 }}>
            {sidebarOffen ? '◀' : '▶'}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✦</span> IMMOBILIENTOOL KI-Assistent
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
              Claude Haiku 4.5 · {(data.Liegenschaft?.length ?? 0)} Liegenschaften · {(data.Handwerker?.length ?? 0)} Handwerker · {offeneSchaeden.length} offene Meldungen
            </div>
          </div>
          {!leer && (
            <button onClick={neuerChat} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
              ↺ Neuer Chat
            </button>
          )}
        </div>

        {/* Chat-Bereich */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {leer && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 28 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>✦</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#1e293b' }}>Wie kann ich helfen?</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>Stelle eine Frage, lass Meldungen bearbeiten oder Texte verfassen.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, width: '100%', maxWidth: 800 }}>
                {SCHNELLSTARTS.map(s => (
                  <button key={s.text} onClick={() => sendMsg(s.text)}
                    style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: '#374151', lineHeight: 1.4 }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#1e293b')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontWeight: 500 }}>{s.text}</span>
                  </button>
                ))}
              </div>
              {offeneSchaeden.length > 0 && (
                <div style={{ width: '100%', maxWidth: 800 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Offene Meldungen — direkt analysieren</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {offeneSchaeden.slice(0, 8).map((f: AnyRecord) => (
                      <button key={f.id}
                        onClick={() => sendMsg(`Analysiere Meldung #${f.fallNummer ?? '?'} vollständig: "${f.titel}". Status: ${statusLabel(f.status)}, Priorität: ${f.prioritaet ?? 'Normal'}, Kategorie: ${f.kategorie ?? '?'}. Beschreibung: ${f.beschreibung ?? 'keine'}. Wähle den besten Handwerker und bereite alles vor.`)}
                        style={{ background: ['Dringend','Hoch'].includes(f.prioritaet) ? '#fef2f2' : '#f8fafc', border: `1px solid ${['Dringend','Hoch'].includes(f.prioritaet) ? '#fecaca' : '#e5e7eb'}`, borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: ['Dringend','Hoch'].includes(f.prioritaet) ? '#dc2626' : '#374151', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span>{['Dringend','Hoch'].includes(f.prioritaet) ? '🔴' : '🟡'}</span>
                        #{f.fallNummer ?? '?'} {String(f.titel ?? '').substring(0, 30)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
              {m.role === 'assistant' && <div style={{ fontSize: 11, color: '#9ca3af', paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 5 }}><span>✦</span> IMMOBILIENTOOL KI</div>}
              <div style={{ maxWidth: '78%', background: m.role === 'user' ? '#1e293b' : '#fff', color: m.role === 'user' ? '#fff' : '#111827', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '12px 16px', fontSize: 14, lineHeight: 1.65, border: m.role === 'assistant' ? '1px solid #e5e7eb' : 'none', boxShadow: m.role === 'assistant' ? '0 1px 4px rgba(0,0,0,.05)' : 'none' }}>
                {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
              </div>
              {m.role === 'assistant' && <button onClick={() => copyText(m.content, i)} style={{ fontSize: 11, color: copied === i ? '#166534' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', paddingLeft: 4 }}>{copied === i ? '✓ Kopiert' : '⎘ Kopieren'}</button>}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 5 }}><span>✦</span> IMMOBILIENTOOL KI</div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px 18px 18px 4px', padding: '12px 18px', display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0,1,2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />)}
              </div>
            </div>
          )}

          {aktionenListe.filter((_, i) => !abgelehnte.includes(i)).length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}><span>✦</span> KI-Vorschläge — prüfen und bestätigen</div>
              {aktionenListe.map((a, i) => abgelehnte.includes(i) ? null : (
                <AktionsKarte key={i} aktion={a} save={save} remove={remove} data={data} onAblehnen={() => setAbgelehnte(prev => [...prev, i])} />
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Eingabe */}
        <div style={{ flexShrink: 0, padding: '10px 24px 18px', borderTop: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              placeholder="Frage stellen oder Auftrag erteilen … (Enter = Senden, Shift+Enter = Zeilenumbruch)"
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.5, minHeight: 22, maxHeight: 120, fontFamily: 'inherit', background: 'transparent' }}
              rows={1} onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }}
            />
            <button onClick={() => sendMsg()} disabled={loading || !input.trim()}
              style={{ background: loading || !input.trim() ? '#e5e7eb' : '#1e293b', color: loading || !input.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', cursor: loading || !input.trim() ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
              {loading ? '…' : 'Senden ↵'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#c4c9d4', textAlign: 'center', marginTop: 5 }}>
            Enter = Senden · Shift+Enter = Neue Zeile · Chats werden lokal für {employee?.name ?? 'dich'} gespeichert
          </div>
        </div>
      </div>

    </div>
  );
}

// ── IMMOBILIENTOOL KI-Assistent ──────────────────────────────────────────────────────

function PortalKIAssistent({ context, systemPrompt, buttonLabel }: {
  context?: string;
  systemPrompt?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    const res = await bedrockChatAnfrage(next, systemPrompt, context);
    setMessages([...next, { role: 'assistant', content: res.antwort }]);
    setLoading(false);
  };

  const W: React.CSSProperties = {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12,
  };
  const PANEL: React.CSSProperties = {
    width: 380, maxHeight: '70vh', background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,.14)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };
  const BTN: React.CSSProperties = {
    width: 52, height: 52, borderRadius: '50%', background: '#1e293b', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,.25)',
  };

  return (
    <div style={W}>
      {open && (
        <div style={PANEL}>
          {/* Header */}
          <div style={{ background: '#1e293b', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>✦ IMMOBILIENTOOL KI-Assistent</div>
              <div style={{ fontSize: 11, opacity: .7 }}>Claude Haiku 4.5 · AWS Bedrock Frankfurt</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: '#6b7280', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                Wie kann ich helfen?{context ? <><br /><span style={{ fontSize: 11 }}>Kontext geladen ✓</span></> : null}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? '#1e293b' : '#f1f5f9',
                color: m.role === 'user' ? '#fff' : '#111827',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '8px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>{m.content}</div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', borderRadius: '16px 16px 16px 4px', padding: '8px 14px', fontSize: 13, color: '#6b7280' }}>
                <span style={{ display: 'inline-block', animation: 'pulse 1s infinite' }}>···</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Input */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 12px', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Nachricht eingeben…"
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }}
            />
            <button onClick={send} disabled={loading || !input.trim()} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading || !input.trim() ? .5 : 1 }}>
              ↑
            </button>
          </div>
        </div>
      )}
      <button style={BTN} onClick={() => setOpen(o => !o)} title={buttonLabel ?? 'IMMOBILIENTOOL KI-Assistent'}>
        {open ? '✕' : '✦'}
      </button>
    </div>
  );
}

function SchadenKIAssist({ schaden }: { schaden: AnyRecord }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const ctx = `Schadenfall: "${schaden.titel ?? ''}" | Status: ${schaden.status ?? ''} | Priorität: ${schaden.prioritaet ?? ''} | Kategorie: ${schaden.kategorie ?? ''} | Beschreibung: ${schaden.beschreibung ?? ''} | Liegenschaft-ID: ${schaden.liegenschaftId ?? ''}`;

  const send = async () => {
    const text = input.trim(); if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next); setInput(''); setLoading(true);
    const res = await bedrockChatAnfrage(next, 'Du hilfst beim Bearbeiten eines Schadensfalls. Mache konkrete Vorschläge für Priorität, Kategorie, Handwerker-Anweisung und Antwort-Nachrichten.', ctx);
    setMessages([...next, { role: 'assistant', content: res.antwort }]);
    setLoading(false);
  };

  const STARTERS = [
    'Priorität einschätzen',
    'Antwort-Vorlage erstellen',
    'Handwerker-Anweisung formulieren',
    'Zusammenfassung für Eigentümer',
  ];

  return (
    <div>
      <button className="secondary" onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <span>✦</span> {open ? 'KI schließen' : 'KI-Assistent'}
      </button>
      {open && (
        <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>✦ IMMOBILIENTOOL KI — Schadenfall-Assist</div>
          <div style={{ padding: 12, display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6' }}>
            {STARTERS.map(s => (
              <button key={s} onClick={() => { setInput(s); }} style={{ fontSize: 11, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Schadenfall-Kontext geladen. Stelle eine Frage oder wähle einen Schnellstart.</p>}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.role === 'user' ? '#1e293b' : '#f8fafc', color: m.role === 'user' ? '#fff' : '#111', borderRadius: 10, padding: '7px 11px', fontSize: 13 }}>{m.role === 'assistant' ? renderMarkdown(m.content) : m.content}</div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: '#9ca3af', fontSize: 13 }}>···</div>}
            <div ref={endRef} />
          </div>
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 12px', display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} placeholder="Frage stellen…" style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
            <button onClick={send} disabled={loading || !input.trim()} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', opacity: loading || !input.trim() ? .5 : 1 }}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  const [resolvedUrl, setResolvedUrl] = React.useState<string>('');
  React.useEffect(() => {
    if (!url) { setResolvedUrl(''); return; }
    if (url.startsWith('http')) { setResolvedUrl(url); return; }
    // S3-Pfad → signierte URL auflösen
    getUrl({ path: url }).then(r => setResolvedUrl(r.url.toString())).catch(() => setResolvedUrl(''));
  }, [url]);
  return resolvedUrl
    ? <img className="avatar" src={resolvedUrl} alt={name} onError={() => setResolvedUrl('')} />
    : <span className="avatar">{initials(name)}</span>;
}
function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }
function Title({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) { return <div className="title"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{actions && <div className="title-actions">{actions}</div>}</div>; }
function Panel({ title, children, className = '' }: any) { return <section className={`panel ${className}`}><h2>{title}</h2>{children}</section>; }
function propertyName(data: Record<string, AnyRecord[]>, id?: string) { const l = data.Liegenschaft.find(x => x.id === id); return l ? `${l.liegenschaftNummer} · ${l.name}` : 'Ohne Liegenschaft'; }
function personName(data: Record<string, AnyRecord[]>, id?: string) {
  const person = data.KontaktPerson.find(x => x.id === id);
  return person ? personDisplayName(person) : 'Ohne Person';
}
function workerName(data: Record<string, AnyRecord[]>, id?: string) { return data.Handwerker.find(x => x.id === id)?.firma ?? 'Kein Handwerker'; }
function employeeName(data: Record<string, AnyRecord[]>, id?: string) { return data.Mitarbeiter.find(x => x.id === id)?.name ?? 'Nicht zugewiesen'; }
  const PROPERTY_STATUS_OPTIONS = ['Aktiv', 'Inaktiv', 'Archiviert', 'Gelöscht'];
  const PROPERTY_TYPE_OPTIONS = ['Mietliegenschaft', 'STWEG', 'Gewerbe', 'Wohnliegenschaft', 'Gemischt', 'Sonstiges'];
  const PERSON_ROLE_OPTIONS = ['Mieter', 'Eigentümer', 'Hauswart', 'Beirat', 'Kontaktperson', 'Handwerker'];
const PERSON_STATUS_OPTIONS = ['Aktiv', 'Nicht eingeladen', 'Einladung ausstehend', 'Inaktiv', 'Archiviert', 'Gelöscht'];
const EMPLOYEE_FUNCTION_OPTIONS = [
  'Geschäftsführer',
  'Geschäftsführerin',
  'Inhaber',
  'Mitinhaberin',
  'Admin / Developer',
  'Buchhaltung / Entwicklung',
  'Buchhalter',
  'Buchhalterin',
  'Bewirtschafter',
  'Bewirtschafterin',
  'Immobilienverwalter',
  'Assistent Bewirtschaftung',
  'Administration / Sekretariat',
  'HR / Lohn',
  'Support',
  'Sachbearbeiter',
  'Praktikant',
  'Sonstiges',
];

const EMPLOYEE_GRUPPE_OPTIONS = [
  'CEO / Geschäftsführung',
  'Bewirtschaftung',
  'HR',
  'Buchhaltung',
  'Support',
  'Buchhaltung & Entwicklung',
];

const EMPLOYEE_STATUS_OPTIONS = ['Aktiv', 'Inaktiv', 'Urlaub', 'Archiviert'];

function nextCaseNumber(data: Record<string, AnyRecord[]>) {
  const year = new Date().getFullYear();
  const max = data.Schadenfall.reduce((highest: number, fall: AnyRecord) => {
    const match = String(fall.fallNummer ?? '').match(/^(\d{4})-(\d+)$/);
    if (!match || Number(match[1]) !== year) return highest;
    return Math.max(highest, Number(match[2]));
  }, 0);
  return `${year}-${max + 1}`;
}

const toAwsDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const isNewLocalId = (id?: string) => !id || id.startsWith('tmp-');
const cleanDeletedName = (name?: string) => String(name ?? '').replace(/^\[GELÖSCHT\]\s*/i, '').trim();

const splitPersonName = (person: AnyRecord) => {
  const rawName = cleanDeletedName(person.name);
  const parts = rawName.split(/\s+/).filter(Boolean);
  const vorname = String(person.vorname ?? parts.slice(0, -1).join(' ') ?? '').trim();
  const nachname = String(person.nachname ?? parts.at(-1) ?? '').trim();
  return {
    vorname: vorname || (parts.length === 1 ? parts[0] : ''),
    nachname,
  };
};

const personDisplayName = (person: AnyRecord) => {
  const { vorname, nachname } = splitPersonName(person);
  return [vorname, nachname].filter(Boolean).join(' ') || cleanDeletedName(person.name) || 'Ohne Name';
};

const propertyPayload = (property: AnyRecord) => ({
  id: property.id,
  liegenschaftNummer: property.liegenschaftNummer,
  name: property.name,
  strasse: property.strasse,
  plz: property.plz,
  ort: property.ort,
  typ: property.typ || 'Mietliegenschaft',
  status: property.status || 'Aktiv',
  zustand: property.zustand,
  zustandText: property.zustandText,
  verwalterId: property.verwalterId || undefined,
});

const personPayload = (person: AnyRecord) => ({
  id: person.id,
  liegenschaftId: person.liegenschaftId,
  vorname: splitPersonName(person).vorname,
  nachname: splitPersonName(person).nachname,
  name: personDisplayName(person),
  rolle: person.rolle || 'Mieter',
  email: String(person.email ?? '').trim(),
  telefon: String(person.telefon ?? '').trim(),
  adresse: String(person.adresse ?? '').trim(),
  kontoStatus: person.kontoStatus || 'Nicht eingeladen',
  wohnungsNummer: String(person.wohnungsNummer ?? '').trim(),
  stockwerk: String(person.stockwerk ?? '').trim(),
  cognitoSub: person.cognitoSub || undefined,
  portalSichtbar: person.portalSichtbar !== false,
});

const casePayload = (fall: AnyRecord) => ({
  id: fall.id,
  fallNummer: fall.fallNummer || undefined,
  titel: fall.titel || 'Neue Meldung',
  beschreibung: fall.beschreibung || 'Bitte Beschreibung ergänzen.',
  status: statusValue(fall.status),
  prioritaet: fall.prioritaet || 'Normal',
  kategorie: fall.kategorie || 'Schaden',
  liegenschaftId: fall.liegenschaftId || undefined,
  personId: fall.personId || undefined,
  liegenschaftAdresse: fall.liegenschaftAdresse || '',
  plzOrt: fall.plzOrt || '',
  fotoUrl: fall.fotoUrl || undefined,
  gemeldetVon: fall.gemeldetVon || undefined,
  frist: toAwsDate(fall.frist),
  verantwortlicherMitarbeiterId: fall.verantwortlicherMitarbeiterId || undefined,
  handwerkerId: fall.handwerkerId || undefined,
});

function Dashboard({ data, rights, employee, setView, setSelectedPropertyId, setSelectedCaseId }: any) {
  const offeneFaelle = data.Schadenfall
    .filter((f: AnyRecord) => ['OFFEN', 'NEU'].includes(statusValue(f.status)))
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(b.createdAt ?? b.erstelltAm ?? '').localeCompare(String(a.createdAt ?? a.erstelltAm ?? ''))
    );

  const bearbeitungFaelle = data.Schadenfall
    .filter((f: AnyRecord) => statusValue(f.status) === 'IN_BEARBEITUNG')
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? ''))
    );

  const pendingChanges = data.StammdatenAenderung.filter((x: AnyRecord) => x.status === 'Offen');
  const activeProperties = data.Liegenschaft.filter((l: AnyRecord) => !['Archiviert', 'Gelöscht'].includes(l.status));
  const activeWorkers = data.Handwerker.filter((h: AnyRecord) => h.status !== 'Archiviert' && h.status !== 'Gelöscht');
  const highPriority = offeneFaelle.filter((f: AnyRecord) => ['Hoch', 'Dringend', 'Notfall'].includes(f.prioritaet));

  const todayTerms = data.KalenderTermin.filter(
    (t: AnyRecord) => new Date(t.start).toDateString() === new Date().toDateString()
  );
  const upcomingTerms = data.KalenderTermin
    .filter((t: AnyRecord) => new Date(t.start).getTime() >= Date.now() - 3600000)
    .sort((a: AnyRecord, b: AnyRecord) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);
  const newestCases = [...offeneFaelle, ...bearbeitungFaelle].slice(0, 5);
  const firstName = String(employee?.name ?? 'Team').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend';

  return (
    <div>
      <Title title="Dashboard" sub={`${greeting} ${firstName}. Alles Wichtige für heute in einer Ansicht.`} actions={
        <div style={{ position: 'relative' }}>
          <KIFlyout label="KI-Tagesübersicht" systemPrompt="Du gibst einen kompakten Tagesbriefing für einen Immobilienverwalter." kontext={`Offene Meldungen: ${offeneFaelle.length}, davon dringend: ${highPriority.length}. In Bearbeitung: ${bearbeitungFaelle.length}. Termine heute: ${todayTerms.length}. Liegenschaften: ${activeProperties.length}. Handwerker: ${activeWorkers.length}.`} schnellstarts={['Tagesübersicht geben', 'Dringende Aufgaben priorisieren', 'Was sollte ich heute zuerst erledigen?']} />
        </div>
      } />

      {/* KI-Autopilot: Fälle ohne Handwerker */}
      {(() => {
        const ohneHW = offeneFaelle.filter((f: AnyRecord) => !f.handwerkerId);
        if (ohneHW.length === 0) return null;
        return (
          <div style={{ margin: '0 0 20px', padding: '14px 18px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>✦</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>KI-Autopilot: {ohneHW.length} Meldung{ohneHW.length !== 1 ? 'en' : ''} ohne Handwerker</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Öffne einen Fall — KI analysiert automatisch und wählt den passenden Handwerker</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ohneHW.slice(0, 4).map((f: AnyRecord) => (
                <button key={f.id} onClick={() => { setSelectedCaseId(f.id); setView('fallDetail'); }} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  #{f.fallNummer ?? '?'} {String(f.titel ?? '').substring(0, 22)}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="dashboard-shell">
        <section className="dashboard-hero">
          <div>
            <span className="dashboard-eyebrow">Arbeitszentrale</span>
            <h2>{highPriority.length ? `${highPriority.length} dringende Meldung${highPriority.length === 1 ? '' : 'en'}` : 'Keine dringenden Meldungen'}</h2>
            <p>{offeneFaelle.length} offen, {bearbeitungFaelle.length} in Bearbeitung, {todayTerms.length} Termin{todayTerms.length === 1 ? '' : 'e'} heute.</p>
          </div>
          <div className="dashboard-hero-actions">
            {canAccessView('faelle', rights) && <button className="primary" onClick={() => setView('faelle')}>Meldungen öffnen</button>}
            {canAccessView('kalender', rights) && <button onClick={() => setView('kalender')}>Kalender</button>}
          </div>
        </section>

        <div className="kpis compact dashboard-kpis">
          <Metric label="Offen" value={offeneFaelle.length} tone="red" hint={`${highPriority.length} dringend`} />
          <Metric label="In Arbeit" value={bearbeitungFaelle.length} tone="blue" hint="laufende Fälle" />
          <Metric label="Heute" value={todayTerms.length} tone="orange" hint="Termine" />
          <Metric label="Freigaben" value={pendingChanges.length} tone="green" hint="Stammdaten" />
          <Metric label="Liegenschaften" value={activeProperties.length} hint="aktiv" />
          <Metric label="Handwerker" value={activeWorkers.length} hint="verfügbar" />
        </div>

        <div className="dashboard-workbench">
          <Panel title="Priorität jetzt">
            {newestCases.length === 0 ? (
              <p className="hint">Aktuell sind keine aktiven Meldungen vorhanden.</p>
            ) : (
              newestCases.map((f: AnyRecord) => (
                <button
                  className="work-item"
                  key={f.id}
                  onClick={() => {
                    setSelectedCaseId(f.id);
                    setView('fallDetail');
                  }}
                >
                  <span className={`work-dot ${statusValue(f.status) === 'IN_BEARBEITUNG' ? 'blue' : 'red'}`} />
                  <div>
                    <strong>{f.fallNummer ? `${f.fallNummer} · ` : ''}{f.titel}</strong>
                    <small>{propertyName(data, f.liegenschaftId)} · {personName(data, f.personId)}</small>
                  </div>
                  <Badge tone={f.prioritaet === 'Hoch' ? 'red' : statusValue(f.status) === 'IN_BEARBEITUNG' ? 'blue' : ''}>{f.prioritaet ?? statusLabel(f.status)}</Badge>
                </button>
              ))
            )}
          </Panel>

          <Panel title="Tagesplan">
            {upcomingTerms.length === 0 ? (
              <p className="hint">Keine kommenden Termine geplant.</p>
            ) : (
              upcomingTerms.map((t: AnyRecord) => (
                <div className="schedule-item" key={t.id}>
                  <div>
                    <strong>{new Date(t.start).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</strong>
                    <span>{new Date(t.start).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                  <section>
                    <strong>{t.titel}</strong>
                    <small>{propertyName(data, t.liegenschaftId)} · {t.ort || t.typ}</small>
                  </section>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Schnellzugriff">
            <div className="dashboard-actions">
              {canAccessView('faelle', rights) && <button onClick={() => setView('faelle')}><span>⚠️</span><strong>Meldung prüfen</strong><small>Liste und Chat öffnen</small></button>}
              {canAccessView('liegenschaften', rights) && <button onClick={() => setView('liegenschaften')}><span>🏢</span><strong>Liegenschaft suchen</strong><small>Objekt, Parteien, Dokumente</small></button>}
              {canAccessView('handwerker', rights) && <button onClick={() => setView('handwerker')}><span>🔧</span><strong>Handwerker</strong><small>Auslastung und Historie</small></button>}
              {canAccessView('mitarbeiter', rights) && <button onClick={() => setView('mitarbeiter')}><span>👥</span><strong>Mitarbeiter</strong><small>Rechte und Einladungen</small></button>}
            </div>
          </Panel>

          <Panel title="Freigaben">
            {pendingChanges.length === 0 ? (
              <p className="hint">Keine offenen Stammdatenänderungen.</p>
            ) : (
              pendingChanges.slice(0, 5).map((change: AnyRecord) => (
                <div className="approval-item" key={change.id}>
                  <div>
                    <strong>{change.eingereichtVon || personName(data, change.personId)}</strong>
                    <span>{labelFor(change.feld)}: {String(change.neuerWert || '-')}</span>
                  </div>
                  <Badge tone="orange">Offen</Badge>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone, hint }: any) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function PropertyList({ data, setView, setSelectedPropertyId, setPropertyDraft }: any) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Alle');
  const [modus, setModus] = useState<'aktiv' | 'archiv' | 'geloescht'>('aktiv');

  const list = data.Liegenschaft
    .filter((l: AnyRecord) => {
      const search = JSON.stringify(l).toLowerCase().includes(q.toLowerCase());
      const geloescht = l.status === 'Gelöscht' || String(l.name ?? '').startsWith('[GELÖSCHT]');
      const archiviert = l.status === 'Archiviert';
      const aktiv = !archiviert && !geloescht;

      const modusOk =
        modus === 'aktiv' ? aktiv :
        modus === 'archiv' ? archiviert :
        geloescht;

      const statusOk = status === 'Alle' || l.status === status;

      return search && modusOk && statusOk;
    })
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(a.liegenschaftNummer ?? '').localeCompare(String(b.liegenschaftNummer ?? ''))
    );

  const neueLiegenschaft = () => {
    const neue = {
      id: `tmp-lg-${uid()}`,
      liegenschaftNummer: '',
      name: '',
      strasse: '',
      plz: '',
      ort: '',
      typ: 'Mietliegenschaft',
      status: 'Aktiv',
      zustandText: '',
      verwalterId: '',
      verwaltungsbeginn: new Date().toISOString().slice(0, 10),
      einheiten: 1,
      createdAt: nowIso(),
    };

    setSelectedPropertyId(neue.id);
    setPropertyDraft(neue);
    setView('liegenschaftDetail');
  };

  return (
    <div>
      <Title
        title={
          modus === 'aktiv'
            ? 'Liegenschaften'
            : modus === 'archiv'
              ? 'Archivierte Liegenschaften'
              : 'Gelöschte Liegenschaften'
        }
        sub="Liegenschaften verwalten, erfassen, archivieren oder wiederherstellen."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="primary small" onClick={neueLiegenschaft}>
              Neue Liegenschaft erfassen
            </button>
            <button className="small" onClick={() => setModus('aktiv')}>Aktiv</button>
            <button className="small" onClick={() => setModus('archiv')}>Archiviert</button>
            <button className="small" onClick={() => setModus('geloescht')}>Gelöscht</button>
          </div>
        }
      />

      <Panel title="Liegenschaftsliste" className="full-list">
        <div className="list-toolbar">
          <input
            className="search"
            placeholder="Suche nach Nummer, Name, Adresse oder Ort ..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />

          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option>Alle</option>
            {PROPERTY_STATUS_OPTIONS.map(x => <option key={x}>{x}</option>)}
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Name</th>
              <th>Adresse</th>
              <th>Ort</th>
              <th>Typ</th>
              <th>Zuständig</th>
              <th>Parteien</th>
              <th>Offene Fälle</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {list.map((l: AnyRecord) => (
              <tr
                key={l.id}
                onClick={() => {
                  setSelectedPropertyId(l.id);
                  setView('liegenschaftDetail');
                }}
              >
                <td>{l.liegenschaftNummer || '—'}</td>
                <td><strong>{l.name || 'Neue Liegenschaft'}</strong></td>
                <td>{l.strasse || '—'}</td>
                <td>{[l.plz, l.ort].filter(Boolean).join(' ') || '—'}</td>
                <td>{l.typ || '—'}</td>
                <td>{employeeName(data, l.verwalterId)}</td>
                <td>{data.KontaktPerson.filter((p: AnyRecord) => p.liegenschaftId === l.id && p.kontoStatus !== 'Gelöscht').length}</td>
                <td>{data.Schadenfall.filter((f: AnyRecord) => f.liegenschaftId === l.id && !['ERLEDIGT', 'Erledigt', 'Archiviert'].includes(f.status)).length}</td>
                <td>
                  <Badge tone={l.status === 'Aktiv' ? 'green' : l.status === 'Gelöscht' ? 'red' : 'orange'}>
                    {l.status || 'Aktiv'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
function PropertyDetailPage({ data, selectedPropertyId, propertyDraft, setPropertyDraft, tab, setTab, save, remove, refreshKontaktPersonen, setView, setSelectedPersonId, setSelectedCaseId, setSelectedWorkerId, setSelectedPropertyId }: any) {
  const property = data.Liegenschaft.find((l: AnyRecord) => l.id === selectedPropertyId) ?? (propertyDraft?.id === selectedPropertyId ? propertyDraft : data.Liegenschaft[0]);
  const isDraft = isNewLocalId(property?.id);
  const [edit, setEdit] = useState(!property?.name || !property?.strasse || !property?.plz || !property?.ort);
  const [draft, setDraft] = useState<AnyRecord>(property ?? {});
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    setDraft(property ?? {});
    setFehler('');
    if (!property?.name || !property?.strasse || !property?.plz || !property?.ort) {
      setEdit(true);
    }
  }, [property?.id, propertyDraft?.id]);

  if (!property) {
    return (
      <div>
        <Title title="Liegenschaft nicht gefunden" sub="Die gespeicherte Auswahl ist nicht mehr vorhanden oder AWS lädt noch." actions={<button onClick={() => setView('liegenschaften')}>Zur Liegenschaftsliste</button>} />
        <div className="content-wrap">
          <Panel title="Keine Daten">
            <p className="hint">Bitte öffnen Sie eine echte Liegenschaft aus der Liste.</p>
          </Panel>
        </div>
      </div>
    );
  }

  const tabs: PropertyTab[] = ['Übersicht', 'Stammdaten', 'Objekte', 'Parteien', 'Meldungen', 'Termine', 'Dokumente', 'Abschlüsse', 'Schlüssel', 'Geräte', 'Chat', 'Historie'];

  const validieren = () => {
    if (!draft.liegenschaftNummer?.trim()) return 'Liegenschaftsnummer ist ein Pflichtfeld.';
    if (!draft.name?.trim()) return 'Name ist ein Pflichtfeld.';
    if (!draft.strasse?.trim()) return 'Strasse ist ein Pflichtfeld.';
    if (!draft.plz?.trim()) return 'PLZ ist ein Pflichtfeld.';
    if (!draft.ort?.trim()) return 'Ort ist ein Pflichtfeld.';
    if (!draft.typ?.trim()) return 'Typ ist ein Pflichtfeld.';
    return '';
  };

  const speichern = async () => {
    const error = validieren();
    if (error) {
      setFehler(error);
      return;
    }

    const localDraft = {
      ...draft,
      id: isDraft ? `lg-${uid()}` : property.id,
      liegenschaftNummer: String(draft.liegenschaftNummer).trim(),
      name: String(draft.name).trim(),
      strasse: String(draft.strasse).trim(),
      plz: String(draft.plz).trim(),
      ort: String(draft.ort).trim(),
      typ: draft.typ || 'Mietliegenschaft',
      status: draft.status || 'Aktiv',
      zustandText: draft.zustandText ?? '',
      verwalterId: draft.verwalterId || undefined,
      verwaltungsbeginn: toAwsDate(draft.verwaltungsbeginn),
      einheiten: Number(draft.einheiten || 1),
      updatedAt: nowIso(),
    };
    const payload = propertyPayload(localDraft);

    const result = await save('Liegenschaft', payload);
    if (!result?.ok) {
      setFehler('Liegenschaft konnte nicht in AWS gespeichert werden. Bitte Backend-Schema deployen und erneut speichern.');
      return;
    }

    setPropertyDraft(null);
    setSelectedPropertyId(payload.id);
    setDraft(localDraft);
    setEdit(false);
    setFehler('');
  };

  const archivieren = async () => {
    const ok = window.confirm(`Liegenschaft "${property.name}" archivieren?`);
    if (!ok) return;

    const result = await save('Liegenschaft', propertyPayload({
      ...property,
      status: 'Archiviert',
      updatedAt: nowIso(),
    }));
    if (!result?.ok) {
      setFehler('Archivieren konnte nicht in AWS gespeichert werden. Bitte Backend-Schema/Deployment prüfen.');
      return;
    }

    setView('liegenschaften');
  };

  const wiederherstellen = async () => {
    const result = await save('Liegenschaft', propertyPayload({
      ...property,
      name: String(property.name ?? '').replace('[GELÖSCHT] ', ''),
      status: 'Aktiv',
      updatedAt: nowIso(),
    }));
    if (!result?.ok) {
      setFehler('Wiederherstellen konnte nicht in AWS gespeichert werden. Bitte Backend-Schema/Deployment prüfen.');
      return;
    }

    setView('liegenschaften');
  };

  const loeschen = async () => {
    const ok = window.confirm(`Liegenschaft "${property.name}" wirklich als gelöscht markieren?`);
    if (!ok) return;

    const result = await save('Liegenschaft', propertyPayload({
      ...property,
      name: String(property.name ?? '').startsWith('[GELÖSCHT]')
        ? property.name
        : `[GELÖSCHT] ${property.name}`,
      status: 'Gelöscht',
      updatedAt: nowIso(),
    }));
    if (!result?.ok) {
      setFehler('Löschen konnte nicht in AWS gespeichert werden. Bitte Backend-Schema/Deployment prüfen.');
      return;
    }

    setView('liegenschaften');
  };

  const istArchiviertOderGeloescht = property.status === 'Archiviert' || property.status === 'Gelöscht';

  return (
    <div>
      <Title
        title={`${property.liegenschaftNummer || '—'} · ${property.name || 'Neue Liegenschaft'}`}
        sub={`${property.strasse || ''}, ${property.plz || ''} ${property.ort || ''}`}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => { if (isDraft) setPropertyDraft(null); setView('liegenschaften'); }}>Zurück zur Liste</button>
            <button className="small" onClick={() => setEdit(!edit)}>
              {edit ? 'Bearbeitung abbrechen' : 'Bearbeiten'}
            </button>

            {istArchiviertOderGeloescht ? (
              <button className="primary small" onClick={wiederherstellen}>Wiederherstellen</button>
            ) : (
              <button className="small" onClick={archivieren}>Archivieren</button>
            )}

            <button className="danger small" onClick={loeschen}>Löschen</button>
          </div>
        }
      />

      {edit && (
        <Panel title="Liegenschaft bearbeiten">
          {fehler && <p style={{ color: '#dc2626', fontWeight: 800 }}>{fehler}</p>}

          <div className="form-grid">
            <label>
              Liegenschaftsnummer *
              <input value={draft.liegenschaftNummer ?? ''} onChange={e => setDraft({ ...draft, liegenschaftNummer: e.target.value })} />
            </label>

            <label>
              Name *
              <input value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>

            <label>
              Strasse *
              <input value={draft.strasse ?? ''} onChange={e => setDraft({ ...draft, strasse: e.target.value })} />
            </label>

            <label>
              PLZ *
              <input value={draft.plz ?? ''} onChange={e => setDraft({ ...draft, plz: e.target.value })} />
            </label>

            <label>
              Ort *
              <input value={draft.ort ?? ''} onChange={e => setDraft({ ...draft, ort: e.target.value })} />
            </label>

            <label>
              Typ *
              <select value={draft.typ ?? 'Mietliegenschaft'} onChange={e => setDraft({ ...draft, typ: e.target.value })}>
                {PROPERTY_TYPE_OPTIONS.map(x => <option key={x}>{x}</option>)}
              </select>
            </label>

            <label>
              Status
              <select value={draft.status ?? 'Aktiv'} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                {PROPERTY_STATUS_OPTIONS.map(x => <option key={x}>{x}</option>)}
              </select>
            </label>

            <label>
              Zuständiger Mitarbeiter
              <select value={draft.verwalterId ?? ''} onChange={e => setDraft({ ...draft, verwalterId: e.target.value })}>
                <option value="">Nicht zugewiesen</option>
                {data.Mitarbeiter.map((m: AnyRecord) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>

            <label>
              Verwaltungsbeginn
              <input type="date" value={draft.verwaltungsbeginn ?? ''} onChange={e => setDraft({ ...draft, verwaltungsbeginn: e.target.value })} />
            </label>

            <label>
              Einheiten
              <input type="number" value={draft.einheiten ?? 1} onChange={e => setDraft({ ...draft, einheiten: Number(e.target.value) })} />
            </label>

            <label>
              Zustand / Bemerkung
              <textarea value={draft.zustandText ?? ''} onChange={e => setDraft({ ...draft, zustandText: e.target.value })} />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button onClick={() => { if (isDraft) { setPropertyDraft(null); setView('liegenschaften'); } else { setEdit(false); } }}>Abbrechen</button>
            <button className="primary" onClick={speichern}>Speichern</button>
          </div>
        </Panel>
      )}

      <div className="content-wrap">
        <div className="tabs sticky-tabs">
          {tabs.map(t => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <PropertyTabContent
          tab={tab}
          data={data}
          property={property}
          save={save}
          remove={remove}
          refreshKontaktPersonen={refreshKontaktPersonen}
          setView={setView}
          setSelectedPersonId={setSelectedPersonId}
          setSelectedCaseId={setSelectedCaseId}
          setSelectedWorkerId={setSelectedWorkerId}
        />
      </div>
    </div>
  );
}
function PropertyTabContent({ tab, data, property, save, remove, refreshKontaktPersonen, setView, setSelectedPersonId, setSelectedCaseId, setSelectedWorkerId }: any) {
  const persons = data.KontaktPerson.filter((p: AnyRecord) => p.liegenschaftId === property.id);
  const cases = data.Schadenfall.filter((f: AnyRecord) => f.liegenschaftId === property.id);
  const terms = data.KalenderTermin.filter((t: AnyRecord) => t.liegenschaftId === property.id);
  if (tab === 'Übersicht') return <div className="grid two"><Panel title="Stammdaten"><div className="info-grid"><Info label="Liegenschaftsnummer" value={property.liegenschaftNummer}/><Info label="Typ" value={property.typ}/><Info label="Status" value={property.status}/><Info label="Verwaltungsbeginn" value={property.verwaltungsbeginn}/><Info label="Zuständig" value={employeeName(data, property.verwalterId)}/><Info label="Einheiten" value={property.einheiten}/></div></Panel><Panel title="Kurzüberblick"><div className="mini-kpis"><Metric label="Parteien" value={persons.length}/><Metric label="Offene Meldungen" value={cases.filter((f: AnyRecord) => !['ERLEDIGT','ARCHIVIERT'].includes(statusValue(f.status))).length}/><Metric label="Termine" value={terms.length}/><Metric label="Schlüssel" value={data.Schluessel.filter((s: AnyRecord)=>s.liegenschaftId===property.id).length}/></div></Panel></div>;
  if (tab === 'Stammdaten') return <Panel title="Stammdaten bearbeiten"><EditFields item={property} fields={['liegenschaftNummer','name','strasse','plz','ort','typ','status','verwaltungsbeginn','einheiten','zustandText']} onSave={(x) => save('Liegenschaft', propertyPayload(x))} /></Panel>;
  if (tab === 'Parteien') {
  return (
    <PropertyParties
      data={data}
      property={property}
      save={save}
      refreshKontaktPersonen={refreshKontaktPersonen}
      setView={setView}
      setSelectedPersonId={setSelectedPersonId}
    />
  );
}
  if (tab === 'Meldungen') return <Panel title="Meldungen dieser Liegenschaft">{cases.map((f: AnyRecord)=><button className="list-row clickable" onClick={()=>{setSelectedCaseId(f.id); setView('fallDetail')}}><div><strong>{f.fallNummer || '—'} · {f.titel}</strong><span>{personName(data,f.personId)} · {f.kategorie}</span></div><Badge tone={f.prioritaet==='Hoch'?'red':''}>{statusLabel(statusValue(f.status))}</Badge></button>)}</Panel>;
  if (tab === 'Termine') return <Panel title="Termine dieser Liegenschaft">{terms.map((t: AnyRecord)=><div className="list-row"><div><strong>{t.titel}</strong><span>{deDate(t.start)} · {workerName(data,t.handwerkerId)}</span></div><Badge>{t.typ}</Badge></div>)}</Panel>;
  if (tab === 'Dokumente') return <Documents data={data} propertyId={property.id} save={save} />;
  if (tab === 'Abschlüsse') return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><NebenkostenUpload data={data} property={property} save={save} /><Closings data={data} propertyId={property.id} save={save} /></div>;
  if (tab === 'Schlüssel') return <Keys data={data} property={property} propertyId={property.id} save={save} remove={remove} setSelectedWorkerId={setSelectedWorkerId} setView={setView} />;
  if (tab === 'Objekte') return <ObjekteTab data={data} property={property} save={save} setView={setView} setSelectedPersonId={setSelectedPersonId} />;
  if (tab === 'Geräte') return <GeraeteManager data={data} property={property} save={save} />;
  if (tab === 'Chat') return <Chat data={data} propertyId={property.id} save={save} />;
  return <Panel title="Historie"><Timeline items={[...cases, ...terms, ...data.Schluessel.filter((s:AnyRecord)=>s.liegenschaftId===property.id)]} /></Panel>;
}

type PersonenModus = 'aktiv' | 'archiv' | 'geloescht' | 'alle';

const personState = (person: AnyRecord) => {
  const status = String(person.kontoStatus ?? '');
  const name = String(person.name ?? '');
  const geloescht = status === 'Gelöscht' || name.startsWith('[GELÖSCHT]');
  const archiviert = status === 'Archiviert' && !geloescht;
  return { archiviert, geloescht };
};

function PropertyParties({ data, property, save, refreshKontaktPersonen, setView, setSelectedPersonId }: any) {
  const [personenModus, setPersonenModus] = useState<PersonenModus>('aktiv');
  const [editPerson, setEditPerson] = useState<AnyRecord | null>(null);
  const [reloadStatus, setReloadStatus] = useState('');

  const reloadKontaktPersonen = async () => {
    if (!refreshKontaktPersonen) return;
    try {
      setReloadStatus('Personen werden aus AWS geladen ...');
      await refreshKontaktPersonen();
      setReloadStatus('');
    } catch (error: any) {
      console.error('KontaktPerson reload failed:', error);
      setReloadStatus(`Kontaktpersonen konnten nicht aus AWS geladen werden: ${error?.message ?? String(error)}`);
    }
  };

  useEffect(() => {
    reloadKontaktPersonen();
  }, [property.id]);

  const persons = data.KontaktPerson
    .filter((p: AnyRecord) => p.liegenschaftId === property.id)
    .filter((p: AnyRecord) => {
      const { archiviert, geloescht } = personState(p);
      if (personenModus === 'archiv') return archiviert;
      if (personenModus === 'geloescht') return geloescht;
      if (personenModus === 'alle') return true;
      return !archiviert && !geloescht;
    });

  const counts = data.KontaktPerson
    .filter((p: AnyRecord) => p.liegenschaftId === property.id)
    .reduce((acc: Record<PersonenModus, number>, p: AnyRecord) => {
      const { archiviert, geloescht } = personState(p);
      acc.alle += 1;
      if (geloescht) acc.geloescht += 1;
      else if (archiviert) acc.archiv += 1;
      else acc.aktiv += 1;
      return acc;
    }, { aktiv: 0, archiv: 0, geloescht: 0, alle: 0 });

  const panelTitle = personenModus === 'archiv'
    ? 'Archivierte Personen'
    : personenModus === 'geloescht'
      ? 'Gelöschte Personen'
      : personenModus === 'alle'
        ? 'Alle Eigentümer / Mieter / Kontakte'
        : 'Eigentümer / Mieter / Kontakte';

  const wiederherstellen = async (person: AnyRecord) => {
    await save('KontaktPerson', {
      ...person,
      name: cleanDeletedName(person.name) || 'Ohne Name',
      kontoStatus: 'Aktiv',
      portalSichtbar: true,
      updatedAt: nowIso(),
    });
    await reloadKontaktPersonen();
  };

  const neuePerson = () => {
    setEditPerson({
      id: `p-${uid()}`,
      liegenschaftId: property.id,
      vorname: '',
      nachname: '',
      name: '',
      rolle: 'Mieter',
      email: '',
      telefon: '',
      adresse: `${property.strasse ?? ''}, ${property.plz ?? ''} ${property.ort ?? ''}`.trim(),
      wohnungsNummer: '',
      stockwerk: '',
      kontoStatus: 'Nicht eingeladen',
      portalSichtbar: true,
      createdAt: nowIso(),
    });
  };

  return (
    <Panel title={panelTitle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <p className="hint">
          Personen dieser Liegenschaft bleiben in AWS erhalten. Gelöschte oder archivierte Einträge können hier separat angezeigt und wiederhergestellt werden.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="primary small" onClick={neuePerson}>Neue Person erfassen</button>
          <button className="small" onClick={reloadKontaktPersonen}>Aus AWS aktualisieren</button>
          {([
            ['aktiv', `Aktiv (${counts.aktiv})`],
            ['archiv', `Archiviert (${counts.archiv})`],
            ['geloescht', `Gelöscht (${counts.geloescht})`],
            ['alle', `Alle (${counts.alle})`],
          ] as [PersonenModus, string][]).map(([value, label]) => (
            <button
              key={value}
              className={`small ${personenModus === value ? 'selected' : ''}`}
              onClick={() => setPersonenModus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {editPerson && (
        <PersonEditor
          person={editPerson}
          save={save}
          onClose={async () => {
            setEditPerson(null);
            await reloadKontaktPersonen();
          }}
        />
      )}

      {reloadStatus && <p className="hint">{reloadStatus}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Rolle</th>
            <th>Objekt</th>
            <th>E-Mail</th>
            <th>Telefon</th>
            <th>Konto</th>
            <th>Aktionen</th>
          </tr>
        </thead>

        <tbody>
          {persons.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-cell">Keine Personen in dieser Ansicht.</td>
            </tr>
          )}
          {persons.map((p: AnyRecord) => (
            <tr key={p.id} onClick={() => { setSelectedPersonId(p.id); setView('personDetail'); }}>
              <td><strong>{personDisplayName(p)}</strong></td>
              <td>{p.rolle}</td>
              <td>{[p.wohnungsNummer, p.stockwerk].filter(Boolean).join(' · ') || '—'}</td>
              <td>{p.email || '—'}</td>
              <td>{p.telefon || '—'}</td>
              <td>
                <Badge tone={p.kontoStatus === 'Aktiv' ? 'green' : p.kontoStatus === 'Gelöscht' ? 'red' : 'orange'}>
                  {p.kontoStatus ?? 'Nicht eingeladen'}
                </Badge>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="small" onClick={(e) => { e.stopPropagation(); setEditPerson(p); }}>Bearbeiten</button>
                  <button className="small" onClick={(e) => { e.stopPropagation(); setSelectedPersonId(p.id); setView('personDetail'); }}>Öffnen</button>
                  {(personState(p).archiviert || personState(p).geloescht) && (
                    <button className="small" onClick={(e) => { e.stopPropagation(); wiederherstellen(p); }}>Wiederherstellen</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function PersonEditor({ person, save, onClose }: any) {
  const [draft, setDraft] = useState<AnyRecord>(() => {
    const { vorname, nachname } = splitPersonName(person);
    return { ...person, vorname, nachname, name: [vorname, nachname].filter(Boolean).join(' ') || cleanDeletedName(person.name) };
  });
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState('');

  const validieren = () => {
    if (!draft.vorname?.trim()) return 'Vorname ist ein Pflichtfeld.';
    if (!draft.nachname?.trim()) return 'Nachname ist ein Pflichtfeld.';
    if (!draft.rolle?.trim()) return 'Rolle ist ein Pflichtfeld.';
    if (!draft.email?.trim()) return 'E-Mail ist ein Pflichtfeld.';
    return '';
  };

  const draftWithName = (overrides: AnyRecord = {}) => {
    const next = { ...draft, ...overrides };
    const autoName = [next.vorname, next.nachname].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
    const name = overrides.name ?? autoName;
    return { ...next, name };
  };

  const speichern = async () => {
    const error = validieren();
    if (error) {
      setFehler(error);
      return;
    }

    const result = await save('KontaktPerson', {
      ...draftWithName(),
      portalSichtbar: draft.portalSichtbar !== false,
      updatedAt: nowIso(),
    });

    if (!result?.ok) {
      const errorMsg = result?.error?.message || String(result?.error) || 'Unbekannter Fehler';
      console.error('PersonEditor save error:', errorMsg, result);
      setFehler(`Person wurde lokal gespeichert, AWS-Fehler: ${errorMsg}`);
      return;
    }

    onClose();
  };

  const einladungVorbereiten = async () => {
    const error = validieren();
    if (error) {
      setFehler(error);
      return;
    }

    const personResult = await save('KontaktPerson', {
      ...draftWithName(),
      kontoStatus: 'Einladung ausstehend',
      portalSichtbar: true,
      updatedAt: nowIso(),
    });
    if (!personResult?.ok) {
      setFehler('Person wurde lokal gespeichert, der Einladungsauftrag konnte aber nicht sauber synchronisiert werden.');
      return;
    }

    const einladung = {
      id: `ein-${uid()}`,
      email: draft.email,
      rolle: draft.rolle,
      zielTyp: 'KontaktPerson',
      zielId: draft.id,
      status: 'Wird versendet',
      gesendetAm: nowIso(),
      createdBy: 'Verwaltung',
      name: personDisplayName(draftWithName()),
    };

    try {
      const awsInvite = await erstelleEinladungsauftrag(einladung);
      await save('Einladung', {
        id: einladung.id,
        email: einladung.email,
        rolle: einladung.rolle,
        zielTyp: einladung.zielTyp,
        zielId: einladung.zielId,
        gesendetAm: einladung.gesendetAm,
        createdBy: einladung.createdBy,
        status: awsInvite?.status ?? 'Versendet',
        tempPasswordHinweis: awsInvite?.message ?? 'Cognito Einladung wurde versendet.',
      });
      await save('KontaktPerson', {
        ...draftWithName(),
        kontoStatus: awsInvite?.status ?? 'Einladung versendet',
        portalSichtbar: true,
        cognitoSub: awsInvite?.username ?? draft.cognitoSub,
        updatedAt: nowIso(),
      });
    } catch (error: any) {
      setFehler(error?.message ?? 'AWS Einladung konnte nicht versendet werden.');
      return;
    }

    onClose();
  };

  const archivieren = async () => {
    const result = await save('KontaktPerson', {
      ...draftWithName(),
      kontoStatus: 'Archiviert',
      portalSichtbar: false,
      updatedAt: nowIso(),
    });
    if (!result?.ok) {
      setFehler('Archivieren konnte nicht mit AWS synchronisiert werden.');
      return;
    }
    onClose();
  };

  const loeschen = async () => {
    const ok = window.confirm(`Person "${personDisplayName(draft)}" wirklich löschen?`);
    if (!ok) return;

    const result = await save('KontaktPerson', {
      ...draftWithName({ name: `[GELÖSCHT] ${personDisplayName(draftWithName())}` }),
      kontoStatus: 'Gelöscht',
      portalSichtbar: false,
      updatedAt: nowIso(),
    });
    if (!result?.ok) {
      setFehler('Löschen konnte nicht mit AWS synchronisiert werden.');
      return;
    }

    onClose();
  };

  const passwortZuruecksetzen = async () => {
    if (!draft.email?.trim()) { setFehler('E-Mail-Adresse fehlt.'); return; }
    setFehler('');
    setMeldung('Passwort-Reset wird versendet ...');
    try {
      const result = await erstelleEinladungsauftrag({
        id: `ein-${uid()}`,
        email: draft.email.trim(),
        rolle: draft.rolle ?? 'Benutzer',
        zielTyp: 'KontaktPerson',
        zielId: draft.id,
        name: personDisplayName(draftWithName()),
      });
      setMeldung(result?.message ?? 'Passwort-Reset-E-Mail wurde versendet.');
    } catch (error: any) {
      setFehler(error?.message ?? 'Passwort-Reset konnte nicht versendet werden.');
      setMeldung('');
    }
  };

  return (
    <div className="panel" style={{ background: '#f8fafc', marginBottom: 18 }}>
      <h2>Person erfassen / bearbeiten</h2>

      {fehler && <p style={{ color: '#dc2626', fontWeight: 700 }}>{fehler}</p>}
      {meldung && <p style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>{meldung}</p>}

      <div className="form-grid">
        <label>Vorname<input value={draft.vorname ?? ''} onChange={e => setDraft(draftWithName({ vorname: e.target.value }))} /></label>
        <label>Nachname<input value={draft.nachname ?? ''} onChange={e => setDraft(draftWithName({ nachname: e.target.value }))} /></label>

        <label>Rolle
          <select value={draft.rolle ?? 'Mieter'} onChange={e => setDraft({ ...draft, rolle: e.target.value })}>
            {PERSON_ROLE_OPTIONS.map(x => <option key={x}>{x}</option>)}
          </select>
        </label>

        <label>E-Mail<input value={draft.email ?? ''} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
        <label>Telefon<input value={draft.telefon ?? ''} onChange={e => setDraft({ ...draft, telefon: e.target.value })} /></label>
        <label>Adresse<input value={draft.adresse ?? ''} onChange={e => setDraft({ ...draft, adresse: e.target.value })} /></label>
        <label>Wohnung / Einheit<input value={draft.wohnungsNummer ?? ''} onChange={e => setDraft({ ...draft, wohnungsNummer: e.target.value })} /></label>
        <label>Stockwerk<input value={draft.stockwerk ?? ''} onChange={e => setDraft({ ...draft, stockwerk: e.target.value })} /></label>

        <label>Konto-Status
          <select value={draft.kontoStatus ?? 'Nicht eingeladen'} onChange={e => setDraft({ ...draft, kontoStatus: e.target.value })}>
            {PERSON_STATUS_OPTIONS.map(x => <option key={x}>{x}</option>)}
          </select>
        </label>

        <label>In App sichtbar
          <select value={draft.portalSichtbar !== false ? 'true' : 'false'} onChange={e => setDraft({ ...draft, portalSichtbar: e.target.value === 'true' })}>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={onClose}>Abbrechen</button>
        <button onClick={archivieren}>Archivieren</button>
        <button className="danger" onClick={loeschen}>Löschen</button>
        <button onClick={speichern}>Speichern</button>
        {draft.kontoStatus && draft.kontoStatus !== 'Nicht eingeladen' && (
          <button onClick={passwortZuruecksetzen}>Passwort zurücksetzen</button>
        )}
        <button className="primary" onClick={einladungVorbereiten}>Speichern & Einladung vorbereiten</button>
      </div>
    </div>
  );
}

function Info({ label, value }: any) { return <div className="info"><span>{label}</span><strong>{value ?? '—'}</strong></div>; }

type PersonTab = 'Übersicht' | 'Stammdaten' | 'Dokumente' | 'Meldungen' | 'Chat' | 'Termine' | 'Schlüssel' | 'Historie';

function PersonDetailPage({ data, personId, save, setMode, setCustomerViewId, setView, setSelectedCaseId, setSelectedPropertyId, setPropertyTab }: any) {
  const p = data.KontaktPerson.find((x: AnyRecord) => x.id === personId);
  const [tab, setTab] = useState<PersonTab>('Übersicht');
  if (!p) return null;

  const prop = data.Liegenschaft.find((l: AnyRecord) => l.id === p.liegenschaftId);
  const docs = data.Dokument.filter((d: AnyRecord) => d.personId === p.id);
  const cases = data.Schadenfall.filter((f: AnyRecord) => f.personId === p.id);
  const caseIds = new Set(cases.map((f: AnyRecord) => f.id));
  const messages = data.ChatMessage.filter((m: AnyRecord) => m.personId === p.id || caseIds.has(m.schadenfallId));
  const terms = data.KalenderTermin.filter((t: AnyRecord) => t.personIds?.includes(p.id) || caseIds.has(t.schadenfallId));
  const keys = data.Schluessel.filter((s: AnyRecord) => s.personId === p.id);
  const changes = data.StammdatenAenderung.filter((c: AnyRecord) => c.personId === p.id);
  const tabs: PersonTab[] = ['Übersicht', 'Stammdaten', 'Dokumente', 'Meldungen', 'Chat', 'Termine', 'Schlüssel', 'Historie'];

  const openCase = (id: string) => {
    setSelectedCaseId(id);
    setView('fallDetail');
  };

  return (
    <div>
      <Title
        title={personDisplayName(p)}
        sub={`${p.rolle} · ${prop?.liegenschaftNummer ?? ''} ${prop?.name ?? ''}`}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => { setSelectedPropertyId(p.liegenschaftId); setPropertyTab('Parteien'); setView('liegenschaftDetail'); }}>Zur Liegenschaft</button>
            <button onClick={() => { setCustomerViewId(p.id); setMode('customer'); }}>Ansicht als Kunde öffnen</button>
          </div>
        }
      />

      <div className="content-wrap">
        <div className="tabs sticky-tabs">
          {tabs.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Übersicht' && (
          <div className="grid two" style={{ padding: 0 }}>
            <Panel title="Kurzüberblick">
              <div className="mini-kpis">
                <Metric label="Dokumente" value={docs.length} />
                <Metric label="Meldungen" value={cases.length} />
                <Metric label="Nachrichten" value={messages.length} />
                <Metric label="Schlüssel" value={keys.length} />
              </div>
            </Panel>
            <Panel title="Stammdaten">
              <div className="info-grid">
                <Info label="Vorname" value={splitPersonName(p).vorname} />
                <Info label="Nachname" value={splitPersonName(p).nachname} />
                <Info label="Rolle" value={p.rolle} />
                <Info label="E-Mail" value={p.email} />
                <Info label="Telefon" value={p.telefon} />
                <Info label="Adresse" value={p.adresse} />
                <Info label="Objekt" value={[p.wohnungsNummer, p.stockwerk].filter(Boolean).join(' · ') || '—'} />
                <Info label="Konto" value={p.kontoStatus} />
              </div>
              {p.email && p.kontoStatus && p.kontoStatus !== 'Nicht eingeladen' && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e6ded4' }}>
                  <ResetPasswordButton
                    email={p.email}
                    name={personDisplayName(p)}
                    zielTyp="KontaktPerson"
                    zielId={p.id}
                    rolle={p.rolle}
                  />
                </div>
              )}
            </Panel>
            <Panel title="Letzte Meldungen">
              {cases.length === 0 ? <p className="hint">Keine Meldungen vorhanden.</p> : cases.slice(0, 5).map((f: AnyRecord) => (
                <button className="list-row clickable" key={f.id} onClick={() => openCase(f.id)}>
                  <div><strong>{f.fallNummer || '—'} · {f.titel}</strong><span>{f.kategorie} · {statusLabel(statusValue(f.status))}</span></div>
                  <Badge tone={f.prioritaet === 'Dringend' || f.prioritaet === 'Hoch' ? 'red' : ''}>{f.prioritaet ?? 'Normal'}</Badge>
                </button>
              ))}
            </Panel>
            <Panel title="Letzte Nachrichten">
              {messages.length === 0 ? <p className="hint">Keine Chatverläufe vorhanden.</p> : messages.slice(-5).map((m: AnyRecord) => (
                <div className="list-row" key={m.id}>
                  <div><strong>{m.absender ?? 'Unbekannt'}</strong><span>{deDate(m.zeitstempel ?? m.createdAt)} · {m.nachricht}</span></div>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {tab === 'Stammdaten' && (
          <PersonEditor person={p} save={save} onClose={() => setTab('Übersicht')} />
        )}

        {tab === 'Dokumente' && (
          <Panel title="Dokumente / Protokolle / Abschlüsse">
            {docs.length === 0 ? <p className="hint">Keine Dokumente zu dieser Person vorhanden.</p> : docs.map((d: AnyRecord) => (
              <div className="list-row" key={d.id}>
                <div><strong>{d.jahr} · {d.titel}</strong><span>{d.kategorie} · {d.dateiname}</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {d.dateiUrl && <DocOpenButton url={d.dateiUrl} titel={d.titel} />}
                  <Badge>{d.sichtbarFuerKunden ? 'sichtbar' : 'intern'}</Badge>
                </div>
              </div>
            ))}
          </Panel>
        )}

        {tab === 'Meldungen' && (
          <Panel title="Schadensmeldungen dieser Person">
            {cases.length === 0 ? <p className="hint">Keine Meldungen vorhanden.</p> : cases.map((f: AnyRecord) => (
              <button className="list-row clickable" key={f.id} onClick={() => openCase(f.id)}>
                <div><strong>{f.fallNummer || '—'} · {f.titel}</strong><span>{propertyName(data, f.liegenschaftId)} · {f.kategorie}</span></div>
                <Badge tone={statusValue(f.status) === 'ERLEDIGT' ? 'green' : statusValue(f.status) === 'IN_BEARBEITUNG' ? 'blue' : ''}>{statusLabel(statusValue(f.status))}</Badge>
              </button>
            ))}
          </Panel>
        )}

        {tab === 'Chat' && (
          <Panel title="Chatverläufe">
            {messages.length === 0 ? <p className="hint">Keine Chatverläufe vorhanden.</p> : messages.map((m: AnyRecord) => (
              <div className="list-row" key={m.id}>
                <div>
                  <strong>{m.absender ?? 'Unbekannt'} · {deDate(m.zeitstempel ?? m.createdAt)}</strong>
                  <span>{m.nachricht}</span>
                </div>
                {m.schadenfallId && <button onClick={() => openCase(m.schadenfallId)}>Fall öffnen</button>}
              </div>
            ))}
          </Panel>
        )}

        {tab === 'Termine' && (
          <Panel title="Termine">
            {terms.length === 0 ? <p className="hint">Keine Termine vorhanden.</p> : terms.map((t: AnyRecord) => (
              <div className="list-row" key={t.id}>
                <div><strong>{t.titel}</strong><span>{deDate(t.start)} · {workerName(data, t.handwerkerId)} · {t.ort ?? ''}</span></div>
                <Badge>{t.status ?? t.typ}</Badge>
              </div>
            ))}
          </Panel>
        )}

        {tab === 'Schlüssel' && (
          <Panel title="Schlüsselprotokoll">
            {keys.length === 0 ? <p className="hint">Keine Schlüssel zu dieser Person vorhanden.</p> : keys.map((s: AnyRecord) => (
              <div className="list-row" key={s.id}>
                <div><strong>{s.bezeichnung} · {s.nummer}</strong><span>{s.ausgegebenAm ?? '—'} · {s.ausgegebenAn ?? personDisplayName(p)}</span></div>
                <Badge>{s.status}</Badge>
              </div>
            ))}
          </Panel>
        )}

        {tab === 'Historie' && (
          <Panel title="Historie">
            <Timeline items={[...changes, ...cases, ...docs, ...keys, ...terms]} />
          </Panel>
        )}
      </div>
    </div>
  );
}
function InvitePerson({ person, save }: any) {
  const [status, setStatus] = useState('');
  return <div className="invite"><h3>Zugang erstellen</h3><p className="hint">Versendet eine echte AWS-Cognito-Einladung an diese Person und speichert den Versand im Verlauf.</p><button className="primary" onClick={async()=>{ const item={id:`ein-${uid()}`, email: person.email, rolle: person.rolle, zielTyp:'KontaktPerson', zielId:person.id, status:'Wird versendet', gesendetAm:nowIso(), createdBy:'Verwaltung', name: personDisplayName(person)}; try { setStatus('AWS-Einladung wird versendet ...'); const awsInvite = await erstelleEinladungsauftrag(item); await save('Einladung', { id:item.id, email:item.email, rolle:item.rolle, zielTyp:item.zielTyp, zielId:item.zielId, gesendetAm:item.gesendetAm, createdBy:item.createdBy, status: awsInvite?.status ?? 'Versendet', tempPasswordHinweis: awsInvite?.message ?? 'Cognito Einladung wurde versendet.' }); await save('KontaktPerson', { ...person, name: personDisplayName(person), kontoStatus: awsInvite?.status ?? 'Einladung versendet', portalSichtbar: true, cognitoSub: awsInvite?.username ?? person.cognitoSub, updatedAt: nowIso() }); setStatus(awsInvite?.message ?? 'Einladung versendet.'); } catch (error:any) { setStatus(error?.message ?? 'AWS Einladung konnte nicht versendet werden.'); } }}>Zugangsdaten per AWS senden</button>{status && <p className="hint">{status}</p>}</div>;
}

function ResetPasswordButton({ email, name, zielTyp, zielId, rolle }: {
  email: string; name?: string; zielTyp: string; zielId: string; rolle?: string;
}) {
  const [meldung, setMeldung] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = async () => {
    if (!email?.trim()) { setMeldung('E-Mail-Adresse fehlt.'); return; }
    setLoading(true);
    setMeldung('Passwort-Reset wird versendet ...');
    try {
      const result = await erstelleEinladungsauftrag({
        id: `ein-${uid()}`,
        email: email.trim(),
        rolle: rolle ?? 'Benutzer',
        zielTyp,
        zielId,
        name: name ?? email.trim(),
      });
      setMeldung(result?.message ?? 'Passwort-Reset-E-Mail wurde versendet.');
    } catch (error: any) {
      setMeldung(error?.message ?? 'Passwort-Reset konnte nicht versendet werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button className="small" onClick={reset} disabled={loading}>
        {loading ? 'Wird gesendet …' : 'Passwort zurücksetzen'}
      </button>
      {meldung && <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>{meldung}</p>}
    </div>
  );
}

function CasesList({ data, save, setView, setSelectedCaseId }: any) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Alle');
  const [prio, setPrio] = useState('Alle');
  const [zeigeArchiv, setZeigeArchiv] = useState(false);

  const statusOptions = [{ value: 'Alle', label: 'Alle' }, ...CASE_STATUS_OPTIONS];
  const prioOptions = ['Alle', 'Dringend', 'Hoch', 'Normal', 'Niedrig'];

  const createCase = async () => {
    const property = data.Liegenschaft[0];
    if (!property) return;
    const person = data.KontaktPerson.find((p: AnyRecord) => p.liegenschaftId === property?.id) ?? data.KontaktPerson[0];
    const item = {
      id: `f-${uid()}`,
      fallNummer: nextCaseNumber(data),
      titel: 'Neue Meldung',
      beschreibung: 'Bitte Beschreibung ergänzen.',
      status: 'OFFEN',
      prioritaet: 'Normal',
      kategorie: 'Schaden',
      liegenschaftId: property?.id,
      personId: person?.id,
      liegenschaftAdresse: property?.strasse ?? '',
      plzOrt: `${property?.plz ?? ''} ${property?.ort ?? ''}`.trim(),
      gemeldetVon: person?.name ?? 'Verwaltung',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await save('Schadenfall', item);
    setSelectedCaseId(item.id);
    setView('fallDetail');
  };

  const list = data.Schadenfall
    .filter((f: AnyRecord) => {
      const searchText = JSON.stringify(f).toLowerCase();
      const matchesSearch = searchText.includes(q.toLowerCase());
      const normalisierterStatus = statusValue(f.status);
      const istArchiv =
        ['ERLEDIGT', 'ARCHIVIERT'].includes(normalisierterStatus) ||
        String(f.titel ?? '').startsWith('[GELÖSCHT]');
      const matchesArchiv = zeigeArchiv ? istArchiv : !istArchiv;
      const matchesStatus = status === 'Alle' || normalisierterStatus === status;
      const matchesPrio = prio === 'Alle' || f.prioritaet === prio;
      return matchesSearch && matchesArchiv && matchesStatus && matchesPrio;
    })
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(b.createdAt ?? b.updatedAt ?? '').localeCompare(String(a.createdAt ?? a.updatedAt ?? ''))
    );
  return (
    <div>
      <Title
        title={zeigeArchiv ? 'Archivierte Meldungen' : 'Meldungen'}
        sub={
          zeigeArchiv
            ? 'Erledigte oder gelöschte Meldungen.'
            : 'Kompakte Liste. Details, Chat, Handwerker und Termine öffnen sich erst nach Klick.'
        }
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="primary small" onClick={createCase}>
              Neue Meldung erfassen
            </button>
            <button className="small" onClick={() => setZeigeArchiv(!zeigeArchiv)}>
              {zeigeArchiv ? 'Aktive Meldungen' : 'Archiviert'}
            </button>
          </div>
        }
      />
      <Panel title={zeigeArchiv ? 'Archiv' : 'Alle aktiven Meldungen'} className="full-list">
        <div className="list-toolbar">
          <input
            className="search"
            placeholder="Suche nach Fall, Liegenschaft, Person oder Kategorie ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((x: any) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
          <select value={prio} onChange={(e) => setPrio(e.target.value)}>
            {prioOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fall-Nr.</th>
              <th>Titel</th>
              <th>Liegenschaft</th>
              <th>Person</th>
              <th>Kategorie</th>
              <th>Handwerker</th>
              <th>Status</th>
              <th>Priorität</th>
              <th>Frist</th>
            </tr>
          </thead>
          <tbody>
            {list.map((f: AnyRecord) => {
              const normalisierterStatus = statusValue(f.status);
              return (
                <tr
                  key={f.id}
                  onClick={() => {
                    setSelectedCaseId(f.id);
                    setView('fallDetail');
                  }}
                >
                  <td>{f.fallNummer || '—'}</td>
                  <td><strong>{f.titel}</strong></td>
                  <td>{propertyName(data, f.liegenschaftId)}</td>
                  <td>{personName(data, f.personId)}</td>
                  <td>{f.kategorie ?? 'Schaden'}</td>
                  <td>{workerName(data, f.handwerkerId)}</td>
                  <td>
                    <Badge tone={normalisierterStatus === 'ERLEDIGT' ? 'green' : normalisierterStatus === 'IN_BEARBEITUNG' ? 'blue' : ''}>
                      {statusLabel(normalisierterStatus)}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={f.prioritaet === 'Dringend' || f.prioritaet === 'Hoch' ? 'red' : 'orange'}>
                      {f.prioritaet ?? 'Normal'}
                    </Badge>
                  </td>
                  <td>{f.frist ? deDate(f.frist) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
const CASE_STATUS_OPTIONS = [
  { value: 'OFFEN', label: 'Offen' },
  { value: 'IN_BEARBEITUNG', label: 'In Bearbeitung' },
  { value: 'OFFERTEN_EINGEHOLT', label: 'Offerten eingeholt' },
  { value: 'HANDWERKER_BEAUFTRAGT', label: 'Handwerker beauftragt' },
  { value: 'BELEG_NACHGEREICHT', label: 'Beleg nachgereicht' },
  { value: 'ERLEDIGT', label: 'Erledigt' },
  { value: 'ARCHIVIERT', label: 'Archiviert' },
];

const CASE_PRIORITY_OPTIONS = ['Dringend', 'Hoch', 'Normal', 'Niedrig'];

const CASE_CATEGORY_OPTIONS = [
  'Schaden',
  'Heizung',
  'Sanitär',
  'Wasser',
  'Elektrik',
  'Schimmel',
  'Fenster',
  'Schlüssel',
  'Unterlagen',
  'Sonstiges',
];

function statusLabel(status?: string) {
  if (status === 'OFFEN' || status === 'Offen' || status === 'Neu') return 'Offen';
  if (status === 'IN_BEARBEITUNG' || status === 'In Bearbeitung') return 'In Bearbeitung';
  if (status === 'OFFERTEN_EINGEHOLT' || status === 'Offerten eingeholt') return 'Offerten eingeholt';
  if (status === 'HANDWERKER_BEAUFTRAGT' || status === 'Handwerker beauftragt') return 'Handwerker beauftragt';
  if (status === 'BELEG_NACHGEREICHT' || status === 'Beleg nachgereicht') return 'Beleg nachgereicht';
  if (status === 'ERLEDIGT' || status === 'Erledigt') return 'Erledigt';
  if (status === 'ARCHIVIERT' || status === 'Archiviert') return 'Archiviert';
  return status ?? 'Offen';
}

function statusValue(status?: string) {
  if (!status) return 'OFFEN';
  if (status === 'Offen' || status === 'Neu') return 'OFFEN';
  if (status === 'In Bearbeitung') return 'IN_BEARBEITUNG';
  if (status === 'Offerten eingeholt') return 'OFFERTEN_EINGEHOLT';
  if (status === 'Handwerker beauftragt') return 'HANDWERKER_BEAUFTRAGT';
  if (status === 'Beleg nachgereicht') return 'BELEG_NACHGEREICHT';
  if (status === 'Erledigt') return 'ERLEDIGT';
  if (status === 'Archiviert') return 'ARCHIVIERT';
  return status;
}

const toDatetimeLocal = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function CaseDetailPage({ data, selectedCaseId, save, remove, setSelectedWorkerId, setView }: any) {
  const [tab, setTab] = useState<CaseTab>('Übersicht');
  const [zeigeFallAuftrag, setZeigeFallAuftrag] = useState(false);
  const fall = data.Schadenfall.find((f: AnyRecord) => f.id === selectedCaseId) ?? data.Schadenfall[0];
  const [draft, setDraft] = useState<AnyRecord>(fall ?? {});

  useEffect(() => {
    setDraft({
      ...(fall ?? {}),
      frist: toDatetimeLocal(fall?.frist),
    });
  }, [fall?.id]);

  if (!fall) {
    return (
      <div>
        <Title title="Meldung nicht gefunden" sub="Die gespeicherte Auswahl ist nicht mehr vorhanden oder AWS lädt noch." actions={<button onClick={() => setView('faelle')}>Zur Meldungsliste</button>} />
        <div className="content-wrap">
          <Panel title="Keine Daten">
            <p className="hint">Bitte öffnen Sie eine echte Meldung aus der Liste.</p>
          </Panel>
        </div>
      </div>
    );
  }

  const tabs: CaseTab[] = ['Übersicht', 'Chat', 'Bilder', 'Handwerker', 'Termine', 'Dokumente', 'Verlauf'];

  const saveFall = async () => {
  const payload = {
    ...fall,
    fallNummer: draft.fallNummer || fall.fallNummer || nextCaseNumber(data),
    titel: draft.titel,
    beschreibung: draft.beschreibung,
    status: statusValue(draft.status),
    prioritaet: draft.prioritaet,
    kategorie: draft.kategorie,
    frist: toAwsDate(draft.frist),
    verantwortlicherMitarbeiterId: draft.verantwortlicherMitarbeiterId || undefined,
    handwerkerId: draft.handwerkerId || undefined,
    updatedAt: nowIso(),
  };
  await save('Schadenfall', payload);
  setDraft({ ...payload, frist: toDatetimeLocal(payload.frist) });
};

  const quickSaveStatus = async (status: string) => {
    const fertig = {
      ...fall,
      ...draft,
      status: statusValue(status),
      frist: toAwsDate(draft.frist),
      updatedAt: nowIso(),
    };

    setDraft({
      ...fertig,
      frist: toDatetimeLocal(fertig.frist),
    });

    await save('Schadenfall', fertig);
  };

  return (
    <div>
      <Title
        title={`${fall.fallNummer ?? ''} · ${fall.titel}`}
        sub={`${propertyName(data, fall.liegenschaftId)} · ${personName(data, fall.personId)}`}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
           <button onClick={() => setView('faelle')}>Zurück zur Liste</button>
           <button className="primary small" onClick={() => setZeigeFallAuftrag(true)}>Auftrag erstellen</button>

           <button
            className="danger small"
            onClick={() => {
             const ok = window.confirm(`Meldung "${fall.titel}" wirklich löschen?`);
             if (!ok) return;

            save('Schadenfall', {
               ...fall,
                titel: `[GELÖSCHT] ${fall.titel}`,
                status: 'ARCHIVIERT',
                updatedAt: nowIso(),
            });
            setView('faelle');
          }}
         >
          Löschen
       </button>
     </div>
}
      />

      <div className="content-wrap">
        <div className="tabs sticky-tabs">
          {tabs.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Übersicht' && (
          <>
            <KIAutoAnalyse fall={fall} data={data} save={save} remove={remove} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div className="info-card">
                <strong>Erstellt</strong>
                <div>{deDate(fall.createdAt)}</div>
              </div>

              <div className="info-card">
                <strong>Zuletzt geändert</strong>
                <div>{deDate(fall.updatedAt)}</div>
              </div>

              <div className="info-card">
                <strong>Gemeldet von</strong>
                <div>{fall.gemeldetVon || personName(data, fall.personId)}</div>
              </div>

              <div className="info-card">
                <strong>Fallnummer</strong>
                <div>{fall.fallNummer || '—'}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}><SchadenKIAssist schaden={fall} /></div>

            <Panel title="Meldungsdetails">
              <div className="form-grid">
                <label>
                  Titel
                  <input
                    value={draft.titel ?? ''}
                    onChange={(e) => setDraft({ ...draft, titel: e.target.value })}
                  />
                </label>

                <label>
                  Status
                  <select
                  value={statusValue(draft.status)}
                   onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    {CASE_STATUS_OPTIONS.map((x) => (
                   <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
                </label>

                <label>
                  Priorität
                  <select value={draft.prioritaet ?? 'Normal'} onChange={(e) => setDraft({ ...draft, prioritaet: e.target.value })}>
                    {CASE_PRIORITY_OPTIONS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Kategorie
                  <select value={draft.kategorie ?? 'Sonstiges'} onChange={(e) => setDraft({ ...draft, kategorie: e.target.value })}>
                    {CASE_CATEGORY_OPTIONS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Verantwortlicher Mitarbeiter
                  <select
                    value={draft.verantwortlicherMitarbeiterId ?? ''}
                    onChange={(e) => setDraft({ ...draft, verantwortlicherMitarbeiterId: e.target.value })}
                  >
                    <option value="">Nicht zugewiesen</option>
                    {data.Mitarbeiter.map((m: AnyRecord) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Handwerker
                  <select value={draft.handwerkerId ?? ''} onChange={(e) => setDraft({ ...draft, handwerkerId: e.target.value })}>
                    <option value="">Kein Handwerker</option>
                    {data.Handwerker.map((h: AnyRecord) => (
                      <option key={h.id} value={h.id}>
                        {h.firma} · {h.gewerk}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Frist / Termin
                  <input
                    type="datetime-local"
                    value={draft.frist ?? ''}
                    onChange={(e) => setDraft({ ...draft, frist: e.target.value })}
                  />
                </label>

                <label>
                  Beschreibung
                  <textarea
                    value={draft.beschreibung ?? ''}
                    onChange={(e) => setDraft({ ...draft, beschreibung: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="primary" onClick={saveFall}>
                  Speichern
                </button>

                <button onClick={() => setDraft({ ...draft, status: 'IN_BEARBEITUNG' })}>
                  In Bearbeitung setzen
                </button>

                <button onClick={() => setDraft({ ...draft, status: 'ERLEDIGT' })}>
                  Als erledigt vormerken
                </button>

                <button
                  style={{ background: '#dc2626', color: 'white' }}
                  onClick={() => quickSaveStatus('ERLEDIGT')}
                >
                  Schadenfall abschliessen
                </button>
              </div>
            </Panel>
          </>
        )}

        {tab === 'Chat' && <Chat data={data} caseId={fall.id} propertyId={fall.liegenschaftId} save={save} />}
        {tab === 'Handwerker' && <AssignWorker data={data} fall={fall} save={save} setSelectedWorkerId={setSelectedWorkerId} setView={setView} />}
        {tab === 'Termine' && <CaseAppointments data={data} fall={fall} save={save} />}
        {tab === 'Dokumente' && <Documents data={data} propertyId={fall.liegenschaftId} save={save} />}
        {tab === 'Verlauf' && (
          <Panel title="Verlauf">
            <Timeline
              items={[
                fall,
                ...data.ChatMessage.filter((m: AnyRecord) => m.schadenfallId === fall.id),
                ...data.KalenderTermin.filter((t: AnyRecord) => t.schadenfallId === fall.id),
              ]}
            />
          </Panel>
        )}
        {tab === 'Bilder' && <CaseImages data={data} fall={fall} save={save} />}
      </div>

      {zeigeFallAuftrag && (
        <FallAuftragModal
          fall={fall}
          data={data}
          save={save}
          onClose={() => setZeigeFallAuftrag(false)}
          onAuftragErstellt={async (handwerkerId: string) => {
            await save('Schadenfall', {
              ...fall,
              status: 'HANDWERKER_BEAUFTRAGT',
              handwerkerId: handwerkerId || fall.handwerkerId || undefined,
              updatedAt: nowIso(),
            });
          }}
        />
      )}
    </div>
  );
}

function AssignWorker({ data, fall, save, setSelectedWorkerId, setView }: any) {
  const [hw, setHw] = useState(fall.handwerkerId ?? '');
  const [status, setStatus] = useState('');

  useEffect(() => {
    setHw(fall.handwerkerId ?? '');
    setStatus('');
  }, [fall.id, fall.handwerkerId]);

  const assignWorker = async () => {
    setStatus('Speichere Zuweisung ...');
    const result = await save('Schadenfall', {
      ...fall,
      handwerkerId: hw || undefined,
      status: hw ? 'HANDWERKER_BEAUFTRAGT' : statusValue(fall.status),
      updatedAt: nowIso(),
    });
    setStatus(result?.ok ? 'Handwerker wurde gespeichert.' : 'Handwerker wurde lokal gesetzt, AWS-Synchronisierung bitte prüfen.');
  };

  return (
    <Panel title="Handwerker zuweisen">
      <div className="form-grid">
        <label>
          Handwerker
          <select value={hw} onChange={(e) => setHw(e.target.value)}>
            <option value="">Kein Handwerker</option>
            {data.Handwerker.map((h: AnyRecord) => (
              <option key={h.id} value={h.id}>
                {h.firma} · {h.gewerk}
              </option>
            ))}
          </select>
        </label>

        <button
          className="primary"
          onClick={assignWorker}
        >
          Speichern und synchronisieren
        </button>
      </div>
      {status && <p className="hint">{status}</p>}

      {hw && (
        <button className="list-row clickable" onClick={() => { setSelectedWorkerId(hw); setView('handwerkerDetail'); }}>
          <div>
            <strong>{workerName(data, hw)}</strong>
            <span>Handwerkerprofil öffnen</span>
          </div>
        </button>
      )}
    </Panel>
  );
}

// MARK: – SearchSelect Kombobox

function SearchSelect({
  value, onChange, options, placeholder = '— Suchen und wählen —', disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (v: string) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="text"
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected ? selected.label : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{ flex: 1, background: selected && !open ? '#f0f9ff' : undefined }}
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery(''); }}
            title="Auswahl zurücksetzen"
            style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1, cursor: 'pointer',
              background: 'none', border: '1px solid #ddd', borderRadius: 6, color: '#666' }}
          >×</button>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 9999, top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)', maxHeight: 280, overflowY: 'auto',
          marginTop: 2,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', color: '#999', fontSize: 13 }}>Keine Treffer</div>
          ) : filtered.map(o => (
            <div
              key={o.value}
              onMouseDown={() => pick(o.value)}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                background: o.value === value ? '#eff6ff' : undefined,
                fontWeight: o.value === value ? 600 : undefined,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? '#eff6ff' : '')}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// MARK: – KI Formular-Assistent

function FormularKIAssistent({ data, onFill, fallKontext }: {
  data: any;
  onFill: (daten: Record<string, any>) => void;
  fallKontext?: string;
}) {
  const [eingabe, setEingabe] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ text: string; ok: boolean } | null>(null);
  const [offen, setOffen] = React.useState(true);

  const absenden = async () => {
    if (!eingabe.trim() || busy) return;
    setBusy(true);
    setFeedback(null);

    // Client-side pre-filter Handwerker by keywords (avoid sending 2000+ entries)
    const keywords = eingabe.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const hwGefiltert = ((data.Handwerker ?? []) as any[])
      .filter(h => h.status !== 'Archiviert')
      .map(h => {
        const txt = `${h.firma ?? ''} ${h.gewerk ?? ''} ${h.kontaktperson ?? ''} ${h.adresse ?? ''}`.toLowerCase();
        const score = keywords.filter(k => txt.includes(k)).length;
        return { ...h, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 50);

    const lgListe = ((data.Liegenschaft ?? []) as any[])
      .filter(l => !['Archiviert', 'Gelöscht'].includes(l.status))
      .map(l => `ID:${l.id} | Nr.${l.liegenschaftNummer} · ${l.name} · ${l.strasse}, ${l.plz} ${l.ort}`);

    const hwListe = hwGefiltert
      .map(h => `ID:${h.id} | ${h.firma} · ${h.gewerk}${h.telefon ? ' · Tel:' + h.telefon : ''}${h.email ? ' · ' + h.email : ''}`);

    const kontext = [
      fallKontext ?? '',
      'LIEGENSCHAFTEN:\n' + lgListe.join('\n'),
      'HANDWERKER (top Treffer):\n' + hwListe.join('\n'),
    ].filter(Boolean).join('\n\n');

    const systemPrompt = `Du hilfst beim Ausfüllen des IMMOBILIENTOOL Auftragsformulars.

Analysiere die Anfrage und erstelle eine AUFTRAG_FORMULAR_FILL-Aktion mit den Formulardaten.

Aktionsformat (innerhalb <aktionen>...</aktionen>):
[{
  "typ": "AUFTRAG_FORMULAR_FILL",
  "beschreibung": "Formular ausfüllen für ...",
  "daten": {
    "liegenschaftId": "exakte ID aus der Liste",
    "handwerkerId": "exakte ID aus der Liste",
    "auftragstext": "Vollständiger professioneller Auftragstext auf Deutsch",
    "auftragsartLabel": "Heizungsausfall|Boiler defekt|Sanitär / Wasserhahn|Waschmaschine defekt|Garagetor defekt|Elektriker / Beleuchtung|Freier Auftrag|...",
    "termin": "z.B. möglichst bald oder konkretes Datum",
    "referenz": "Fallnummer oder Stichwort",
    "hinweis": "Hinweis für Handwerker (optional)"
  }
}]

Regeln:
- Nutze immer die exakten IDs aus dem Kontext
- Auftragstext: Professionelle Anrede, Beschreibung des Problems, Adresse der Liegenschaft, höflicher Abschluss
- Wähle den Handwerker anhand von Gewerk + Nähe zur Liegenschaft
- Wenn kein passender Handwerker: nimm den gewerk-nächsten
- Antworte NUR mit der Aktion, kein erklärender Text nötig`;

    try {
      const res = await bedrockChatAnfrage([{ role: 'user', content: eingabe }], systemPrompt, kontext);
      const aktion = res.aktionen.find(a => a.typ === 'AUFTRAG_FORMULAR_FILL');
      if (aktion?.daten) {
        onFill(aktion.daten);
        setFeedback({ text: '✓ Formular ausgefüllt – bitte prüfen und anpassen.', ok: true });
        setEingabe('');
      } else if (res.antwort) {
        setFeedback({ text: res.antwort.slice(0, 300), ok: false });
      } else {
        setFeedback({ text: 'Keine Formular-Daten erkannt. Bitte präziser beschreiben.', ok: false });
      }
    } catch (e: any) {
      setFeedback({ text: `Fehler: ${e?.message ?? 'Unbekannt'}`, ok: false });
    }
    setBusy(false);
  };

  return (
    <div style={{
      border: '1.5px solid #e0e7ff', borderRadius: 10, marginBottom: 16,
      background: 'linear-gradient(135deg,#f0f4ff 0%,#fafbff 100%)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOffen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
          fontWeight: 600, fontSize: 13, color: '#3730a3',
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ flex: 1, textAlign: 'left' }}>KI-Assistent – Formular ausfüllen</span>
        <span style={{ fontSize: 11, fontWeight: 400, color: '#6366f1', marginRight: 6 }}>
          Beschreibe den Auftrag in natürlicher Sprache
        </span>
        <span style={{ fontSize: 12 }}>{offen ? '▲' : '▼'}</span>
      </button>

      {offen && (
        <div style={{ padding: '0 14px 14px' }}>
          <textarea
            placeholder='z.B. "Heizungsausfall Musterstrasse 16, Muster Haustechnik beauftragen, Termin nächste Woche" oder "Wasserschaden Küche in einer Liegenschaft, passenden Sanitär-Handwerker wählen"'
            value={eingabe}
            onChange={e => setEingabe(e.target.value)}
            rows={3}
            disabled={busy}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') absenden(); }}
            style={{ width: '100%', resize: 'vertical', fontSize: 13, boxSizing: 'border-box' }}
          />
          {feedback && (
            <p style={{
              margin: '6px 0 8px', fontSize: 12.5, fontWeight: 500,
              color: feedback.ok ? '#166534' : '#92400e',
              background: feedback.ok ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${feedback.ok ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 6, padding: '6px 10px',
            }}>
              {feedback.text}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>⌘+Enter / Strg+Enter zum Absenden</span>
            <button
              className="primary"
              onClick={absenden}
              disabled={busy || !eingabe.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}
            >
              {busy
                ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Analysiere…</>
                : <>✦ Ausfüllen</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FallAuftragModal({ fall, data, save, onClose, onAuftragErstellt }: any) {
  let tpl: Record<string, any> = {};

  // Auto-select Auftragsart based on fall.kategorie
  const initialArtIdx = Math.max(0, AUFTRAGSARTEN.findIndex(a =>
    a.geraetTyp && fall.kategorie && (
      fall.kategorie.toLowerCase().includes(a.geraetTyp.toLowerCase()) ||
      a.label.toLowerCase().includes(fall.kategorie.toLowerCase())
    )
  ));

  const [selectedLiegenschaftId, setSelectedLiegenschaftId] = useState(fall.liegenschaftId ?? data.Liegenschaft[0]?.id ?? '');
  const [selectedPersonId, setSelectedPersonId] = useState(fall.personId ?? '');
  const [selectedHandwerkerId, setSelectedHandwerkerId] = useState(fall.handwerkerId ?? '');
  const [selectedGeraetId, setSelectedGeraetId] = useState('');
  const [auftragsartIdx, setAuftragsartIdx] = useState(initialArtIdx);
  const [auftragstext, setAuftragstext] = useState(() => AUFTRAGSARTEN[initialArtIdx]?.text || fall.beschreibung || '');
  const [referenz, setReferenz] = useState(fall.fallNummer || '');
  const [termin, setTermin] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [rechnungsadresse, setRechnungsadresse] = useState('');
  const [bearbeiterId, setBearbeiterId] = useState((data.Mitarbeiter ?? [])[0]?.id ?? '');
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const selectedPerson = data.KontaktPerson.find((p: AnyRecord) => p.id === selectedPersonId);
  const selectedLiegenschaft = data.Liegenschaft.find((l: AnyRecord) => l.id === selectedLiegenschaftId);
  const selectedHandwerker = data.Handwerker.find((h: AnyRecord) => h.id === selectedHandwerkerId);
  const liegenschaftGeraete = (data.Dokument ?? [])
    .filter((d: AnyRecord) => d.liegenschaftId === selectedLiegenschaftId && d.kategorie === 'Gerät')
    .map(geraetFromDokument);

  useEffect(() => {
    const art = AUFTRAGSARTEN[auftragsartIdx];
    if (art?.text) setAuftragstext(art.text);
  }, [auftragsartIdx]);

  useEffect(() => {
    if (!selectedGeraetId) return;
    const gerät = liegenschaftGeraete.find((g: AnyRecord) => g.id === selectedGeraetId);
    if (!gerät) return;
    const matchIdx = AUFTRAGSARTEN.findIndex(a => a.geraetTyp === (gerät.typ || gerät.dateiname));
    if (matchIdx > 0) setAuftragsartIdx(matchIdx);
  }, [selectedGeraetId]);

  const buildFields = () => {
    const liegenschaftText = selectedLiegenschaft
      ? `${selectedLiegenschaft.liegenschaftNummer ? selectedLiegenschaft.liegenschaftNummer + ' · ' : ''}${selectedLiegenschaft.name}, ${selectedLiegenschaft.strasse}, ${selectedLiegenschaft.plz} ${selectedLiegenschaft.ort}`
      : '';
    return {
      datum: new Date().toLocaleDateString('de-CH'),
      liegenschaft: liegenschaftText,
      mieter: selectedPerson ? personDisplayName(selectedPerson) : '',
      telefon: selectedPerson?.telefon ?? '',
      referenz,
      termin,
      auftragstext,
      hinweis,
      rechnungsadresse,
      bearbeiter: (data.Mitarbeiter ?? []).find((m: AnyRecord) => m.id === bearbeiterId)?.name ?? '',
    };
  };

  // Live preview debounced
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const doc = await genAuftragPdf({ ...{ id: 'fall-auftrag', titel: 'Auftragsformular', felderJson: JSON.stringify(tpl) }, felderJson: '{}' }, buildFields(), selectedHandwerker);
        if (cancelled) return;
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch { /* ignore */ }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedLiegenschaftId, selectedPersonId, selectedHandwerkerId, selectedGeraetId, auftragsartIdx, referenz, termin, auftragstext, hinweis, rechnungsadresse, bearbeiterId]);

  const getDoc = () => genAuftragPdf({ id: 'fall-auftrag', titel: 'Auftragsformular', felderJson: '{}' }, buildFields(), selectedHandwerker);

  const herunterladen = async () => {
    setBusy(true);
    try {
      const doc = await getDoc();
      const fname = `Auftrag-${fall.fallNummer || fall.id}-${new Date().toLocaleDateString('de-CH').replace(/\./g, '-')}.pdf`;
      doc.save(fname);
      await onAuftragErstellt(selectedHandwerkerId);
      setSaveMsg(`PDF heruntergeladen. Status → Handwerker beauftragt.`);
    } catch (e: any) { setSaveMsg(`Fehler: ${e?.message}`); }
    setBusy(false);
  };

  const drucken = async () => {
    setBusy(true);
    try {
      const doc = await getDoc();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      win?.addEventListener('load', () => win.print());
      await onAuftragErstellt(selectedHandwerkerId);
    } catch (e: any) { setSaveMsg(`Fehler: ${e?.message}`); }
    setBusy(false);
  };

  const speichernBeiLiegenschaft = async () => {
    if (!selectedLiegenschaftId) return;
    setBusy(true);
    try {
      const doc = await getDoc();
      const blob = doc.output('blob');
      const fname = `Auftrag-${fall.fallNummer || fall.id}-${new Date().toLocaleDateString('de-CH').replace(/\./g, '-')}.pdf`;
      const path = `dokumente/${selectedLiegenschaftId}/${Date.now()}-${fname}`;
      const { uploadData, getUrl } = await import('aws-amplify/storage');
      await uploadData({ path, data: blob }).result;
      const urlResult = await getUrl({ path });
      await save('Dokument', {
        id: `dok-${uid()}`,
        liegenschaftId: selectedLiegenschaftId,
        titel: `Auftrag · ${fall.fallNummer || fall.titel}`,
        kategorie: 'Auftrag',
        jahr: new Date().getFullYear(),
        dateiname: fname,
        dateiUrl: urlResult.url.toString(),
        sichtbarFuerKunden: false,
        freigabeStatus: 'Intern',
        volltext: '',
      });
      await onAuftragErstellt(selectedHandwerkerId);
      setSaveMsg('Auftrag gespeichert. Status → Handwerker beauftragt.');
    } catch (e: any) { setSaveMsg(`Fehler: ${e?.message}`); }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal auftrag-wide-modal">
        <div className="modal-head">
          <h2>📋 Auftrag erstellen: {fall.fallNummer || ''} · {fall.titel}</h2>
          <button onClick={onClose}>×</button>
        </div>
        {saveMsg && <p style={{ padding: '6px 0', color: saveMsg.includes('Fehler') ? '#dc2626' : '#166534', fontWeight: 600 }}>{saveMsg}</p>}

        <div className="auftrag-editor-layout">
          {/* LEFT — Formular */}
          <div className="auftrag-editor-form">
            <FormularKIAssistent
              data={data}
              fallKontext={`SCHADENFALL: ${fall.titel} | Status: ${fall.status} | Liegenschaft: ${fall.liegenschaftAdresse ?? ''}`}
              onFill={daten => {
                if (daten.liegenschaftId) setSelectedLiegenschaftId(daten.liegenschaftId);
                if (daten.personId) setSelectedPersonId(daten.personId);
                if (daten.handwerkerId) setSelectedHandwerkerId(daten.handwerkerId);
                if (daten.auftragstext) setAuftragstext(daten.auftragstext);
                if (daten.termin) setTermin(daten.termin);
                if (daten.referenz) setReferenz(daten.referenz);
                if (daten.hinweis) setHinweis(daten.hinweis);
                if (daten.auftragsartLabel) {
                  const idx = AUFTRAGSARTEN.findIndex((a: any) => a.label === daten.auftragsartLabel);
                  if (idx >= 0) setAuftragsartIdx(idx);
                }
              }}
            />
            <div className="auftrag-form-section">
              <h3>Liegenschaft & Person</h3>
              <label>Liegenschaft *
                <SearchSelect
                  value={selectedLiegenschaftId}
                  onChange={v => { setSelectedLiegenschaftId(v); setSelectedPersonId(''); }}
                  placeholder="— Liegenschaft suchen —"
                  options={data.Liegenschaft
                    .filter((l: AnyRecord) => !['Archiviert','Gelöscht'].includes(l.status))
                    .map((l: AnyRecord) => ({ value: l.id, label: `${l.liegenschaftNummer} · ${l.strasse ?? l.name}` }))}
                />
              </label>
              <label>Mieter / Person
                <SearchSelect
                  value={selectedPersonId}
                  onChange={setSelectedPersonId}
                  placeholder="— Person suchen —"
                  disabled={!selectedLiegenschaftId}
                  options={data.KontaktPerson
                    .filter((p: AnyRecord) => p.liegenschaftId === selectedLiegenschaftId)
                    .map((p: AnyRecord) => ({ value: p.id, label: `${personDisplayName(p)} (${p.rolle})` }))}
                />
              </label>
            </div>

            <div className="auftrag-form-section">
              <h3>Handwerker</h3>
              <label>Handwerker / Firma
                <SearchSelect
                  value={selectedHandwerkerId}
                  onChange={setSelectedHandwerkerId}
                  placeholder="— Firma oder Gewerk suchen —"
                  options={(data.Handwerker ?? [])
                    .filter((h: AnyRecord) => h.status !== 'Archiviert')
                    .map((h: AnyRecord) => ({ value: h.id, label: `${h.firma} · ${h.gewerk}` }))}
                />
              </label>
              {selectedHandwerker && (
                <div className="auftrag-hw-info">
                  {selectedHandwerker.kontaktperson && <span>👤 {selectedHandwerker.kontaktperson}</span>}
                  {selectedHandwerker.telefon && <span>📞 {selectedHandwerker.telefon}</span>}
                  {selectedHandwerker.email && <span>✉ {selectedHandwerker.email}</span>}
                </div>
              )}
            </div>

            <div className="auftrag-form-section">
              <h3>Auftragsdetails</h3>
              {liegenschaftGeraete.length > 0 && (
                <label>Gerät / Anlage
                  <select value={selectedGeraetId} onChange={e => setSelectedGeraetId(e.target.value)}>
                    <option value="">— Gerät wählen (optional) —</option>
                    {liegenschaftGeraete.map((g: AnyRecord) => (
                      <option key={g.id} value={g.id}>{g.typ || g.dateiname} · {g.titel}{g.standort ? ' (' + g.standort + ')' : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>Auftragsart
                <select value={auftragsartIdx} onChange={e => setAuftragsartIdx(Number(e.target.value))}>
                  {AUFTRAGSARTEN.map((a, i) => <option key={i} value={i}>{a.label}</option>)}
                </select>
              </label>
              <label>Auftragstext
                <textarea rows={4} value={auftragstext} onChange={e => setAuftragstext(e.target.value)} style={{ border: '1px solid #ddd6cc', borderRadius: 12, padding: '10px 12px', fontSize: 13, resize: 'vertical', width: '100%' }} />
              </label>
              <label>Unsere Referenz
                <input value={referenz} onChange={e => setReferenz(e.target.value)} placeholder="z.B. Fallnummer" />
              </label>
              <label>Termin
                <input value={termin} onChange={e => setTermin(e.target.value)} placeholder="möglichst bald" />
              </label>
              <label>Hinweis (für Handwerker)
                <textarea rows={2} value={hinweis} onChange={e => setHinweis(e.target.value)} placeholder="z.B. Schlüssel bei uns im Büro …" style={{ border: '1px solid #ddd6cc', borderRadius: 12, padding: '10px 12px', fontSize: 13, resize: 'vertical', width: '100%' }} />
              </label>
              <label>Rechnungsadresse
                <input value={rechnungsadresse} onChange={e => setRechnungsadresse(e.target.value)} placeholder="z.B. Meinefirma GmbH, Musterstrasse 1" />
              </label>
            </div>

            <div className="auftrag-form-section">
              <h3>Bearbeiter / Unterschrift</h3>
              <label>Ausgefüllt von
                <select value={bearbeiterId} onChange={e => setBearbeiterId(e.target.value)}>
                  <option value="">— Person wählen —</option>
                  {(data.Mitarbeiter ?? []).filter((m: AnyRecord) => m.status !== 'Inaktiv').map((m: AnyRecord) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.funktion || m.gruppe}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="auftrag-actions">
              <div className="auftrag-save-group">
                <span style={{ fontSize: 12, color: '#6f7b8e', fontWeight: 700 }}>Speichern bei:</span>
                <button disabled={!selectedLiegenschaftId || busy} onClick={speichernBeiLiegenschaft}>📁 Liegenschaft</button>
              </div>
              <div className="auftrag-save-group">
                <button disabled={busy} onClick={drucken}>🖨 Drucken</button>
                <button className="primary" disabled={busy} onClick={herunterladen}>⬇ Herunterladen</button>
              </div>
            </div>
          </div>

          {/* RIGHT — Live-Preview */}
          <div className="auftrag-preview-pane">
            <div className="auftrag-preview-label">Live-Vorschau</div>
            {previewUrl
              ? <iframe src={previewUrl} className="auftrag-preview-iframe" title="Vorschau" />
              : <div className="auftrag-preview-placeholder">Vorschau wird geladen …</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseAppointments({ data, fall, save }: any) {
  const [draft, setDraft] = useState({
    id: `t-${uid()}`,
    titel: `Termin zu ${fall.titel}`,
    typ: 'Handwerkertermin',
    liegenschaftId: fall.liegenschaftId,
    personIds: [fall.personId].filter(Boolean),
    handwerkerId: fall.handwerkerId ?? '',
    mitarbeiterIds: [fall.verantwortlicherMitarbeiterId].filter(Boolean),
    schadenfallId: fall.id,
    start: new Date().toISOString().slice(0, 16),
    ende: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    ort: fall.liegenschaftAdresse ?? '',
    beschreibung: '',
    erinnerungMinuten: 60,
    sichtbarInApp: true,
    status: 'Geplant',
  });

  const termine = data.KalenderTermin
    .filter((t: AnyRecord) => t.schadenfallId === fall.id)
    .sort((a: AnyRecord, b: AnyRecord) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const saveTermin = async () => {
    await save('KalenderTermin', {
      ...draft,
      start: new Date(draft.start).toISOString(),
      ende: new Date(draft.ende).toISOString(),
      personIds: draft.personIds,
      mitarbeiterIds: draft.mitarbeiterIds,
      sichtbarInApp: Boolean(draft.sichtbarInApp),
      createdAt: nowIso(),
    });

    if (draft.handwerkerId) {
      await save('Schadenfall', {
        ...fall,
        handwerkerId: draft.handwerkerId,
        status: statusValue(fall.status) === 'OFFEN' ? 'IN_BEARBEITUNG' : statusValue(fall.status),
        updatedAt: nowIso(),
      });
    }

    setDraft({
      ...draft,
      id: `t-${uid()}`,
      titel: `Termin zu ${fall.titel}`,
      start: new Date().toISOString().slice(0, 16),
      ende: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      beschreibung: '',
    });
  };

  return (
    <Panel title="Termine zum Schadenfall">
      <div className="form-grid">
        <label>
          Titel
          <input value={draft.titel} onChange={(e) => setDraft({ ...draft, titel: e.target.value })} />
        </label>

        <label>
          Terminart
          <select value={draft.typ} onChange={(e) => setDraft({ ...draft, typ: e.target.value })}>
            <option>Handwerkertermin</option>
            <option>Übergabetermin</option>
            <option>Wohnungsabnahme</option>
            <option>Besichtigung</option>
            <option>Eigentümerversammlung</option>
            <option>Sonstiges</option>
          </select>
        </label>

        <label>
          Start
          <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
        </label>

        <label>
          Ende
          <input type="datetime-local" value={draft.ende} onChange={(e) => setDraft({ ...draft, ende: e.target.value })} />
        </label>

        <label>
          Handwerker
          <SearchSelect
            value={draft.handwerkerId}
            onChange={v => setDraft({ ...draft, handwerkerId: v })}
            placeholder="— Firma oder Gewerk suchen —"
            options={data.Handwerker
              .filter((h: AnyRecord) => h.status !== 'Archiviert')
              .map((h: AnyRecord) => ({ value: h.id, label: `${h.firma} · ${h.gewerk}` }))}
          />
        </label>

        <label>
          Verantwortlicher Mitarbeiter
          <select
            value={draft.mitarbeiterIds[0] ?? ''}
            onChange={(e) => setDraft({ ...draft, mitarbeiterIds: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Nicht zugewiesen</option>
            {data.Mitarbeiter.map((m: AnyRecord) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label>
          Liegenschaft
          <select value={draft.liegenschaftId} onChange={(e) => setDraft({ ...draft, liegenschaftId: e.target.value })}>
            {data.Liegenschaft.map((l: AnyRecord) => (
              <option key={l.id} value={l.id}>{l.liegenschaftNummer} · {l.name}</option>
            ))}
          </select>
        </label>

        <label>
          Kunde / Person
          <select
            value={draft.personIds[0] ?? ''}
            onChange={(e) => setDraft({ ...draft, personIds: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Keine Person</option>
            {data.KontaktPerson
              .filter((p: AnyRecord) => p.liegenschaftId === draft.liegenschaftId)
              .map((p: AnyRecord) => (
                <option key={p.id} value={p.id}>{personDisplayName(p)} · {p.rolle}</option>
              ))}
          </select>
        </label>

        <label>
          Ort
          <input value={draft.ort} onChange={(e) => setDraft({ ...draft, ort: e.target.value })} />
        </label>

        <label>
          Status
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option>Geplant</option>
            <option>Bestätigt</option>
            <option>Erledigt</option>
            <option>Abgesagt</option>
          </select>
        </label>

        <label>
          Erinnerung
          <select value={draft.erinnerungMinuten} onChange={(e) => setDraft({ ...draft, erinnerungMinuten: Number(e.target.value) })}>
            <option value={0}>Keine Erinnerung</option>
            <option value={15}>15 Minuten vorher</option>
            <option value={30}>30 Minuten vorher</option>
            <option value={60}>1 Stunde vorher</option>
            <option value={1440}>1 Tag vorher</option>
          </select>
        </label>

        <label>
          In App sichtbar
          <select value={draft.sichtbarInApp ? 'true' : 'false'} onChange={(e) => setDraft({ ...draft, sichtbarInApp: e.target.value === 'true' })}>
            <option value="true">Ja, für Kunde sichtbar</option>
            <option value="false">Nein, nur intern</option>
          </select>
        </label>

        <label>
          Beschreibung
          <textarea value={draft.beschreibung} onChange={(e) => setDraft({ ...draft, beschreibung: e.target.value })} />
        </label>
      </div>

      <button className="primary" onClick={saveTermin}>
        Termin speichern & synchronisieren
      </button>

      <div style={{ marginTop: 20 }}>
        <h3>Bestehende Termine zu diesem Fall</h3>

        {termine.length === 0 ? (
          <p className="hint">Noch keine Termine zu diesem Schadenfall vorhanden.</p>
        ) : (
          termine.map((t: AnyRecord) => (
            <div className="list-row" key={t.id}>
              <div>
                <strong>{t.titel}</strong>
                <span>{deDate(t.start)} · {workerName(data, t.handwerkerId)} · {personName(data, t.personIds?.[0])}</span>
              </div>
              <Badge>{t.status}</Badge>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function CaseImages({ fall, save }: any) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');

  const bilder = Array.isArray(fall.bilder)
    ? fall.bilder
    : fall.fotoUrl
      ? [fall.fotoUrl]
      : [];

  const uploadImages = async () => {
    if (files.length === 0) {
      setUploadStatus('Bitte zuerst Bilder auswählen.');
      return;
    }

    try {
      setUploadStatus('Bilder werden hochgeladen ...');

      const uploadedUrls: string[] = [];

      for (const file of files) {
        const safeName = file.name.replaceAll(' ', '_');
        const path = `schadenfaelle/${fall.id}/bilder/${Date.now()}-${safeName}`;

        await uploadData({ path, data: file }).result;

        const urlResult = await getUrl({ path });
        uploadedUrls.push(urlResult.url.toString());
      }

      const neueBilder = [...bilder, ...uploadedUrls];

      await save('Schadenfall', {
        ...fall,
        bilder: neueBilder,
        fotoUrl: neueBilder[0] ?? '',
        status: statusValue(fall.status),
        updatedAt: nowIso(),
      });

      setFiles([]);
      setUploadStatus('Bilder gespeichert.');
    } catch (error) {
      console.warn(error);
      setUploadStatus('Bilder konnten nicht gespeichert werden.');
    }
  };

  return (
    <Panel title="Bilder / Fotodokumentation">
      <div className="form-grid">
        <label>
          Bilder hochladen
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.webp"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        <label>
          Hinweis
          <input value={files.length ? `${files.length} Datei(en) ausgewählt` : 'Keine Datei ausgewählt'} readOnly />
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
        {uploadStatus && <span className="hint">{uploadStatus}</span>}
        <button className="primary" onClick={uploadImages}>
          Bilder hochladen & speichern
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {bilder.length === 0 ? (
          <p className="hint">Noch keine Bilder zu diesem Schadenfall vorhanden.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {bilder.map((url: string, index: number) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: '#fff',
                  textDecoration: 'none',
                  color: '#162033',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
                }}
              >
                <img
                  src={url}
                  alt={`Schadenbild ${index + 1}`}
                  style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: 10, fontWeight: 700, fontSize: 13 }}>
                  Bild {index + 1}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Calendar({ data, save }: any) {
  const [viewMode, setViewMode] = useState<'Tag'|'Woche'|'Monat'|'Jahr'>('Woche'); const [filter, setFilter] = useState('Alle'); const [selected,setSelected]=useState<AnyRecord|null>(null); const [property,setProperty]=useState('Alle');
  const terms = data.KalenderTermin.filter((t: AnyRecord) => (filter === 'Alle' || t.typ === filter) && (property==='Alle'||t.liegenschaftId===property));
  const days = Array.from({length: viewMode==='Woche'?7: viewMode==='Tag'?1:31},(_,i)=>{const d=new Date(); d.setDate(d.getDate()+i); return d;});
  return <div><Title title="Kalender" sub="Outlook-ähnliche Ansicht mit Tages-, Wochen-, Monats- und Jahresansicht." actions={
    <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
      <KIFlyout label="✦ Termin planen" systemPrompt="Du hilfst Termine zu planen und den Kalender zu organisieren." kontext={`Kommende Termine: ${data.KalenderTermin?.length ?? 0}`} schnellstarts={['Handwerkertermin planen', 'Besichtigung organisieren', 'Termin-Konflikt prüfen', 'Wochenplanung erstellen']} />
      <button className="primary small" onClick={()=>setSelected({id:`t-${uid()}`,titel:'',typ:'Handwerkertermin',start:new Date().toISOString().slice(0,16),ende:new Date(Date.now()+3600000).toISOString().slice(0,16),sichtbarInApp:true,status:'Geplant'})}>Neuer Termin</button>
    </div>
  } />
    <div className="calendar-page"><div className="toolbar calendar-toolbar">{(['Tag','Woche','Monat','Jahr'] as const).map(x => <button className={viewMode === x ? 'active' : ''} onClick={() => setViewMode(x)}>{x}</button>)}<select value={filter} onChange={e => setFilter(e.target.value)}>{['Alle','Handwerkertermin','Wohnungsabnahme','Übergabe','Besichtigung','Eigentümerversammlung'].map(x => <option>{x}</option>)}</select><select value={property} onChange={e=>setProperty(e.target.value)}><option value="Alle">Alle Liegenschaften</option>{data.Liegenschaft.map((l:AnyRecord)=><option value={l.id}>{l.liegenschaftNummer} · {l.name}</option>)}</select></div><div className={`calendar-grid mode-${viewMode.toLowerCase()}`}>{days.map(day=><div className="cal-day"><div className="cal-date"><strong>{day.toLocaleDateString('de-CH',{weekday:'short'})}</strong><span>{day.toLocaleDateString('de-CH')}</span></div>{terms.filter((t:AnyRecord)=> viewMode==='Jahr' || new Date(t.start).toDateString()===day.toDateString() || viewMode==='Woche').slice(0, viewMode==='Woche'?3:8).map((t:AnyRecord)=><button className="cal-event" onClick={()=>setSelected(t)}><strong>{t.titel}</strong><span>{new Date(t.start).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})} · {workerName(data,t.handwerkerId)}</span></button>)}</div>)}</div><Panel title="Terminliste nach Datum">{terms.sort((a:AnyRecord,b:AnyRecord)=>new Date(a.start).getTime()-new Date(b.start).getTime()).map((t:AnyRecord)=><button className="list-row clickable" onClick={()=>setSelected(t)}><div><strong>{t.titel}</strong><span>{deDate(t.start)} · {propertyName(data,t.liegenschaftId)} · {personName(data,t.personIds?.[0])}</span></div><Badge>{t.typ}</Badge></button>)}</Panel></div>{selected && <Modal title={selected.id?.startsWith('t-') && !data.KalenderTermin.some((t:AnyRecord)=>t.id===selected.id) ? 'Termin erfassen' : 'Termin bearbeiten'} onClose={()=>setSelected(null)}><EditFields item={selected} fields={['titel','typ','liegenschaftId','handwerkerId','start','ende','ort','beschreibung','sichtbarInApp','status']} onSave={(x)=>{ save('KalenderTermin',{...x,start:new Date(x.start).toISOString(),ende:new Date(x.ende).toISOString()}); setSelected(null); }}/></Modal>}</div>;
}

// ── Handwerker-Name normalisieren für Duplikaterkennung ──────────────────────
function normHandwerkerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ag|sa|sàrl|kg|oe?hg|llc|inc|ltd|co\.|und co\.?|& co\.?|einzelunternehmen|i\.?l\.?)\b/g, '')
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findeAehnlicheHandwerker(name: string, liste: AnyRecord[]): AnyRecord[] {
  if (!name || name.length < 3) return [];
  const norm = normHandwerkerName(name);
  if (!norm) return [];
  return liste.filter((h: AnyRecord) => {
    const hNorm = normHandwerkerName(String(h.firma ?? ''));
    if (!hNorm) return false;
    if (hNorm === norm) return true;                        // exakt gleich
    if (hNorm.includes(norm) || norm.includes(hNorm)) return true;  // einer enthält anderen
    // Anfang stimmt überein (min. 8 Zeichen)
    const minLen = Math.min(hNorm.length, norm.length);
    if (minLen >= 8 && hNorm.substring(0, minLen) === norm.substring(0, minLen)) return true;
    return false;
  });
}

// ── CSV-Telefon bereinigen ────────────────────────────────────────────────────
function bereinigeTelefon(raw: any): string {
  const s = String(raw ?? '').replace(/\.0$/, '').replace(/[\s\-\.() ]/g, '').replace('nan', '').trim();
  if (!s) return '';
  if (s.startsWith('+41') && s.length >= 11) return s;
  if (s.startsWith('0041')) return '+41' + s.slice(4);
  if (/^41\d{8,9}$/.test(s)) return '+' + s;
  if (/^0\d{9}$/.test(s)) return '+41' + s.slice(1);
  return s;
}

function parseCsv(text: string): AnyRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++;
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some(cell => cell.trim())) rows.push(row);

  const headers = (rows.shift() ?? []).map(header => header.replace(/^\uFEFF/, '').trim());
  return rows.map(cells => Object.fromEntries(
    headers.map((header, index) => [header, cells[index]?.trim() ?? ''])
  ));
}

function HandwerkerImportModal({ save, vorhandene, handwerker, onClose }: {
  save: (model: string, item: AnyRecord) => Promise<any>;
  vorhandene: Set<string>;
  handwerker: AnyRecord[];
  onClose: () => void;
}) {
  const [phase, setPhase]             = useState<'auswahl' | 'vorschau' | 'import' | 'fertig'>('auswahl');
  const [zeilen, setZeilen]           = useState<AnyRecord[]>([]);
  const [fortschritt, setFortschritt] = useState(0);
  const [fehler, setFehler]           = useState(0);
  const [dateiname, setDateiname]     = useState('');
  const [ueberspringe, setUeberspringe] = useState(true);
  const [modus, setModus]             = useState<'neu' | 'aktualisieren'>('aktualisieren');

  const leseCsv = async (file: File) => {
    setZeilen(parseCsv(await file.text()));
    setDateiname(file.name);
    setPhase('vorschau');
  };

  const startImport = async () => {
    setPhase('import');
    let ok = 0; let err = 0; let dup = 0;
    const BATCH = 8;

    for (let i = 0; i < zeilen.length; i += BATCH) {
      const chunk = zeilen.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (row) => {
        const firma  = String(row['Firma'] ?? row['firma'] ?? '').trim();
        const gewerk = String(row['Gewerk'] ?? row['gewerk'] ?? '').trim();
        if (!firma) return;

        const tel     = bereinigeTelefon(row['Telefon'] ?? row['telefon'] ?? '');
        const nottel  = bereinigeTelefon(row['Notfall-Telefon'] ?? row['notfallTelefon'] ?? '');
        const email   = String(row['Email'] ?? row['email'] ?? '').replace('nan','').trim().toLowerCase();
        const adresse = String(row['Adresse'] ?? row['adresse'] ?? '').replace('nan','').trim();
        const einsatz = String(row['Einsatzgebiet'] ?? row['einsatzgebiet'] ?? '').replace('nan','').trim();
        const stunden = row['Stundensatz'] ?? row['stundensatz'];
        const notiz   = String(row['Bemerkung'] ?? row['bemerkung'] ?? '').replace('nan','').trim()
                          .replace(/^UID:\s*CHE[\w.-]+$/, '').trim();

        try {
          if (modus === 'aktualisieren') {
            // Vorhandenen Handwerker per Name finden und Felder aktualisieren
            const normFirma = normHandwerkerName(firma);
            const vorhandenerHW = handwerker.find((h: AnyRecord) =>
              normHandwerkerName(String(h.firma ?? '')) === normFirma
            );
            if (vorhandenerHW) {
              const update: AnyRecord = { ...vorhandenerHW, updatedAt: nowIso() };
              if (adresse) update.adresse = adresse;
              if (email && !vorhandenerHW.email) update.email = email;
              if (tel && !vorhandenerHW.telefon) update.telefon = tel;
              if (nottel && !vorhandenerHW.notfallTelefon) update.notfallTelefon = nottel;
              if (einsatz && !vorhandenerHW.einsatzgebiet) update.einsatzgebiet = einsatz;
              await save('Handwerker', update);
              ok++;
            } else {
              dup++; // Kein Treffer → überspringen
            }
          } else {
            // Neu-Import-Modus
            if (!gewerk) return;
            if (ueberspringe) {
              const normFirma = normHandwerkerName(firma);
              const istDuplikat = [...vorhandene].some(n => normHandwerkerName(n) === normFirma);
              if (istDuplikat) { dup++; return; }
            }
            const item: AnyRecord = {
              id: `hw-${uid()}`, firma, gewerk,
              kontaktperson: String(row['Kontaktperson'] ?? '').replace('nan','').trim(),
              email, telefon: tel, notfallTelefon: nottel, adresse, einsatzgebiet: einsatz,
              bewertung: undefined,
              stundensatz: stunden && String(stunden) !== 'nan' ? Number(stunden) : undefined,
              status: 'Aktiv', bemerkung: notiz,
              createdAt: nowIso(), updatedAt: nowIso(),
            };
            await save('Handwerker', item);
            ok++;
          }
        } catch { err++; }
      }));
      setFortschritt(Math.min(i + BATCH, zeilen.length));
      setFehler(err);
    }
    setFortschritt(zeilen.length);
    setFehler(err);
    setPhase('fertig');
  };

  const pct = zeilen.length ? Math.round(fortschritt / zeilen.length * 100) : 0;
  const duplikatZeilen = zeilen.filter(r => {
    const norm = normHandwerkerName(String(r['Firma'] ?? '').trim());
    return norm && [...vorhandene].some(n => normHandwerkerName(n) === norm);
  });
  const neu = zeilen.length - duplikatZeilen.length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 25px 60px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📥 Handwerker importieren</div>
          {phase !== 'import' && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>}
        </div>

        {/* Auswahl */}
        {phase === 'auswahl' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Modus-Wahl */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'aktualisieren', label: '🔄 Bestehende aktualisieren', desc: 'Adresse + leere Felder bei vorhandenen Einträgen ergänzen' },
                { key: 'neu',          label: '➕ Neu importieren',            desc: 'Neue Handwerker anlegen, Duplikate überspringen' },
              ].map(m => (
                <button key={m.key} onClick={() => setModus(m.key as 'neu' | 'aktualisieren')}
                  style={{ flex: 1, border: `2px solid ${modus === m.key ? '#1e293b' : '#e5e7eb'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: modus === m.key ? '#1e293b' : '#fff', color: modus === m.key ? '#fff' : '#374151', textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</div>
                  <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>{m.desc}</div>
                </button>
              ))}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, border: '2px dashed #d1d5db', borderRadius: 12, padding: '28px 20px', cursor: 'pointer', background: '#f8fafc' }}>
              <span style={{ fontSize: 36 }}>📂</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>CSV-Datei wählen</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>UTF-8, kann mit Excel bearbeitet werden</span>
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && leseCsv(e.target.files[0])} />
            </label>
          </div>
        )}

        {/* Vorschau */}
        {phase === 'vorschau' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📊 {zeilen.length} Einträge in «{dateiname}»</div>
              {modus === 'aktualisieren' ? (
                <div style={{ fontSize: 13, color: '#374151' }}>
                  <strong style={{ color: '#16a34a' }}>{duplikatZeilen.length}</strong> vorhandene Einträge werden aktualisiert &nbsp;·&nbsp;
                  <strong style={{ color: '#9ca3af' }}>{neu}</strong> nicht gefunden (überspringen)
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#374151' }}>
                  Neu: <strong>{neu}</strong> &nbsp;·&nbsp;
                  Bereits vorhanden: <strong style={{ color: duplikatZeilen.length > 0 ? '#d97706' : '#374151' }}>{duplikatZeilen.length}</strong>
                </div>
              )}
              {modus === 'neu' && duplikatZeilen.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                  <input type="checkbox" checked={ueberspringe} onChange={e => setUeberspringe(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  <span>Duplikate überspringen <span style={{ color: '#6b7280' }}>(empfohlen)</span></span>
                </label>
              )}
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Mit Telefon: {zeilen.filter(r => bereinigeTelefon(r['Telefon']).length > 3).length} &nbsp;·&nbsp;
                Mit E-Mail: {zeilen.filter(r => String(r['Email']??'').includes('@')).length}
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Beispiel-Einträge aus der Datei:
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {zeilen.slice(0, 5).map((r, i) => (
                <div key={i} style={{ fontSize: 12, background: '#f8fafc', borderRadius: 6, padding: '6px 10px' }}>
                  <strong>{String(r['Firma']??'').substring(0,40)}</strong> · {r['Gewerk']} · {r['Adresse']}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={startImport} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, flex: 1 }}>
                {modus === 'aktualisieren'
                  ? `🔄 ${duplikatZeilen.length} Einträge aktualisieren`
                  : `✓ ${ueberspringe && duplikatZeilen.length > 0 ? `${neu} neue importieren` : `Alle ${zeilen.length} importieren`}`}
              </button>
              <button onClick={() => setPhase('auswahl')} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
                Andere Datei
              </button>
            </div>
          </div>
        )}

        {/* Import läuft */}
        {phase === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Importiere … {fortschritt} / {zeilen.length}
            </div>
            <div style={{ background: '#e5e7eb', borderRadius: 8, height: 12, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 8, transition: 'width .2s' }} />
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{pct}% abgeschlossen · bitte nicht schliessen</div>
          </div>
        )}

        {/* Fertig */}
        {phase === 'fertig' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>✅</span>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{fortschritt - fehler} Handwerker angelegt</div>
            {fehler > 0 && <div style={{ color: '#dc2626', fontSize: 13 }}>{fehler} Einträge fehlgeschlagen</div>}
            <div style={{ color: '#6b7280', fontSize: 13 }}>Die Daten wurden in AWS gespeichert und sind sofort verfügbar.</div>
            <button onClick={onClose} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              Zur Handwerkerliste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ContractorList({ data, save, setView, setSelectedWorkerId }: any) {
  const [q, setQ] = useState('');
  const [gewerk, setGewerk] = useState('Alle');
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState<AnyRecord>({
    firma: '',
    gewerk: '',
    kontaktperson: '',
    email: '',
    telefon: '',
    notfallTelefon: '',
    strasse: '',
    plz: '',
    ort: '',
    einsatzgebiet: '',
    bewertung: 5,
    stundensatz: '',
    status: 'Aktiv',
    bemerkung: '',
  });
  const [error, setError]       = useState('');
  const [duplikate, setDuplikate] = useState<AnyRecord[]>([]);
  const [seite, setSeite]       = useState(1);
  const PRO_SEITE = 50;

  const list = data.Handwerker.filter((h: AnyRecord) =>
    !String(h.firma ?? '').startsWith('[GELÖSCHT]') &&
    JSON.stringify(h).toLowerCase().includes(q.toLowerCase()) &&
    (gewerk === 'Alle' || h.gewerk === gewerk)
  ).sort((a: AnyRecord, b: AnyRecord) => String(a.firma ?? '').localeCompare(String(b.firma ?? ''), 'de'));

  const seitenAnzahl = Math.ceil(list.length / PRO_SEITE);
  const seiteLimited = Math.min(seite, Math.max(1, seitenAnzahl));
  const listSeite    = list.slice((seiteLimited - 1) * PRO_SEITE, seiteLimited * PRO_SEITE);

  const gewerke = ['Alle', ...Array.from(new Set(
    data.Handwerker
      .filter((h: AnyRecord) => !String(h.firma ?? '').startsWith('[GELÖSCHT]'))
      .map((h: AnyRecord) => h.gewerk).filter(Boolean)
  )).sort()];
  const vorhandeneNamen = new Set<string>(data.Handwerker.map((h: AnyRecord) => String(h.firma ?? '').toLowerCase().trim()));

  const resetDraft = () => {
    setDraft({
      firma: '',
      gewerk: '',
      kontaktperson: '',
      email: '',
      telefon: '',
      notfallTelefon: '',
      strasse: '',
      plz: '',
      ort: '',
      einsatzgebiet: '',
      bewertung: 5,
      stundensatz: '',
      status: 'Aktiv',
      bemerkung: '',
    });
    setError('');
  };

  const createContractor = async () => {
    if (!String(draft.firma ?? '').trim()) {
      setError('Firma ist ein Pflichtfeld.');
      return;
    }
    if (!String(draft.gewerk ?? '').trim()) {
      setError('Gewerk ist ein Pflichtfeld.');
      return;
    }

    // Exakte Duplikate blockieren, ähnliche nur warnen
    const exakt = findeAehnlicheHandwerker(String(draft.firma).trim(), data.Handwerker).filter(
      (h: AnyRecord) => normHandwerkerName(h.firma) === normHandwerkerName(String(draft.firma).trim())
    );
    if (exakt.length > 0) {
      const weiter = window.confirm(
        `⚠️ Möglicher Doppeleintrag!\n\n` +
        `«${exakt[0].firma}» ist bereits in der Datenbank.\n\n` +
        `Trotzdem als neuen Handwerker anlegen?`
      );
      if (!weiter) return;
    }

    const item = {
      id: `hw-${uid()}`,
      firma: String(draft.firma).trim(),
      gewerk: String(draft.gewerk).trim(),
      kontaktperson: String(draft.kontaktperson ?? '').trim(),
      email: String(draft.email ?? '').trim(),
      telefon: String(draft.telefon ?? '').trim(),
      notfallTelefon: String(draft.notfallTelefon ?? '').trim(),
      adresse: [String(draft.strasse ?? '').trim(), [String(draft.plz ?? '').trim(), String(draft.ort ?? '').trim()].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      einsatzgebiet: String(draft.einsatzgebiet ?? '').trim(),
      bewertung: Number(draft.bewertung || 0),
      stundensatz: draft.stundensatz === '' ? undefined : Number(draft.stundensatz),
      status: draft.status || 'Aktiv',
      bemerkung: String(draft.bemerkung ?? '').trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const result = await save('Handwerker', item);
    if (!result?.ok) {
      setError('Handwerker wurde lokal angelegt, konnte aber noch nicht mit AWS synchronisiert werden.');
      return;
    }

    resetDraft();
    setEditorOpen(false);
    setSelectedWorkerId(item.id);
    setView('handwerkerDetail');
  };

  return (
    <div>
      <Title
        title="Handwerker"
        sub="Handwerkerdatenbank mit Einsatzhistorie, Terminen, Quittungen und Dokumenten."
        actions={
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <KIFlyout label="✦ Handwerker finden" systemPrompt="Du hilfst den richtigen Handwerker für einen Job zu finden." kontext={`Verfügbare Handwerker (Top 80):\n${(data.Handwerker ?? []).filter((h: AnyRecord) => h.status !== 'Inaktiv' && !String(h.firma ?? '').startsWith('[GELÖSCHT]')).slice(0, 80).map((h: AnyRecord) => `[${h.id}] ${h.firma ?? h.name} – ${h.gewerk ?? ''} | Tel: ${h.telefon ?? ''} | ${h.email ?? ''}`).join('\n')}`} schnellstarts={['Sanitär-Handwerker empfehlen', 'Elektriker für Notfall', 'Günstigsten Maler finden', 'Handwerker für Heizung']} />
            <button className="small" onClick={() => {
              const csv = [
                ['Firma','Gewerk','Kontaktperson','Email','Telefon','Notfall-Telefon','Adresse','Einsatzgebiet','Stundensatz','Bemerkung'],
                ['Muster Sanitär GmbH','Sanitär','Max Muster','info@muster-sanitaer.example','+41 61 000 00 00','','Musterweg 1, 4000 Basel','Basel, Aargau, Solothurn','95','Beispieldatensatz'],
              ].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
              const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'handwerker_vorlage.csv';
              link.click();
              URL.revokeObjectURL(url);
            }}>📄 Vorlage herunterladen</button>
            <button className="small" onClick={() => setImportOpen(true)}>📥 CSV importieren</button>
            <button className="primary small" onClick={() => { resetDraft(); setEditorOpen(true); }}>Neuen Handwerker erfassen</button>
          </div>
        }
      />
      <Panel title={`Handwerkerliste · ${list.length} Einträge${seitenAnzahl > 1 ? ` · Seite ${seiteLimited}/${seitenAnzahl}` : ''}`} className="full-list">
        <div className="list-toolbar">
          <input className="search" placeholder="Suche nach Firma, Gewerk, Kontaktperson, Region ..." value={q} onChange={e => { setQ(e.target.value); setSeite(1); }} />
          <select value={gewerk} onChange={e => { setGewerk(e.target.value); setSeite(1); }}>{gewerke.map((g: any) => <option key={g}>{g}</option>)}</select>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Firma</th><th>Gewerk</th><th>Kontaktperson</th><th>Telefon</th><th>Region</th><th>Aktuelle Einsätze</th><th>Bewertung</th><th>Status</th></tr>
          </thead>
          <tbody>
            {listSeite.map((h: AnyRecord) => (
              <tr key={h.id} onClick={() => { setSelectedWorkerId(h.id); setView('handwerkerDetail'); }}>
                <td><strong>{h.firma}</strong></td>
                <td>{h.gewerk}</td>
                <td>{h.kontaktperson}</td>
                <td>{h.telefon}</td>
                <td>{h.einsatzgebiet}</td>
                <td>{data.Schadenfall.filter((f: AnyRecord) => f.handwerkerId === h.id && !['ERLEDIGT', 'ARCHIVIERT'].includes(statusValue(f.status))).length}</td>
                <td>{h.bewertung ? `${h.bewertung} ★` : '—'}</td>
                <td><Badge tone={h.status === 'Aktiv' ? 'green' : h.status === 'Inaktiv' ? 'orange' : ''}>{h.status ?? 'Aktiv'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {seitenAnzahl > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px 4px', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {(seiteLimited - 1) * PRO_SEITE + 1}–{Math.min(seiteLimited * PRO_SEITE, list.length)} von {list.length} Einträgen
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setSeite(1)} disabled={seiteLimited === 1} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: seiteLimited === 1 ? '#f9fafb' : '#fff', cursor: seiteLimited === 1 ? 'default' : 'pointer', fontSize: 13 }}>«</button>
              <button onClick={() => setSeite(s => Math.max(1, s - 1))} disabled={seiteLimited === 1} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: seiteLimited === 1 ? '#f9fafb' : '#fff', cursor: seiteLimited === 1 ? 'default' : 'pointer', fontSize: 13 }}>‹ Zurück</button>
              {Array.from({ length: Math.min(seitenAnzahl, 7) }, (_, i) => {
                let p = i + 1;
                if (seitenAnzahl > 7) {
                  if (seiteLimited <= 4) p = i + 1;
                  else if (seiteLimited >= seitenAnzahl - 3) p = seitenAnzahl - 6 + i;
                  else p = seiteLimited - 3 + i;
                }
                return (
                  <button key={p} onClick={() => setSeite(p)} style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #e5e7eb', background: p === seiteLimited ? '#1e293b' : '#fff', color: p === seiteLimited ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: p === seiteLimited ? 700 : 400 }}>{p}</button>
                );
              })}
              <button onClick={() => setSeite(s => Math.min(seitenAnzahl, s + 1))} disabled={seiteLimited === seitenAnzahl} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: seiteLimited === seitenAnzahl ? '#f9fafb' : '#fff', cursor: seiteLimited === seitenAnzahl ? 'default' : 'pointer', fontSize: 13 }}>Weiter ›</button>
              <button onClick={() => setSeite(seitenAnzahl)} disabled={seiteLimited === seitenAnzahl} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: seiteLimited === seitenAnzahl ? '#f9fafb' : '#fff', cursor: seiteLimited === seitenAnzahl ? 'default' : 'pointer', fontSize: 13 }}>»</button>
            </div>
          </div>
        )}
      </Panel>

      {importOpen && (
        <HandwerkerImportModal
          save={save}
          vorhandene={vorhandeneNamen}
          handwerker={data.Handwerker}
          onClose={() => setImportOpen(false)}
        />
      )}

      {editorOpen && (
        <Modal title="Handwerker erfassen" onClose={() => setEditorOpen(false)}>
          {error && <p style={{ color: '#dc2626', fontWeight: 700, marginBottom: 12 }}>{error}</p>}

          <div className="hw-form-sections">
            {/* Firma & Gewerk */}
            <div className="hw-form-section">
              <div className="hw-section-label">Firma & Gewerk</div>
              <div className="form-grid">
                <label>Firma *
                  <input
                    value={draft.firma}
                    onChange={e => {
                      const val = e.target.value;
                      setDraft({ ...draft, firma: val });
                      setDuplikate(findeAehnlicheHandwerker(val, data.Handwerker));
                    }}
                    placeholder="Firmenname"
                    style={duplikate.length > 0 ? { borderColor: '#f59e0b', background: '#fffbeb' } : {}}
                  />
                  {duplikate.length > 0 && (
                    <div style={{ marginTop: 6, background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚠️ {duplikate.length === 1 ? 'Möglicher Doppeleintrag' : `${duplikate.length} mögliche Doppeleinträge`}
                      </div>
                      {duplikate.slice(0, 3).map((h: AnyRecord) => (
                        <div key={h.id} style={{ fontSize: 12, color: '#78350f', background: '#fef3c7', borderRadius: 6, padding: '4px 8px' }}>
                          <strong>{h.firma}</strong>
                          {h.gewerk ? ` · ${h.gewerk}` : ''}
                          {h.telefon ? ` · ${h.telefon}` : ''}
                          {h.adresse ? ` · ${h.adresse}` : ''}
                        </div>
                      ))}
                      {duplikate.length > 3 && (
                        <div style={{ fontSize: 11, color: '#92400e' }}>+ {duplikate.length - 3} weitere ähnliche Einträge</div>
                      )}
                    </div>
                  )}
                </label>
                <label>Gewerk *
                  <select value={draft.gewerk} onChange={e => setDraft({ ...draft, gewerk: e.target.value })}>
                    <option value="">— Gewerk wählen —</option>
                    {['Sanitär', 'Elektriker', 'Maler', 'Schlosser / Schlüsseldienst', 'Schreiner / Zimmermann', 'Heizung / Lüftung / Klima', 'Gipser / Trockenbau', 'Bodenleger', 'Dachdecker', 'Fassade / Isolation', 'Gartenunterhalt', 'Reinigung / Hauswartung', 'Lift / Aufzug', 'Allgemeine Reparaturen', 'Sonstiges'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* Kontakt */}
            <div className="hw-form-section">
              <div className="hw-section-label">Kontakt</div>
              <div className="form-grid">
                <label>Kontaktperson
                  <input value={draft.kontaktperson} onChange={e => setDraft({ ...draft, kontaktperson: e.target.value })} placeholder="Vor- und Nachname" />
                </label>
                <label>E-Mail
                  <input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="firma@beispiel.invalid" />
                </label>
                <label>Telefon
                  <input value={draft.telefon} onChange={e => setDraft({ ...draft, telefon: e.target.value })} placeholder="+41 61 000 00 00" />
                </label>
                <label>Notfalltelefon
                  <input value={draft.notfallTelefon} onChange={e => setDraft({ ...draft, notfallTelefon: e.target.value })} placeholder="+41 79 000 00 00" />
                </label>
              </div>
            </div>

            {/* Standort */}
            <div className="hw-form-section">
              <div className="hw-section-label">Standort & Einsatzgebiet</div>
              <div className="form-grid">
                <label style={{ gridColumn: '1/-1' }}>Strasse
                  <input value={draft.strasse} onChange={e => setDraft({ ...draft, strasse: e.target.value })} placeholder="Musterstrasse 12" />
                </label>
                <label>PLZ
                  <input value={draft.plz} onChange={e => setDraft({ ...draft, plz: e.target.value })} placeholder="4001" />
                </label>
                <label>Ort
                  <input value={draft.ort} onChange={e => setDraft({ ...draft, ort: e.target.value })} placeholder="Basel" />
                </label>
                <label>Einsatzgebiet
                  <select value={draft.einsatzgebiet} onChange={e => setDraft({ ...draft, einsatzgebiet: e.target.value })}>
                    <option value="">— Region wählen —</option>
                    {EINSATZGEBIETE.map(r => <option key={r}>{r}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* Konditionen */}
            <div className="hw-form-section full">
              <div className="hw-section-label">Konditionen & Status</div>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <label>Bewertung
                  <div className="hw-star-row">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" className={`hw-star ${Number(draft.bewertung) >= n ? 'filled' : ''}`}
                        onClick={() => setDraft({ ...draft, bewertung: n })}>★</button>
                    ))}
                    <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 6 }}>{draft.bewertung ? `${draft.bewertung}/5` : 'Noch nicht bewertet'}</span>
                  </div>
                </label>
                <label>Stundensatz (CHF/h)
                  <input type="number" min="0" step="5" value={draft.stundensatz} onChange={e => setDraft({ ...draft, stundensatz: e.target.value })} placeholder="z.B. 95" />
                </label>
                <label>Status
                  <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                    <option>Aktiv</option><option>Inaktiv</option><option>Gesperrt</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Bemerkung */}
            <div className="hw-form-section full">
              <div className="hw-section-label">Bemerkung</div>
              <textarea value={draft.bemerkung} onChange={e => setDraft({ ...draft, bemerkung: e.target.value })}
                placeholder="Interne Notizen, Spezialisierungen, Konditionen ..."
                style={{ width: '100%', border: '1px solid #ddd6cc', borderRadius: 12, padding: '10px 14px', fontSize: 13, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditorOpen(false)}>Abbrechen</button>
            <button className="primary" onClick={createContractor}>Handwerker speichern</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
// ── Adresse-Hilfsfunktionen ───────────────────────────────────────────────────

const EINSATZGEBIETE = [
  'Basel-Stadt', 'Basel-Landschaft', 'Aargau', 'Solothurn',
  'Jura', 'Bern', 'Zürich', 'Luzern', 'Zug', 'Schweizweit',
];

function parseAdresse(adresse: string): { strasse: string; plz: string; ort: string } {
  const s = String(adresse ?? '').trim();
  // Format: "Strasse 12, 4133 Pratteln"
  const m = s.match(/^(.+?),\s*(\d{4})\s+(.+)$/);
  if (m) return { strasse: m[1].trim(), plz: m[2].trim(), ort: m[3].trim() };
  // Format: "4133 Pratteln"
  const m2 = s.match(/^(\d{4})\s+(.+)$/);
  if (m2) return { strasse: '', plz: m2[1], ort: m2[2].trim() };
  // Nur Ort
  return { strasse: '', plz: '', ort: s };
}

function combineAdresse(strasse: string, plz: string, ort: string): string {
  const plzOrt = [plz.trim(), ort.trim()].filter(Boolean).join(' ');
  return [strasse.trim(), plzOrt].filter(Boolean).join(', ');
}

function HandwerkerStammdatenForm({ h, save }: { h: AnyRecord; save: (model: string, item: AnyRecord) => Promise<any> }) {
  const parsed = parseAdresse(h.adresse ?? '');
  const [d, setD] = useState<AnyRecord>({
    firma:          h.firma ?? '',
    gewerk:         h.gewerk ?? '',
    kontaktperson:  h.kontaktperson ?? '',
    email:          h.email ?? '',
    telefon:        h.telefon ?? '',
    notfallTelefon: h.notfallTelefon ?? '',
    strasse:        parsed.strasse,
    plz:            parsed.plz,
    ort:            parsed.ort,
    einsatzgebiet:  h.einsatzgebiet ?? '',
    bewertung:      h.bewertung ?? '',
    stundensatz:    h.stundensatz ?? '',
    status:         h.status ?? 'Aktiv',
    bemerkung:      h.bemerkung ?? '',
  });
  const [gespeichert, setGespeichert] = useState(false);

  const speichern = async () => {
    await save('Handwerker', {
      ...h,
      firma:          String(d.firma).trim(),
      gewerk:         String(d.gewerk).trim(),
      kontaktperson:  String(d.kontaktperson).trim(),
      email:          String(d.email).trim(),
      telefon:        String(d.telefon).trim(),
      notfallTelefon: String(d.notfallTelefon).trim(),
      adresse:        combineAdresse(String(d.strasse), String(d.plz), String(d.ort)),
      einsatzgebiet:  String(d.einsatzgebiet).trim(),
      bewertung:      d.bewertung ? Number(d.bewertung) : undefined,
      stundensatz:    d.stundensatz !== '' ? Number(d.stundensatz) : undefined,
      status:         d.status,
      bemerkung:      String(d.bemerkung).trim(),
      updatedAt:      nowIso(),
    });
    setGespeichert(true);
    setTimeout(() => setGespeichert(false), 2500);
  };

  const F = ({ label, field, type = 'text', placeholder = '', col = '' }: { label: string; field: string; type?: string; placeholder?: string; col?: string }) => (
    <label style={col ? { gridColumn: col } : {}}>
      {label}
      <input type={type} value={String(d[field] ?? '')} onChange={e => setD({ ...d, [field]: e.target.value })} placeholder={placeholder} />
    </label>
  );

  return (
    <Panel title="Stammdaten bearbeiten">
      <div className="hw-form-sections">

        {/* Firma & Gewerk */}
        <div className="hw-form-section">
          <div className="hw-section-label">Firma & Gewerk</div>
          <div className="form-grid">
            <F label="Firma *" field="firma" placeholder="Firmenname" />
            <label>Gewerk *
              <select value={d.gewerk} onChange={e => setD({ ...d, gewerk: e.target.value })}>
                <option value="">— Gewerk wählen —</option>
                {['Sanitär','Elektrik','Maler','Schreiner','Zimmermann','Heizung','Lüftung','Dachdecker','Gipser','Schlosser','Gärtner','Reinigung','Bodenleger','Glaser','Kaminkehrer','Isolierung','Maurer','Fensterbau','Trockenbau','Tiefbau','Sonstiges'].map(g => <option key={g}>{g}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Kontakt */}
        <div className="hw-form-section">
          <div className="hw-section-label">Kontakt</div>
          <div className="form-grid">
            <F label="Kontaktperson" field="kontaktperson" placeholder="Vor- und Nachname" />
            <F label="E-Mail" field="email" type="email" placeholder="firma@beispiel.invalid" />
            <F label="Telefon" field="telefon" placeholder="+41 61 000 00 00" />
            <F label="Notfalltelefon" field="notfallTelefon" placeholder="+41 79 000 00 00" />
          </div>
        </div>

        {/* Adresse — 3 separate Felder */}
        <div className="hw-form-section">
          <div className="hw-section-label">Adresse & Einsatzgebiet</div>
          <div className="form-grid">
            <F label="Strasse & Hausnummer" field="strasse" placeholder="Musterstrasse 12" col="1/-1" />
            <F label="PLZ" field="plz" placeholder="4001" />
            <F label="Ort" field="ort" placeholder="Basel" />
            <label style={{ gridColumn: '1/-1' }}>Einsatzgebiet
              <select value={d.einsatzgebiet} onChange={e => setD({ ...d, einsatzgebiet: e.target.value })}>
                <option value="">— Region wählen —</option>
                {EINSATZGEBIETE.map(r => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Konditionen */}
        <div className="hw-form-section">
          <div className="hw-section-label">Konditionen & Status</div>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <label>Bewertung
              <div className="hw-star-row">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" className={`hw-star ${Number(d.bewertung) >= n ? 'filled' : ''}`}
                    onClick={() => setD({ ...d, bewertung: n })}>★</button>
                ))}
                <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 6 }}>{d.bewertung ? `${d.bewertung}/5` : '—'}</span>
              </div>
            </label>
            <F label="Stundensatz (CHF/h)" field="stundensatz" type="number" placeholder="95" />
            <label>Status
              <select value={d.status} onChange={e => setD({ ...d, status: e.target.value })}>
                <option>Aktiv</option><option>Inaktiv</option><option>Gesperrt</option>
              </select>
            </label>
          </div>
        </div>

        {/* Bemerkung */}
        <div className="hw-form-section full">
          <div className="hw-section-label">Bemerkung</div>
          <textarea value={d.bemerkung} onChange={e => setD({ ...d, bemerkung: e.target.value })}
            style={{ width: '100%', minHeight: 70, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>

      </div>

      <button
        className="primary"
        style={{ marginTop: 16, width: '100%' }}
        onClick={speichern}
      >
        {gespeichert ? '✓ Gespeichert' : 'Speichern'}
      </button>
    </Panel>
  );
}

function ContractorDetailPage({ data, selectedWorkerId, save, setSelectedCaseId, setView }: any) {
  const h = data.Handwerker.find((x: AnyRecord) => x.id === selectedWorkerId) ?? data.Handwerker[0];
  const [tab, setTab] = useState<WorkerTab>('Auslastung');
  if (!h) return <AccessDenied />;

  const cases = data.Schadenfall.filter((f: AnyRecord) => f.handwerkerId === h.id);
  const terms = data.KalenderTermin.filter((t: AnyRecord) => t.handwerkerId === h.id);
  const keys = data.Schluessel.filter((s: AnyRecord) => s.handwerkerId === h.id);
  const now = Date.now();
  const activeCases = cases.filter((f: AnyRecord) => !['ERLEDIGT', 'ARCHIVIERT'].includes(statusValue(f.status)));
  const completedCases = cases.filter((f: AnyRecord) => ['ERLEDIGT', 'ARCHIVIERT'].includes(statusValue(f.status)));
  const upcomingTerms = terms
    .filter((t: AnyRecord) => new Date(t.start).getTime() >= now && t.status !== 'Abgesagt')
    .sort((a: AnyRecord, b: AnyRecord) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const pastTerms = terms
    .filter((t: AnyRecord) => new Date(t.start).getTime() < now || t.status === 'Erledigt')
    .sort((a: AnyRecord, b: AnyRecord) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const urgentCases = activeCases.filter((f: AnyRecord) => ['Dringend', 'Hoch'].includes(f.prioritaet));
  const workloadScore = activeCases.length * 2 + upcomingTerms.length + urgentCases.length * 2;
  const workloadLabel = workloadScore >= 10 ? 'Stark ausgelastet' : workloadScore >= 5 ? 'Gut ausgelastet' : 'Kapazität vorhanden';
  const workloadTone = workloadScore >= 10 ? 'red' : workloadScore >= 5 ? 'orange' : 'green';
  const tabs: WorkerTab[] = ['Auslastung', 'Aktuell', 'Verlauf', 'Stammdaten', 'Termine', 'Schlüssel', 'Dokumente'];

  const caseRow = (f: AnyRecord) => (
    <button className="list-row clickable" key={f.id} onClick={() => { setSelectedCaseId(f.id); setView('fallDetail'); }}>
      <div>
        <strong>{f.fallNummer ? `${f.fallNummer} · ` : ''}{f.titel}</strong>
        <span>{propertyName(data, f.liegenschaftId)} · {personName(data, f.personId)} · {f.kategorie ?? 'Meldung'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Badge tone={f.prioritaet === 'Dringend' || f.prioritaet === 'Hoch' ? 'red' : 'orange'}>{f.prioritaet ?? 'Normal'}</Badge>
        <Badge>{statusLabel(statusValue(f.status))}</Badge>
      </div>
    </button>
  );

  const termRow = (t: AnyRecord) => (
    <div className="list-row" key={t.id}>
      <div>
        <strong>{t.titel}</strong>
        <span>{deDate(t.start)} · {propertyName(data, t.liegenschaftId)} · {t.ort ?? ''}</span>
      </div>
      <Badge>{t.typ}</Badge>
    </div>
  );

  return (
    <div>
      <Title title={h.firma} sub={`${h.gewerk} · ${h.kontaktperson ?? ''}`} actions={
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <KIFlyout label="✦ KI-Analyse" systemPrompt="Du analysierst einen Handwerker und gibst Empfehlungen." kontext={`Handwerker: ${h.firma}, Gewerk: ${h.gewerk}, Kontakt: ${h.kontaktperson ?? ''}, Tel: ${h.telefon ?? ''}, Email: ${h.email ?? ''}, Aktive Einsätze: ${activeCases.length}, Abgeschlossen: ${completedCases.length}`} schnellstarts={['Handwerker bewerten', 'Auftrag formulieren', 'E-Mail an Handwerker schreiben', 'Kosten analysieren']} />
          <button onClick={() => setView('handwerker')}>Zurück zur Liste</button>
          <button
            className="small"
            style={{ background: h.status === 'Inaktiv' ? '#16a34a' : '#f59e0b', color: '#fff', border: 'none' }}
            onClick={() => {
              const neuerStatus = h.status === 'Inaktiv' ? 'Aktiv' : 'Inaktiv';
              save('Handwerker', { ...h, status: neuerStatus, updatedAt: nowIso() });
            }}
          >
            {h.status === 'Inaktiv' ? '✓ Reaktivieren' : 'Inaktiv setzen'}
          </button>
          <button
            className="danger small"
            onClick={() => {
              if (!window.confirm(`Handwerker «${h.firma}» in den Papierkorb legen?`)) return;
              save('Handwerker', { ...h, firma: `[GELÖSCHT] ${h.firma}`, status: 'Gelöscht', updatedAt: nowIso() });
              setView('handwerker');
            }}
          >
            Löschen
          </button>
        </div>
      } />
      <div className="content-wrap">
        <div className="tabs sticky-tabs">
          {tabs.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === 'Auslastung' && (
          <>
            <div className="kpis compact">
              <Metric label="Auslastung" value={workloadLabel} tone={workloadTone} hint={`${activeCases.length} aktiv · ${upcomingTerms.length} Termine`} />
              <Metric label="Aktuelle Einsätze" value={activeCases.length} tone={activeCases.length ? 'blue' : 'green'} hint="offen oder in Bearbeitung" />
              <Metric label="Dringend/Hoch" value={urgentCases.length} tone={urgentCases.length ? 'red' : 'green'} hint="Priorität" />
              <Metric label="Abgeschlossen" value={completedCases.length} tone="green" hint="Verlauf" />
            </div>
            <div className="grid two">
              <Panel title="Wo ist er aktuell eingesetzt?">
                {activeCases.length === 0 && upcomingTerms.length === 0 ? <p className="hint">Aktuell keine offenen Einsätze oder kommenden Termine.</p> : (
                  <>
                    {activeCases.slice(0, 6).map(caseRow)}
                    {upcomingTerms.slice(0, 4).map(termRow)}
                  </>
                )}
              </Panel>
              <Panel title="Letzter Verlauf">
                {[...completedCases, ...pastTerms]
                  .sort((a: AnyRecord, b: AnyRecord) => String(b.updatedAt ?? b.start ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.start ?? a.createdAt ?? '')))
                  .slice(0, 8)
                  .map((item: AnyRecord) => item.titel && item.liegenschaftId && item.status ? caseRow(item) : termRow(item))}
                {completedCases.length === 0 && pastTerms.length === 0 && <p className="hint">Noch kein Verlauf vorhanden.</p>}
              </Panel>
            </div>
          </>
        )}

        {tab === 'Aktuell' && (
          <div className="grid two">
            <Panel title="Aktuelle Meldungen">
              {activeCases.length ? activeCases.map(caseRow) : <p className="hint">Keine aktiven Meldungen zugewiesen.</p>}
            </Panel>
            <Panel title="Kommende Termine">
              {upcomingTerms.length ? upcomingTerms.map(termRow) : <p className="hint">Keine kommenden Termine geplant.</p>}
            </Panel>
          </div>
        )}

        {tab === 'Verlauf' && (
          <div className="grid two">
            <Panel title="Abgeschlossene / archivierte Meldungen">
              {completedCases.length ? completedCases.map(caseRow) : <p className="hint">Noch keine abgeschlossenen Einsätze.</p>}
            </Panel>
            <Panel title="Vergangene Termine">
              {pastTerms.length ? pastTerms.map(termRow) : <p className="hint">Noch keine vergangenen Termine.</p>}
            </Panel>
          </div>
        )}

        {tab === 'Stammdaten' && <HandwerkerStammdatenForm h={h} save={save} />}
        {tab === 'Termine' && <Panel title="Alle Termine">{terms.length ? terms.map(termRow) : <p className="hint">Keine Termine vorhanden.</p>}</Panel>}
        {tab === 'Schlüssel' && <Panel title="Schlüssel / Quittungen">{keys.length ? keys.map((s:AnyRecord)=><div className="list-row" key={s.id}><div><strong>{s.bezeichnung} · {s.nummer}</strong><span>{propertyName(data,s.liegenschaftId)} · {s.ausgegebenAm ?? '—'}</span></div><Badge>{s.status}</Badge></div>) : <p className="hint">Keine Schlüssel oder Quittungen vorhanden.</p>}</Panel>}
        {tab === 'Dokumente' && <Panel title="Dokumente"><p className="hint">Handwerker-Dokumente können später hier abgelegt werden.</p></Panel>}
      </div>
    </div>
  );
}

type PermissionDef = [string, string];

const PERMISSION_GROUPS: { title: string; rights: PermissionDef[] }[] = [
  { title: 'Übersicht', rights: [['dashboard:lesen', 'Dashboard ansehen']] },
  { title: 'Liegenschaften', rights: [['liegenschaften:lesen', 'Liegenschaften ansehen'], ['liegenschaften:bearbeiten', 'Liegenschaften bearbeiten'], ['parteien:bearbeiten', 'Mieter/Eigentümer bearbeiten'], ['schluessel:bearbeiten', 'Schlüssel verwalten']] },
  { title: 'Meldungen', rights: [['meldungen:lesen', 'Meldungen ansehen'], ['meldungen:bearbeiten', 'Meldungen bearbeiten'], ['meldungen:loeschen', 'Meldungen löschen'], ['meldungen:pdf', 'Meldungen als PDF/Mail teilen']] },
  { title: 'Kalender & Handwerker', rights: [['kalender:lesen', 'Kalender ansehen'], ['kalender:bearbeiten', 'Termine bearbeiten'], ['handwerker:lesen', 'Handwerker ansehen'], ['handwerker:bearbeiten', 'Handwerker bearbeiten']] },
  { title: 'Dokumente & Abschlüsse', rights: [['dokumente:lesen', 'Dokumente ansehen'], ['dokumente:bearbeiten', 'Dokumente hochladen/bearbeiten'], ['abschluesse:lesen', 'Abschlüsse ansehen'], ['abschluesse:bearbeiten', 'Abschlüsse hochladen/bearbeiten']] },
  { title: 'Personal', rights: [['mitarbeiter:lesen', 'Mitarbeiter ansehen'], ['mitarbeiter:bearbeiten', 'Mitarbeiter bearbeiten'], ['lohn:lesen', 'Lohndaten ansehen'], ['lohn:bearbeiten', 'Lohndaten bearbeiten']] },
  { title: 'Administration', rights: [['rechte:lesen', 'Gruppen/Rechte ansehen'], ['rechte:vergeben', 'Gruppen/Rechte vergeben'], ['kundenansicht:oeffnen', 'Kundenansicht öffnen'], ['portal:lesen', 'Über Portal ansehen'], ['portal:bearbeiten', 'Über Portal bearbeiten'], ['suche:lesen', 'Globale Suche verwenden'], ['system:entwicklung', 'Developer-/Systemfunktionen']] },
] ;

const allPermissions = () => PERMISSION_GROUPS.flatMap((group) => group.rights);
// ── Papierkorb ────────────────────────────────────────────────────────────────

function Papierkorb({ data, save, remove }: {
  data: Record<string, AnyRecord[]>;
  save: (model: string, item: AnyRecord) => Promise<any>;
  remove: (model: string, id: string) => Promise<any>;
}) {
  const [filter, setFilter]           = useState('Alle');
  const [bestaetigung, setBestaetigung] = useState<{ model: string; id: string; name: string } | null>(null);
  const [laedt, setLaedt]             = useState<string | null>(null);

  const MODELLE: { key: string; label: string; nameField: string }[] = [
    { key: 'Handwerker',   label: 'Handwerker',      nameField: 'firma'  },
    { key: 'Liegenschaft', label: 'Liegenschaften',  nameField: 'name'   },
    { key: 'KontaktPerson',label: 'Kontaktpersonen', nameField: 'name'   },
    { key: 'Schadenfall',  label: 'Meldungen',       nameField: 'titel'  },
    { key: 'Mitarbeiter',  label: 'Mitarbeiter',     nameField: 'name'   },
    { key: 'Dokument',     label: 'Dokumente',       nameField: 'titel'  },
  ];

  const istGeloescht = (item: AnyRecord, field: string) =>
    String(item[field] ?? '').startsWith('[GELÖSCHT]') || item.status === 'Gelöscht';

  const alleItems: AnyRecord[] = MODELLE.flatMap(({ key, label, nameField }) =>
    (data[key] ?? [])
      .filter((item: AnyRecord) => istGeloescht(item, nameField))
      .map((item: AnyRecord) => ({ ...item, _model: key, _label: label, _nameField: nameField }))
  );

  const anzeigeItems = filter === 'Alle'
    ? alleItems
    : alleItems.filter(i => i._label === filter);

  const gruppenMitEintraegen = MODELLE.filter(m =>
    alleItems.some(i => i._label === m.label)
  );

  const DEFAULT_STATUS: Record<string, string> = {
    Handwerker: 'Aktiv', Liegenschaft: 'Aktiv', KontaktPerson: 'Aktiv',
    Schadenfall: 'OFFEN', Mitarbeiter: 'Aktiv', Dokument: 'Intern',
  };

  const wiederherstellen = async (item: AnyRecord) => {
    const nameField = item._nameField as string;
    const model     = item._model as string;
    setLaedt(item.id);
    const cleanName = String(item[nameField] ?? '').replace(/^\[GELÖSCHT\]\s*/, '');
    const update: AnyRecord = { ...item, [nameField]: cleanName, updatedAt: nowIso() };
    if (update.status === 'Gelöscht') update.status = DEFAULT_STATUS[model] ?? 'Aktiv';
    if (model === 'KontaktPerson') update.kontoStatus = 'Eingeladen';
    delete update._model; delete update._label; delete update._nameField;
    await save(model, update);
    setLaedt(null);
  };

  const endgueltigLoeschen = async () => {
    if (!bestaetigung) return;
    setLaedt(bestaetigung.id);
    await remove(bestaetigung.model, bestaetigung.id);
    setBestaetigung(null);
    setLaedt(null);
  };

  return (
    <div>
      <Title
        title="Papierkorb"
        sub={alleItems.length ? `${alleItems.length} gelöschte Einträge · Wiederherstellen oder endgültig löschen` : 'Papierkorb ist leer'}
        actions={alleItems.length > 0 ? (
          <button className="danger small" onClick={() => {
            if (!window.confirm(`Alle ${alleItems.length} Einträge endgültig löschen?\nDies kann nicht rückgängig gemacht werden.`)) return;
            Promise.all(alleItems.map(i => remove(i._model, i.id)));
          }}>
            Papierkorb leeren ({alleItems.length})
          </button>
        ) : undefined}
      />

      {alleItems.length === 0 ? (
        <Panel title="">
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Papierkorb ist leer</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Gelöschte Objekte erscheinen hier und können wiederhergestellt werden.</div>
          </div>
        </Panel>
      ) : (
        <>
          {/* Filter-Tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['Alle', ...gruppenMitEintraegen.map(m => m.label)].map(f => {
              const count = f === 'Alle' ? alleItems.length : alleItems.filter(i => i._label === f).length;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? '#1e293b' : '#f1f5f9',
                  color: filter === f ? '#fff' : '#374151',
                  border: 'none', borderRadius: 8, padding: '6px 14px',
                  cursor: 'pointer', fontSize: 13, fontWeight: filter === f ? 700 : 400,
                }}>
                  {f} <span style={{ opacity: .7 }}>({count})</span>
                </button>
              );
            })}
          </div>

          <Panel title={filter === 'Alle' ? 'Alle gelöschten Einträge' : filter}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {anzeigeItems.map(item => {
                const nameField = item._nameField as string;
                const cleanName = String(item[nameField] ?? '').replace(/^\[GELÖSCHT\]\s*/, '');
                const isLoading = laedt === item.id;
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #fee2e2', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
                    <Badge tone="red">{item._label}</Badge>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{cleanName}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {item.updatedAt ? `Gelöscht: ${deDate(item.updatedAt)}` : ''}
                        {item.gewerk ? ` · ${item.gewerk}` : ''}
                        {item.adresse ? ` · ${item.adresse}` : ''}
                        {item.liegenschaftAdresse ? ` · ${item.liegenschaftAdresse}` : ''}
                        {item.kategorie ? ` · ${item.kategorie}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => wiederherstellen(item)}
                        disabled={isLoading}
                        style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: isLoading ? .6 : 1 }}
                      >
                        {isLoading ? '…' : '↩ Wiederherstellen'}
                      </button>
                      <button
                        onClick={() => setBestaetigung({ model: item._model, id: item.id, name: cleanName })}
                        disabled={isLoading}
                        style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        🗑 Endgültig
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}

      {/* Bestätigungs-Modal */}
      {bestaetigung && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 25px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#dc2626' }}>⚠️ Endgültig löschen</div>
            <p style={{ margin: 0, color: '#374151', fontSize: 14, lineHeight: 1.6 }}>
              «<strong>{bestaetigung.name}</strong>» wird permanent aus der Datenbank entfernt.<br />
              Diese Aktion kann <strong>nicht rückgängig</strong> gemacht werden.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={endgueltigLoeschen}
                disabled={!!laedt}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flex: 1 }}
              >
                {laedt ? '…' : 'Ja, endgültig löschen'}
              </button>
              <button
                onClick={() => setBestaetigung(null)}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STAFF_NAV: [View, string, string][] = [
  ['dashboard', 'Dashboard', 'grid-2x2'],
  ['liegenschaften', 'Liegenschaften', 'building-2'],
  ['faelle', 'Meldungen', 'alert-triangle'],
  ['kiAssistent', '✦ KI-Assistent', 'grid-2x2'],
  ['kalender', 'Kalender', 'calendar-days'],
  ['handwerker', 'Handwerker', 'wrench'],
  ['formulare', 'Formulare', 'file-text'],
  ['inserate', 'Inserate', 'building-2'],
  ['statistiken', 'Statistiken', 'grid-2x2'],
  ['internChat', 'Interner Chat', 'message-square'],
  ['externChat', 'Externer Chat', 'smartphone'],
  ['urlaubskalender', 'Urlaubskalender', 'calendar-days'],
  ['mitarbeiter', 'Mitarbeiter & Rechte', 'users'],
  ['portal', 'Über Portal / App', 'smartphone'],
  ['suche', 'Globale Suche', 'search'],
  ['papierkorb', 'Papierkorb', 'trash-2'],
];

const VIEW_RIGHTS: Record<View, string[]> = {
  dashboard: ['dashboard:lesen'],
  liegenschaften: ['liegenschaften:lesen'],
  liegenschaftDetail: ['liegenschaften:lesen'],
  personDetail: ['liegenschaften:lesen', 'parteien:bearbeiten'],
  faelle: ['meldungen:lesen'],
  fallDetail: ['meldungen:lesen'],
  kalender: ['kalender:lesen'],
  handwerker: ['handwerker:lesen'],
  handwerkerDetail: ['handwerker:lesen'],
  formulare: ['dokumente:lesen'],
  inserate: ['liegenschaften:lesen'],
  statistiken: ['dashboard:lesen'],
  internChat: ['dashboard:lesen'],
  externChat: ['externchat:lesen', 'meldungen:lesen'],
  urlaubskalender: ['dashboard:lesen'],
  mitarbeiter: ['mitarbeiter:lesen', 'rechte:lesen'],
  myProfile: ['dashboard:lesen'],
  suche: ['suche:lesen'],
  portal: ['portal:lesen'],
  customerPicker: ['kundenansicht:oeffnen'],
  kiAssistent: ['dashboard:lesen'],
  papierkorb: ['dashboard:lesen'],
};

const rolesForData = (data: Record<string, AnyRecord[]>) => data.Rolle?.length ? data.Rolle : seed.Rolle;
const ADMIN_EMAILS = ['admin@example.invalid'];
const isAdminEmployee = (employee?: AnyRecord) => ADMIN_EMAILS.includes(String(employee?.email ?? '').toLowerCase());
const roleForEmployee = (data: Record<string, AnyRecord[]>, employee?: AnyRecord) => {
  const roles = rolesForData(data);
  if (!employee) return roles[0];
  return roles.find((r) => r.name === employee.gruppe) ?? roles[0];
};
const effectiveRightsFor = (data: Record<string, AnyRecord[]>, employee: AnyRecord) => {
  if (!employee) return [];
  if (isAdminEmployee(employee)) return ['*'];
  const groupRights = roleForEmployee(data, employee)?.rechte ?? [];
  const extra = employee.rechteExtra ?? [];
  const denied = new Set(employee.rechteEntzogen ?? []);
  if (groupRights.includes('*') || extra.includes('*')) return ['*'];
  return Array.from(new Set([...groupRights, ...extra])).filter((right) => !denied.has(right));
};
const hasRight = (rights: string[], right: string) => rights.includes('*') || rights.includes(right);
const canAccessView = (view: View, rights: string[]) => VIEW_RIGHTS[view]?.some((right) => hasRight(rights, right)) ?? false;

function AccessDenied() {
  return (
    <Panel title="Kein Zugriff">
      <p className="hint">Für diesen Bereich fehlt die passende Berechtigung. Der Menüpunkt wird für Rollen ohne Zugriff ausgeblendet.</p>
    </Panel>
  );
}

function EmployeePhotoUploader({ employee, save, approvalOnly = false }: any) {
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File | null) => {
    if (!employee?.id || !file) return;
    try {
      setUploading(true);
      setStatus('Profilbild wird hochgeladen ...');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `profile-images/${employee.id}/${Date.now()}-${safeName}`;
      await uploadData({ path, data: file }).result;
      const urlResult = await getUrl({ path });
      const photoUrl = urlResult.url.toString();

      if (approvalOnly) {
        await save('StammdatenAenderung', {
          id: `chg-${uid()}`,
          mitarbeiterId: employee.id,
          feld: 'photoUrl',
          alterWert: employee.photoUrl ?? '',
          neuerWert: photoUrl,
          status: 'Offen',
          eingereichtVon: employee.name,
          notiz: `Profilbild zur Freigabe hochgeladen: ${file.name}`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        setStatus('Profilbild wurde als Freigabe-Antrag eingereicht.');
      } else {
        await save('Mitarbeiter', { ...employee, photoUrl, updatedAt: nowIso() });
        setStatus('Profilbild gespeichert.');
      }
    } catch (error) {
      console.warn(error);
      setStatus('Profilbild konnte nicht gespeichert werden.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="photo-upload">
      <Avatar name={employee?.name ?? 'Mitarbeiter'} url={employee?.photoUrl} />
      <div>
        <strong>Profilbild</strong>
        <span>{approvalOnly ? 'Änderungen werden HR/Admin zur Freigabe vorgelegt.' : 'Wird in Portal und App angezeigt.'}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)} />
        {status && <p>{status}</p>}
      </div>
    </div>
  );
}

function EmployeeDocumentList({ docs }: { docs: AnyRecord[] }) {
  const sortedDocs = docs.slice().sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));

  if (!sortedDocs.length) {
    return <p className="hint">Für diesen Mitarbeiter sind noch keine Dokumente hinterlegt.</p>;
  }

  return (
    <div className="document-list">
      {sortedDocs.map((doc) => (
        <div className="document-row" key={doc.id}>
          <div>
            <strong>{doc.titel}</strong>
            <span>{doc.kategorie || 'Dokument'} · {doc.jahr || 'ohne Jahr'} · {doc.dateiname || 'keine Datei'}</span>
          </div>
          <div>
            {doc.vertraulich && <Badge>Vertraulich</Badge>}
            {doc.dateiUrl && <DocOpenButton url={doc.dateiUrl} titel={doc.titel} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function ZeiterfassungTabView({ eintraege }: { eintraege: AnyRecord[] }) {
  const [monatOffset, setMonatOffset] = useState(0);

  const now = new Date();
  const monatDate = new Date(now.getFullYear(), now.getMonth() + monatOffset, 1);
  const monatStart = monatDate;
  const monatEnd = new Date(monatDate.getFullYear(), monatDate.getMonth() + 1, 0, 23, 59, 59);
  const monatName = monatDate.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
  const istAktuellerMonat = monatOffset === 0;

  const calcH = (e: AnyRecord) => {
    const s = e.startZeit ? new Date(e.startZeit) : null;
    const en = e.endZeit ? new Date(e.endZeit) : null;
    return s && en ? Math.max(0, (en.getTime() - s.getTime()) / 3600000 - (e.pauseMinuten || 0) / 60) : 0;
  };

  const getISOWeek = (d: Date) => {
    const tmp = new Date(d); tmp.setHours(0,0,0,0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const w1 = new Date(tmp.getFullYear(), 0, 4);
    return 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  };

  const monatEintraege = eintraege
    .filter(e => { if (!e.startZeit) return false; const d = new Date(e.startZeit); return d >= monatStart && d <= monatEnd; })
    .sort((a, b) => String(b.startZeit).localeCompare(String(a.startZeit)));

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const stundenWoche = eintraege
    .filter(e => e.startZeit && new Date(e.startZeit) >= startOfWeek && !e.istUrlaub && !e.istKrank)
    .reduce((acc: number, e: AnyRecord) => acc + calcH(e), 0);
  const stundenMonat = monatEintraege
    .filter((e: AnyRecord) => !e.istUrlaub && !e.istKrank && !e.istUeberzeitabbau)
    .reduce((acc: number, e: AnyRecord) => acc + calcH(e), 0);
  const arbeitstage = new Set(
    monatEintraege.filter((e: AnyRecord) => !e.istUrlaub && !e.istKrank && e.startZeit).map((e: AnyRecord) => new Date(e.startZeit).toDateString())
  ).size;
  const festgeschrieben = monatEintraege.filter((e: AnyRecord) => e.istGesperrt).length;
  const offen = monatEintraege.filter((e: AnyRecord) => !e.istGesperrt).length;

  const weekGroups: Record<string, AnyRecord[]> = {};
  for (const e of monatEintraege) {
    if (!e.startZeit) continue;
    const d = new Date(e.startZeit);
    const kw = `${d.getFullYear()}-${String(getISOWeek(d)).padStart(2, '0')}`;
    if (!weekGroups[kw]) weekGroups[kw] = [];
    weekGroups[kw].push(e);
  }

  const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const TYP_CFG: Record<string, { label: string; tone: string }> = {
    Urlaub: { label: 'Urlaub', tone: 'orange' },
    Krank: { label: 'Krank', tone: 'red' },
    ÜZA: { label: 'ÜZA', tone: 'orange' },
    Arbeit: { label: 'Arbeit', tone: 'green' },
  };

  const navBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1,
  };

  if (eintraege.length === 0) {
    return (
      <section className="detail" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏱</div>
        <h3 style={{ margin: '0 0 8px', color: '#111827' }}>Noch keine Einträge</h3>
        <p style={{ color: '#6b7280', margin: 0 }}>Verbinde die Zeiterfassung-App unter <strong>Einstellungen → IMMOBILIENTOOL Server</strong>.</p>
      </section>
    );
  }

  return (
    <section className="detail">
      {/* Monatsnavigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Arbeitszeiten</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={navBtn} onClick={() => setMonatOffset(o => o - 1)}>‹</button>
          <span style={{ minWidth: 148, textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#111827' }}>{monatName}</span>
          <button style={{ ...navBtn, opacity: istAktuellerMonat ? 0.35 : 1, cursor: istAktuellerMonat ? 'not-allowed' : 'pointer' }} onClick={() => setMonatOffset(o => Math.min(0, o + 1))} disabled={istAktuellerMonat}>›</button>
        </div>
      </div>

      {/* Statistik-Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 10, marginBottom: 24 }}>
        {istAktuellerMonat && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Diese Woche</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', lineHeight: 1 }}>{stundenWoche.toFixed(2)}<span style={{ fontSize: 13, fontWeight: 500 }}> h</span></div>
          </div>
        )}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Arbeitsstunden</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8', lineHeight: 1 }}>{stundenMonat.toFixed(2)}<span style={{ fontSize: 13, fontWeight: 500 }}> h</span></div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Arbeitstage</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{arbeitstage}</div>
        </div>
        <div style={{ background: festgeschrieben === monatEintraege.length && monatEintraege.length > 0 ? '#f0fdf4' : '#fafafa', border: `1px solid ${festgeschrieben === monatEintraege.length && monatEintraege.length > 0 ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: festgeschrieben > 0 ? '#166534' : '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Festgeschrieben</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: festgeschrieben > 0 ? '#15803d' : '#9ca3af', lineHeight: 1 }}>
            {festgeschrieben}<span style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af' }}> / {monatEintraege.length}</span>
          </div>
        </div>
        {offen > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Noch offen</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{offen}</div>
          </div>
        )}
      </div>

      {/* Einträge gruppiert nach Woche */}
      {monatEintraege.length === 0 ? (
        <p className="hint" style={{ textAlign: 'center', padding: '32px 0' }}>Keine Einträge für {monatName}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(weekGroups).map(([kw, entries]) => {
            const kwNum = kw.split('-')[1];
            const weekH = entries.filter((e: AnyRecord) => !e.istUrlaub && !e.istKrank && !e.istUeberzeitabbau).reduce((acc: number, e: AnyRecord) => acc + calcH(e), 0);
            const allLocked = entries.every((e: AnyRecord) => e.istGesperrt);
            const someLocked = !allLocked && entries.some((e: AnyRecord) => e.istGesperrt);
            return (
              <div key={kw} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                {/* Wochen-Header */}
                <div style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>KW {kwNum}</span>
                    {allLocked && <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>🔒 Vollständig festgeschrieben</span>}
                    {someLocked && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Teilweise festgeschrieben</span>}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#1d4ed8' }}>{weekH.toFixed(2)} h</span>
                </div>
                {/* Tages-Zeilen */}
                {[...entries].reverse().map((e: AnyRecord, idx: number) => {
                  const start = e.startZeit ? new Date(e.startZeit) : null;
                  const end = e.endZeit ? new Date(e.endZeit) : null;
                  const h = calcH(e);
                  const typ = e.istUrlaub ? 'Urlaub' : e.istKrank ? 'Krank' : e.istUeberzeitabbau ? 'ÜZA' : 'Arbeit';
                  const cfg = TYP_CFG[typ];
                  const wt = start ? WOCHENTAGE[start.getDay()] : '';
                  const isLast = idx === entries.length - 1;
                  return (
                    <div key={e.id} style={{
                      display: 'grid', gridTemplateColumns: '100px 160px 70px 80px 90px 150px',
                      gap: 8, alignItems: 'center', padding: '10px 14px',
                      borderBottom: isLast ? 'none' : '1px solid #f3f4f6', fontSize: 14,
                      background: e.istGesperrt ? '#fafffe' : '#fff',
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#374151', marginRight: 5 }}>{wt}</span>
                        <span style={{ color: '#6b7280', fontSize: 13 }}>{start ? start.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }) : '—'}</span>
                      </div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                        {start ? start.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        <span style={{ color: '#9ca3af', margin: '0 5px' }}>→</span>
                        {end ? end.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>Läuft…</span>}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 13 }}>{e.pauseMinuten ? `${e.pauseMinuten} min` : '—'}</div>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{end ? `${h.toFixed(2)} h` : '—'}</div>
                      <div><Badge tone={cfg.tone}>{cfg.label}</Badge></div>
                      <div>
                        {e.istGesperrt
                          ? <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', whiteSpace: 'nowrap' }}>Festgeschrieben</span>
                          : <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fff7ed', color: '#c2410c', whiteSpace: 'nowrap' }}>Nicht festgeschrieben</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MyEmployeeProfile({ data, employee, save }: any) {
  const [tab, setTab] = useState<'Profil' | 'Dokumente' | 'Änderungen' | 'Zeiterfassung'>('Profil');
  const [draft, setDraft] = useState<AnyRecord>(employee ?? {});
  const [message, setMessage] = useState('');
  const fields = ['name', 'email', 'telefon', 'funktion', 'adresse', 'kinder'];
  const docs = data.MitarbeiterDokument.filter((doc: AnyRecord) => doc.mitarbeiterId === employee?.id);
  const changes = data.StammdatenAenderung.filter((change: AnyRecord) => change.mitarbeiterId === employee?.id);
  const zeitEintraege: AnyRecord[] = (data.ZeiterfassungEintrag ?? []).filter((e: AnyRecord) =>
    e.mitarbeiterId === employee?.id || (employee?.email && String(e.email ?? '').toLowerCase() === String(employee.email).toLowerCase())
  );

  useEffect(() => {
    setDraft(employee ?? {});
  }, [employee?.id]);

  if (!employee) {
    return <Panel title="Mein Profil"><p className="hint">Kein Mitarbeiterprofil gefunden.</p></Panel>;
  }

  const submitChanges = async () => {
    const changed = fields.filter((field) => String(draft[field] ?? '') !== String(employee[field] ?? ''));
    if (!changed.length) {
      setMessage('Keine Änderung erkannt.');
      return;
    }

    setMessage('Änderungen werden eingereicht ...');
    for (const field of changed) {
      await save('StammdatenAenderung', {
        id: `chg-${uid()}`,
        mitarbeiterId: employee.id,
        feld: field,
        alterWert: employee[field] ?? '',
        neuerWert: draft[field] ?? '',
        status: 'Offen',
        eingereichtVon: employee.name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    setMessage('Änderungen eingereicht. HR/Admin prüft diese vor Übernahme.');
  };

  return (
    <div>
      <Title title="Mein Profil" sub="Eigene Daten, Freigaben und Mitarbeiterdokumente." />
      <div className="content-wrap profile-page">
        <section className="detail profile-hero">
          <Avatar name={employee.name} url={employee.photoUrl} />
          <div>
            <h2>{employee.name}</h2>
            <p>{employee.funktion} · {employee.gruppe}</p>
            <Badge tone="green">Aktive Mitarbeiteransicht</Badge>
          </div>
        </section>
        <div className="tabs">{(['Profil', 'Dokumente', 'Änderungen', 'Zeiterfassung'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
        {tab === 'Profil' && (
          <section className="detail">
            <EmployeePhotoUploader employee={employee} save={save} approvalOnly />
            {message && <p className="hint">{message}</p>}
            <div className="form-grid profile-form">
              {fields.map((field) => (
                <label key={field}>
                  {labelFor(field)}
                  <input value={draft[field] ?? ''} type={typeof employee[field] === 'number' ? 'number' : 'text'} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
                </label>
              ))}
              <button className="primary" onClick={submitChanges}>Änderungen zur Freigabe einreichen</button>
            </div>
          </section>
        )}
        {tab === 'Dokumente' && (
          <section className="detail">
            <h2>Meine Unterlagen</h2>
            <EmployeeDocumentList docs={docs} />
          </section>
        )}
        {tab === 'Änderungen' && (
          <section className="detail">
            <h2>Meine Freigabe-Anträge</h2>
            {changes.length === 0 ? <p className="hint">Keine offenen oder vergangenen Änderungsanträge vorhanden.</p> : (
              <div className="document-list">
                {changes.slice().sort((a: AnyRecord, b: AnyRecord) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))).map((change: AnyRecord) => (
                  <div className="document-row" key={change.id}>
                    <div>
                      <strong>{labelFor(change.feld)}</strong>
                      <span>{String(change.alterWert || '-')} {'->'} {String(change.neuerWert || '-')}</span>
                    </div>
                    <Badge tone={change.status === 'Offen' ? 'orange' : change.status === 'Genehmigt' ? 'green' : ''}>{change.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === 'Zeiterfassung' && (
          <>
            <div style={{ margin: '0 0 12px', padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔒 <span>Diese Daten sind <strong>nur für dich sichtbar</strong> — kein Arbeitskollege kann deine Zeiteinträge einsehen.</span>
            </div>
            <ZeiterfassungTabView eintraege={zeitEintraege} />
          </>
        )}
      </div>
    </div>
  );
}

function MitarbeiterStammdatenForm({ emp, save }: any) {
  const [draft, setDraft] = useState<AnyRecord>({ ...emp });
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft({ ...emp }); setSaved(false); }, [emp?.id]);

  const set = (field: string, value: any) => setDraft((d: AnyRecord) => ({ ...d, [field]: value }));

  const onSave = async () => {
    await save('Mitarbeiter', { ...draft, updatedAt: nowIso() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const SelectField = ({ label, field, options }: { label: string; field: string; options: string[] }) => (
    <label>
      {label}
      <select value={draft[field] ?? ''} onChange={e => set(field, e.target.value)}>
        <option value="">— wählen —</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </label>
  );

  const InputField = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <label>
      {label}
      <input type={type} value={draft[field] ?? ''} onChange={e => set(field, e.target.value)} placeholder={placeholder} />
    </label>
  );

  return (
    <Panel title="Stammdaten bearbeiten">
      <div className="form-grid">
        <InputField label="Name *" field="name" />
        <SelectField label="Funktion *" field="funktion" options={EMPLOYEE_FUNCTION_OPTIONS} />
        <InputField label="E-Mail" field="email" type="email" placeholder="name@example.invalid" />
        <InputField label="Telefon" field="telefon" placeholder="+41 00 000 00 00" />
        <SelectField label="Gruppe / Abteilung" field="gruppe" options={EMPLOYEE_GRUPPE_OPTIONS} />
        <label>Rolle im System
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={draft.rolle ?? ''} onChange={e => set('rolle', e.target.value)} style={{ flex: 1 }}>
              <option value="">— wählen —</option>
              <option>Geschäftsführer / in</option>
              <option>Admin / Developer</option>
              <option>Mitarbeiter</option>
              <option>Praktikant</option>
            </select>
          </div>
        </label>
        <SelectField label="Status" field="status" options={EMPLOYEE_STATUS_OPTIONS} />
        <InputField label="Adresse" field="adresse" placeholder="Strasse, PLZ Ort" />
        <label>In «Unser Team» anzeigen
          <select value={String(draft.teamSichtbar ?? true)} onChange={e => set('teamSichtbar', e.target.value === 'true')}>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        </label>
        <InputField label="Team-Sortierung" field="teamSortierung" type="number" />
        <InputField label="Kinder" field="kinder" type="number" placeholder="0" />
        <label>Eintrittsdatum
          <input type="date" value={draft.eintrittsdatum ?? ''} onChange={e => set('eintrittsdatum', e.target.value || null)} />
        </label>
        <label>Urlaubskontingent (Tage/Jahr)
          <input type="number" min="0" max="365" value={draft.urlaubsKontingent ?? 25} onChange={e => set('urlaubsKontingent', parseInt(e.target.value) || 25)} />
        </label>
        {draft.eintrittsdatum && (() => {
          const j = new Date().getFullYear();
          const r = berechneUrlaubsanspruch(draft.eintrittsdatum, draft.urlaubsKontingent ?? 25, j);
          return r.istGekuerzt ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#78350f' }}>
                Urlaubsanspruch {j}: <strong>{r.anspruch} Tage</strong> <span style={{ color: '#92400e' }}>({r.info})</span>
              </p>
            </div>
          ) : null;
        })()}
      </div>
      {saved && <p style={{ color: '#166534', fontWeight: 700, marginTop: 10 }}>✓ Gespeichert.</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="primary" onClick={onSave}>Speichern</button>
      </div>
    </Panel>
  );
}

function MitarbeiterCard({ m, isSelected, isActing, onSelect, onAnsicht, onArchivieren }: any) {
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenuPos(null);

  React.useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    window.addEventListener('click', close);
    window.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    return () => window.removeEventListener('click', close);
  }, [menuPos]);

  const MENU_ITEMS = [
    { label: '👤 Öffnen / Ansicht', action: () => { onSelect(); closeMenu(); } },
    { label: '🎭 Als Mitarbeiter ansehen', action: () => { onAnsicht(); closeMenu(); }, disabled: isActing },
    { label: '📋 Kopieren (Name)', action: () => { navigator.clipboard.writeText(m.name); closeMenu(); } },
    { label: '✉️ E-Mail kopieren', action: () => { if (m.email) navigator.clipboard.writeText(m.email); closeMenu(); }, disabled: !m.email },
    { label: '📞 Telefon kopieren', action: () => { if (m.telefon) navigator.clipboard.writeText(m.telefon); closeMenu(); }, disabled: !m.telefon },
    null, // divider
    { label: m.status === 'Inaktiv' ? '✓ Reaktivieren' : '⏸ Deaktivieren', action: () => { onArchivieren(); closeMenu(); }, danger: m.status === 'Aktiv' },
  ];

  return (
    <>
      <button
        className={`emp-row ${isSelected ? 'active' : ''} ${isActing ? 'acting' : ''}`}
        onClick={onSelect}
        onContextMenu={openMenu}
        title="Rechtsklick für Optionen"
      >
        <Avatar name={m.name} url={m.photoUrl} />
        <div className="emp-row-info">
          <strong>{m.name}</strong>
          <span>{m.funktion}{m.gruppe ? ` · ${m.gruppe}` : ''}</span>
        </div>
        <Badge tone={m.status === 'Aktiv' ? 'green' : 'orange'}>{m.status || 'Aktiv'}</Badge>
      </button>

      {menuPos && (
        <div
          className="mitarbeiter-context-menu"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={e => e.stopPropagation()}
        >
          <div className="ctx-header">{m.name}</div>
          {MENU_ITEMS.map((item, i) =>
            item === null
              ? <div key={i} className="ctx-divider" />
              : (
                <button
                  key={i}
                  className={`ctx-item ${item.danger ? 'ctx-danger' : ''} ${item.disabled ? 'ctx-disabled' : ''}`}
                  onClick={() => !item.disabled && item.action()}
                  disabled={!!item.disabled}
                >
                  {item.label}
                </button>
              )
          )}
        </div>
      )}
    </>
  );
}

function Employees({ data, rights, selectedEmployeeId, setSelectedEmployeeId, ownEmployeeId, actingEmployeeId, setActingEmployeeId, save, setMode }: any) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<EmployeeTab>('Übersicht');
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const employeeData = data.Mitarbeiter ?? [];
  const rightsData = { ...data, Rolle: rolesForData(data) };
  const emp = employeeData.find((m: AnyRecord) => m.id === selectedEmployeeId) ?? employeeData[0];
  const ownEmployee = employeeData.find((m: AnyRecord) => m.id === ownEmployeeId);
  const list = employeeData.filter((m: AnyRecord) => JSON.stringify(m).toLowerCase().includes(q.toLowerCase()));
  const effective = effectiveRightsFor(data, emp);
  const tabs: EmployeeTab[] = [
    'Übersicht',
    ...(hasRight(rights, 'mitarbeiter:lesen') ? ['Stammdaten', 'Dokumente', 'Historie'] as EmployeeTab[] : []),
    ...(hasRight(rights, 'lohn:lesen') ? ['Lohn'] as EmployeeTab[] : []),
    ...(hasRight(rights, 'rechte:lesen') ? ['Rollen & Rechte'] as EmployeeTab[] : []),
  ];

  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] ?? 'Übersicht');
  }, [tab, tabs.join('|')]);

  if (!emp) {
    return (
      <div>
        <Title title="Mitarbeiter & Rechte" sub="Personalakten, Gruppen, Einzelrechte und Lohndokumente." actions={<button className="primary small" onClick={() => setShowNewEmployee(true)}>Mitarbeiter hinzufügen</button>} />
        <Panel title="Noch keine Mitarbeiter">
          <p className="hint">Es sind noch keine Mitarbeiter in AWS gespeichert. Du kannst direkt den ersten Mitarbeiter erfassen und einer Gruppe zuweisen.</p>
          <button className="primary" onClick={() => setShowNewEmployee(true)}>Mitarbeiter hinzufügen</button>
        </Panel>
        {showNewEmployee && (
          <Modal title="Mitarbeiter erfassen" onClose={() => setShowNewEmployee(false)}>
            <EmployeeEditor
              data={rightsData}
              save={save}
              onClose={() => setShowNewEmployee(false)}
              onCreated={(id: string) => {
                setSelectedEmployeeId(id);
                setTab('Rollen & Rechte');
              }}
            />
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div>
      <Title title="Mitarbeiter & Rechte" sub="Personalakten, Gruppen, Einzelrechte und Lohndokumente." actions={<button className="primary small" onClick={() => setShowNewEmployee(true)}>+ Mitarbeiter</button>} />
      <div className="emp-page-layout">

        {/* ── Sidebar: Mitarbeiterliste ── */}
        <aside className="emp-sidebar">
          <div className="emp-sidebar-search">
            <input className="search" placeholder="Suchen …" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="emp-sidebar-list">
            {list.map((m: AnyRecord) => (
              <MitarbeiterCard
                key={m.id}
                m={m}
                isSelected={m.id === emp.id}
                isActing={m.id === actingEmployeeId}
                onSelect={() => setSelectedEmployeeId(m.id)}
                onAnsicht={() => { setActingEmployeeId(m.id); setMode('staff'); }}
                onArchivieren={() => save('Mitarbeiter', { ...m, status: 'Inaktiv', updatedAt: nowIso() })}
              />
            ))}
          </div>
          <button className="emp-sidebar-add" onClick={() => setShowNewEmployee(true)}>+ Mitarbeiter hinzufügen</button>
        </aside>

        {/* ── Detail-Bereich ── */}
        <div className="emp-detail">

          {/* Header */}
          <div className="emp-detail-header">
            <Avatar name={emp.name} url={emp.photoUrl} />
            <div className="emp-detail-header-info">
              <h2>{emp.name}</h2>
              <p>{emp.funktion}{emp.gruppe ? ` · ${emp.gruppe}` : ''}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <Badge tone={effective.includes('*') ? 'green' : ''}>{effective.includes('*') ? 'Vollzugriff' : `${effective.length} Rechte`}</Badge>
                <Badge tone={emp.status === 'Aktiv' ? 'green' : 'orange'}>{emp.status ?? 'Aktiv'}</Badge>
              </div>
            </div>
            <div className="emp-detail-header-actions">
              {emp.id !== actingEmployeeId
                ? <button className="small" onClick={() => { setActingEmployeeId(emp.id); setMode('staff'); }}>Als {emp.name.split(' ')[0]} anzeigen</button>
                : <button className="small" disabled>Aktive Ansicht</button>}
              {ownEmployee && actingEmployeeId !== ownEmployee.id && (
                <button className="small return-self" onClick={() => { setActingEmployeeId(ownEmployee.id); setSelectedEmployeeId(ownEmployee.id); }}>Zurück zu mir</button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">{tabs.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

          {/* Tab-Inhalte */}
          <div className="emp-tab-body">
            {tab === 'Übersicht' && (
              <div className="grid two" style={{ padding: 0 }}>
                <Panel title="Kontakt & Rolle">
                  <div className="info-grid">
                    <Info label="E-Mail" value={emp.email} />
                    <Info label="Telefon" value={emp.telefon} />
                    <Info label="Funktion" value={emp.funktion} />
                    <Info label="Gruppe" value={emp.gruppe} />
                  </div>
                  {emp.email && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0eee8' }}>
                      <ResetPasswordButton email={emp.email} name={emp.name} zielTyp="Mitarbeiter" zielId={emp.id} rolle={emp.gruppe ?? emp.rolle} />
                    </div>
                  )}
                </Panel>
                <Panel title="Personal & Urlaub">
                  <div className="info-grid">
                    <Info label="Eintrittsdatum" value={emp.eintrittsdatum ? new Date(emp.eintrittsdatum).toLocaleDateString('de-CH') : '—'} />
                    <Info label="Kontingent" value={`${emp.urlaubsKontingent ?? 25} Tage / Jahr`} />
                    <Info label="Effektive Rechte" value={effective.includes('*') ? 'Alle' : `${effective.length}`} />
                    <Info label="Team sichtbar" value={emp.teamSichtbar ? 'Ja' : 'Nein'} />
                    {(() => { const j = new Date().getFullYear(); const r = berechneUrlaubsanspruch(emp.eintrittsdatum, emp.urlaubsKontingent ?? 25, j); return r.istGekuerzt ? <Info label={`Anspruch ${j}`} value={`${r.anspruch} Tage · ${r.info}`} /> : null; })()}
                  </div>
                </Panel>
              </div>
            )}
            {tab === 'Stammdaten' && (
              <div className="stack">
                <EmployeePhotoUploader employee={emp} save={save} />
                <MitarbeiterStammdatenForm emp={emp} save={save} />
                <InviteBox data={rightsData} save={save} />
              </div>
            )}
            {tab === 'Dokumente' && <Documents data={data} employeeId={emp.id} save={save} employee />}
            {tab === 'Lohn' && <Panel title="Lohnunterlagen"><EditFields item={emp} fields={['jahreslohn', 'kinder']} onSave={(x) => save('Mitarbeiter', x)} /><Documents data={data} employeeId={emp.id} save={save} employee /></Panel>}
            {tab === 'Rollen & Rechte' && <RolesAndPermissions data={rightsData} employee={emp} save={save} />}
            {tab === 'Historie' && <Timeline items={data.MitarbeiterDokument.filter((d: AnyRecord) => d.mitarbeiterId === emp.id)} />}
          </div>
        </div>
      </div>
      {showNewEmployee && (
        <Modal title="Mitarbeiter erfassen" onClose={() => setShowNewEmployee(false)}>
          <EmployeeEditor
            data={rightsData}
            save={save}
            onClose={() => setShowNewEmployee(false)}
            onCreated={(id: string) => {
              setSelectedEmployeeId(id);
              setTab('Rollen & Rechte');
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function EmployeeEditor({ data, save, onClose, onCreated }: any) {
  const roles = rolesForData(data);
  const firstRole = roles[0]?.name ?? 'Mitarbeiter';
  const systemRoleOptions = Array.from(new Set([
    ...roles.map((role: AnyRecord) => role.name).filter(Boolean),
    'Geschäftsführer',
    'Admin / Developer',
    'Developer',
    'Buchhaltung',
    'Bewirtschafter',
    'HR',
    'Support',
  ]));
  const [draft, setDraft] = useState<AnyRecord>({
    name: '',
    funktion: '',
    email: '',
    telefon: '',
    rolle: firstRole,
    gruppe: firstRole,
    status: 'Einladung ausstehend',
    teamSichtbar: true,
    teamSortierung: 100,
    rechteExtra: [],
    rechteEntzogen: [],
  });
  const [sendLogin, setSendLogin] = useState(true);
  const [message, setMessage] = useState('');

  const validate = () => {
    if (!draft.name?.trim()) return 'Name ist ein Pflichtfeld.';
    if (!draft.funktion?.trim()) return 'Funktion ist ein Pflichtfeld.';
    if (!draft.email?.trim()) return 'E-Mail ist ein Pflichtfeld.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return 'Bitte eine gültige E-Mail eingeben.';
    if (!draft.gruppe?.trim()) return 'Gruppe ist ein Pflichtfeld.';
    return '';
  };

  const createEmployee = async () => {
    const error = validate();
    if (error) {
      setMessage(error);
      return;
    }

    const employee = {
      ...draft,
      id: `ma-${uid()}`,
      name: draft.name.trim(),
      funktion: draft.funktion.trim(),
      email: draft.email.trim(),
      rolle: draft.rolle || draft.gruppe,
      gruppe: draft.gruppe,
      status: sendLogin ? 'Einladung ausstehend' : 'Aktiv',
      teamSichtbar: draft.teamSichtbar === true || draft.teamSichtbar === 'true',
      teamSortierung: Number(draft.teamSortierung || 100),
      rechteExtra: draft.rechteExtra ?? [],
      rechteEntzogen: draft.rechteEntzogen ?? [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setMessage('Speichere Mitarbeiter ...');
    const employeeResult = await save('Mitarbeiter', employee);
    if (!employeeResult?.ok) {
      setMessage('Mitarbeiter konnte nicht sauber mit AWS synchronisiert werden.');
      return;
    }

    if (sendLogin) {
      const invitation = {
        id: `ein-${uid()}`,
        email: employee.email,
        rolle: employee.gruppe,
        zielTyp: 'Mitarbeiter',
        zielId: employee.id,
        status: 'Wird versendet',
        gesendetAm: nowIso(),
        createdBy: 'Verwaltung',
        name: employee.name,
      };
      try {
        setMessage('AWS-Einladung wird versendet ...');
        const awsInvite = await erstelleEinladungsauftrag(invitation);
        await save('Einladung', {
          id: invitation.id,
          email: invitation.email,
          rolle: invitation.rolle,
          zielTyp: invitation.zielTyp,
          zielId: invitation.zielId,
          gesendetAm: invitation.gesendetAm,
          createdBy: invitation.createdBy,
          status: awsInvite?.status ?? 'Versendet',
          tempPasswordHinweis: awsInvite?.message ?? 'Cognito Einladung wurde versendet.',
        });
        await save('Mitarbeiter', {
          ...employee,
          status: awsInvite?.status ?? 'Einladung versendet',
          cognitoSub: awsInvite?.username,
          updatedAt: nowIso(),
        });
      } catch (error: any) {
        setMessage(error?.message ?? 'AWS Einladung konnte nicht versendet werden.');
        return;
      }
    }

    onCreated(employee.id);
    onClose();
  };

  return (
    <div>
      {message && <p className="hint">{message}</p>}
      <div className="form-grid">
        <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Funktion
          <select value={draft.funktion} onChange={(e) => setDraft({ ...draft, funktion: e.target.value })}>
            <option value="">Funktion auswählen</option>
            {EMPLOYEE_FUNCTION_OPTIONS.map((funktion) => <option key={funktion}>{funktion}</option>)}
          </select>
        </label>
        <label>E-Mail<input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@example.invalid" /></label>
        <label>Telefon<input value={draft.telefon} onChange={(e) => setDraft({ ...draft, telefon: e.target.value })} /></label>
        <label>Gruppe
          <select value={draft.gruppe} onChange={(e) => setDraft({ ...draft, gruppe: e.target.value, rolle: e.target.value })}>
            {roles.map((role: AnyRecord) => <option key={role.id}>{role.name}</option>)}
          </select>
        </label>
        <label>Rolle/Funktion im System
          <select value={draft.rolle} onChange={(e) => setDraft({ ...draft, rolle: e.target.value })}>
            <option value="">Rolle auswählen</option>
            {systemRoleOptions.map((role) => <option key={role}>{role}</option>)}
          </select>
        </label>
        <label>Status
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            {['Aktiv', 'Einladung ausstehend', 'Inaktiv', 'Archiviert'].map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>Im Team anzeigen
          <select value={draft.teamSichtbar ? 'true' : 'false'} onChange={(e) => setDraft({ ...draft, teamSichtbar: e.target.value === 'true' })}>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        </label>
        <label>Team-Sortierung<input type="number" value={draft.teamSortierung} onChange={(e) => setDraft({ ...draft, teamSortierung: Number(e.target.value) })} /></label>
        <label>AWS Login
          <select value={sendLogin ? 'true' : 'false'} onChange={(e) => setSendLogin(e.target.value === 'true')}>
            <option value="true">Login-Einladung vorbereiten</option>
            <option value="false">Nur Mitarbeiter speichern</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onClose}>Abbrechen</button>
        <button className="primary" onClick={createEmployee}>Mitarbeiter speichern</button>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, count, children, defaultOpen = true }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="permission-section">
      <button
        className="perm-section-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{title}</span>
          {count !== undefined && <span style={{ fontSize: 11, background: '#e0e7ef', color: '#374151', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{count}</span>}
        </span>
        <span style={{ fontSize: 12, color: '#718095', transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </button>
      {open && <div style={{ paddingTop: 6 }}>{children}</div>}
    </div>
  );
}

function RolesAndPermissions({ data, employee, save }: any) {
  const roles = rolesForData(data);
  const [selectedRoleId, setSelectedRoleId] = useState(roleForEmployee(data, employee)?.id ?? roles[0]?.id);
  const selectedRole = roles.find((r: AnyRecord) => r.id === selectedRoleId) ?? roles[0];
  const members = data.Mitarbeiter.filter((m: AnyRecord) => m.gruppe === selectedRole?.name);
  const effective = effectiveRightsFor(data, employee);
  const [alleOffen, setAlleOffen] = useState(true);
  const [sectionKey, setSectionKey] = useState(0);

  useEffect(() => {
    const current = roleForEmployee(data, employee);
    if (current?.id) setSelectedRoleId(current.id);
  }, [employee.id, employee.gruppe]);

  const renameRole = (name: string) => {
    if (!selectedRole) return;
    const oldName = selectedRole.name;
    save('Rolle', { ...selectedRole, name });
    data.Mitarbeiter
      .filter((m: AnyRecord) => m.gruppe === oldName)
      .forEach((m: AnyRecord) => save('Mitarbeiter', { ...m, gruppe: name }));
  };
  const toggleRoleRight = (right: string) => {
    if (!selectedRole) return;
    const current = selectedRole.rechte ?? [];
    const next = current.includes(right) ? current.filter((x: string) => x !== right) : [...current.filter((x: string) => x !== '*'), right];
    save('Rolle', { ...selectedRole, rechte: next });
  };
  const toggleEmployeeExtra = (right: string) => {
    const current = employee.rechteExtra ?? [];
    const next = current.includes(right) ? current.filter((x: string) => x !== right) : [...current, right];
    save('Mitarbeiter', { ...employee, rechteExtra: next });
  };
  const toggleEmployeeDenied = (right: string) => {
    const current = employee.rechteEntzogen ?? [];
    const next = current.includes(right) ? current.filter((x: string) => x !== right) : [...current, right];
    save('Mitarbeiter', { ...employee, rechteEntzogen: next });
  };
  const createGroup = () => {
    const name = `Neue Gruppe ${data.Rolle.length + 1}`;
    const item = { id: `r-${uid()}`, name, beschreibung: 'Neue Berechtigungsgruppe', rechte: ['dashboard:lesen'] };
    save('Rolle', item);
    setSelectedRoleId(item.id);
  };

  return (
    <div className="rights-redesign">

      {/* ── Gruppen-Selektor ── */}
      <div className="group-selector-bar">
        <div className="group-pills">
          {roles.map((role: AnyRecord) => {
            const count = data.Mitarbeiter.filter((m: AnyRecord) => m.gruppe === role.name).length;
            return (
              <button
                key={role.id}
                className={`group-pill ${role.id === selectedRole?.id ? 'active' : ''}`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <span>{role.name}</span>
                <span className="group-pill-meta">{role.rechte?.includes('*') ? '★' : role.rechte?.length ?? 0} · {count} MA</span>
              </button>
            );
          })}
          <button className="group-pill add-pill" onClick={createGroup}>+ Neue Gruppe</button>
        </div>
      </div>

      {/* ── Gruppe bearbeiten + Mitglieder ── */}
      <div className="group-edit-layout">
        <div className="group-edit-main">
          <div className="group-edit-meta">
            <div className="form-grid" style={{ marginBottom: 0 }}>
              <label>Gruppenname<input value={selectedRole?.name ?? ''} onChange={(e) => renameRole(e.target.value)} /></label>
              <label>Beschreibung<input value={selectedRole?.beschreibung ?? ''} onChange={(e) => save('Rolle', { ...selectedRole, beschreibung: e.target.value })} /></label>
              <label>Vollzugriff
                <select value={selectedRole?.rechte?.includes('*') ? 'true' : 'false'} onChange={(e) => save('Rolle', { ...selectedRole, rechte: e.target.value === 'true' ? ['*'] : ['dashboard:lesen'] })}>
                  <option value="false">Nein</option><option value="true">Ja — alle Rechte</option>
                </select>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
            <strong style={{ fontSize: 13, color: '#374151' }}>Berechtigungen</strong>
            <button className="small" onClick={() => { setAlleOffen(o => !o); setSectionKey(k => k + 1); }}>
              {alleOffen ? '▲ Alle zuklappen' : '▼ Alle aufklappen'}
            </button>
          </div>
          <div className="permission-sections" key={`role-${sectionKey}`}>
            {PERMISSION_GROUPS.map((group) => {
              const aktiv = group.rights.filter(([r]) => selectedRole?.rechte?.includes('*') || selectedRole?.rechte?.includes(r)).length;
              return (
                <CollapsibleSection key={group.title} title={group.title} count={aktiv} defaultOpen={alleOffen}>
                  {group.rights.map(([right, label]) => (
                    <label className="check" key={right}>
                      <input type="checkbox" checked={selectedRole?.rechte?.includes('*') || selectedRole?.rechte?.includes(right)} disabled={selectedRole?.rechte?.includes('*')} onChange={() => toggleRoleRight(right)} />
                      {label}
                    </label>
                  ))}
                </CollapsibleSection>
              );
            })}
          </div>
        </div>

        <div className="group-members-panel">
          <strong style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 10 }}>
            Mitglieder · {members.length} von {data.Mitarbeiter.length}
          </strong>
          <div className="member-list">
            {data.Mitarbeiter.map((m: AnyRecord) => (
              <label key={m.id} className="member-row">
                <input type="checkbox" checked={m.gruppe === selectedRole?.name} onChange={(e) => selectedRole && save('Mitarbeiter', { ...m, gruppe: e.target.checked ? selectedRole.name : 'Ohne Gruppe' })} />
                <Avatar name={m.name} url={m.photoUrl} />
                <div>
                  <strong>{m.name}</strong>
                  <span>{m.funktion}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Einzelrechte für den ausgewählten Mitarbeiter ── */}
      <details className="individual-rights-details">
        <summary>Einzelrechte: {employee.name} <span style={{ fontSize: 12, color: '#718095', fontWeight: 400 }}>— Abweichungen von der Gruppe</span></summary>
        <div style={{ padding: '16px 0 0' }}>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label>Gruppe
              <select value={employee.gruppe ?? ''} onChange={(e) => save('Mitarbeiter', { ...employee, gruppe: e.target.value })}>
                {roles.map((r: AnyRecord) => <option key={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>Rolle/Funktion<input value={employee.rolle ?? ''} onChange={(e) => save('Mitarbeiter', { ...employee, rolle: e.target.value })} /></label>
          </div>
          <div className="effective-rights">
            <strong>Aktive Berechtigungen</strong>
            <span>{effective.includes('*') ? 'Alle Rechte durch Vollzugriff.' : effective.map((right) => allPermissions().find(([id]) => id === right)?.[1] ?? right).join(' · ')}</span>
          </div>
          <div className="permission-sections" key={`emp-${sectionKey}`}>
            {PERMISSION_GROUPS.map((group) => {
              const hatExtra = group.rights.filter(([r]) => hasRight(employee.rechteExtra ?? [], r)).length;
              const hatEntzogen = group.rights.filter(([r]) => (employee.rechteEntzogen ?? []).includes(r)).length;
              return (
                <CollapsibleSection key={group.title} title={group.title} defaultOpen={alleOffen}>
                  {(hatExtra > 0 || hatEntzogen > 0) && <span style={{ fontSize: 11, color: '#92400e', background: '#fef9ef', padding: '2px 8px', borderRadius: 8, marginBottom: 6, display: 'inline-block' }}>+{hatExtra} extra · −{hatEntzogen} entzogen</span>}
                  {group.rights.map(([right, label]) => (
                    <div className="employee-right-row" key={right}>
                      <span>{label}</span>
                      <label><input type="checkbox" checked={hasRight(employee.rechteExtra ?? [], right)} onChange={() => toggleEmployeeExtra(right)} /> Zusatz</label>
                      <label><input type="checkbox" checked={(employee.rechteEntzogen ?? []).includes(right)} onChange={() => toggleEmployeeDenied(right)} /> Entziehen</label>
                    </div>
                  ))}
                </CollapsibleSection>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
function InviteBox({ data, save }: any) {
  const roles = rolesForData(data);
  const employees = data.Mitarbeiter ?? [];
  const firstEmployee = employees[0];
  const [employeeId, setEmployeeId] = useState(firstEmployee?.id ?? '');
  const [email, setEmail] = useState(firstEmployee?.email ?? '');
  const [rolle, setRolle] = useState(firstEmployee?.gruppe ?? 'Mitarbeiter');
  const [status, setStatus] = useState('');

  const selectedEmployee = employees.find((m: AnyRecord) => m.id === employeeId);

  const selectEmployee = (id: string) => {
    const employee = employees.find((m: AnyRecord) => m.id === id);
    setEmployeeId(id);
    setEmail(employee?.email ?? '');
    setRolle(employee?.gruppe ?? employee?.rolle ?? 'Mitarbeiter');
    setStatus('');
  };

  const sendInvite = async () => {
    if (!email.trim()) {
      setStatus('Bitte E-Mail eintragen.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Bitte eine gültige E-Mail eingeben.');
      return;
    }

    const item = {
      id: `ein-${uid()}`,
      email: email.trim(),
      rolle,
      zielTyp: 'Mitarbeiter',
      zielId: employeeId || selectedEmployee?.id || 'neu',
      status: 'Wird versendet',
      gesendetAm: nowIso(),
      createdBy: 'Verwaltung',
      name: selectedEmployee?.name ?? email.trim(),
    };

    setStatus('AWS-Einladung wird versendet ...');
    try {
      const awsInvite = await erstelleEinladungsauftrag(item);
      await save('Einladung', {
        id: item.id,
        email: item.email,
        rolle: item.rolle,
        zielTyp: item.zielTyp,
        zielId: item.zielId,
        gesendetAm: item.gesendetAm,
        createdBy: item.createdBy,
        status: awsInvite?.status ?? 'Versendet',
        tempPasswordHinweis: awsInvite?.message ?? 'Cognito Einladung wurde versendet.',
      });

      if (selectedEmployee) {
        await save('Mitarbeiter', {
          ...selectedEmployee,
          email: email.trim(),
          gruppe: rolle,
          rolle,
          status: awsInvite?.status ?? 'Einladung versendet',
          cognitoSub: awsInvite?.username ?? selectedEmployee.cognitoSub,
          updatedAt: nowIso(),
        });
      }

      setStatus(awsInvite?.message ?? 'AWS Login wurde versendet.');
    } catch (error: any) {
      setStatus(error?.message ?? 'AWS Einladung konnte nicht versendet werden.');
    }
  };

  const passwortZuruecksetzen = async () => {
    if (!email.trim()) { setStatus('Bitte E-Mail eintragen.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Bitte eine gültige E-Mail eingeben.'); return; }
    setStatus('Passwort-Reset wird versendet ...');
    try {
      const awsResult = await erstelleEinladungsauftrag({
        id: `ein-${uid()}`,
        email: email.trim(),
        rolle,
        zielTyp: 'Mitarbeiter',
        zielId: employeeId || selectedEmployee?.id || 'unbekannt',
        name: selectedEmployee?.name ?? email.trim(),
      });
      setStatus(awsResult?.message ?? 'Passwort-Reset-E-Mail wurde versendet.');
    } catch (error: any) {
      setStatus(error?.message ?? 'Passwort-Reset konnte nicht versendet werden.');
    }
  };

  return (
    <div className="invite">
      <h3>Zugangsdaten senden</h3>
      <p className="hint">Sendet direkt eine Cognito-Einladung per AWS und speichert den Versand im Verlauf.</p>
      <select value={employeeId} onChange={(e) => selectEmployee(e.target.value)}>
        <option value="">Neuen/externen Empfänger erfassen</option>
        {employees.map((m: AnyRecord) => <option key={m.id} value={m.id}>{m.name} · {m.gruppe}</option>)}
      </select>
      <input placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} />
      <select value={rolle} onChange={e => setRolle(e.target.value)}>
        {roles.map((role: AnyRecord) => <option key={role.id}>{role.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={sendInvite}>Einladung senden</button>
        <button onClick={passwortZuruecksetzen}>Passwort zurücksetzen</button>
      </div>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}

// ─── Öffnungszeiten ───────────────────────────────────────────────────────────

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const OEZ_SI_ID = 'si-oeffnungszeiten';

interface OezZeitblock { id: string; von: string; bis: string }
interface OezStandard { von?: string; bis?: string; zeiten: OezZeitblock[]; geschlossen: boolean }
interface OezAusnahme { id: string; datum: string; hinweis: string; vonBis: string; geschlossen: boolean }
interface OezConfig {
  standard: Record<string, OezStandard>;
  ausnahmen: OezAusnahme[];
  hinweisAllgemein: string;
}

const defaultOez = (): OezConfig => ({
  standard: Object.fromEntries(WOCHENTAGE.map((d, i) => [d, {
    von: '08:00',
    bis: '17:00',
    zeiten: [{ id: `zeit-${i}-1`, von: '08:00', bis: '17:00' }],
    geschlossen: i >= 5,
  }])),
  ausnahmen: [],
  hinweisAllgemein: '',
});

const normalizeOezTag = (tag: Partial<OezStandard> | undefined, fallback: OezStandard): OezStandard => {
  const zeiten = Array.isArray(tag?.zeiten) && tag?.zeiten.length
    ? tag.zeiten.map((z, index) => ({
      id: z.id || `zeit-${uid()}-${index}`,
      von: z.von || tag?.von || fallback.von || '08:00',
      bis: z.bis || tag?.bis || fallback.bis || '17:00',
    }))
    : [{ id: `zeit-${uid()}`, von: tag?.von || fallback.von || '08:00', bis: tag?.bis || fallback.bis || '17:00' }];

  return {
    ...fallback,
    ...tag,
    von: zeiten[0]?.von ?? fallback.von,
    bis: zeiten[zeiten.length - 1]?.bis ?? fallback.bis,
    zeiten,
    geschlossen: Boolean(tag?.geschlossen ?? fallback.geschlossen),
  };
};

const normalizeOez = (raw: Partial<OezConfig>): OezConfig => {
  const base = defaultOez();
  return {
    ...base,
    ...raw,
    standard: Object.fromEntries(WOCHENTAGE.map((tag) => [
      tag,
      normalizeOezTag(raw.standard?.[tag], base.standard[tag]),
    ])),
    ausnahmen: Array.isArray(raw.ausnahmen) ? raw.ausnahmen : [],
    hinweisAllgemein: raw.hinweisAllgemein ?? '',
  };
};

const oezZeitenText = (tag?: OezStandard) => {
  if (!tag || tag.geschlossen) return 'Geschlossen';
  return (tag.zeiten?.length ? tag.zeiten : [{ id: 'legacy', von: tag.von || '08:00', bis: tag.bis || '17:00' }])
    .map((z) => `${z.von} – ${z.bis}`)
    .join(' / ') + ' Uhr';
};

function ladeOez(data: Record<string, AnyRecord[]>): OezConfig {
  const si = (data.PortalInhalt ?? []).find((x: AnyRecord) => x.id === OEZ_SI_ID || (x.bereich === 'Öffnungszeiten' && x.titel === 'Konfiguration'));
  if (!si?.inhalt) return defaultOez();
  try { return normalizeOez(JSON.parse(si.inhalt)); } catch { return defaultOez(); }
}

function OeffnungszeitenModal({ data, save, onClose }: any) {
  const [cfg, setCfg] = useState<OezConfig>(() => ladeOez(data));
  const [saved, setSaved] = useState(false);
  const [neueAusnahme, setNeueAusnahme] = useState<Omit<OezAusnahme, 'id'>>({ datum: new Date().toISOString().slice(0, 10), hinweis: '', vonBis: '', geschlossen: true });

  const setTag = (tag: string, field: keyof OezStandard, value: string | boolean | OezZeitblock[]) =>
    setCfg(c => ({ ...c, standard: { ...c.standard, [tag]: { ...c.standard[tag], [field]: value } } }));

  const setZeit = (tag: string, zeitId: string, field: keyof OezZeitblock, value: string) =>
    setCfg(c => ({
      ...c,
      standard: {
        ...c.standard,
        [tag]: {
          ...c.standard[tag],
          zeiten: c.standard[tag].zeiten.map((z) => z.id === zeitId ? { ...z, [field]: value } : z),
        },
      },
    }));

  const addZeit = (tag: string, afterId?: string) =>
    setCfg(c => {
      const aktuelle = c.standard[tag].zeiten.length ? c.standard[tag].zeiten : [{ id: uid(), von: '08:00', bis: '12:00' }];
      const index = Math.max(0, aktuelle.findIndex((z) => z.id === afterId));
      const basis = aktuelle[index] ?? aktuelle[aktuelle.length - 1];
      const neuerBlock = { id: `zeit-${uid()}`, von: basis?.bis && basis.bis < '13:30' ? '13:30' : basis?.bis || '13:30', bis: '16:30' };
      const zeiten = [...aktuelle];
      zeiten.splice(index + 1, 0, neuerBlock);
      return {
        ...c,
        standard: {
          ...c.standard,
          [tag]: { ...c.standard[tag], geschlossen: false, zeiten },
        },
      };
    });

  const removeZeit = (tag: string, zeitId: string) =>
    setCfg(c => {
      const zeiten = c.standard[tag].zeiten.filter((z) => z.id !== zeitId);
      return {
        ...c,
        standard: {
          ...c.standard,
          [tag]: { ...c.standard[tag], zeiten: zeiten.length ? zeiten : [{ id: `zeit-${uid()}`, von: '08:00', bis: '17:00' }] },
        },
      };
    });

  const addAusnahme = () => {
    if (!neueAusnahme.datum) return;
    setCfg(c => ({ ...c, ausnahmen: [...c.ausnahmen, { id: uid(), ...neueAusnahme }] }));
    setNeueAusnahme({ datum: new Date().toISOString().slice(0, 10), hinweis: '', vonBis: '', geschlossen: true });
  };

  const removeAusnahme = (id: string) =>
    setCfg(c => ({ ...c, ausnahmen: c.ausnahmen.filter(a => a.id !== id) }));

  const onSave = async () => {
    const existingId = (data.PortalInhalt ?? []).find((x: AnyRecord) => x.bereich === 'Öffnungszeiten' && x.titel === 'Konfiguration')?.id ?? OEZ_SI_ID;
    await save('PortalInhalt', {
      id: existingId,
      bereich: 'Öffnungszeiten',
      titel: 'Konfiguration',
      inhalt: JSON.stringify(cfg),
      sortierung: 0,
      sichtbar: true,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Heute-Status
  const heute = WOCHENTAGE[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const heuteConfig = cfg.standard[heute];
  const heuteAusnahme = cfg.ausnahmen.find(a => a.datum === new Date().toISOString().slice(0, 10));

  return (
    <div className="modal-backdrop">
      <div className="oez-modal">
        <div className="modal-head">
          <h2>🕐 Öffnungszeiten bearbeiten</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="oez-modal-body">
          {/* Heute-Status */}
          <div className={`oez-heute ${heuteAusnahme?.geschlossen || (!heuteAusnahme && heuteConfig?.geschlossen) ? 'geschlossen' : 'offen'}`}>
            <strong>Heute ({heute}): </strong>
            {heuteAusnahme
              ? <span>{heuteAusnahme.geschlossen ? `Geschlossen — ${heuteAusnahme.hinweis}` : heuteAusnahme.vonBis || 'Sonderzeiten'}</span>
              : <span>{oezZeitenText(heuteConfig)}</span>
            }
          </div>

          <div className="oez-two-col">
            {/* Standard-Woche — kompakt */}
            <div>
              <div className="oez-section-label">Standard-Woche</div>
              <div className="oez-week-grid">
                {WOCHENTAGE.map(tag => {
                  const t = cfg.standard[tag] ?? normalizeOezTag(undefined, defaultOez().standard[tag]);
                  return (
                    <div key={tag} className={`oez-tag-row ${tag === heute ? 'heute' : ''} ${t.geschlossen ? 'geschlossen-row' : ''}`}>
                      <div className="oez-tag-head">
                        <span className="oez-tag-name">{tag.slice(0, 2)}<span className="oez-tag-full">{tag.slice(2)}</span></span>
                        <label className="oez-closed-toggle">
                          <input type="checkbox" checked={t.geschlossen} onChange={e => setTag(tag, 'geschlossen', e.target.checked)} />
                          <span>{t.geschlossen ? 'Zu' : 'Auf'}</span>
                        </label>
                      </div>
                      <div className="oez-time-blocks">
                        {t.zeiten.map((zeit, index) => (
                          <div className="oez-time-block" key={zeit.id}>
                            <input type="time" value={zeit.von} disabled={t.geschlossen}
                              onChange={e => setZeit(tag, zeit.id, 'von', e.target.value)} className="oez-time-input" />
                            <span className="oez-dash">–</span>
                            <input type="time" value={zeit.bis} disabled={t.geschlossen}
                              onChange={e => setZeit(tag, zeit.id, 'bis', e.target.value)} className="oez-time-input" />
                            <button className="oez-add-time" disabled={t.geschlossen} onClick={() => addZeit(tag, zeit.id)} title="Zeitblock hinzufügen">+</button>
                            {t.zeiten.length > 1 && (
                              <button className="oez-remove-time" disabled={t.geschlossen} onClick={() => removeZeit(tag, zeit.id)} title="Zeitblock entfernen">×</button>
                            )}
                            {index === 0 && t.zeiten.length === 1 && <span className="oez-pause-hint">Pause via +</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="oez-hinweis-label">Allgemeiner Hinweis
                <input value={cfg.hinweisAllgemein} onChange={e => setCfg(c => ({ ...c, hinweisAllgemein: e.target.value }))}
                  placeholder="z.B. Mittagspause 12:00–13:00" className="oez-hinweis-input" />
              </label>
            </div>

            {/* Ausnahmen */}
            <div>
              <div className="oez-section-label">Ausnahmen & Feiertage</div>
              <div className="oez-ausnahme-form">
                <input type="date" value={neueAusnahme.datum} onChange={e => setNeueAusnahme({ ...neueAusnahme, datum: e.target.value })} />
                <input value={neueAusnahme.hinweis} onChange={e => setNeueAusnahme({ ...neueAusnahme, hinweis: e.target.value })} placeholder="Grund (z.B. Feiertag, Ausflug …)" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={neueAusnahme.geschlossen} onChange={e => setNeueAusnahme({ ...neueAusnahme, geschlossen: e.target.checked })} />
                    Geschlossen
                  </label>
                  {!neueAusnahme.geschlossen && (
                    <input value={neueAusnahme.vonBis} onChange={e => setNeueAusnahme({ ...neueAusnahme, vonBis: e.target.value })}
                      placeholder="09:00–12:00" style={{ flex: 1, border: '1px solid #ddd6cc', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
                  )}
                  <button className="primary small" onClick={addAusnahme}>+</button>
                </div>
              </div>
              <div className="oez-ausnahme-list">
                {cfg.ausnahmen.length === 0 && <p className="hint" style={{ margin: '8px 0' }}>Keine Ausnahmen erfasst.</p>}
                {cfg.ausnahmen
                  .slice().sort((a, b) => a.datum.localeCompare(b.datum))
                  .map(a => (
                    <div key={a.id} className={`oez-ausnahme-item ${a.datum < new Date().toISOString().slice(0, 10) ? 'past' : ''}`}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{new Date(a.datum + 'T12:00:00').toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</strong>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{a.hinweis}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge tone={a.geschlossen ? 'red' : 'green'}>{a.geschlossen ? 'Zu' : a.vonBis || 'Auf'}</Badge>
                        <button className="small" style={{ padding: '3px 8px', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={() => removeAusnahme(a.id)}>×</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="oez-modal-footer">
          {saved && <span style={{ color: '#166534', fontWeight: 700, fontSize: 13 }}>✓ Gespeichert & synchronisiert</span>}
          <button onClick={onClose}>Schliessen</button>
          <button className="primary" onClick={onSave}>Speichern & synchronisieren</button>
        </div>
      </div>
    </div>
  );
}

function OeffnungszeitenEditor({ data, save }: any) {
  const [zeigeModal, setZeigeModal] = useState(false);
  const cfg = ladeOez(data);
  const heute = WOCHENTAGE[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const heuteConfig = cfg.standard[heute];
  const heuteAusnahme = cfg.ausnahmen.find(a => a.datum === new Date().toISOString().slice(0, 10));
  const istGeschlossen = heuteAusnahme?.geschlossen || (!heuteAusnahme && heuteConfig?.geschlossen);
  const naechsteAusnahme = cfg.ausnahmen
    .filter(a => a.datum > new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.datum.localeCompare(b.datum))[0];

  return (
    <>
      {/* Kompakte Karte */}
      <div className="oez-card">
        <div className="oez-card-left">
          <span className="oez-card-icon">🕐</span>
          <div>
            <strong>Öffnungszeiten</strong>
            <div className="oez-card-sub">
              <span className={`oez-status-dot ${istGeschlossen ? 'rot' : 'gruen'}`} />
              <span>Heute ({heute}): </span>
              <span style={{ fontWeight: 600 }}>
                {heuteAusnahme ? (heuteAusnahme.geschlossen ? `Geschlossen — ${heuteAusnahme.hinweis}` : heuteAusnahme.vonBis) : oezZeitenText(heuteConfig)}
              </span>
              {naechsteAusnahme && (
                <span style={{ marginLeft: 12, color: '#f59e0b', fontSize: 12 }}>
                  · Nächste Ausnahme: {new Date(naechsteAusnahme.datum + 'T12:00:00').toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })} – {naechsteAusnahme.hinweis}
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="primary small" onClick={() => setZeigeModal(true)}>✏ Bearbeiten</button>
      </div>

      {zeigeModal && <OeffnungszeitenModal data={data} save={save} onClose={() => setZeigeModal(false)} />}
    </>
  );
}

const FIRMENDATEN_FELDER = [
  { bereich: 'Firmendaten', titel: 'Firmenname', icon: '🏢', placeholder: 'Immobilientool' },
  { bereich: 'Firmendaten', titel: 'Adresse', icon: '📍', placeholder: 'Musterstrasse 1, 4000 Basel' },
  { bereich: 'Firmendaten', titel: 'Telefon', icon: '📞', placeholder: '+41 00 000 00 00' },
  { bereich: 'Firmendaten', titel: 'E-Mail', icon: '✉️', placeholder: 'info@example.invalid' },
  { bereich: 'Firmendaten', titel: 'Webseite', icon: '🌐', placeholder: 'https://example.invalid' },
  { bereich: 'Firmendaten', titel: 'Bürozeiten', icon: '🕐', placeholder: 'Mo–Fr 08:00–17:00 Uhr' },
];

function PortalContent({ data, save }: any) {
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [firmaDraft, setFirmaDraft] = useState<Record<string, string>>({});
  const [firmaSaved, setFirmaSaved] = useState(false);
  const [dragTeamId, setDragTeamId] = useState('');
  const [previewNow, setPreviewNow] = useState(() => new Date());

  const portalInhalte = data.PortalInhalt as AnyRecord[];
  const oezCfg = ladeOez(data);
  const heute = WOCHENTAGE[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const heuteOez = oezCfg.standard[heute];
  const previewTime = previewNow.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  React.useEffect(() => {
    const timer = window.setInterval(() => setPreviewNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Firmendaten aus PortalInhalt laden
  React.useEffect(() => {
    const draft: Record<string, string> = {};
    FIRMENDATEN_FELDER.forEach(f => {
      const record = portalInhalte.find(x => x.bereich === f.bereich && x.titel === f.titel);
      draft[f.titel] = record?.inhalt ?? '';
    });
    setFirmaDraft(draft);
  }, [portalInhalte.length]);

  const saveFirmaDaten = async () => {
    for (const f of FIRMENDATEN_FELDER) {
      const existing = portalInhalte.find(x => x.bereich === f.bereich && x.titel === f.titel);
      const wert = firmaDraft[f.titel] ?? '';
      await save('PortalInhalt', {
        id: existing?.id ?? `si-firma-${f.titel.toLowerCase().replace(/\s/g, '-')}`,
        bereich: f.bereich,
        titel: f.titel,
        inhalt: wert,
        sortierung: FIRMENDATEN_FELDER.indexOf(f) + 1,
        sichtbar: true,
      });
    }
    setFirmaSaved(true);
    setTimeout(() => setFirmaSaved(false), 2500);
  };

  const team = data.Mitarbeiter
    .filter((m: AnyRecord) => m.teamSichtbar)
    .sort((a: AnyRecord, b: AnyRecord) => (a.teamSortierung ?? 100) - (b.teamSortierung ?? 100));
  const areas = portalInhalte
    .filter((x: AnyRecord) => x.bereich !== 'Firmendaten' && x.bereich !== 'Öffnungszeiten')
    .slice()
    .sort((a: AnyRecord, b: AnyRecord) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

  const updateTeamOrder = async (ordered: AnyRecord[]) => {
    await Promise.all(ordered.map((member: AnyRecord, index: number) =>
      save('Mitarbeiter', { ...member, teamSortierung: (index + 1) * 10, updatedAt: nowIso() })
    ));
  };

  const moveTeamMember = async (id: string, direction: -1 | 1) => {
    const currentIndex = team.findIndex((member: AnyRecord) => member.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= team.length) return;
    const ordered = [...team];
    const [member] = ordered.splice(currentIndex, 1);
    ordered.splice(nextIndex, 0, member);
    await updateTeamOrder(ordered);
  };

  const dropTeamMember = async (targetId: string) => {
    if (!dragTeamId || dragTeamId === targetId) return;
    const ordered = [...team];
    const fromIndex = ordered.findIndex((member: AnyRecord) => member.id === dragTeamId);
    const toIndex = ordered.findIndex((member: AnyRecord) => member.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [member] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, member);
    setDragTeamId('');
    await updateTeamOrder(ordered);
  };

  return (
    <div>
      <Title
        title="Über Portal / App Inhalte"
        sub="CMS für die App. Änderungen synchronisieren automatisch mit iOS und Webportal."
        actions={<button className="primary small" onClick={() => setSelected({ id: `si-${uid()}`, bereich: 'Kontakt', titel: 'Neuer Inhalt', inhalt: '', sortierung: 100, sichtbar: true })}>Neuer Inhalt</button>}
      />

      {/* Öffnungszeiten */}
      <OeffnungszeitenEditor data={data} save={save} />

      {/* Firmendaten-Block */}
      <div style={{ margin: '0 32px 24px' }}>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>🏢 Firmendaten & Kontakt</h2>
          <p style={{ fontSize: 13, color: '#8290a7', margin: '0 0 18px' }}>
            Diese Daten erscheinen in der App unter Einstellungen → Kontakt und im Kundenportal. Sie synchronisieren automatisch.
          </p>
          <div className="form-grid">
            {FIRMENDATEN_FELDER.map(f => (
              <label key={f.titel}>
                {f.icon} {f.titel}
                <input
                  value={firmaDraft[f.titel] ?? ''}
                  onChange={e => setFirmaDraft({ ...firmaDraft, [f.titel]: e.target.value })}
                  placeholder={f.placeholder}
                />
              </label>
            ))}
          </div>
          {firmaSaved && <p style={{ color: '#166534', fontWeight: 700, marginTop: 10 }}>✓ Firmendaten gespeichert und synchronisiert.</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="primary" onClick={saveFirmaDaten}>Speichern & synchronisieren</button>
          </div>
        </section>
      </div>

      <div className="cms-layout">
        <Panel title="Weitere App-Inhalte">
          <input className="search" placeholder="Bereich suchen ..." />
          {areas.map((x: AnyRecord) => (
            <button key={x.id} className={`content-item ${selected?.id === x.id ? 'selected' : ''}`} onClick={() => setSelected(x)}>
              <div>
                <strong>{x.titel}</strong>
                <span>{x.bereich}</span>
              </div>
              <Badge tone={x.sichtbar ? 'green' : ''}>{x.sichtbar ? 'Aktiv' : 'Versteckt'}</Badge>
            </button>
          ))}
        </Panel>
        <Panel title={selected?.titel ?? 'Inhalt wählen'}>
          {selected
            ? <EditFields item={selected} fields={['bereich', 'titel', 'inhalt', 'sortierung', 'sichtbar']} onSave={(x: AnyRecord) => { save('PortalInhalt', x); setSelected(x); }} />
            : (
              <div className="stack">
                <p className="hint">Wähle einen Inhalt aus der Liste oder erstelle einen neuen.</p>
                <div className="team-order-panel">
                  <div>
                    <strong>Team-Reihenfolge</strong>
                    <span>Mitarbeitende mit Griff ziehen oder per Pfeil verschieben.</span>
                  </div>
                  {team.length === 0 ? <p className="hint">Keine sichtbaren Teammitglieder.</p> : team.map((member: AnyRecord, index: number) => (
                    <div
                      key={member.id}
                      className={`team-order-row ${dragTeamId === member.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={() => setDragTeamId(member.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropTeamMember(member.id)}
                      onDragEnd={() => setDragTeamId('')}
                    >
                      <span className="team-drag-handle">≡</span>
                      <Avatar name={member.name} url={member.photoUrl} />
                      <div>
                        <strong>{member.name}</strong>
                        <span>{member.funktion}</span>
                      </div>
                      <div className="team-order-actions">
                        <button className="small" disabled={index === 0} onClick={() => moveTeamMember(member.id, -1)}>↑</button>
                        <button className="small" disabled={index === team.length - 1} onClick={() => moveTeamMember(member.id, 1)}>↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        </Panel>
        <Panel title="Live-Vorschau App">
          <div className="phone-preview" aria-label="iPhone Vorschau Über Portal">
            <div className="phone-speaker" />
            <div className="phone-screen">
              <div className="ios-statusbar">
                <span>{previewTime}</span>
                <span className="ios-status-icons"><span /> <span /> <span /></span>
              </div>
              <div className="ios-nav ios-nav-large">
                <h3>Über Portal</h3>
              </div>
              <div className="ios-list">
                <div className="ios-section-title">Kontakt</div>
                <div className="ios-section">
                  <div className="ios-row ios-link-row">
                    <span className="ios-icon map">⌂</span>
                    <span>Adresse in Karten öffnen</span>
                  </div>
                  <div className="ios-row ios-link-row">
                    <span className="ios-icon phone">☎</span>
                    <span>000 000 00 00 anrufen</span>
                  </div>
                  <div className="ios-row ios-link-row">
                    <span className="ios-icon mail">@</span>
                    <span>E-Mail schreiben</span>
                  </div>
                  <div className="ios-row ios-link-row">
                    <span className="ios-icon web">↗</span>
                    <span>Webseite öffnen</span>
                  </div>
                  <div className="ios-row">
                    <span className="ios-icon clock">◷</span>
                    <span>{heute}: {oezZeitenText(heuteOez)}</span>
                  </div>
                </div>

                <div className="ios-section-title">Öffnungszeiten</div>
                <div className="ios-section">
                  {WOCHENTAGE.map((tag) => (
                    <div className="ios-hours-row" key={tag}>
                      <strong>{tag.slice(0, 2)}</strong>
                      <span>{oezZeitenText(oezCfg.standard[tag])}</span>
                    </div>
                  ))}
                  {oezCfg.hinweisAllgemein && <div className="ios-note-row">{oezCfg.hinweisAllgemein}</div>}
                </div>

                <div className="ios-section-title">Informationen</div>
                <div className="ios-section">
                  {areas.filter((x: AnyRecord) => x.sichtbar).length === 0 && (
                    <div className="ios-info-row">
                      <strong>Keine Inhalte sichtbar</strong>
                      <span>Aktiviere Inhalte im CMS, damit sie in der App erscheinen.</span>
                    </div>
                  )}
                  {areas.filter((x: AnyRecord) => x.sichtbar).map((x: AnyRecord) => (
                    <div className="ios-info-row" key={x.id}>
                      <strong>{x.titel}</strong>
                      {x.inhalt && <span>{x.inhalt}</span>}
                    </div>
                  ))}
                </div>

                <div className="ios-section-title">Unser Team</div>
                <div className="ios-section">
                  {team.length === 0 && (
                    <div className="ios-info-row">
                      <strong>Kein Team sichtbar</strong>
                      <span>Aktiviere Mitarbeitende in Mitarbeiter & Rechte.</span>
                    </div>
                  )}
                  {team.map((m: AnyRecord) => (
                    <div className="ios-team-row" key={m.id}>
                      <Avatar name={m.name} url={m.photoUrl} />
                      <div>
                        <strong>{m.name}</strong>
                        <span>{m.funktion}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

const isActiveProperty = (property: AnyRecord) => {
  const status = String(property.status ?? '').toLowerCase();
  const name = String(property.name ?? '').toLowerCase();
  return status !== 'gelöscht' && status !== 'archiviert' && !name.startsWith('[gelöscht]');
};

const isActiveParty = (person: AnyRecord) => {
  const status = String(person.kontoStatus ?? '').toLowerCase();
  const name = String(person.name ?? personDisplayName(person) ?? '').toLowerCase();
  return status !== 'gelöscht' && status !== 'archiviert' && !name.startsWith('[gelöscht]');
};

const isActiveCase = (fall: AnyRecord) => {
  const status = statusValue(fall.status);
  const title = String(fall.titel ?? '').toLowerCase();
  return status !== 'ARCHIVIERT' && !title.startsWith('[gelöscht]');
};

const isActiveGenericRow = (row: AnyRecord) => {
  const name = String(row.name ?? row.titel ?? row.firma ?? row.bezeichnung ?? '').toLowerCase();
  const status = String(row.status ?? row.kontoStatus ?? '').toLowerCase();
  return !name.startsWith('[gelöscht]') && status !== 'gelöscht' && status !== 'archiviert';
};

const isSearchVisible = (model: string, row: AnyRecord, data: Record<string, AnyRecord[]>) => {
  const property = row.liegenschaftId ? data.Liegenschaft.find((l: AnyRecord) => l.id === row.liegenschaftId) : null;
  const person = row.personId ? data.KontaktPerson.find((p: AnyRecord) => p.id === row.personId) : null;
  const fall = row.schadenfallId ? data.Schadenfall.find((f: AnyRecord) => f.id === row.schadenfallId) : null;

  if (property && !isActiveProperty(property)) return false;
  if (person && !isActiveParty(person)) return false;
  if (fall && !isActiveCase(fall)) return false;
  if (model === 'Liegenschaft') return isActiveProperty(row);
  if (model === 'KontaktPerson') return isActiveParty(row);
  if (model === 'Schadenfall') return isActiveCase(row);
  if (model === 'ChatMessage' && !row.nachricht?.trim()) return false;
  return isActiveGenericRow(row);
};

function CustomerPicker({ data, setCustomerViewId, setMode }: any) {
  const [q, setQ] = useState('');
  const activeParties = data.KontaktPerson.filter(isActiveParty);
  const props = data.Liegenschaft
    .filter(isActiveProperty)
    .filter((l: AnyRecord) => {
      const parties = activeParties.filter((p: AnyRecord) => p.liegenschaftId === l.id);
      const matchesProperty = JSON.stringify(l).toLowerCase().includes(q.toLowerCase());
      const matchesParty = parties.some((p: AnyRecord) => JSON.stringify(p).toLowerCase().includes(q.toLowerCase()));
      return parties.length > 0 && (matchesProperty || matchesParty);
    });

  return (
    <div>
      <Title title="Kundenansicht auswählen" sub="Wählen Sie zuerst die Liegenschaft und danach Eigentümer oder Mieter." />
      <Panel title="Liegenschaften und Parteien" className="full-list">
        <input className="search" placeholder="Suche nach Liegenschaft, Eigentümer, Mieter, E-Mail ..." value={q} onChange={e => setQ(e.target.value)} />
        <div className="property-picker">
          {props.length === 0 ? (
            <p className="hint">Keine aktiven Liegenschaften mit aktiven Parteien gefunden.</p>
          ) : (
            props.map((l: AnyRecord) => (
              <div className="picker-property" key={l.id}>
                <h3>{l.liegenschaftNummer} · {l.name}</h3>
                <p>{l.strasse}, {l.plz} {l.ort}</p>
                {activeParties
                  .filter((p: AnyRecord) => p.liegenschaftId === l.id)
                  .map((p: AnyRecord) => (
                    <button className="party-card" key={p.id} onClick={() => { setCustomerViewId(p.id); setMode('customer'); }}>
                      <Avatar name={personDisplayName(p)} />
                      <div>
                        <strong>{personDisplayName(p)}</strong>
                        <span>{p.rolle} · {p.email}</span>
                      </div>
                      <Badge>{p.kontoStatus}</Badge>
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function Search({ data, search, setSearch, setView, setSelectedPropertyId, setSelectedPersonId, setSelectedCaseId, setPropertyTab }: any) {
  const term = search.toLowerCase();
  const results = Object.entries(data)
    .flatMap(([model, rows]: any) => rows.map((row: AnyRecord) => ({ model, row })))
    .filter(({ model, row }) => isSearchVisible(model, row, data))
    .filter(({ row }) => !term || JSON.stringify(row).toLowerCase().includes(term));

  return (
    <div>
      <Title title="Globale Suche" sub="Findet aktive Liegenschaften, Personen, Meldungen, Dokumente, Schlüssel, Termine, Mitarbeitende und Handwerker." />
      <input className="global-search" autoFocus placeholder="Suche nach Nummer, Name, Adresse, Dokument, Schlüssel ..." value={search} onChange={e => setSearch(e.target.value)} />
      <Panel title="Ergebnisse">
        {results.length === 0 ? (
          <p className="hint">Keine aktiven Treffer gefunden.</p>
        ) : (
          results.slice(0, 80).map(({ model, row }) => (
            <button
              className="list-row clickable"
              key={`${model}-${row.id}`}
              onClick={() => {
                if (model === 'Liegenschaft') {
                  setSelectedPropertyId(row.id);
                  setView('liegenschaftDetail');
                } else if (model === 'KontaktPerson') {
                  setSelectedPersonId(row.id);
                  setSelectedPropertyId(row.liegenschaftId);
                  setPropertyTab('Parteien');
                  setView('personDetail');
                } else if (model === 'Schadenfall') {
                  setSelectedCaseId(row.id);
                  setView('fallDetail');
                } else if (row.schadenfallId) {
                  setSelectedCaseId(row.schadenfallId);
                  setView('fallDetail');
                } else if (row.liegenschaftId) {
                  setSelectedPropertyId(row.liegenschaftId);
                  setPropertyTab('Parteien');
                  setView('liegenschaftDetail');
                }
              }}
            >
              <div>
                <strong>{row.name || row.titel || row.firma || row.bezeichnung || row.email || row.nachricht || 'Eintrag'}</strong>
                <span>{[row.liegenschaftNummer, row.strasse, row.ort, row.kategorie, row.dateiname, row.nummer].filter(Boolean).join(' · ')}</span>
              </div>
              <Badge>{model}</Badge>
            </button>
          ))
        )}
      </Panel>
    </div>
  );
}

// ─── Customer Portal colours ─────────────────────────────────────────────────
const CP = {
  bg: '#f7f4ef',
  card: '#ffffff',
  border: '#e5dfd8',
  text: '#1a2233',
  muted: '#6b7280',
  accent: '#1e40af',
  accentLight: '#eff6ff',
  green: '#166534',
  greenBg: '#dcfce7',
  orange: '#92400e',
  orangeBg: '#fef3c7',
  red: '#991b1b',
  redBg: '#fee2e2',
};

type CPortalTab = 'home' | 'meldungen' | 'dokumente' | 'termine' | 'profil' | 'kontakt';

function CustomerPortal({ data, customer, save }: any) {
  const [activeTab, setActiveTab] = useState<CPortalTab>(() => (getPersistedState(`portal:cportal:tab:${customer.id}`, 'home') as CPortalTab));
  const [activeCaseId, setActiveCaseId] = useState('');

  useEffect(() => { persistState(`portal:cportal:tab:${customer.id}`, activeTab); }, [activeTab, customer.id]);
  const prop = data.Liegenschaft.find((l: AnyRecord) => l.id === customer.liegenschaftId);
  const docs = data.Dokument.filter((d: AnyRecord) => d.personId === customer.id && d.sichtbarFuerKunden);
  const terms = data.KalenderTermin.filter((t: AnyRecord) => t.personIds?.includes(customer.id) && t.sichtbarInApp);
  const cases = data.Schadenfall.filter((f: AnyRecord) =>
    !String(f.titel ?? '').startsWith('[GELÖSCHT]') &&
    (f.personId === customer.id || f.liegenschaftId === customer.liegenschaftId)
  );
  const openCases = cases.filter((f: AnyRecord) => !['ERLEDIGT', 'ARCHIVIERT'].includes(statusValue(f.status)));
  const nextTerm = [...terms].filter((t: AnyRecord) => new Date(t.start) >= new Date()).sort((a: AnyRecord, b: AnyRecord) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  const portalContent = data.PortalInhalt ?? [];
  const vorname = splitPersonName(customer).vorname || personDisplayName(customer);

  const TABS: { id: CPortalTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Übersicht', icon: '🏠' },
    { id: 'meldungen', label: 'Meine Meldungen', icon: '⚠️' },
    { id: 'dokumente', label: 'Dokumente', icon: '📄' },
    { id: 'termine', label: 'Termine', icon: '📅' },
    { id: 'profil', label: 'Mein Profil', icon: '👤' },
    { id: 'kontakt', label: 'Kontakt', icon: '📞' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: CP.bg, fontFamily: 'inherit' }}>
      {/* Top header bar */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="/logo-immobilientool.svg" alt="Immobilientool" style={{ height: 36, background: '#fff', borderRadius: 8, padding: '4px 8px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Willkommen, {vorname}</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
            {customer.rolle} · {prop ? `${prop.name}, ${prop.strasse}` : 'Liegenschaft wird geladen …'}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.6 }}>
          <div>Immobilientool</div>
          <div>+41 00 000 00 00</div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${CP.border}`, display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setActiveCaseId(''); }}
            style={{ border: 'none', background: 'transparent', padding: '14px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: activeTab === tab.id ? CP.accent : CP.muted, borderBottom: activeTab === tab.id ? `3px solid ${CP.accent}` : '3px solid transparent', transition: 'all .15s' }}>
            <span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}
            {tab.id === 'meldungen' && openCases.length > 0 && (
              <span style={{ marginLeft: 7, background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{openCases.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
        {activeTab === 'home' && (
          <CPortalHome customer={customer} prop={prop} openCases={openCases} cases={cases} docs={docs} nextTerm={nextTerm} setActiveTab={setActiveTab} setActiveCaseId={setActiveCaseId} />
        )}
        {activeTab === 'meldungen' && (
          <CPortalMeldungen data={data} customer={customer} prop={prop} cases={cases} save={save} activeCaseId={activeCaseId} setActiveCaseId={setActiveCaseId} />
        )}
        {activeTab === 'dokumente' && <CPortalDokumente docs={docs} />}
        {activeTab === 'termine' && <CPortalTermine terms={terms} />}
        {activeTab === 'profil' && <CPortalProfil customer={customer} prop={prop} save={save} />}
        {activeTab === 'kontakt' && <CPortalKontakt portalContent={portalContent} />}
      </div>
    </div>
  );
}

// ── Startseite / Home ────────────────────────────────────────────────────────
function CPortalHome({ customer, prop, openCases, cases, docs, nextTerm, setActiveTab, setActiveCaseId }: any) {
  const vorname = splitPersonName(customer).vorname || personDisplayName(customer);
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)', borderRadius: 20, padding: '32px 36px', color: '#fff' }}>
        <div style={{ fontSize: 13, opacity: .7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Ihr Mieterportal</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 900, letterSpacing: '-.02em' }}>{greeting}, {vorname}!</h1>
        <p style={{ margin: 0, opacity: .8, fontSize: 15 }}>
          {prop ? `${prop.name} · ${prop.strasse}, ${prop.plz} ${prop.ort}` : 'Liegenschaft wird geladen …'}
          {customer.wohnungsNummer ? ` · Wohnung ${customer.wohnungsNummer}` : ''}
          {customer.stockwerk ? `, ${customer.stockwerk}. Stockwerk` : ''}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { label: 'Offene Meldungen', value: openCases.length, tone: openCases.length > 0 ? '#dc2626' : '#166534', bg: openCases.length > 0 ? '#fee2e2' : '#dcfce7', action: () => setActiveTab('meldungen') },
          { label: 'Meine Dokumente', value: docs.length, tone: '#1e40af', bg: '#eff6ff', action: () => setActiveTab('dokumente') },
          { label: 'Meldungen total', value: cases.length, tone: '#6b7280', bg: '#f3f4f6', action: () => setActiveTab('meldungen') },
        ].map((kpi) => (
          <button key={kpi.label} onClick={kpi.action} style={{ background: kpi.bg, border: `1px solid ${kpi.tone}30`, borderRadius: 16, padding: '20px 22px', textAlign: 'left', cursor: 'pointer', transition: 'transform .15s' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: kpi.tone, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 13, color: kpi.tone, marginTop: 6, fontWeight: 600 }}>{kpi.label}</div>
          </button>
        ))}
      </div>

      {/* Nächster Termin */}
      {nextTerm && (
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: CP.muted, marginBottom: 12 }}>Nächster Termin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: CP.accentLight, borderRadius: 12, padding: '12px 16px', textAlign: 'center', minWidth: 64 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: CP.accent }}>{new Date(nextTerm.start).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</div>
              <div style={{ fontSize: 12, color: CP.accent }}>{new Date(nextTerm.start).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: CP.text, fontSize: 16 }}>{nextTerm.titel}</div>
              <div style={{ color: CP.muted, fontSize: 13, marginTop: 3 }}>{nextTerm.ort || nextTerm.typ}</div>
            </div>
          </div>
        </div>
      )}

      {/* Letzte Meldungen preview */}
      {cases.length > 0 && (
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: CP.muted }}>Meine letzten Meldungen</div>
            <button onClick={() => setActiveTab('meldungen')} style={{ border: 'none', background: 'none', color: CP.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Alle ansehen →</button>
          </div>
          {cases.slice(0, 3).map((f: AnyRecord) => (
            <button key={f.id} onClick={() => { setActiveTab('meldungen'); setActiveCaseId(f.id); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: `1px solid ${CP.border}`, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div>
                <div style={{ fontWeight: 600, color: CP.text, fontSize: 14 }}>{f.fallNummer ? `${f.fallNummer} · ` : ''}{f.titel}</div>
                <div style={{ fontSize: 12, color: CP.muted, marginTop: 2 }}>{f.kategorie} · {deDate(f.createdAt)}</div>
              </div>
              <CPortalStatusBadge status={statusValue(f.status)} />
            </button>
          ))}
        </div>
      )}

      {/* Schnellaktionen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        <button onClick={() => setActiveTab('meldungen')} style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 14, padding: '18px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div><div style={{ fontWeight: 700, color: CP.text }}>Neue Meldung</div><div style={{ fontSize: 12, color: CP.muted, marginTop: 3 }}>Schaden oder Problem melden</div></div>
        </button>
        <button onClick={() => setActiveTab('dokumente')} style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 14, padding: '18px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <div><div style={{ fontWeight: 700, color: CP.text }}>Meine Unterlagen</div><div style={{ fontSize: 12, color: CP.muted, marginTop: 3 }}>Dokumente und Abschlüsse</div></div>
        </button>
      </div>
    </div>
  );
}

function CPortalStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    OFFEN: { label: 'Offen', color: '#b45309', bg: '#fef3c7' },
    IN_BEARBEITUNG: { label: 'In Bearbeitung', color: '#1e40af', bg: '#dbeafe' },
    OFFERTEN_EINGEHOLT: { label: 'Offerten eingeholt', color: '#6d28d9', bg: '#ede9fe' },
    HANDWERKER_BEAUFTRAGT: { label: 'Handwerker beauftragt', color: '#0e7490', bg: '#cffafe' },
    BELEG_NACHGEREICHT: { label: 'Beleg nachgereicht', color: '#0e7490', bg: '#cffafe' },
    ERLEDIGT: { label: 'Erledigt', color: '#166534', bg: '#dcfce7' },
    ARCHIVIERT: { label: 'Archiviert', color: '#6b7280', bg: '#f3f4f6' },
  };
  const s = map[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

// ── Meldungsübersicht ────────────────────────────────────────────────────────
function CPortalMeldungen({ data, customer, prop, cases, save, activeCaseId, setActiveCaseId }: any) {
  const [showNew, setShowNew] = useState(false);
  const sorted = [...cases].sort((a: AnyRecord, b: AnyRecord) =>
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  );
  const activeCase = cases.find((f: AnyRecord) => f.id === activeCaseId);

  if (activeCase) {
    return <CPortalCaseDetail fall={activeCase} data={data} customer={customer} save={save} onBack={() => setActiveCaseId('')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: CP.text }}>Meine Meldungen</h2>
          <p style={{ margin: '4px 0 0', color: CP.muted, fontSize: 14 }}>Alle Ihre Meldungen und deren aktueller Stand.</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: CP.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          + Neue Meldung
        </button>
      </div>

      {showNew && (
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 18, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CP.text }}>Neue Meldung erfassen</h3>
            <button onClick={() => setShowNew(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <CustomerMessage data={data} customer={customer} prop={prop} save={save} onDone={() => setShowNew(false)} />
        </div>
      )}

      {sorted.length === 0 && !showNew ? (
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, color: CP.text, fontSize: 16, marginBottom: 6 }}>Keine offenen Meldungen</div>
          <div style={{ color: CP.muted, fontSize: 14 }}>Wenn Sie ein Problem haben, können Sie es hier melden.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((f: AnyRecord) => {
            const msgs = data.ChatMessage.filter((m: AnyRecord) => m.schadenfallId === f.id);
            const st = statusValue(f.status);
            const isOpen = !['ERLEDIGT', 'ARCHIVIERT'].includes(st);
            return (
              <button key={f.id} onClick={() => setActiveCaseId(f.id)}
                style={{ background: CP.card, border: `1px solid ${isOpen ? '#bfdbfe' : CP.border}`, borderRadius: 16, padding: '18px 22px', textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start', transition: 'box-shadow .15s' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: CP.text }}>{f.fallNummer ? `${f.fallNummer} · ` : ''}{f.titel}</span>
                  </div>
                  <div style={{ fontSize: 13, color: CP.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>📁 {f.kategorie}</span>
                    <span>📅 {deDate(f.createdAt)}</span>
                    {msgs.length > 0 && <span>💬 {msgs.length} Nachricht{msgs.length !== 1 ? 'en' : ''}</span>}
                  </div>
                  {f.beschreibung && <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5, maxWidth: 600 }}>{String(f.beschreibung).slice(0, 120)}{f.beschreibung.length > 120 ? '…' : ''}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <CPortalStatusBadge status={st} />
                  <span style={{ fontSize: 12, color: CP.muted }}>Details →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CPortalCaseDetail({ fall, data, customer, save, onBack }: any) {
  const msgs = (data.ChatMessage ?? [])
    .filter((m: AnyRecord) => m.schadenfallId === fall.id)
    .sort((a: AnyRecord, b: AnyRecord) => String(a.zeitstempel ?? a.createdAt ?? '').localeCompare(String(b.zeitstempel ?? b.createdAt ?? '')));
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);

  const sendMsg = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    await save('ChatMessage', {
      id: `cm-${uid()}`,
      schadenfallId: fall.id,
      personId: customer.id,
      absender: personDisplayName(customer),
      absenderTyp: 'kunde',
      nachricht: newMsg.trim(),
      zeitstempel: nowIso(),
    });
    setNewMsg('');
    setSending(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={onBack} style={{ border: 'none', background: 'none', color: CP.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left', padding: 0 }}>← Zurück zur Übersicht</button>

      {/* Case header */}
      <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 18, padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: CP.muted, marginBottom: 4, fontWeight: 700 }}>{fall.fallNummer || 'Meldung'}</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: CP.text }}>{fall.titel}</h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: CP.muted, flexWrap: 'wrap' }}>
              <span>📁 {fall.kategorie}</span>
              <span>📅 Gemeldet {deDate(fall.createdAt)}</span>
              {fall.prioritaet && <span>🔺 {fall.prioritaet}</span>}
            </div>
          </div>
          <CPortalStatusBadge status={statusValue(fall.status)} />
        </div>
        {fall.beschreibung && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 14, color: CP.text, lineHeight: 1.6 }}>
            {fall.beschreibung}
          </div>
        )}
      </div>

      {/* Timeline / Chat */}
      <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 18, padding: '22px 26px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: CP.text }}>Verlauf & Kommunikation</h3>

        {msgs.length === 0 ? (
          <p style={{ color: CP.muted, fontSize: 14, margin: '0 0 20px' }}>Noch keine Nachrichten. Schreiben Sie uns bei Fragen.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 400, overflowY: 'auto' }}>
            {msgs.map((m: AnyRecord) => {
              const isCustomer = m.absenderTyp === 'kunde' || m.personId === customer.id;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: isCustomer ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: isCustomer ? CP.accent : '#475569', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {initials(m.absender)}
                  </div>
                  <div style={{ maxWidth: '72%' }}>
                    <div style={{ fontSize: 11, color: CP.muted, marginBottom: 4, textAlign: isCustomer ? 'right' : 'left' }}>
                      {m.absender} · {deDate(m.zeitstempel ?? m.createdAt)}
                    </div>
                    <div style={{ background: isCustomer ? CP.accent : '#f1f5f9', color: isCustomer ? '#fff' : CP.text, borderRadius: isCustomer ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: 14, lineHeight: 1.5 }}>
                      {m.nachricht}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply box */}
        <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${CP.border}`, paddingTop: 16 }}>
          <textarea value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Nachricht schreiben …" rows={2}
            style={{ flex: 1, border: `1px solid ${CP.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, resize: 'none', fontFamily: 'inherit' }} />
          <button onClick={sendMsg} disabled={!newMsg.trim() || sending}
            style={{ background: CP.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '0 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: newMsg.trim() ? 1 : 0.5 }}>
            {sending ? '…' : 'Senden'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dokumente ────────────────────────────────────────────────────────────────
function CPortalDokumente({ docs }: any) {
  const grouped = (docs as AnyRecord[]).reduce((acc: Record<string, AnyRecord[]>, d: AnyRecord) => {
    const key = d.kategorie || 'Allgemein';
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: CP.text }}>Meine Dokumente</h2>
      {docs.length === 0 ? (
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: 40, textAlign: 'center', color: CP.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p>Noch keine Dokumente verfügbar. Sie werden hier angezeigt, sobald Dokumente für Sie freigegeben sind.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([kat, katDocs]: [string, AnyRecord[]]) => (
            <div key={kat} style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: CP.text }}>📁 {kat}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(katDocs as AnyRecord[]).map((d: AnyRecord) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: `1px solid ${CP.border}`, borderRadius: 12, color: CP.text }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: CP.text }}>📄 {d.titel}</div>
                      <div style={{ fontSize: 12, color: CP.muted, marginTop: 3 }}>{d.dateiname} {d.jahr ? `· ${d.jahr}` : ''}</div>
                    </div>
                    <DocOpenButton url={d.dateiUrl} titel={d.titel} label="Öffnen / ↓" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Termine ──────────────────────────────────────────────────────────────────
function CPortalTermine({ terms }: any) {
  const sorted = [...terms].sort((a: AnyRecord, b: AnyRecord) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const future = sorted.filter((t: AnyRecord) => new Date(t.start) >= new Date());
  const past = sorted.filter((t: AnyRecord) => new Date(t.start) < new Date());

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: CP.text }}>Meine Termine</h2>
      {terms.length === 0 ? (
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: 40, textAlign: 'center', color: CP.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p>Keine Termine eingetragen. Geplante Termine werden hier angezeigt.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {future.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: CP.muted, marginBottom: 12 }}>Anstehend</div>
              {future.map((t: AnyRecord) => (
                <div key={t.id} style={{ background: CP.accentLight, border: '1px solid #bfdbfe', borderRadius: 14, padding: '16px 20px', marginBottom: 10, display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', background: CP.accent, color: '#fff', borderRadius: 10, padding: '10px 6px' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{new Date(t.start).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</div>
                    <div style={{ fontSize: 11 }}>{new Date(t.start).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: CP.text, fontSize: 15 }}>{t.titel}</div>
                    {t.ort && <div style={{ fontSize: 13, color: CP.muted, marginTop: 3 }}>📍 {t.ort}</div>}
                  </div>
                  <span style={{ background: CP.accent, color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{t.typ}</span>
                </div>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: CP.muted, marginBottom: 12 }}>Vergangen</div>
              {past.map((t: AnyRecord) => (
                <div key={t.id} style={{ background: '#f8fafc', border: `1px solid ${CP.border}`, borderRadius: 12, padding: '12px 18px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: .7 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: CP.text, fontSize: 14 }}>{t.titel}</div>
                    <div style={{ fontSize: 12, color: CP.muted }}>{new Date(t.start).toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <span style={{ background: '#e2e8f0', color: '#475569', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>{t.typ}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Profil ───────────────────────────────────────────────────────────────────
function CPortalProfil({ customer, prop, save }: any) {
  const [draft, setDraft] = useState({ feld: '', neuerWert: '' });
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!draft.feld || !draft.neuerWert.trim()) return;
    await save('StammdatenAenderung', {
      id: `chg-${uid()}`,
      personId: customer.id,
      feld: draft.feld,
      alterWert: String((customer as any)[draft.feld] ?? ''),
      neuerWert: draft.neuerWert.trim(),
      status: 'Offen',
      eingereichtVon: personDisplayName(customer),
    });
    setSent(true);
    setDraft({ feld: '', neuerWert: '' });
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: CP.text }}>Mein Profil</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Current data */}
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: CP.text }}>Ihre Daten</h3>
          {[
            ['Name', personDisplayName(customer)],
            ['Rolle', customer.rolle],
            ['E-Mail', customer.email],
            ['Telefon', customer.telefon || '—'],
            ['Adresse', customer.adresse || '—'],
            ['Wohnung', customer.wohnungsNummer || '—'],
            ['Stockwerk', customer.stockwerk || '—'],
            ['Liegenschaft', prop?.name || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${CP.border}`, fontSize: 14 }}>
              <span style={{ color: CP.muted, fontWeight: 600 }}>{label}</span>
              <span style={{ color: CP.text, fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Change request */}
        <div style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: CP.text }}>Änderung beantragen</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: CP.muted, lineHeight: 1.6 }}>Änderungen werden von unserem Team geprüft und nach Bestätigung übernommen.</p>
          {sent && <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 14 }}>✓ Ihr Änderungswunsch wurde übermittelt.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: CP.muted, fontWeight: 700 }}>Was möchten Sie ändern?
              <select value={draft.feld} onChange={(e) => setDraft({ ...draft, feld: e.target.value })} style={{ border: `1px solid ${CP.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#fff' }}>
                <option value="">— Feld wählen —</option>
                <option value="email">E-Mail Adresse</option>
                <option value="telefon">Telefonnummer</option>
                <option value="adresse">Adresse</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: CP.muted, fontWeight: 700 }}>Neuer Wert
              <input value={draft.neuerWert} onChange={(e) => setDraft({ ...draft, neuerWert: e.target.value })} style={{ border: `1px solid ${CP.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#fff' }} />
            </label>
            <button onClick={submit} disabled={!draft.feld || !draft.neuerWert.trim()} style={{ background: CP.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', opacity: draft.feld && draft.neuerWert.trim() ? 1 : 0.5 }}>
              Änderung einreichen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kontakt ──────────────────────────────────────────────────────────────────
function CPortalKontakt({ portalContent }: any) {
  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: CP.text }}>Kontakt & Informationen</h2>

      {/* Portal Contact Card */}
      <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', borderRadius: 18, padding: '28px 32px', color: '#fff', marginBottom: 24 }}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Immobilientool</div>
        <div style={{ opacity: .85, fontSize: 14, marginBottom: 18 }}>Wir sind für Sie da – zögern Sie nicht, uns zu kontaktieren.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {[
            { icon: '📍', label: 'Adresse', value: 'Musterstrasse 1, 4000 Basel' },
            { icon: '📞', label: 'Telefon', value: '+41 00 000 00 00' },
            { icon: '✉️', label: 'E-Mail', value: 'info@example.invalid' },
            { icon: '🕐', label: 'Bürozeiten', value: 'Mo–Fr 08:00–17:00 Uhr' },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 11, opacity: .7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PortalInhalt content */}
      {portalContent.filter((x: AnyRecord) => x.sichtbar).map((item: AnyRecord) => (
        <div key={item.id} style={{ background: CP.card, border: `1px solid ${CP.border}`, borderRadius: 14, padding: '18px 22px', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: CP.text, fontSize: 15, marginBottom: 6 }}>{item.titel}</div>
          <div style={{ color: CP.muted, fontSize: 14, lineHeight: 1.6 }}>{item.inhalt}</div>
        </div>
      ))}
    </div>
  );
}

function CustomerMessage({ data, customer, prop, save, onDone }: any) {
  const [draft, setDraft] = useState({
    titel: '',
    beschreibung: '',
    prioritaet: 'Normal',
    kategorie: 'Allgemeine Meldung',
    mietobjekt: '',
    stockwerk: '',
    schadensort: '',
    zugangMoeglich: 'Ja',
    wieEntstanden: '',
    bemerkung: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const requiredFields = ['titel', 'beschreibung'];
  const kategorieOptions = ['Allgemeine Meldung', 'Heizung', 'Wasser', 'Sanitär', 'Elektrik', 'Schimmel', 'Fenster', 'Schlüssel', 'Unterlagen', 'Sonstiges'];
  const prioritaetOptions = ['Dringend', 'Hoch', 'Normal', 'Niedrig'];

  const getFieldError = (key: string): string => {
    const value = String(draft[key as keyof typeof draft] ?? '').trim();
    if (requiredFields.includes(key) && !value) {
      return key === 'titel' ? 'Bitte einen Titel angeben.' : 'Bitte eine Beschreibung angeben.';
    }
    return '';
  };

  const errors = requiredFields.reduce((acc: Record<string, string>, key) => {
    const error = getFieldError(key);
    if (error) acc[key] = error;
    return acc;
  }, {});
  const isFormValid = requiredFields.every((key) => !getFieldError(key));
  const showFieldError = (key: string) => (submitAttempted || touched[key]) && !!errors[key];
  const updateDraft = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const markTouched = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!isFormValid) { setSaveStatus('Bitte füllen Sie alle Pflichtfelder aus.'); return; }
    try {
      setSaveStatus('Meldung wird gespeichert...');
      await save('Schadenfall', {
        id: `f-${uid()}`,
        fallNummer: nextCaseNumber(data),
        titel: draft.titel.trim(),
        beschreibung: draft.beschreibung.trim(),
        status: 'OFFEN',
        prioritaet: draft.prioritaet,
        kategorie: draft.kategorie,
        liegenschaftId: prop?.id,
        personId: customer.id,
        liegenschaftAdresse: prop?.strasse ?? '',
        plzOrt: `${prop?.plz ?? ''} ${prop?.ort ?? ''}`,
        gemeldetVon: personDisplayName(customer),
        mietobjekt: draft.mietobjekt.trim() || undefined,
        stockwerk: draft.stockwerk.trim() || undefined,
        schadensort: draft.schadensort.trim() || undefined,
        zugangMoeglich: draft.zugangMoeglich,
        wieEntstanden: draft.wieEntstanden.trim() || undefined,
        bemerkung: draft.bemerkung.trim() || undefined,
        createdAt: nowIso(),
      });
      setSaveStatus('✓ Meldung erfolgreich eingereicht. Wir kümmern uns darum!');
      setDraft({ titel: '', beschreibung: '', prioritaet: 'Normal', kategorie: 'Allgemeine Meldung', mietobjekt: '', stockwerk: '', schadensort: '', zugangMoeglich: 'Ja', wieEntstanden: '', bemerkung: '' });
      setTouched({});
      setSubmitAttempted(false);
      setTimeout(() => { setSaveStatus(''); onDone?.(); }, 3000);
    } catch (error) {
      setSaveStatus('Fehler beim Speichern. Bitte versuchen Sie es später erneut.');
    }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${CP.border}`, borderRadius: 10, background: '#fff', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  const errInp: React.CSSProperties = { ...inp, borderColor: '#dc2626', background: '#fff5f5' };

  return (
    <div>
      {saveStatus && (
        <div style={{ marginBottom: 16, background: saveStatus.includes('erfolgreich') ? '#dcfce7' : '#fee2e2', border: `1px solid ${saveStatus.includes('erfolgreich') ? '#bbf7d0' : '#fecdd3'}`, color: saveStatus.includes('erfolgreich') ? '#15803d' : '#991b1b', borderRadius: 10, padding: 12, fontSize: 13 }}>
          {saveStatus}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>Titel <span style={{ color: '#dc2626' }}>*</span></label>
          <input type="text" value={draft.titel} onChange={(e) => updateDraft('titel', e.target.value)} onBlur={() => markTouched('titel')} style={showFieldError('titel') ? errInp : inp} />
          {showFieldError('titel') && <div style={{ marginTop: 4, fontSize: 12, color: '#dc2626' }}>{errors.titel}</div>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>Kategorie</label>
          <select value={draft.kategorie} onChange={(e) => updateDraft('kategorie', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            {kategorieOptions.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>Dringlichkeit</label>
          <select value={draft.prioritaet} onChange={(e) => updateDraft('prioritaet', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            {prioritaetOptions.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>Beschreibung <span style={{ color: '#dc2626' }}>*</span></label>
        <textarea value={draft.beschreibung} onChange={(e) => updateDraft('beschreibung', e.target.value)} onBlur={() => markTouched('beschreibung')} rows={4} style={{ ...(showFieldError('beschreibung') ? errInp : inp), minHeight: 100, resize: 'vertical' }} placeholder="Was ist passiert? Wo befindet sich das Problem?" />
        {showFieldError('beschreibung') && <div style={{ marginTop: 4, fontSize: 12, color: '#dc2626' }}>{errors.beschreibung}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
        {[['schadensort', 'Schadensort'], ['mietobjekt', 'Mietobjekt / Einheit'], ['stockwerk', 'Stockwerk']].map(([key, label]) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>{label}</label>
            <input value={draft[key as keyof typeof draft]} onChange={(e) => updateDraft(key, e.target.value)} style={inp} />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>Zugang möglich?</label>
          <select value={draft.zugangMoeglich} onChange={(e) => updateDraft('zugangMoeglich', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option>Ja</option><option>Nein</option><option>Nach Absprache</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={handleSubmit} style={{ background: CP.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '13px 28px', fontWeight: 800, cursor: 'pointer', fontSize: 15, opacity: isFormValid ? 1 : .7 }}>
          ✓ Meldung einreichen
        </button>
      </div>
    </div>
  );
}

// ─── Geräte (stored as Dokument with kategorie='Gerät') ─────────────────────
// ─── Inserate ────────────────────────────────────────────────────────────────

// ─── Statistiken ─────────────────────────────────────────────────────────────

function StatistikenView({ data }: any) {
  const faelle = data.Schadenfall as AnyRecord[];
  const liegenschaften = (data.Liegenschaft as AnyRecord[]).filter(l => !['Archiviert','Gelöscht'].includes(l.status ?? ''));
  const personen = data.KontaktPerson as AnyRecord[];
  const handwerker = (data.Handwerker as AnyRecord[]).filter(h => h.status !== 'Archiviert');

  // Leerstand
  const aktivPersonen = personen.filter(p => !['Archiviert','Gelöscht','Nicht eingeladen'].includes(p.kontoStatus ?? '') && !String(p.name ?? '').startsWith('[GELÖSCHT]'));
  const gesamtEinheiten = liegenschaften.reduce((s: number, l: AnyRecord) => s + Number(l.einheiten ?? 1), 0);
  const belegteEinheiten = aktivPersonen.filter(p => p.rolle === 'Mieter').length;
  const leerstandRate = gesamtEinheiten > 0 ? Math.max(0, Math.round((1 - belegteEinheiten / gesamtEinheiten) * 100)) : 0;

  // Fälle
  const offeneFaelle = faelle.filter(f => ['OFFEN','IN_BEARBEITUNG','OFFERTEN_EINGEHOLT','HANDWERKER_BEAUFTRAGT','BELEG_NACHGEREICHT'].includes(statusValue(f.status)));
  const erledigteFaelle = faelle.filter(f => statusValue(f.status) === 'ERLEDIGT');
  const kategorien = CASE_CATEGORY_OPTIONS.map(kat => ({
    kat, count: faelle.filter(f => f.kategorie === kat).length,
  })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);

  // Handwerker-Auslastung
  const hwAuslastung = handwerker.map((h: AnyRecord) => ({
    name: h.firma, aktiv: faelle.filter(f => f.handwerkerId === h.id && !['ERLEDIGT','ARCHIVIERT'].includes(statusValue(f.status))).length,
    gesamt: faelle.filter(f => f.handwerkerId === h.id).length,
  })).filter(h => h.gesamt > 0).sort((a, b) => b.aktiv - a.aktiv);

  // Monatlicher Trend (dieses Jahr)
  const year = new Date().getFullYear();
  const monats = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return {
      label: new Date(year, i, 1).toLocaleDateString('de-CH', { month: 'short' }),
      count: faelle.filter(f => String(f.createdAt ?? '').startsWith(`${year}-${m}`)).length,
    };
  });
  const maxMonat = Math.max(1, ...monats.map(m => m.count));

  const KPI = ({ label, value, sub, tone }: any) => (
    <div className={`metric ${tone ?? ''}`} style={{ minHeight: 0 }}>
      <span>{label}</span>
      <strong style={{ fontSize: 28 }}>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
    </div>
  );

  return (
    <div>
      <Title title="Statistiken & Auslastung" sub="Übersicht über Leerstand, Meldungen, Handwerker und Trends." actions={
        <div style={{ position: 'relative' }}>
          <KIFlyout label="✦ KI-Analyse" systemPrompt="Du analysierst Immobilienverwaltungs-Daten und gibst Handlungsempfehlungen." kontext={`Liegenschaften: ${(data.Liegenschaft ?? []).length}. Schadensfälle gesamt: ${(data.Schadenfall ?? []).length}, offen: ${(data.Schadenfall ?? []).filter((f: AnyRecord) => f.status === 'OFFEN').length}. Handwerker: ${(data.Handwerker ?? []).length}. Mitarbeiter: ${(data.Mitarbeiter ?? []).length}.`} schnellstarts={['Trends analysieren', 'Welche Liegenschaft hat die meisten Probleme?', 'Handwerker-Auslastung bewerten', 'Optimierungspotenzial finden']} />
        </div>
      } />

      {/* KPI-Zeile */}
      <div className="kpis compact" style={{ gridTemplateColumns: 'repeat(6,1fr)', margin: '0 32px 24px' }}>
        <KPI label="Liegenschaften" value={liegenschaften.length} sub="aktiv" />
        <KPI label="Leerstand" value={`${leerstandRate}%`} sub={`${gesamtEinheiten - belegteEinheiten} Einheiten frei`} tone={leerstandRate > 10 ? 'red' : 'green'} />
        <KPI label="Aktive Parteien" value={aktivPersonen.length} sub="Mieter & Eigentümer" />
        <KPI label="Offene Meldungen" value={offeneFaelle.length} tone={offeneFaelle.length > 5 ? 'red' : offeneFaelle.length > 0 ? 'orange' : 'green'} />
        <KPI label="Erledigt" value={erledigteFaelle.length} sub="gesamt" tone="green" />
        <KPI label="Handwerker" value={handwerker.length} sub="verfügbar" />
      </div>

      <div className="grid two" style={{ padding: '0 32px 32px', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Monatlicher Trend */}
        <Panel title={`Meldungen ${year} — Monatstrend`}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginBottom: 8 }}>
            {monats.map(m => (
              <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8290a7', fontWeight: 700 }}>{m.count > 0 ? m.count : ''}</span>
                <div style={{ width: '100%', background: m.count > 0 ? '#2563eb' : '#e9eef5', borderRadius: '4px 4px 0 0', height: `${Math.round((m.count / maxMonat) * 100)}%`, minHeight: m.count > 0 ? 8 : 4 }} />
                <span style={{ fontSize: 10, color: '#8290a7' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Meldungen nach Kategorie */}
        <Panel title="Meldungen nach Kategorie">
          {kategorien.length === 0 ? <p className="hint">Keine Meldungen vorhanden.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kategorien.slice(0, 8).map(({ kat, count }) => (
                <div key={kat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{kat}</span>
                    <span style={{ color: '#8290a7' }}>{count}</span>
                  </div>
                  <Bar pct={(count / faelle.length) * 100} color="#2563eb" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Leerstand pro Liegenschaft */}
        <Panel title="Belegung pro Liegenschaft">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liegenschaften.slice(0, 8).map((l: AnyRecord) => {
              const einheiten = Number(l.einheiten ?? 1);
              const belegt = personen.filter(p => p.liegenschaftId === l.id && p.rolle === 'Mieter' && !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? '')).length;
              const pct = einheiten > 0 ? Math.round((belegt / einheiten) * 100) : 0;
              return (
                <div key={l.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{l.liegenschaftNummer} · {l.name}</span>
                    <span style={{ color: pct < 80 ? '#dc2626' : '#166534', fontWeight: 700 }}>{belegt}/{einheiten} ({pct}%)</span>
                  </div>
                  <Bar pct={pct} color={pct < 80 ? '#ef4444' : '#22c55e'} />
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Handwerker-Auslastung */}
        <Panel title="Handwerker-Auslastung (aktive Fälle)">
          {hwAuslastung.length === 0 ? <p className="hint">Keine Handwerker mit Fallbezug.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hwAuslastung.slice(0, 8).map(hw => (
                <div key={hw.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{hw.name}</span>
                    <span style={{ color: '#8290a7' }}>{hw.aktiv} aktiv · {hw.gesamt} gesamt</span>
                  </div>
                  <Bar pct={hw.aktiv > 0 ? (hw.aktiv / Math.max(...hwAuslastung.map(h => h.aktiv))) * 100 : 0} color="#f59e0b" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ─── Nebenkostenabrechnung Upload ─────────────────────────────────────────────

function NebenkostenUpload({ data, property, save }: any) {
  const [personId, setPersonId] = useState('');
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  const personen = (data.KontaktPerson ?? []).filter(
    (p: AnyRecord) => p.liegenschaftId === property.id && !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? '')
  );

  const upload = async () => {
    if (!file || !personId) { setStatus('Bitte Partei und Datei wählen.'); return; }
    setUploading(true);
    setStatus('Wird hochgeladen …');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `dokumente/${property.id}/nebenkosten/${jahr}/${Date.now()}-${safeName}`;
      await uploadData({ path, data: file }).result;
      const urlResult = await getUrl({ path });
      const person = personen.find((p: AnyRecord) => p.id === personId);
      await save('Dokument', {
        id: `nk-${uid()}`,
        liegenschaftId: property.id,
        personId,
        titel: `Nebenkostenabrechnung ${jahr}`,
        kategorie: 'Nebenkostenabrechnung',
        jahr,
        dateiname: file.name,
        dateiUrl: urlResult.url.toString(),
        sichtbarFuerKunden: true,
        freigabeStatus: 'Freigegeben',
        volltext: `Nebenkostenabrechnung ${jahr} ${person ? personDisplayName(person) : ''}`,
      });
      setStatus(`✓ Abrechnung ${jahr} für ${person ? personDisplayName(person) : ''} hochgeladen und freigegeben.`);
      setFile(null);
    } catch (e: any) { setStatus(`Fehler: ${e?.message}`); }
    setUploading(false);
  };

  const bestehende = (data.Dokument ?? []).filter(
    (d: AnyRecord) => d.liegenschaftId === property.id && d.kategorie === 'Nebenkostenabrechnung'
  ).sort((a: AnyRecord, b: AnyRecord) => (b.jahr ?? 0) - (a.jahr ?? 0));

  return (
    <Panel title="📊 Nebenkostenabrechnung hochladen">
      <p className="hint" style={{ marginBottom: 14 }}>Heizkosten und Nebenkostenabrechnungen direkt der Partei zuordnen — sofort im Kundenportal sichtbar.</p>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr auto auto', alignItems: 'end', marginBottom: 14 }}>
        <label>Partei *
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            <option value="">— Person wählen —</option>
            {personen.map((p: AnyRecord) => (
              <option key={p.id} value={p.id}>{personDisplayName(p)} ({p.rolle})</option>
            ))}
          </select>
        </label>
        <label>Jahr
          <input type="number" value={jahr} onChange={e => setJahr(Number(e.target.value))} min={2000} max={2099} />
        </label>
        <label>PDF / Datei
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button className="primary" disabled={uploading || !file || !personId} onClick={upload}>
          {uploading ? 'Lädt …' : '↑ Hochladen'}
        </button>
      </div>
      {status && <p style={{ color: status.includes('Fehler') ? '#dc2626' : '#166534', fontWeight: 600, fontSize: 13 }}>{status}</p>}

      {bestehende.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a7', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Bereits hochgeladen</div>
          {bestehende.map((d: AnyRecord) => (
            <div key={d.id} className="list-row">
              <div>
                <strong>{d.titel}</strong>
                <span>{personDisplayName(personen.find((p: AnyRecord) => p.id === d.personId) ?? {})} · {d.dateiname}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge tone="green">Sichtbar</Badge>
                <DocOpenButton url={d.dateiUrl} titel={d.titel} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Interessentenverwaltung ──────────────────────────────────────────────────

function InteressentenTab({ inserat, setInserate }: { inserat: AnyRecord; setInserate: (fn: (prev: AnyRecord[]) => AnyRecord[]) => void }) {
  const STATI = ['Anfrage', 'Besichtigung geplant', 'Besichtigung erfolgt', 'Zugesagt', 'Abgesagt'];
  const [draft, setDraft] = useState({ name: '', email: '', telefon: '', notiz: '', status: 'Anfrage', datum: new Date().toISOString().slice(0, 10) });
  const interessenten: AnyRecord[] = (() => { try { return JSON.parse(inserat.interessenten ?? '[]'); } catch { return []; } })();

  const add = () => {
    if (!draft.name.trim()) return;
    const neu = [...interessenten, { id: uid(), ...draft }];
    setInserate(prev => prev.map(i => i.id === inserat.id ? { ...i, interessenten: JSON.stringify(neu) } : i));
    setDraft({ name: '', email: '', telefon: '', notiz: '', status: 'Anfrage', datum: new Date().toISOString().slice(0, 10) });
  };

  const updateStatus = (id: string, status: string) => {
    const neu = interessenten.map(x => x.id === id ? { ...x, status } : x);
    setInserate(prev => prev.map(i => i.id === inserat.id ? { ...i, interessenten: JSON.stringify(neu) } : i));
  };

  const remove = (id: string) => {
    const neu = interessenten.filter(x => x.id !== id);
    setInserate(prev => prev.map(i => i.id === inserat.id ? { ...i, interessenten: JSON.stringify(neu) } : i));
  };

  const statusTone: Record<string, string> = { 'Zugesagt': 'green', 'Abgesagt': 'red', 'Anfrage': 'orange', 'Besichtigung geplant': 'blue', 'Besichtigung erfolgt': 'blue' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <Badge>{interessenten.length} Interessenten total</Badge>
        <Badge tone="green">{interessenten.filter(x => x.status === 'Zugesagt').length} Zugesagt</Badge>
        <Badge tone="orange">{interessenten.filter(x => x.status === 'Anfrage').length} Anfragen offen</Badge>
      </div>

      {/* Neue Anfrage */}
      <div style={{ background: '#f8fafc', border: '1px solid #e9eef5', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#8290a7', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>+ Neue Anfrage erfassen</div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}>
          <label>Name *<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Vor- und Nachname" /></label>
          <label>E-Mail<input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="email@beispiel.invalid" /></label>
          <label>Telefon<input value={draft.telefon} onChange={e => setDraft({ ...draft, telefon: e.target.value })} placeholder="+41 79 …" /></label>
          <button className="primary small" disabled={!draft.name.trim()} onClick={add}>+ Hinzufügen</button>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: 'auto 1fr', marginTop: 10 }}>
          <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>{STATI.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Notiz<input value={draft.notiz} onChange={e => setDraft({ ...draft, notiz: e.target.value })} placeholder="Besondere Wünsche, Bemerkungen …" /></label>
        </div>
      </div>

      {/* Liste */}
      {interessenten.length === 0 ? (
        <p className="hint">Noch keine Interessenten erfasst.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Kontakt</th><th>Datum</th><th>Status</th><th>Notiz</th><th></th></tr></thead>
          <tbody>
            {interessenten.map((x: AnyRecord) => (
              <tr key={x.id}>
                <td><strong>{x.name}</strong></td>
                <td>
                  {x.email && <a href={`mailto:${x.email}`} style={{ color: '#2563eb', display: 'block', fontSize: 12 }}>{x.email}</a>}
                  {x.telefon && <a href={`tel:${x.telefon}`} style={{ color: '#2563eb', fontSize: 12 }}>{x.telefon}</a>}
                </td>
                <td style={{ fontSize: 12, color: '#8290a7' }}>{x.datum}</td>
                <td>
                  <select value={x.status} onChange={e => updateStatus(x.id, e.target.value)}
                    style={{ border: '1px solid #ddd6cc', borderRadius: 8, padding: '4px 8px', fontSize: 12, background: '#fff' }}>
                    {STATI.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ fontSize: 12, color: '#8290a7', maxWidth: 200 }}>{x.notiz}</td>
                <td><button className="small danger" onClick={() => remove(x.id)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Übergabeprotokoll ────────────────────────────────────────────────────────

const RAEUME = ['Eingang / Flur', 'Wohnzimmer', 'Küche', 'Bad / WC', 'Schlafzimmer 1', 'Schlafzimmer 2', 'Kinderzimmer', 'Balkon / Terrasse', 'Keller / Estrich', 'Garage'];
const ZUSTAENDE = ['Gut', 'Kleinere Mängel', 'Renovationsbedarf', 'Stark beschädigt'];

// ─── OpenImmo XML Generator ───────────────────────────────────────────────────

function generiereOpenImmoXml(inserat: AnyRecord): string {
  const esc = (s: string | number | undefined | null) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const adressParts = String(inserat.adresse ?? '').split(',');
  const strasse = esc(adressParts[0]?.trim());
  const ortParts = (adressParts[1] ?? '').trim().split(' ');
  const plz = esc(ortParts[0] ?? '');
  const ort = esc(ortParts.slice(1).join(' ') || adressParts[2]?.trim() || '');

  const ausstattung = (inserat.ausstattung ?? []) as string[];
  const hatBalkon = ausstattung.includes('Balkon') ? '<balkon>true</balkon>' : '';
  const hatGarten = ausstattung.includes('Garten') ? '<gartennutzung>true</gartennutzung>' : '';
  const hatLift = ausstattung.includes('Lift') ? '<fahrstuhl>PERSONEN</fahrstuhl>' : '';
  const hatParkplatz = ausstattung.includes('Garage') || ausstattung.includes('Parkplatz') ? '<anzahl_stellplaetze>1</anzahl_stellplaetze>' : '';

  const now = new Date().toISOString().slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<openimmo>
  <uebertragung art="VOLLABGLEICH" umfang="OBJEKT" modus="NEW" version="1.2.7"/>
  <anbieter>
    <anbieter_id>IMMOBILIENTOOL_IMMOBILIEN</anbieter_id>
    <firma>Immobilientool</firma>
    <strasse>Musterstrasse 1</strasse>
    <plz>4001</plz>
    <ort>Basel</ort>
    <land iso_land="CHE"/>
    <telefon>+41000000000</telefon>
    <email>info@example.invalid</email>
    <immobilie>
      <verwaltung_techn>
        <objektnr_intern>${esc(inserat.id)}</objektnr_intern>
        <aktion aktionart="CHANGE"/>
        <stand_vom>${esc(now)}</stand_vom>
      </verwaltung_techn>
      <verwaltung_objekt>
        <object_show_address>1</object_show_address>
        <verfuegbar_ab>${esc(inserat.verfuegbarAb ?? '')}</verfuegbar_ab>
      </verwaltung_objekt>
      <objektkategorie>
        <nutzungsart WOHNEN="true"/>
        <vermarktungsart MIETE="true"/>
        <objektart>
          <wohnung wohnungtyp="ETAGENWOHNUNG"/>
        </objektart>
      </objektkategorie>
      <geo>
        <strasse>${strasse}</strasse>
        <plz>${plz}</plz>
        <ort>${ort}</ort>
        <land iso_land="CHE"/>
      </geo>
      <preise>
        <nettokaltmiete>${esc(inserat.miete ?? 0)}</nettokaltmiete>
        <nebenkosten>${esc(inserat.nebenkosten ?? 0)}</nebenkosten>
        <waehrung iso_waehrung="CHF"/>
      </preise>
      <flaechen>
        <wohnflaeche>${esc(inserat.flaeche ?? '')}</wohnflaeche>
        <anzahl_zimmer>${esc(inserat.zimmer ?? '')}</anzahl_zimmer>
      </flaechen>
      <ausstattung>
        ${hatBalkon}
        ${hatGarten}
        ${hatLift}
        ${hatParkplatz}
      </ausstattung>
      <freitexte>
        <objekttitel>${esc(inserat.adresse ?? inserat.id)}</objekttitel>
        <ausstatt_beschr>${esc(inserat.beschreibung ?? '')}</ausstatt_beschr>
        <lage>${esc(`${strasse}, ${plz} ${ort}`)}</lage>
      </freitexte>
      <kontaktperson>
        <name>Immobilientool</name>
        <vorname>Team</vorname>
        <anrede>Firma</anrede>
        <tel_durchw>+41000000000</tel_durchw>
        <email_direkt>info@example.invalid</email_direkt>
      </kontaktperson>
    </immobilie>
  </anbieter>
</openimmo>`;
}

function FtpKonfigSection({ inserat }: { inserat: AnyRecord }) {
  const CONFIG_KEY = 'portal:ftp:newhome';
  const [cfg, setCfg] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}'); } catch { return {}; }
  });
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showXml, setShowXml] = useState(false);
  const [showConfig, setShowConfig] = useState(!cfg.host);

  const xml = generiereOpenImmoXml(inserat);
  const zipName = `portal_${String(inserat.id).slice(0, 8)}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`;

  const save = () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    setShowConfig(false);
  };

  const herunterladen = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    downloadBlob(blob, zipName.replace('.zip', '.xml'));
  };

  const upload = async () => {
    if (!cfg.host || !cfg.user || !cfg.password) {
      setResult({ ok: false, message: 'Bitte FTP-Zugangsdaten konfigurieren.' });
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const res = await ftpUploadInserat({
        xmlContent: xml,
        zipFileName: zipName,
        ftpHost: cfg.host,
        ftpPort: cfg.port ? Number(cfg.port) : 21,
        ftpUser: cfg.user,
        ftpPassword: cfg.password,
        ftpRemotePath: cfg.path || '/',
        ftpSecure: cfg.secure === 'true',
      });
      setResult(res ?? { ok: false, message: 'Keine Antwort vom Server.' });
    } catch (e: any) {
      setResult({ ok: false, message: e?.message ?? 'Unbekannter Fehler.' });
    }
    setUploading(false);
  };

  return (
    <div className="ftp-section">
      <div className="ftp-header">
        <div>
          <strong>🏡 NewHome.ch — FTP-Upload</strong>
          <span>OpenImmo XML → ZIP → FTP-Server</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="small" onClick={() => setShowConfig(s => !s)}>⚙ FTP einrichten</button>
          <button className="small" onClick={() => setShowXml(s => !s)}>XML Vorschau</button>
          <button className="small" onClick={herunterladen}>⬇ XML herunterladen</button>
          <button className="primary small" disabled={uploading} onClick={upload}>
            {uploading ? '⏳ Wird hochgeladen …' : '↑ Jetzt via FTP hochladen'}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ margin: '10px 0', padding: '10px 14px', background: result.ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${result.ok ? '#bbf7d0' : '#fecdd3'}`, borderRadius: 10, fontSize: 13, color: result.ok ? '#166534' : '#991b1b' }}>
          {result.ok ? '✓' : '✗'} {result.message}
        </div>
      )}

      {showConfig && (
        <div className="ftp-config-grid">
          <div className="ftp-config-info">
            <strong>Wo finde ich die FTP-Zugangsdaten?</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, lineHeight: 1.7, color: '#6f7b8e' }}>
              <li>Auf <a href="https://www.newhome.ch/de/mein-newhome" target="_blank" rel="noreferrer">newhome.ch/mein-newhome</a> einloggen</li>
              <li>Service → Import-Schnittstelle einrichten</li>
              <li>Format: OpenImmo wählen</li>
              <li>FTP-Zugangsdaten werden per E-Mail zugestellt</li>
            </ol>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>FTP-Server (Host) *
              <input value={cfg.host ?? ''} onChange={e => setCfg({ ...cfg, host: e.target.value })} placeholder="ftp.newhome.ch" />
            </label>
            <label>Port
              <input type="number" value={cfg.port ?? '21'} onChange={e => setCfg({ ...cfg, port: e.target.value })} placeholder="21" />
            </label>
            <label>Benutzername *
              <input value={cfg.user ?? ''} onChange={e => setCfg({ ...cfg, user: e.target.value })} placeholder="FTP-Benutzername" />
            </label>
            <label>Passwort *
              <input type="password" value={cfg.password ?? ''} onChange={e => setCfg({ ...cfg, password: e.target.value })} placeholder="FTP-Passwort" />
            </label>
            <label>Remote-Pfad
              <input value={cfg.path ?? '/'} onChange={e => setCfg({ ...cfg, path: e.target.value })} placeholder="/import/" />
            </label>
            <label>FTPS (verschlüsselt)
              <select value={cfg.secure ?? 'false'} onChange={e => setCfg({ ...cfg, secure: e.target.value })}>
                <option value="false">Nein (FTP)</option>
                <option value="true">Ja (FTPS)</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button onClick={() => setShowConfig(false)}>Abbrechen</button>
            <button className="primary" onClick={save}>Zugangsdaten speichern</button>
          </div>
        </div>
      )}

      {showXml && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#8290a7', fontWeight: 700, marginBottom: 6 }}>OpenImmo XML — {zipName}</div>
          <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 11, overflow: 'auto', maxHeight: 300, lineHeight: 1.5, margin: 0 }}>
            {xml}
          </pre>
        </div>
      )}
    </div>
  );
}

const INSERAT_STATUS_OPTIONS = ['Verfügbar', 'Reserviert', 'Vermietet', 'Archiviert'];
const INSERAT_TYP_OPTIONS = ['Wohnung', 'Zimmer', 'Einfamilienhaus', 'Gewerbe', 'Garage / Parkplatz', 'Sonstiges'];
const INSERAT_AUSSTATTUNG = ['Balkon', 'Terrasse', 'Garten', 'Keller', 'Estrich', 'Waschküche', 'Lift', 'Parkplatz', 'Garage', 'Haustiere erlaubt', 'Möbliert', 'Neuwertig'];

// ─── Immobilienplattformen Schweiz ───────────────────────────────────────────

interface Plattform {
  id: string;
  name: string;
  url: string;
  uploadUrl: string;
  logo: string;
  farbe: string;
  beschreibung: string;
  verbindungsTyp: 'apiKey' | 'login' | 'manuell';
  apiDoku: string;
  felder: { key: string; label: string; placeholder: string }[];
}

const INSERAT_PLATTFORMEN: Plattform[] = [
  {
    id: 'newhome',
    name: 'NewHome.ch',
    url: 'https://www.newhome.ch',
    uploadUrl: 'https://www.newhome.ch/de/mein-newhome/inserate',
    logo: '🏡',
    farbe: '#e8622e',
    beschreibung: 'Grösste Schweizer Immobilienplattform. API-Integration über Partner-Zugang.',
    verbindungsTyp: 'apiKey',
    apiDoku: 'https://www.newhome.ch/de/partner',
    felder: [
      { key: 'apiKey', label: 'API-Schlüssel', placeholder: 'nh_live_...' },
      { key: 'partnerId', label: 'Partner-ID', placeholder: 'P-12345' },
    ],
  },
  {
    id: 'homegate',
    name: 'Homegate.ch',
    url: 'https://www.homegate.ch',
    uploadUrl: 'https://partner.homegate.ch',
    logo: '🔑',
    farbe: '#0073e6',
    beschreibung: 'Scout24 Plattform. Zugang via ImmoScout24-Partner-API (REST/JSON).',
    verbindungsTyp: 'apiKey',
    apiDoku: 'https://developer.scout24.ch',
    felder: [
      { key: 'apiKey', label: 'API-Key (Scout24)', placeholder: 'sk_live_...' },
      { key: 'kundenNr', label: 'Kundennummer', placeholder: '1234567' },
    ],
  },
  {
    id: 'immoscout',
    name: 'ImmoScout24.ch',
    url: 'https://www.immoscout24.ch',
    uploadUrl: 'https://partner.immoscout24.ch',
    logo: '🔍',
    farbe: '#e42f2f',
    beschreibung: 'Scout24 Plattform. Gleicher API-Zugang wie Homegate (Scout24-Partner-API).',
    verbindungsTyp: 'apiKey',
    apiDoku: 'https://developer.scout24.ch',
    felder: [
      { key: 'apiKey', label: 'API-Key (Scout24)', placeholder: 'sk_live_...' },
      { key: 'kundenNr', label: 'Kundennummer', placeholder: '1234567' },
    ],
  },
  {
    id: 'flatfox',
    name: 'Flatfox.ch',
    url: 'https://flatfox.ch',
    uploadUrl: 'https://flatfox.ch/de/dashboard',
    logo: '🦊',
    farbe: '#ff6600',
    beschreibung: 'Auf Vermietung spezialisiert. Direkte API-Integration oder manueller Upload.',
    verbindungsTyp: 'login',
    apiDoku: 'https://flatfox.ch/de/api-info',
    felder: [
      { key: 'email', label: 'E-Mail (Flatfox-Login)', placeholder: 'info@example.invalid' },
      { key: 'apiToken', label: 'API-Token', placeholder: 'Token aus Einstellungen → API' },
    ],
  },
  {
    id: 'anibis',
    name: 'Anibis.ch',
    url: 'https://anibis.ch',
    uploadUrl: 'https://www.anibis.ch/de/my-anibis/ads',
    logo: '📋',
    farbe: '#009900',
    beschreibung: 'Kostenlose Inserate. Kein API — manueller Upload mit Export-Datei.',
    verbindungsTyp: 'manuell',
    apiDoku: '',
    felder: [],
  },
];

function ladePlattformConfig(platformId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`portal:plattform:${platformId}`) ?? '{}'); } catch { return {}; }
}
function speicherePlattformConfig(platformId: string, config: Record<string, string>) {
  localStorage.setItem(`portal:plattform:${platformId}`, JSON.stringify(config));
}
function istPlattformVerbunden(platformId: string): boolean {
  const cfg = ladePlattformConfig(platformId);
  return Object.values(cfg).some(v => v.trim().length > 0);
}

function generiereInseratExport(inserat: AnyRecord, plattform: Plattform): string {
  const obj = {
    plattform: plattform.name,
    format: 'OpenImmo-JSON/v1',
    erstellt: new Date().toISOString(),
    inserat: {
      titel: inserat.adresse || 'Inserat',
      typ: inserat.typ || 'Wohnung',
      status: inserat.status || 'Verfügbar',
      adresse: inserat.adresse || '',
      zimmer: inserat.zimmer || null,
      flaeche_m2: inserat.flaeche || null,
      miete_chf: inserat.miete || null,
      nebenkosten_chf: inserat.nebenkosten || null,
      verfuegbar_ab: inserat.verfuegbarAb || null,
      beschreibung: inserat.beschreibung || '',
      ausstattung: inserat.ausstattung || [],
      bilder_anzahl: (inserat.bilder ?? []).length,
      kontakt: {
        firma: 'Immobilientool',
        strasse: 'Musterstrasse 1',
        plz: '4001',
        ort: 'Basel',
        telefon: '+41 00 000 00 00',
        email: 'info@example.invalid',
      },
    },
    api_config: ladePlattformConfig(plattform.id),
  };
  return JSON.stringify(obj, null, 2);
}

function PlattformSektion({ inserat, setInserate }: { inserat: AnyRecord; setInserate: (fn: (prev: AnyRecord[]) => AnyRecord[]) => void }) {
  const [verbindeModal, setVerbindeModal] = useState<Plattform | null>(null);
  const [exportModal, setExportModal] = useState<Plattform | null>(null);
  const [, forceUpdate] = useState(0);

  const plattformenStatus: Record<string, string> = (() => {
    try { return JSON.parse(inserat.plattformenStatus ?? '{}'); } catch { return {}; }
  })();

  const setPlattformStatus = (platformId: string, status: string) => {
    const neu = { ...plattformenStatus, [platformId]: status };
    setInserate(prev => prev.map(i => i.id === inserat.id ? { ...i, plattformenStatus: JSON.stringify(neu) } : i));
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12, color: '#8290a7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
        🌐 Plattformen — Schweizer Immobilienportale
      </div>
      <div className="plattform-grid">
        {INSERAT_PLATTFORMEN.map(p => {
          const verbunden = istPlattformVerbunden(p.id);
          const status = plattformenStatus[p.id];
          return (
            <div key={p.id} className="plattform-card">
              <div className="plattform-card-header" style={{ borderLeft: `4px solid ${p.farbe}` }}>
                <span style={{ fontSize: 22 }}>{p.logo}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14, color: '#172033' }}>{p.name}</strong>
                  <div style={{ marginTop: 2 }}>
                    {status === 'veröffentlicht' ? (
                      <span className="badge green">✓ Veröffentlicht</span>
                    ) : status === 'fehler' ? (
                      <span className="badge red">⚠ Fehler</span>
                    ) : verbunden ? (
                      <span className="badge blue">Verbunden</span>
                    ) : (
                      <span className="badge orange">Nicht verbunden</span>
                    )}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#8290a7', margin: '8px 0', lineHeight: 1.4 }}>{p.beschreibung}</p>
              <div className="plattform-card-actions">
                <button className="small" onClick={() => setVerbindeModal(p)}>
                  {verbunden ? '⚙ Konfigurieren' : '🔗 Verbinden'}
                </button>
                <button className="small primary" disabled={!verbunden && p.verbindungsTyp !== 'manuell'}
                  onClick={() => setExportModal(p)}>
                  {p.verbindungsTyp === 'manuell' ? '↓ Export' : '↑ Veröffentlichen'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {verbindeModal && (
        <PlattformVerbindenModal
          plattform={verbindeModal}
          onClose={() => { setVerbindeModal(null); forceUpdate(n => n + 1); }}
        />
      )}

      {exportModal && (
        <PlattformExportModal
          plattform={exportModal}
          inserat={inserat}
          onClose={() => setExportModal(null)}
          onVeroeffentlicht={() => {
            setPlattformStatus(exportModal.id, 'veröffentlicht');
            setExportModal(null);
          }}
        />
      )}
    </div>
  );
}

function PlattformVerbindenModal({ plattform, onClose }: { plattform: Plattform; onClose: () => void }) {
  const [config, setConfig] = useState<Record<string, string>>(() => ladePlattformConfig(plattform.id));
  const [gespeichert, setGespeichert] = useState(false);

  const speichern = () => {
    speicherePlattformConfig(plattform.id, config);
    setGespeichert(true);
    setTimeout(onClose, 800);
  };

  const loeschen = () => {
    speicherePlattformConfig(plattform.id, {});
    onClose();
  };

  return (
    <Modal title={`${plattform.logo} ${plattform.name} verbinden`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#1e40af' }}>
          <strong>Zugang einrichten:</strong> Die Zugangsdaten werden lokal in Ihrem Browser gespeichert und nie an Dritte übertragen.
          {plattform.apiDoku && (
            <> · <a href={plattform.apiDoku} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>API-Dokumentation öffnen →</a></>
          )}
        </div>

        {plattform.verbindungsTyp === 'manuell' ? (
          <div style={{ background: '#f8fafc', border: '1px solid #e9eef5', borderRadius: 12, padding: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#172033', lineHeight: 1.6 }}>
              <strong>{plattform.name}</strong> unterstützt kein direktes API. Nutzen Sie den <strong>Export</strong> um ein formatiertes Inserat-Dokument herunterzuladen und manuell auf der Plattform hochzuladen.
            </p>
            <a href={plattform.uploadUrl} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, color: '#2563eb', fontWeight: 600, fontSize: 13 }}>
              🌐 {plattform.name} öffnen
            </a>
          </div>
        ) : (
          <div className="form-grid">
            {plattform.felder.map(f => (
              <label key={f.key} style={{ gridColumn: '1/-1' }}>
                {f.label}
                <input
                  type={f.key.toLowerCase().includes('key') || f.key.toLowerCase().includes('token') || f.key.toLowerCase().includes('passwort') ? 'password' : 'text'}
                  value={config[f.key] ?? ''}
                  onChange={e => setConfig({ ...config, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              </label>
            ))}
          </div>
        )}

        {gespeichert && <p style={{ color: '#166534', fontWeight: 600, fontSize: 13 }}>✓ Zugangsdaten gespeichert.</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
          <button className="danger small" onClick={loeschen}>Verbindung trennen</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}>Abbrechen</button>
            {plattform.verbindungsTyp !== 'manuell' && (
              <button className="primary" onClick={speichern}>Verbinden & speichern</button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PlattformExportModal({ plattform, inserat, onClose, onVeroeffentlicht }: {
  plattform: Plattform; inserat: AnyRecord; onClose: () => void; onVeroeffentlicht: () => void;
}) {
  const exportJSON = generiereInseratExport(inserat, plattform);
  const [tab, setTab] = useState<'vorschau' | 'anleitung'>('vorschau');
  const [kopiert, setKopiert] = useState(false);

  const kopieren = () => {
    navigator.clipboard.writeText(exportJSON).then(() => { setKopiert(true); setTimeout(() => setKopiert(false), 2000); });
  };

  const herunterladen = () => {
    const blob = new Blob([exportJSON], { type: 'application/json' });
    downloadBlob(blob, `inserat-${plattform.id}-${Date.now()}.json`);
  };

  const verbunden = istPlattformVerbunden(plattform.id);

  return (
    <Modal title={`${plattform.logo} ${plattform.name} — ${plattform.verbindungsTyp === 'manuell' ? 'Export' : 'Veröffentlichen'}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`small ${tab === 'vorschau' ? 'active' : ''}`}
          style={{ background: tab === 'vorschau' ? '#0e1d32' : '#fff', color: tab === 'vorschau' ? '#fff' : '#172033', border: '1px solid #ddd6cc', borderRadius: 10, padding: '7px 14px' }}
          onClick={() => setTab('vorschau')}>Export-Vorschau</button>
        <button className={`small ${tab === 'anleitung' ? 'active' : ''}`}
          style={{ background: tab === 'anleitung' ? '#0e1d32' : '#fff', color: tab === 'anleitung' ? '#fff' : '#172033', border: '1px solid #ddd6cc', borderRadius: 10, padding: '7px 14px' }}
          onClick={() => setTab('anleitung')}>Anleitung</button>
      </div>

      {tab === 'vorschau' && (
        <>
          <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 11, overflow: 'auto', maxHeight: 340, lineHeight: 1.5, margin: 0 }}>
            {exportJSON}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="small" onClick={kopieren}>{kopiert ? '✓ Kopiert!' : '📋 JSON kopieren'}</button>
            <button className="small" onClick={herunterladen}>⬇ Als JSON herunterladen</button>
            <a href={plattform.uploadUrl} target="_blank" rel="noreferrer"
              style={{ border: '1px solid #ddd6cc', background: '#fff', borderRadius: 10, padding: '6px 12px', fontSize: 13, color: '#172033', textDecoration: 'none' }}>
              🌐 {plattform.name} öffnen
            </a>
          </div>
        </>
      )}

      {tab === 'anleitung' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plattform.verbindungsTyp === 'manuell' ? (
            <>
              <div className="hint">
                <strong>Manueller Upload bei {plattform.name}:</strong>
                <ol style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>JSON-Datei herunterladen (Button oben)</li>
                  <li><a href={plattform.uploadUrl} target="_blank" rel="noreferrer">{plattform.name} öffnen</a> und einloggen</li>
                  <li>Neues Inserat erstellen und Daten aus der JSON übertragen</li>
                  <li>Fotos separat hochladen</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <div className="hint">
                <strong>API-Integration mit {plattform.name}:</strong>
                <ol style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Zugangsdaten konfigurieren (falls noch nicht geschehen)</li>
                  <li>JSON-Export herunterladen oder kopieren</li>
                  <li>API-Endpunkt: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>POST {plattform.url}/api/v1/inserate</code></li>
                  <li>Authorization Header: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Bearer {'{'}API-KEY{'}'}</code></li>
                  <li>Body: JSON aus Export</li>
                </ol>
                {plattform.apiDoku && (
                  <p style={{ margin: '8px 0 0' }}>
                    <a href={plattform.apiDoku} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                      📖 Vollständige API-Dokumentation →
                    </a>
                  </p>
                )}
              </div>
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 14px', fontSize: 13 }}>
                <strong>⚠ Status:</strong> Die direkte API-Verbindung ist vorbereitet. Sobald {plattform.name} einen API-Zugangscode bereitstellt, kann die Veröffentlichung automatisiert werden.
                {!verbunden && <> <strong>Zuerst Verbindung herstellen.</strong></>}
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onClose}>Schliessen</button>
        {verbunden && plattform.verbindungsTyp !== 'manuell' && (
          <button className="primary" onClick={onVeroeffentlicht}>✓ Als veröffentlicht markieren</button>
        )}
      </div>
    </Modal>
  );
}

function InsérateView({ data, save }: any) {
  const [selectedId, setSelectedId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('Verfügbar');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<AnyRecord>({});

  // Inserate werden vorerst lokal im Browser gehalten (kein AWS-Schema noch nötig).
  // Sobald das Amplify-Schema deployed ist, übernimmt save('Inserat', ...) die Persistenz.
  const [inserate, setInserate] = useState<AnyRecord[]>([]);

  const filtered = inserate
    .filter(i => filterStatus === 'Alle' || i.status === filterStatus)
    .filter(i => !q || JSON.stringify(i).toLowerCase().includes(q.toLowerCase()));

  const selected = inserate.find(i => i.id === selectedId);

  const newInserat = () => {
    const id = `ins-${uid()}`;
    setDraft({
      id,
      liegenschaftId: data.Liegenschaft[0]?.id ?? '',
      typ: 'Wohnung',
      zimmer: '',
      flaeche: '',
      miete: '',
      nebenkosten: '',
      verfuegbarAb: new Date().toISOString().slice(0, 10),
      adresse: '',
      beschreibung: '',
      ausstattung: [] as string[],
      bilder: [] as string[],
      bilder360: [] as string[],
      ansprechpersonId: '',
      status: 'Verfügbar',
      onlineSchalten: false,
      websiteUrl: '',
      plattformenStatus: '{}',
      createdAt: nowIso(),
    });
    setShowForm(true);
    setSelectedId(id);
  };

  const saveInserat = () => {
    if (!draft.adresse?.trim() && !data.Liegenschaft.find((l: AnyRecord) => l.id === draft.liegenschaftId)?.strasse) return;
    setInserate(prev => {
      const exists = prev.some(i => i.id === draft.id);
      return exists ? prev.map(i => i.id === draft.id ? { ...draft, updatedAt: nowIso() } : i) : [{ ...draft, updatedAt: nowIso() }, ...prev];
    });
    setShowForm(false);
  };

  const liegenschaftName = (id: string) => {
    const l = data.Liegenschaft.find((x: AnyRecord) => x.id === id);
    return l ? `${l.liegenschaftNummer} · ${l.name}` : '—';
  };

  return (
    <div>
      <Title
        title="Inserate"
        sub="Verwaltung der Mietobjekte und Inserate. Vorbereitung für Online-Veröffentlichung und Interessentenverwaltung."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://example.invalid/vermietung/" target="_blank" rel="noreferrer"
              style={{ border: '1px solid #ddd6cc', background: '#fff', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#172033', textDecoration: 'none' }}>
              🌐 Website ansehen
            </a>
            <button className="primary small" onClick={newInserat}>+ Neues Inserat</button>
          </div>
        }
      />

      {/* Hinweis-Banner */}
      <div style={{ margin: '0 32px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🚧</span>
        <div>
          <strong style={{ color: '#1e40af' }}>In Vorbereitung</strong>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#3b82f6' }}>
            Inserate werden vorerst lokal verwaltet. Die Online-Schaltung und AWS-Anbindung folgt im nächsten Schritt.
            Alle hier erfassten Daten bilden die Grundlage für die spätere Veröffentlichung.
          </p>
        </div>
      </div>

      <div className="inserate-layout">
        {/* Liste */}
        <div className="inserate-list-col">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {['Alle', ...INSERAT_STATUS_OPTIONS].map(s => (
              <button key={s} className={`small ${filterStatus === s ? 'active' : ''}`}
                style={{ background: filterStatus === s ? '#0e1d32' : '#fff', color: filterStatus === s ? '#fff' : '#172033', border: '1px solid #ddd6cc', borderRadius: 999, padding: '7px 13px', fontSize: 12 }}
                onClick={() => setFilterStatus(s)}>{s}</button>
            ))}
          </div>
          <input className="search" placeholder="Suche nach Adresse, Typ, Beschreibung …" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8290a7' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
              <p>Noch keine Inserate erfasst.<br />Klicke auf «Neues Inserat» um loszulegen.</p>
            </div>
          ) : (
            filtered.map(ins => (
              <button key={ins.id} className={`inserat-card ${selectedId === ins.id ? 'selected' : ''}`}
                onClick={() => { setSelectedId(ins.id); setShowForm(false); }}>
                <div className="inserat-card-header">
                  <span className="inserat-typ">{ins.typ}</span>
                  <span className={`inserat-status-dot status-${(ins.status ?? '').toLowerCase().replace(/\s/g,'-')}`}>{ins.status ?? 'Verfügbar'}</span>
                </div>
                <strong>{ins.adresse || liegenschaftName(ins.liegenschaftId) || 'Neue Liegenschaft'}</strong>
                <div className="inserat-card-meta">
                  {ins.zimmer && <span>{ins.zimmer} Zi.</span>}
                  {ins.flaeche && <span>{ins.flaeche} m²</span>}
                  {ins.miete && <span>CHF {ins.miete}/Mt.</span>}
                </div>
                {ins.verfuegbarAb && <small>Ab {ins.verfuegbarAb}</small>}
              </button>
            ))
          )}
        </div>

        {/* Detail / Formular */}
        <div className="inserate-detail-col">
          {!showForm && !selected && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 16, color: '#8290a7' }}>
              <span style={{ fontSize: 48 }}>🏘</span>
              <p>Inserat auswählen oder neu erfassen.</p>
              <button className="primary small" onClick={newInserat}>+ Neues Inserat</button>
            </div>
          )}

          {(showForm || selected) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#172033' }}>
                  {showForm ? (inserate.some(i => i.id === draft.id) ? 'Inserat bearbeiten' : 'Neues Inserat erfassen') : selected?.adresse || 'Inserat'}
                </h2>
                {!showForm && selected && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="small" onClick={() => { setDraft({ ...selected }); setShowForm(true); }}>Bearbeiten</button>
                    <button className="danger small" onClick={() => {
                      if (!window.confirm('Inserat wirklich löschen?')) return;
                      setInserate(prev => prev.filter(i => i.id !== selected.id));
                      setSelectedId('');
                    }}>Löschen</button>
                  </div>
                )}
              </div>

              {showForm ? (
                <div className="form-grid">
                  <label>Liegenschaft
                    <select value={draft.liegenschaftId ?? ''} onChange={e => {
                      const l = data.Liegenschaft.find((x: AnyRecord) => x.id === e.target.value);
                      setDraft({ ...draft, liegenschaftId: e.target.value, adresse: l ? `${l.strasse}, ${l.plz} ${l.ort}` : draft.adresse });
                    }}>
                      <option value="">— wählen —</option>
                      {data.Liegenschaft.filter((l: AnyRecord) => l.status === 'Aktiv').map((l: AnyRecord) => (
                        <option key={l.id} value={l.id}>{l.liegenschaftNummer} · {l.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Adresse / Objekt
                    <input value={draft.adresse ?? ''} onChange={e => setDraft({ ...draft, adresse: e.target.value })} placeholder="z.B. Musterstrasse 12, 4001 Basel" />
                  </label>
                  <label>Objekttyp
                    <select value={draft.typ ?? 'Wohnung'} onChange={e => setDraft({ ...draft, typ: e.target.value })}>
                      {INSERAT_TYP_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>Status
                    <select value={draft.status ?? 'Verfügbar'} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                      {INSERAT_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>Zimmer
                    <input type="number" min="0" step="0.5" value={draft.zimmer ?? ''} onChange={e => setDraft({ ...draft, zimmer: e.target.value })} placeholder="3.5" />
                  </label>
                  <label>Fläche (m²)
                    <input type="number" value={draft.flaeche ?? ''} onChange={e => setDraft({ ...draft, flaeche: e.target.value })} placeholder="78" />
                  </label>
                  <label>Miete (CHF/Mt.)
                    <input type="number" value={draft.miete ?? ''} onChange={e => setDraft({ ...draft, miete: e.target.value })} placeholder="1800" />
                  </label>
                  <label>Nebenkosten (CHF/Mt.)
                    <input type="number" value={draft.nebenkosten ?? ''} onChange={e => setDraft({ ...draft, nebenkosten: e.target.value })} placeholder="200" />
                  </label>
                  <label>Verfügbar ab
                    <input type="date" value={draft.verfuegbarAb ?? ''} onChange={e => setDraft({ ...draft, verfuegbarAb: e.target.value })} />
                  </label>
                  <label>Ansprechperson
                    <select value={draft.ansprechpersonId ?? ''} onChange={e => setDraft({ ...draft, ansprechpersonId: e.target.value })}>
                      <option value="">— Mitarbeiter wählen —</option>
                      {(data.Mitarbeiter ?? []).filter((m: AnyRecord) => m.status !== 'Inaktiv').map((m: AnyRecord) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Website-URL (Inserat)
                    <input value={draft.websiteUrl ?? ''} onChange={e => setDraft({ ...draft, websiteUrl: e.target.value })} placeholder="https://example.invalid/…" />
                  </label>
                  <label style={{ gridColumn: '1/-1' }}>Beschreibung
                    <textarea rows={4} value={draft.beschreibung ?? ''} onChange={e => setDraft({ ...draft, beschreibung: e.target.value })} placeholder="Kurzbeschreibung des Objekts für das Inserat …" />
                  </label>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, color: '#6f7b8e', display: 'block', marginBottom: 8 }}>Ausstattung</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {INSERAT_AUSSTATTUNG.map(a => {
                        const checked = (draft.ausstattung ?? []).includes(a);
                        return (
                          <button key={a} type="button"
                            style={{ border: `1px solid ${checked ? '#2563eb' : '#ddd6cc'}`, background: checked ? '#eff6ff' : '#fff', color: checked ? '#1d4ed8' : '#172033', borderRadius: 999, padding: '7px 13px', fontSize: 13, cursor: 'pointer' }}
                            onClick={() => setDraft({ ...draft, ausstattung: checked ? (draft.ausstattung ?? []).filter((x: string) => x !== a) : [...(draft.ausstattung ?? []), a] })}>
                            {checked ? '✓ ' : ''}{a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <InseratBilderUpload
                      label="Fotos hochladen"
                      hint="JPG, PNG – mehrere auswählbar"
                      accept="image/*"
                      multiple
                      paths={draft.bilder ?? []}
                      uploadsPath={`inserate/${draft.id}/bilder`}
                      onPaths={paths => setDraft({ ...draft, bilder: paths })}
                    />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <InseratBilderUpload
                      label="360°-Bilder hochladen"
                      hint="Equirektangulare JPG/PNG (z.B. aus Matterport, Ricoh Theta)"
                      accept="image/*"
                      multiple={false}
                      paths={draft.bilder360 ?? []}
                      uploadsPath={`inserate/${draft.id}/360`}
                      onPaths={paths => setDraft({ ...draft, bilder360: paths })}
                      is360
                    />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <PlattformSektion inserat={draft} setInserate={setInserate} />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                    <button onClick={() => setShowForm(false)}>Abbrechen</button>
                    <button className="primary" onClick={saveInserat}>Speichern</button>
                  </div>
                </div>
              ) : selected && (
                <div>
                  <div className="inserat-detail-header">
                    <div className="info-grid">
                      <Info label="Typ" value={selected.typ} />
                      <Info label="Status" value={selected.status} />
                      <Info label="Zimmer" value={selected.zimmer ? `${selected.zimmer} Zi.` : '—'} />
                      <Info label="Fläche" value={selected.flaeche ? `${selected.flaeche} m²` : '—'} />
                      <Info label="Miete" value={selected.miete ? `CHF ${selected.miete}/Mt.` : '—'} />
                      <Info label="NK" value={selected.nebenkosten ? `CHF ${selected.nebenkosten}/Mt.` : '—'} />
                      <Info label="Bruttomiete" value={selected.miete && selected.nebenkosten ? `CHF ${Number(selected.miete) + Number(selected.nebenkosten)}/Mt.` : '—'} />
                      <Info label="Verfügbar ab" value={selected.verfuegbarAb || '—'} />
                      <Info label="Liegenschaft" value={liegenschaftName(selected.liegenschaftId)} />
                      <Info label="Ansprechperson" value={(data.Mitarbeiter ?? []).find((m: AnyRecord) => m.id === selected.ansprechpersonId)?.name || '—'} />
                    </div>
                    {selected.beschreibung && (
                      <div style={{ marginTop: 16, padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 14, lineHeight: 1.6, color: '#172033' }}>
                        {selected.beschreibung}
                      </div>
                    )}
                    {(selected.ausstattung ?? []).length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, color: '#8290a7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Ausstattung</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {(selected.ausstattung as string[]).map(a => (
                            <span key={a} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 600 }}>✓ {a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.websiteUrl && (
                      <div style={{ marginTop: 14 }}>
                        <a href={selected.websiteUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
                          🌐 Inserat auf eigener Website öffnen
                        </a>
                      </div>
                    )}

                    <FtpKonfigSection inserat={selected} />
                    {/* Interessenten */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 12, color: '#8290a7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>👥 Interessentenverwaltung</div>
                      <InteressentenTab inserat={selected} setInserate={setInserate} />
                    </div>

                    <PlattformSektion inserat={selected} setInserate={setInserate} />

                    {(selected.bilder ?? []).length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 12, color: '#8290a7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Fotos</div>
                        <InseratGalerie paths={selected.bilder} />
                      </div>
                    )}
                    {(selected.bilder360 ?? []).length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 12, color: '#8290a7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>360°-Ansicht</div>
                        {(selected.bilder360 as string[]).map((path: string, i: number) => (
                          <div key={i} style={{ marginBottom: 14 }}>
                            <Viewer360 s3Path={path} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inserat Bild-Komponenten ────────────────────────────────────────────────

function InseratBilderUpload({ label, hint, accept, multiple, paths, uploadsPath, onPaths, is360 = false }: {
  label: string; hint: string; accept: string; multiple: boolean;
  paths: string[]; uploadsPath: string; onPaths: (p: string[]) => void; is360?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadStatus('Wird hochgeladen …');
    const newPaths: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${uploadsPath}/${Date.now()}-${safeName}`;
        await uploadData({ path, data: file }).result;
        newPaths.push(path);
      }
      onPaths([...paths, ...newPaths]);
      setUploadStatus(`${newPaths.length} Datei${newPaths.length !== 1 ? 'en' : ''} hochgeladen.`);
    } catch (e: any) {
      setUploadStatus(`Upload fehlgeschlagen: ${e?.message ?? String(e)}`);
    }
    setUploading(false);
    setTimeout(() => setUploadStatus(''), 4000);
  };

  const remove = (idx: number) => onPaths(paths.filter((_, i) => i !== idx));

  return (
    <div>
      <label style={{ fontSize: 12, color: '#6f7b8e', display: 'block', marginBottom: 8, fontWeight: 700 }}>
        {is360 ? '🌐 ' : '📷 '}{label}
      </label>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>{hint}</p>

      {paths.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {paths.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <InseratThumbnail s3Path={p} is360={is360} />
              <button onClick={() => remove(i)}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px dashed #a8c4e8', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: '#2563eb', background: '#f0f7ff' }}>
        <span>{uploading ? '⏳' : is360 ? '🔄' : '📁'}</span>
        <span>{uploading ? 'Hochladen …' : `${is360 ? '360°-Bild' : 'Fotos'} auswählen`}</span>
        <input type="file" accept={accept} multiple={multiple} style={{ display: 'none' }} disabled={uploading}
          onChange={e => handleFiles(e.target.files)} />
      </label>
      {uploadStatus && <p style={{ marginTop: 6, fontSize: 12, color: uploadStatus.includes('fehlgeschlagen') ? '#dc2626' : '#166534' }}>{uploadStatus}</p>}
    </div>
  );
}

function InseratThumbnail({ s3Path, is360 }: { s3Path: string; is360?: boolean }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    getUrl({ path: s3Path }).then(r => setUrl(r.url.toString())).catch(() => {});
  }, [s3Path]);
  return url ? (
    <div style={{ position: 'relative', width: 96, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid #e6ded4' }}>
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {is360 && (
        <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>360°</div>
      )}
    </div>
  ) : (
    <div style={{ width: 96, height: 72, borderRadius: 10, background: '#f1f5f9', border: '1px solid #e6ded4', display: 'grid', placeItems: 'center', fontSize: 20 }}>{is360 ? '🌐' : '📷'}</div>
  );
}

function InseratGalerie({ paths }: { paths: string[] }) {
  const [urls, setUrls] = React.useState<string[]>([]);
  const [lightbox, setLightbox] = React.useState('');
  React.useEffect(() => {
    Promise.all(paths.map(p => getUrl({ path: p }).then(r => r.url.toString()).catch(() => ''))).then(setUrls);
  }, [paths.join(',')]);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
        {urls.filter(Boolean).map((url, i) => (
          <button key={i} onClick={() => setLightbox(url)} style={{ border: 'none', padding: 0, borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '4/3', background: '#f1f5f9' }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox('')}
          style={{ background: 'rgba(0,0,0,.85)' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '86vh', borderRadius: 12, objectFit: 'contain' }} />
            <button onClick={() => setLightbox('')}
              style={{ position: 'absolute', top: -14, right: -14, width: 34, height: 34, borderRadius: 999, background: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Viewer360({ s3Path }: { s3Path: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [url, setUrl] = React.useState('');
  const [fehler, setFehler] = React.useState(false);

  React.useEffect(() => {
    getUrl({ path: s3Path }).then(r => setUrl(r.url.toString())).catch(() => setFehler(true));
  }, [s3Path]);

  React.useEffect(() => {
    if (!url || !ref.current) return;
    const container = ref.current;

    const init = () => {
      if ((window as any).pannellum && container) {
        (window as any).pannellum.viewer(container, {
          type: 'equirectangular',
          panorama: url,
          autoLoad: true,
          showControls: true,
          showFullscreenCtrl: true,
          showZoomCtrl: true,
          compass: false,
        });
      }
    };

    if ((window as any).pannellum) {
      init();
      return;
    }

    // Pannellum CSS
    if (!document.querySelector('#pannellum-css')) {
      const link = document.createElement('link');
      link.id = 'pannellum-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
      document.head.appendChild(link);
    }
    // Pannellum JS
    if (!document.querySelector('#pannellum-js')) {
      const script = document.createElement('script');
      script.id = 'pannellum-js';
      script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
      script.onload = init;
      document.body.appendChild(script);
    }
  }, [url]);

  if (fehler) return <p className="hint">360°-Bild konnte nicht geladen werden.</p>;
  if (!url) return <div style={{ height: 420, borderRadius: 14, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#8290a7' }}>360°-Ansicht wird geladen …</div>;
  return <div ref={ref} style={{ width: '100%', height: 420, borderRadius: 14, overflow: 'hidden', border: '1px solid #e6ded4' }} />;
}

// ─── Objekte Tab ─────────────────────────────────────────────────────────────


const OBJEKT_TYP_OPTIONS = ['Wohnung', 'Zimmer', 'Maisonette', 'Attika', 'Gewerbe', 'Garage / Parkplatz', 'Keller', 'Sonstiges'];
const OBJEKT_STATUS_OPTIONS = ['Besetzt', 'Frei', 'Reserviert', 'Sanierung'];

function ObjekteTab({ data, property, save, setView, setSelectedPersonId }: any) {
  const [selectedNr, setSelectedNr] = useState<string | null>(null);

  const allPersons = (data.KontaktPerson as AnyRecord[]).filter((p: AnyRecord) => p.liegenschaftId === property.id);
  const geraete = (data.Dokument as AnyRecord[])
    .filter((d: AnyRecord) => d.liegenschaftId === property.id && d.kategorie === 'Gerät')
    .map(geraetFromDokument);

  const objektNummern = Array.from(new Set(
    allPersons.map((p: AnyRecord) => String(p.wohnungsNummer ?? '').trim()).filter(Boolean)
  )).sort();
  const ohneNr = allPersons.filter((p: AnyRecord) => !String(p.wohnungsNummer ?? '').trim());
  const alleObjekte = [...objektNummern, ...(ohneNr.length ? ['__ohne__'] : [])];

  if (selectedNr !== null) {
    const idx = alleObjekte.indexOf(selectedNr);
    return (
      <ObjektDetailPage
        nr={selectedNr} idx={idx} total={alleObjekte.length} alleObjekte={alleObjekte}
        data={data} property={property} allPersons={allPersons} geraete={geraete}
        save={save} setView={setView} setSelectedPersonId={setSelectedPersonId}
        onNav={(newNr: string) => setSelectedNr(newNr)}
        onBack={() => setSelectedNr(null)}
      />
    );
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#172033' }}>Objekte & Einheiten</h2>
          <p style={{ margin: '4px 0 0', color: '#8290a7', fontSize: 13 }}>
            {alleObjekte.length} Objekt{alleObjekte.length !== 1 ? 'e' : ''} · Klicken zum Öffnen
          </p>
        </div>
      </div>
      {alleObjekte.length === 0 && (
        <Panel title="Keine Objekte">
          <p className="hint">Noch keine Parteien mit Wohnungsnummer erfasst.</p>
        </Panel>
      )}
      <div className="objekte-list">
        {alleObjekte.map(nr => {
          const displayNr = nr === '__ohne__' ? '' : nr;
          const persons = allPersons.filter((p: AnyRecord) => String(p.wohnungsNummer ?? '').trim() === displayNr);
          const active = persons.filter((p: AnyRecord) => !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? '') && !String(p.name ?? '').startsWith('[GELÖSCHT]'));
          const metaDok = (data.Dokument ?? []).find((d: AnyRecord) => d.liegenschaftId === property.id && d.kategorie === 'ObjektMeta' && d.dateiname === displayNr);
          const meta: AnyRecord = (() => { try { return JSON.parse(metaDok?.volltext ?? '{}'); } catch { return {}; } })();
          const objGeraete = geraete.filter((g: AnyRecord) => displayNr && String(g.standort ?? '').toLowerCase().includes(displayNr.toLowerCase()));
          return (
            <button key={nr} className="objekt-list-card" onClick={() => setSelectedNr(nr)}>
              <div className="objekt-list-icon">🏠</div>
              <div className="objekt-list-body">
                <div className="objekt-list-title">
                  <strong>Objekt {nr === '__ohne__' ? '(ohne Nummer)' : nr}</strong>
                  {meta.typ && <span className="badge">{meta.typ}</span>}
                  {meta.status && <span className={`badge ${meta.status === 'Besetzt' ? 'green' : meta.status === 'Frei' ? 'blue' : 'orange'}`}>{meta.status}</span>}
                </div>
                <div className="objekt-list-meta">
                  <span>{active.length > 0 ? active.map((p: AnyRecord) => personDisplayName(p)).join(', ') : 'Keine aktiven Mieter'}</span>
                  {meta.zimmer && <span> · {meta.zimmer} Zi.</span>}
                  {meta.flaeche && <span> · {meta.flaeche} m²</span>}
                  {meta.miete && <span> · CHF {meta.miete}/Mt.</span>}
                  {objGeraete.length > 0 && <span> · {objGeraete.length} Gerät{objGeraete.length !== 1 ? 'e' : ''}</span>}
                </div>
              </div>
              <span className="objekt-list-arrow">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ObjektDetailPage({ nr, idx, total, alleObjekte, data, property, allPersons, geraete, save, setView, setSelectedPersonId, onNav, onBack }: any) {
  const displayNr = nr === '__ohne__' ? '' : nr;
  const [editMode, setEditMode] = useState(false);
  const [showHistorie, setShowHistorie] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const existingMeta = (data.Dokument ?? []).find(
    (d: AnyRecord) => d.liegenschaftId === property.id && d.kategorie === 'ObjektMeta' && d.dateiname === displayNr
  );
  const meta: AnyRecord = (() => { try { return JSON.parse(existingMeta?.volltext ?? '{}'); } catch { return {}; } })();
  const [draft, setDraft] = useState<AnyRecord>(() => ({
    typ: '', status: 'Besetzt', zimmer: '', flaeche: '', stockwerk: '',
    miete: '', nebenkosten: '', verfuegbarAb: '', beschreibung: '', notizen: '',
    ...meta,
  }));

  const persons = allPersons.filter((p: AnyRecord) => String(p.wohnungsNummer ?? '').trim() === displayNr);
  const active = persons.filter((p: AnyRecord) => !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? '') && !String(p.name ?? '').startsWith('[GELÖSCHT]'));
  const historic = persons.filter((p: AnyRecord) => ['Archiviert','Gelöscht'].includes(p.kontoStatus ?? '') || String(p.name ?? '').startsWith('[GELÖSCHT]'));
  const objGeraete = geraete.filter((g: AnyRecord) => displayNr && String(g.standort ?? '').toLowerCase().includes(displayNr.toLowerCase()));
  const personIds = persons.map((p: AnyRecord) => p.id);
  const objDocs = (data.Dokument ?? []).filter((d: AnyRecord) =>
    d.liegenschaftId === property.id && d.kategorie !== 'Gerät' && d.kategorie !== 'ObjektMeta' && personIds.includes(d.personId ?? '')
  );

  const saveMeta = async () => {
    setSavingMeta(true);
    await save('Dokument', {
      id: existingMeta?.id ?? `objmeta-${uid()}`,
      liegenschaftId: property.id,
      titel: `Objekt ${displayNr || '(ohne Nummer)'}`,
      kategorie: 'ObjektMeta',
      dateiname: displayNr,
      jahr: new Date().getFullYear(),
      volltext: JSON.stringify(draft),
      sichtbarFuerKunden: false,
      freigabeStatus: 'Intern',
    });
    setSavingMeta(false);
    setEditMode(false);
  };

  const prevNr = idx > 0 ? alleObjekte[idx - 1] : null;
  const nextNr = idx < total - 1 ? alleObjekte[idx + 1] : null;

  return (
    <div>
      <div className="objekt-detail-nav">
        <button className="small" onClick={onBack}>← Alle Objekte</button>
        <div className="objekt-detail-nav-arrows">
          <button className="objekt-nav-btn" disabled={!prevNr} onClick={() => prevNr && onNav(prevNr)}>‹</button>
          <span className="objekt-nav-pos">{idx + 1} / {total}</span>
          <button className="objekt-nav-btn" disabled={!nextNr} onClick={() => nextNr && onNav(nextNr)}>›</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="small" onClick={() => setEditMode(!editMode)}>{editMode ? 'Abbrechen' : 'Bearbeiten'}</button>
          {editMode && <button className="primary small" onClick={saveMeta} disabled={savingMeta}>{savingMeta ? 'Speichert …' : 'Speichern'}</button>}
        </div>
      </div>

      <div className="objekt-detail-header">
        <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: '#172033', display: 'flex', alignItems: 'center', gap: 10 }}>
          🏠 Objekt {nr === '__ohne__' ? '(ohne Nummer)' : nr}
          {meta.typ && <span className="badge" style={{ fontSize: 13 }}>{meta.typ}</span>}
          {meta.status && <span className={`badge ${meta.status === 'Besetzt' ? 'green' : meta.status === 'Frei' ? 'blue' : 'orange'}`} style={{ fontSize: 13 }}>{meta.status}</span>}
        </h2>
        <p style={{ margin: 0, color: '#8290a7', fontSize: 13 }}>
          {property.liegenschaftNummer} · {property.name} · {property.strasse}, {property.plz} {property.ort}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,.85fr) minmax(460px,1.15fr)', gap: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {editMode ? (
            <section className="panel">
              <h2>Objektdaten bearbeiten</h2>
              <div className="form-grid">
                <label>Typ<select value={draft.typ ?? ''} onChange={e => setDraft({ ...draft, typ: e.target.value })}><option value="">—</option>{OBJEKT_TYP_OPTIONS.map(t => <option key={t}>{t}</option>)}</select></label>
                <label>Status<select value={draft.status ?? 'Besetzt'} onChange={e => setDraft({ ...draft, status: e.target.value })}>{OBJEKT_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></label>
                <label>Zimmer<input type="number" step="0.5" min="0" value={draft.zimmer ?? ''} onChange={e => setDraft({ ...draft, zimmer: e.target.value })} placeholder="3.5" /></label>
                <label>Fläche (m²)<input type="number" value={draft.flaeche ?? ''} onChange={e => setDraft({ ...draft, flaeche: e.target.value })} placeholder="78" /></label>
                <label>Stockwerk<input value={draft.stockwerk ?? ''} onChange={e => setDraft({ ...draft, stockwerk: e.target.value })} placeholder="EG, 1. OG …" /></label>
                <label>Verfügbar ab<input type="date" value={draft.verfuegbarAb ?? ''} onChange={e => setDraft({ ...draft, verfuegbarAb: e.target.value })} /></label>
                <label>Miete (CHF/Mt.)<input type="number" value={draft.miete ?? ''} onChange={e => setDraft({ ...draft, miete: e.target.value })} placeholder="1800" /></label>
                <label>Nebenkosten (CHF/Mt.)<input type="number" value={draft.nebenkosten ?? ''} onChange={e => setDraft({ ...draft, nebenkosten: e.target.value })} placeholder="200" /></label>
                <label style={{ gridColumn: '1/-1' }}>Beschreibung<textarea rows={3} value={draft.beschreibung ?? ''} onChange={e => setDraft({ ...draft, beschreibung: e.target.value })} /></label>
                <label style={{ gridColumn: '1/-1' }}>Interne Notizen<textarea rows={2} value={draft.notizen ?? ''} onChange={e => setDraft({ ...draft, notizen: e.target.value })} placeholder="Interne Bemerkungen …" /></label>
              </div>
            </section>
          ) : (
            <section className="panel">
              <h2>Stammdaten</h2>
              <div className="info-grid">
                <Info label="Typ" value={meta.typ || '—'} />
                <Info label="Status" value={meta.status || '—'} />
                <Info label="Zimmer" value={meta.zimmer ? `${meta.zimmer} Zi.` : '—'} />
                <Info label="Fläche" value={meta.flaeche ? `${meta.flaeche} m²` : '—'} />
                <Info label="Stockwerk" value={meta.stockwerk || '—'} />
                <Info label="Verfügbar ab" value={meta.verfuegbarAb || '—'} />
                <Info label="Miete" value={meta.miete ? `CHF ${meta.miete}/Mt.` : '—'} />
                <Info label="Nebenkosten" value={meta.nebenkosten ? `CHF ${meta.nebenkosten}/Mt.` : '—'} />
                {(meta.miete && meta.nebenkosten) && <Info label="Bruttomiete" value={`CHF ${Number(meta.miete) + Number(meta.nebenkosten)}/Mt.`} />}
              </div>
              {meta.beschreibung && <p style={{ marginTop: 14, fontSize: 14, color: '#172033', lineHeight: 1.6, background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid #e9eef5' }}>{meta.beschreibung}</p>}
              {meta.notizen && <p style={{ marginTop: 8, fontSize: 13, color: '#8290a7', fontStyle: 'italic' }}>📝 {meta.notizen}</p>}
              {!meta.typ && !meta.zimmer && !meta.flaeche && (
                <button className="primary small" style={{ marginTop: 12 }} onClick={() => setEditMode(true)}>Objektdaten erfassen</button>
              )}
            </section>
          )}
          {objGeraete.length > 0 && (
            <section className="panel">
              <h2>Geräte & Anlagen</h2>
              <div className="objekt-geraete-grid">
                {objGeraete.map((g: AnyRecord) => (
                  <div key={g.id} className="objekt-geraet-card">
                    <div className="objekt-geraet-typ">{g.typ || g.dateiname}</div>
                    <strong>{g.titel || g.bezeichnung}</strong>
                    {g.hersteller && <span>{g.hersteller}{g.modell ? ` · ${g.modell}` : ''}</span>}
                    {g.seriennummer && <span>SN: {g.seriennummer}</span>}
                    <Badge tone={g.status === 'Defekt' ? 'red' : 'green'}>{g.status || 'Aktiv'}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="panel">
            <h2>Aktuelle Bewohner</h2>
            {active.length === 0 ? <p className="hint">Keine aktiven Mieter / Eigentümer.</p> : (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Rolle</th><th>E-Mail</th><th>Telefon</th><th>Konto</th><th></th></tr></thead>
                <tbody>
                  {active.map((p: AnyRecord) => (
                    <tr key={p.id} onClick={() => { setSelectedPersonId(p.id); setView('personDetail'); }} style={{ cursor: 'pointer' }}>
                      <td><strong>{personDisplayName(p)}</strong></td>
                      <td>{p.rolle}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.telefon || '—'}</td>
                      <td><Badge tone={p.kontoStatus === 'Aktiv' ? 'green' : 'orange'}>{p.kontoStatus ?? 'Nicht eingeladen'}</Badge></td>
                      <td><button className="small" onClick={e => { e.stopPropagation(); setSelectedPersonId(p.id); setView('personDetail'); }}>Öffnen</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="panel">
            <h2>Dokumente ({objDocs.length})</h2>
            {objDocs.length === 0 ? <p className="hint">Noch keine Dokumente an Bewohner dieses Objekts versendet.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {objDocs.map((d: AnyRecord) => (
                  <div key={d.id} className="list-row">
                    <div>
                      <strong>{d.titel}</strong>
                      <span>{d.kategorie} · {d.jahr} · {personDisplayName(allPersons.find((p: AnyRecord) => p.id === d.personId) ?? {})}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge tone={d.sichtbarFuerKunden ? 'green' : ''}>{d.sichtbarFuerKunden ? 'Kunde sichtbar' : 'Intern'}</Badge>
                      {d.dateiUrl && <DocOpenButton url={d.dateiUrl} titel={d.titel} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          {historic.length > 0 && (
            <section className="panel">
              <button style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 15, color: '#172033' }}
                onClick={() => setShowHistorie(h => !h)}>
                <span>🕐 Frühere Bewohner ({historic.length})</span>
                <span>{showHistorie ? '▲' : '▼'}</span>
              </button>
              {showHistorie && (
                <table className="data-table" style={{ marginTop: 12, opacity: .75 }}>
                  <thead><tr><th>Name</th><th>Rolle</th><th>E-Mail</th><th>Status</th></tr></thead>
                  <tbody>
                    {historic.map((p: AnyRecord) => (
                      <tr key={p.id}><td>{personDisplayName(p)}</td><td>{p.rolle}</td><td>{p.email || '—'}</td><td><Badge tone="orange">{p.kontoStatus ?? 'Archiviert'}</Badge></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}


const GERAET_TYPEN = ['Waschmaschine', 'Tumbler', 'Geschirrspüler', 'Boiler', 'Heizung', 'Lift', 'Garagetor', 'Tiefgaragentor', 'Aussenbeleuchtung', 'Gegensprechanlage', 'Sonstiges'];

function geraetFromDokument(d: AnyRecord) {
  let meta: AnyRecord = {};
  try { meta = JSON.parse(d.volltext ?? '{}'); } catch { /* ignore */ }
  return { ...d, ...meta };
}

function GeraeteManager({ data, property, save }: any) {
  const geraete = (data.Dokument ?? [])
    .filter((d: AnyRecord) => d.liegenschaftId === property.id && d.kategorie === 'Gerät')
    .map(geraetFromDokument);

  const propertyPersons = (data.KontaktPerson ?? [])
    .filter((p: AnyRecord) => p.liegenschaftId === property.id && !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? ''));

  const objektOptionen = Array.from(new Set(
    propertyPersons.map((p: AnyRecord) => String(p.wohnungsNummer ?? '').trim()).filter(Boolean)
  )).sort() as string[];

  const emptyGerät = () => ({
    typ: 'Waschmaschine', bezeichnung: '', hersteller: '', modell: '',
    seriennummer: '', einbaujahr: '', standort: '', objekt: '',
    personId: '', status: 'Aktiv', bemerkung: '',
  });
  const [draft, setDraft] = useState<AnyRecord | null>(null);

  const saveGerät = async () => {
    if (!draft?.bezeichnung?.trim() && !draft?.typ?.trim()) return;
    const bezeichnung = draft.bezeichnung?.trim() || draft.typ;
    const { typ, hersteller, modell, seriennummer, einbaujahr, standort, objekt, status, bemerkung } = draft;
    await save('Dokument', {
      id: draft.id ?? `ger-${uid()}`,
      liegenschaftId: property.id,
      personId: draft.personId || undefined,
      titel: bezeichnung,
      kategorie: 'Gerät',
      dateiname: typ,
      jahr: new Date().getFullYear(),
      volltext: JSON.stringify({ typ, hersteller, modell, seriennummer, einbaujahr: einbaujahr ? Number(einbaujahr) : undefined, standort, objekt, status, bemerkung }),
      sichtbarFuerKunden: false,
      freigabeStatus: 'Intern',
    });
    setDraft(null);
  };

  return (
    <Panel title="Geräte & Anlagen">
      <p className="hint" style={{ marginBottom: 14 }}>Erfasse alle Geräte und Anlagen. Sie stehen in Auftragsformularen zur Auswahl zur Verfügung.</p>
      {draft && (
        <div className="panel" style={{ background: '#f8fafc', marginBottom: 18 }}>
          <h2>{draft.id ? 'Gerät bearbeiten' : 'Neues Gerät erfassen'}</h2>

          <div className="key-form-grid">
            {/* Links — Gerätedaten */}
            <div className="key-form-section">
              <div className="key-form-section-label">Gerät</div>
              <div className="form-grid">
                <label>Typ *
                  <select value={draft.typ ?? 'Waschmaschine'} onChange={(e) => setDraft({ ...draft, typ: e.target.value, bezeichnung: draft.bezeichnung || e.target.value })}>
                    {GERAET_TYPEN.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>Bezeichnung / Name
                  <input value={draft.bezeichnung ?? ''} onChange={(e) => setDraft({ ...draft, bezeichnung: e.target.value })} placeholder="z.B. Waschmaschine Keller links" />
                </label>
                <label>Hersteller
                  <input value={draft.hersteller ?? ''} onChange={(e) => setDraft({ ...draft, hersteller: e.target.value })} placeholder="z.B. Miele, Bosch" />
                </label>
                <label>Modell
                  <input value={draft.modell ?? ''} onChange={(e) => setDraft({ ...draft, modell: e.target.value })} />
                </label>
                <label>Seriennummer
                  <input value={draft.seriennummer ?? ''} onChange={(e) => setDraft({ ...draft, seriennummer: e.target.value })} />
                </label>
                <label>Einbaujahr
                  <input type="number" value={draft.einbaujahr ?? ''} onChange={(e) => setDraft({ ...draft, einbaujahr: e.target.value })} placeholder={String(new Date().getFullYear())} />
                </label>
              </div>
            </div>

            {/* Rechts — Zuordnung */}
            <div className="key-form-section">
              <div className="key-form-section-label">Zuordnung & Standort</div>
              <div className="form-grid">
                <label>Mieter / Person
                  <select value={draft.personId ?? ''} onChange={(e) => {
                    const p = propertyPersons.find((p: AnyRecord) => p.id === e.target.value);
                    setDraft({ ...draft, personId: e.target.value, objekt: draft.objekt || (p?.wohnungsNummer ?? '') });
                  }}>
                    <option value="">— Person wählen (optional) —</option>
                    {propertyPersons.map((p: AnyRecord) => (
                      <option key={p.id} value={p.id}>{personDisplayName(p)} · {p.rolle}{p.wohnungsNummer ? ` (${p.wohnungsNummer})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label>Objekt / Wohnung
                  {objektOptionen.length > 0 ? (
                    <select value={draft.objekt ?? ''} onChange={(e) => setDraft({ ...draft, objekt: e.target.value })}>
                      <option value="">— Objekt wählen —</option>
                      {objektOptionen.map((nr) => <option key={nr} value={nr}>{nr}</option>)}
                      <option value="Allgemein">Allgemein / kein Objekt</option>
                    </select>
                  ) : (
                    <input value={draft.objekt ?? ''} onChange={(e) => setDraft({ ...draft, objekt: e.target.value })} placeholder="z.B. EG Rechts, Keller …" />
                  )}
                </label>
                <label>Standort (Raum)
                  <input value={draft.standort ?? ''} onChange={(e) => setDraft({ ...draft, standort: e.target.value })} placeholder="z.B. Waschküche EG, Keller" />
                </label>
                <label>Status
                  <select value={draft.status ?? 'Aktiv'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                    <option>Aktiv</option><option>Defekt</option><option>In Reparatur</option><option>Inaktiv</option>
                  </select>
                </label>
                <label style={{ gridColumn: '1/-1' }}>Bemerkung
                  <textarea value={draft.bemerkung ?? ''} onChange={(e) => setDraft({ ...draft, bemerkung: e.target.value })} placeholder="Wartungshinweise, Notizen …" />
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button onClick={() => setDraft(null)}>Abbrechen</button>
            <button className="primary" onClick={saveGerät}>Speichern</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="primary small" onClick={() => setDraft(emptyGerät())}>+ Gerät erfassen</button>
      </div>

      {geraete.length === 0 ? (
        <p className="hint">Noch keine Geräte erfasst.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Typ</th><th>Bezeichnung</th><th>Objekt</th><th>Standort</th><th>Hersteller / Modell</th><th>Einbaujahr</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {geraete.map((g: AnyRecord) => (
              <tr key={g.id}>
                <td>{g.typ || g.dateiname}</td>
                <td><strong>{g.titel}</strong></td>
                <td>{g.objekt || '—'}</td>
                <td>{g.standort || '—'}</td>
                <td>{[g.hersteller, g.modell].filter(Boolean).join(' · ') || '—'}</td>
                <td>{g.einbaujahr || '—'}</td>
                <td><Badge tone={g.status === 'Defekt' ? 'red' : g.status === 'Aktiv' ? 'green' : 'orange'}>{g.status || 'Aktiv'}</Badge></td>
                <td><button className="small" onClick={() => setDraft({ ...g })}>Bearbeiten</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// ─── Auftragsarten mit Standardtexten ────────────────────────────────────────
const AUFTRAGSARTEN: { label: string; geraetTyp: string; text: string }[] = [
  { label: '— Auftragsart wählen —', geraetTyp: '', text: '' },
  { label: 'Waschmaschine defekt', geraetTyp: 'Waschmaschine', text: 'Gemäss Mietermeldung ist die Waschmaschine in der allgemeinen Waschküche defekt. Bitte um Überprüfung und Reparatur.' },
  { label: 'Tumbler defekt', geraetTyp: 'Tumbler', text: 'Gemäss Mietermeldung ist der Tumbler in der allgemeinen Waschküche defekt. Bitte um Überprüfung und Reparatur.' },
  { label: 'Waschmaschine/Tumbler pumpt nicht richtig', geraetTyp: 'Waschmaschine', text: 'Gemäss Mietermeldung pumpt und schleudert die Waschmaschine/der Tumbler im allg. Waschraum nicht richtig. Bitte um Überprüfung und Behebung.' },
  { label: 'Beleuchtung Treppenhaus (Minuterie)', geraetTyp: 'Aussenbeleuchtung', text: 'Beleuchtung Treppenhaus: Minuterie defekt. Bitte überprüfen und instand stellen.' },
  { label: 'Aussenbeleuchtung defekt', geraetTyp: 'Aussenbeleuchtung', text: 'Aussenbeleuchtung funktioniert nicht. Bitte um Überprüfung und Behebung des Defekts.' },
  { label: 'Kellerbeleuchtung defekt', geraetTyp: 'Sonstiges', text: 'Gemäss Mietermitteilung ist die Beleuchtung im Allgemeinkeller defekt. Bitte anschauen, wenn nötig Elektriker beauftragen und uns informieren.' },
  { label: 'Garagetor defekt', geraetTyp: 'Garagetor', text: 'Garagentor funktioniert nicht einwandfrei. Bitte um Überprüfung und Reparatur.' },
  { label: 'Tiefgaragentor defekt', geraetTyp: 'Tiefgaragentor', text: 'Tiefgaragentor funktioniert nicht einwandfrei. Bitte um Überprüfung und Reparatur.' },
  { label: 'Heizungsausfall', geraetTyp: 'Heizung', text: 'Mieter meldet Heizungsausfall. Bitte umgehend überprüfen und beheben.' },
  { label: 'Boiler defekt', geraetTyp: 'Boiler', text: 'Boiler defekt, kein Warmwasser. Bitte umgehend überprüfen und reparieren.' },
  { label: 'Lift defekt', geraetTyp: 'Lift', text: 'Lift funktioniert nicht. Bitte umgehend überprüfen und Servicetechniker beauftragen.' },
  { label: 'Gegensprechanlage defekt', geraetTyp: 'Gegensprechanlage', text: 'Gegensprechanlage / Türöffner funktioniert nicht. Bitte überprüfen und reparieren.' },
  { label: 'Freier Auftrag (Blanko)', geraetTyp: '', text: '' },
];

const FOLDER_NAMES = ['Neue Mieter', 'Auftraege', 'Übergabe', 'Kündigung', 'Abrechnung', 'Allgemein'];
const FOLDER_LABELS: Record<string, string> = { 'Auftraege': 'Aufträge' };

const buildMergeData = (person: AnyRecord, liegenschaft: AnyRecord) => ({
  vorname: splitPersonName(person).vorname,
  nachname: splitPersonName(person).nachname,
  name: personDisplayName(person),
  email: String(person.email ?? ''),
  telefon: String(person.telefon ?? ''),
  adresse: String(person.adresse ?? ''),
  wohnungsNummer: String(person.wohnungsNummer ?? ''),
  stockwerk: String(person.stockwerk ?? ''),
  rolle: String(person.rolle ?? ''),
  liegenschaft: liegenschaft?.name ?? '',
  liegenschaftNummer: liegenschaft?.liegenschaftNummer ?? '',
  strasse: liegenschaft?.strasse ?? '',
  plz: liegenschaft?.plz ?? '',
  ort: liegenschaft?.ort ?? '',
  datum: new Date().toLocaleDateString('de-CH'),
  jahr: String(new Date().getFullYear()),
});

async function genAuftragPdf(template: AnyRecord, fields: Record<string, string>, handwerker?: AnyRecord) {
  const { default: jsPDF } = await import('jspdf');
  let tpl: Record<string, any> = {};
  try { tpl = JSON.parse(template.felderJson ?? '{}'); } catch { /* ignore */ }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lm = 25, rm = 185, lineH = 6;
  let y = 20;

  const line = (txt: string, bold = false, size = 10) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(String(txt ?? ''), lm, y); y += lineH;
  };
  const skip = (n = 1) => { y += lineH * n; };
  const hrule = () => { doc.setDrawColor(200, 200, 200); doc.line(lm, y, rm, y); y += 4; };

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('Immobilientool', lm, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Musterstrasse 1 · 4000 Basel · Tel. +41 00 000 00 00', lm, y + 6);
  doc.setFontSize(10);
  doc.text(`Basel, ${fields.datum}`, rm, y + 2, { align: 'right' });
  y += 16; hrule();

  // Contractor block — prefer selected Handwerker over template defaults
  const hwName = handwerker?.firma || tpl.auftraganName || '';
  const hwKontakt = handwerker?.kontaktperson || tpl.auftraganKontakt || '';
  const hwAdresse = handwerker?.adresse || tpl.auftraganAdresse || '';
  const hwEmail = handwerker?.email || tpl.auftraganEmail || '';
  const hwTel = handwerker?.telefon || tpl.auftraganTelefon || '';

  if (hwName) {
    line('Auftrag an:', true);
    line(hwName);
    if (hwKontakt) line(hwKontakt);
    if (hwAdresse) line(hwAdresse);
    if (hwEmail) line(hwEmail);
    if (hwTel) line(`Tel: ${hwTel}`);
    skip();
  }

  // Greeting + body
  line('Guten Tag', true, 11); skip(0.5);
  if (fields.referenz) line(`Unsere Referenz: ${fields.referenz}`);
  if (fields.liegenschaft) line(`Liegenschaft: ${fields.liegenschaft}`);
  if (fields.mieter) line(`Mieter: ${fields.mieter}`);
  if (fields.telefon) line(`Telefonnummer: ${fields.telefon}`);
  skip();

  const auftragsText = (fields.auftragstext ?? '').trim();
  if (auftragsText) {
    if (tpl.kontakthinweis) { line(tpl.kontakthinweis, false); skip(0.5); }
    line('Auftrag:', true);
    const auftragsLines = doc.splitTextToSize(auftragsText, rm - lm - 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(auftragsLines, lm + 4, y);
    y += auftragsLines.length * lineH; skip(0.5);
  } else {
    doc.setFontSize(10); doc.setFont('helvetica', 'italic');
    doc.setTextColor(160, 160, 160);
    doc.text('[ Bitte Auftragstext im Formular links ausfüllen ]', lm, y);
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    y += lineH * 2;
  }

  if (fields.termin?.trim()) { line(`Termin: ${fields.termin}`); skip(0.5); }
  if (tpl.hauswart) { line(`Hauswartung: ${tpl.hauswart}`); skip(0.5); }

  const hinweisText = fields.hinweis || tpl.hinweis || '';
  if (hinweisText) { line(`Hinweis: ${hinweisText}`); skip(0.5); }

  skip(); hrule();

  const rechnungsAdr = (fields.rechnungsadresse ?? '').trim();
  if (rechnungsAdr) { line('Rechnungsadresse:', true); line(rechnungsAdr); skip(); }

  line('Besten Dank.'); skip();
  line('Freundliche Grüsse'); line('Immobilientool');
  skip(1.5);
  // Prefer selected Bearbeiter over template default
  const unterschrift = fields.bearbeiter || tpl.unterschrift || '';
  if (unterschrift) line(unterschrift, true);
  if (!fields.bearbeiter && tpl.unterschrift2) line(tpl.unterschrift2);

  return doc;
}

function DocumentForms({ data, save }: any) {
  const allTemplates = (data.DokumentVorlage ?? [])
    .filter((t: AnyRecord) => t.status !== 'Archiviert')
    .slice()
    .sort((a: AnyRecord, b: AnyRecord) => Number(a.sortierung ?? 100) - Number(b.sortierung ?? 100));

  const kategorien = Array.from(new Set([
    ...FOLDER_NAMES,
    ...allTemplates.map((t: AnyRecord) => t.kategorie).filter(Boolean),
  ])) as string[];

  const [selectedKategorie, setSelectedKategorie] = useState('Neue Mieter');
  const [sendModal, setSendModal] = useState<{ template: AnyRecord; mode: 'app' | 'mail' | 'fill' | 'auftrag' } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<AnyRecord | null>(null);
  const [actionStatus, setActionStatus] = useState('');
  const [pdfViewer, setPdfViewer] = useState<{ url: string; titel: string } | null>(null);

  const templates = allTemplates.filter((t: AnyRecord) => t.kategorie === selectedKategorie);

  const openFile = async (s3Path: string, titel: string) => {
    try {
      const urlResult = await getUrl({ path: s3Path });
      setPdfViewer({ url: urlResult.url.toString(), titel });
    } catch {
      setActionStatus('Datei konnte nicht geöffnet werden. Bitte Backend-Storage prüfen (npx ampx sandbox).');
    }
  };

  const handleUpload = async (file: File, kategorie: string) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `formulare/${kategorie.replace(/\s+/g, '-')}/${Date.now()}-${safeName}`;
    setActionStatus('Hochladen ...');
    try {
      await uploadData({ path, data: file }).result;
      await save('DokumentVorlage', {
        id: `dv-${uid()}`,
        titel: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        kategorie,
        beschreibung: '',
        status: 'Aktiv',
        datenquelle: file.name.toLowerCase().endsWith('.docx') ? 'KontaktPerson, Liegenschaft' : 'Keine',
        vorlageDateiUrl: path,
        felderJson: '[]',
        sortierung: allTemplates.length * 10 + 10,
      });
      setActionStatus('Erfolgreich hochgeladen.');
      setUploadOpen(false);
    } catch (e: any) {
      setActionStatus(`Upload fehlgeschlagen: ${e?.message ?? String(e)}`);
    }
  };

  const fileExt = (t: AnyRecord) => {
    const m = String(t.vorlageDateiUrl ?? t.titel ?? '').match(/\.([a-zA-Z]+)$/);
    return m ? m[1].toUpperCase() : 'DOK';
  };
  const isDocx = (t: AnyRecord) => String(t.vorlageDateiUrl ?? '').toLowerCase().endsWith('.docx');

  return (
    <div>
      <Title
        title="Formulare"
        sub="Ordner mit Vorlagen, Hausordnung und Dokumenten. Direkt an Mieter versenden oder mit Mieterdaten ausfüllen."
        actions={
          <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
            <KIFlyout label="✦ KI-Dokument" systemPrompt="Du erstellst professionelle Dokumente und Texte für die Immobilienverwaltung Immobilientool. Gib immer einen vollständig ausgefüllten, druckfertigen Text zurück." kontext={`Verfügbare Vorlagen: ${allTemplates.map((t: AnyRecord) => t.titel).join(', ')}`} schnellstarts={['Kündigungsbestätigung für Mieter Müller, Hauptstrasse 1', 'Willkommensschreiben neuer Mieter', 'Mahnung: ausstehende Miete März 2026', 'Übergabeprotokoll Wohnung 3. OG', 'Anschreiben Nebenkostenabrechnung 2025', 'Handwerker-Auftrag Sanitär']} />
            <button className="primary small" onClick={() => setUploadOpen(true)}>Dokument hochladen</button>
            <button className="small" onClick={() => setEditDraft({ id: `dv-${uid()}`, titel: '', kategorie: selectedKategorie, status: 'Aktiv', datenquelle: 'Keine', felderJson: '[]', sortierung: allTemplates.length * 10 + 10 })}>Eintrag erfassen</button>
          </div>
        }
      />

      {actionStatus && (
        <p className="hint" style={{ margin: '0 32px 12px', color: actionStatus.includes('fehlgeschlagen') || actionStatus.includes('nicht') ? '#dc2626' : '#166534' }}>
          {actionStatus}
        </p>
      )}

      <div className="formulare-layout">
        <aside className="formulare-sidebar">
          <h3>Ordner</h3>
          {kategorien.map((kat) => {
            const count = allTemplates.filter((t: AnyRecord) => t.kategorie === kat).length;
            return (
              <button key={kat} className={`folder-btn ${selectedKategorie === kat ? 'active' : ''}`} onClick={() => setSelectedKategorie(kat)}>
                <span>{kat === 'Auftraege' ? '📋' : '📁'} {FOLDER_LABELS[kat] ?? kat}</span>
                {count > 0 && <span className="folder-count">{count}</span>}
              </button>
            );
          })}
        </aside>

        <div className="formulare-main">
          <div className="formulare-folder-header">
            <h2>{selectedKategorie}</h2>
            <button className="primary small" onClick={() => setUploadOpen(true)}>+ Hochladen</button>
          </div>

          {templates.length === 0 ? (
            <p className="hint">Noch keine Dokumente in diesem Ordner. Lade ein PDF oder Word-Dokument hoch.</p>
          ) : (
            <div className="formulare-list">
              {templates.map((t: AnyRecord) => {
                const isAuftrag = t.kategorie === 'Auftraege';
                return (
                  <div
                    key={t.id}
                    className={`formulare-card ${isAuftrag ? 'formulare-card-clickable' : ''}`}
                    onClick={isAuftrag ? () => setSendModal({ template: t, mode: 'auftrag' }) : undefined}
                  >
                    <div className={`formulare-card-icon ext-${fileExt(t).toLowerCase()}`}>{isAuftrag ? '📋' : fileExt(t)}</div>
                    <div className="formulare-card-body">
                      <strong>{t.titel}</strong>
                      {t.beschreibung && <span>{t.beschreibung}</span>}
                      <div className="formulare-card-meta">
                        <Badge tone={t.status === 'Aktiv' ? 'green' : 'orange'}>{t.status ?? 'Entwurf'}</Badge>
                        {isAuftrag && <span style={{ fontSize: 12, color: '#2563eb' }}>Klicken zum Öffnen</span>}
                      </div>
                    </div>
                    <div className="formulare-card-actions" onClick={(e) => e.stopPropagation()}>
                      {t.vorlageDateiUrl && !isAuftrag && <button className="small" onClick={() => openFile(t.vorlageDateiUrl, t.titel)}>Öffnen</button>}
                      {isAuftrag
                        ? <button className="small primary" onClick={(e) => { e.stopPropagation(); setSendModal({ template: t, mode: 'auftrag' }); }}>Auftrag erstellen</button>
                        : isDocx(t)
                          ? <button className="small primary" onClick={() => setSendModal({ template: t, mode: 'fill' })}>Ausfüllen</button>
                          : null
                      }
                      {!isAuftrag && <button className="small" onClick={() => setSendModal({ template: t, mode: 'app' })}>In App senden</button>}
                      {!isAuftrag && <button className="small" onClick={() => setSendModal({ template: t, mode: 'mail' })}>Per Mail</button>}
                      <button className="small" title="Bearbeiten" onClick={(e) => { e.stopPropagation(); setEditDraft({ ...t }); }}>✏</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <Modal title="Dokument hochladen" onClose={() => setUploadOpen(false)}>
          <FormularUpload defaultKategorie={selectedKategorie} kategorien={kategorien} onUpload={handleUpload} onClose={() => setUploadOpen(false)} />
        </Modal>
      )}

      {editDraft && (
        <Modal title="Vorlage bearbeiten" onClose={() => setEditDraft(null)}>
          <div className="form-grid">
            <label>Titel<input value={editDraft.titel ?? ''} onChange={(e) => setEditDraft({ ...editDraft, titel: e.target.value })} /></label>
            <label>Ordner
              <select value={editDraft.kategorie ?? ''} onChange={(e) => setEditDraft({ ...editDraft, kategorie: e.target.value })}>
                {kategorien.map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label>Status
              <select value={editDraft.status ?? 'Aktiv'} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}>
                <option>Entwurf</option><option>Aktiv</option><option>Archiviert</option>
              </select>
            </label>
            <label>Sortierung<input type="number" value={editDraft.sortierung ?? 100} onChange={(e) => setEditDraft({ ...editDraft, sortierung: Number(e.target.value) })} /></label>
            <label style={{ gridColumn: '1/-1' }}>Beschreibung<textarea value={editDraft.beschreibung ?? ''} onChange={(e) => setEditDraft({ ...editDraft, beschreibung: e.target.value })} /></label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button onClick={() => setEditDraft(null)}>Abbrechen</button>
            <button className="primary" onClick={async () => {
              if (!editDraft.titel?.trim()) return;
              await save('DokumentVorlage', editDraft);
              setEditDraft(null);
              setActionStatus('Gespeichert.');
            }}>Speichern</button>
          </div>
        </Modal>
      )}

      {pdfViewer && (
        <div className="modal-backdrop" onClick={() => setPdfViewer(null)}>
          <div className="pdf-viewer-modal" onClick={e => e.stopPropagation()}>
            <div className="pdf-viewer-header">
              <span>📄 {pdfViewer.titel}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={pdfViewer.url} download target="_blank" rel="noreferrer"
                  style={{ border: '1px solid #ddd6cc', background: '#fff', borderRadius: 10, padding: '7px 14px', fontSize: 13, color: '#172033', textDecoration: 'none', fontWeight: 600 }}>
                  ⬇ Herunterladen
                </a>
                <button onClick={() => setPdfViewer(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 999, width: 34, height: 34, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>×</button>
              </div>
            </div>
            <iframe src={pdfViewer.url} className="pdf-viewer-iframe" title={pdfViewer.titel} />
          </div>
        </div>
      )}

      {sendModal && (
        <FormularSendModal
          template={sendModal.template}
          mode={sendModal.mode}
          data={data}
          save={save}
          onClose={() => setSendModal(null)}
          onStatus={setActionStatus}
        />
      )}
    </div>
  );
}

function FormularUpload({ defaultKategorie, kategorien, onUpload, onClose }: any) {
  const [kat, setKat] = useState(defaultKategorie ?? kategorien[0]);
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="form-grid">
      <label>Ordner
        <select value={kat} onChange={(e) => setKat(e.target.value)}>
          {kategorien.map((k: string) => <option key={k}>{k}</option>)}
        </select>
      </label>
      <label>Datei (PDF oder Word .docx)
        <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button onClick={onClose}>Abbrechen</button>
        <button className="primary" disabled={!file} onClick={() => file && onUpload(file, kat)}>Hochladen</button>
      </div>
    </div>
  );
}

function AuftragModal({ template, data, save, onClose, onStatus }: any) {
  let tpl: Record<string, any> = {};
  try { tpl = JSON.parse(template.felderJson ?? '{}'); } catch { /* ignore */ }

  const [selectedLiegenschaftId, setSelectedLiegenschaftId] = useState(data.Liegenschaft[0]?.id ?? '');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedHandwerkerId, setSelectedHandwerkerId] = useState('');
  const [referenz, setReferenz] = useState('');
  const [termin, setTermin] = useState('');
  const [auftragsartIdx, setAuftragsartIdx] = useState(0);
  const [auftragstext, setAuftragstext] = useState('');
  const [selectedGeraetId, setSelectedGeraetId] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [rechnungsadresse, setRechnungsadresse] = useState('');
  const [bearbeiterId, setBearbeiterId] = useState(() => (data.Mitarbeiter ?? [])[0]?.id ?? '');
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const persons = data.KontaktPerson.filter(
    (p: AnyRecord) => p.liegenschaftId === selectedLiegenschaftId && !['Archiviert', 'Gelöscht'].includes(p.kontoStatus ?? '')
  );
  const selectedPerson = data.KontaktPerson.find((p: AnyRecord) => p.id === selectedPersonId);
  const selectedLiegenschaft = data.Liegenschaft.find((l: AnyRecord) => l.id === selectedLiegenschaftId);
  const selectedHandwerker = data.Handwerker.find((h: AnyRecord) => h.id === selectedHandwerkerId);

  useEffect(() => { setSelectedPersonId(persons[0]?.id ?? ''); setSelectedGeraetId(''); }, [selectedLiegenschaftId]);

  const liegenschaftGeraete = (data.Dokument ?? [])
    .filter((d: AnyRecord) => d.liegenschaftId === selectedLiegenschaftId && d.kategorie === 'Gerät')
    .map(geraetFromDokument);

  useEffect(() => {
    const art = AUFTRAGSARTEN[auftragsartIdx];
    if (art?.text) setAuftragstext(art.text);
  }, [auftragsartIdx]);

  useEffect(() => {
    if (!selectedGeraetId) return;
    const gerät = liegenschaftGeraete.find((g: AnyRecord) => g.id === selectedGeraetId);
    if (!gerät) return;
    const matchIdx = AUFTRAGSARTEN.findIndex((a) => a.geraetTyp === (gerät.typ || gerät.dateiname));
    if (matchIdx > 0) setAuftragsartIdx(matchIdx);
  }, [selectedGeraetId]);

  const buildFields = () => {
    const liegenschaftText = selectedLiegenschaft
      ? `${selectedLiegenschaft.liegenschaftNummer ? selectedLiegenschaft.liegenschaftNummer + ' · ' : ''}${selectedLiegenschaft.name}, ${selectedLiegenschaft.strasse}, ${selectedLiegenschaft.plz} ${selectedLiegenschaft.ort}`
      : '';
    return {
      datum: new Date().toLocaleDateString('de-CH'),
      liegenschaft: liegenschaftText,
      mieter: selectedPerson ? personDisplayName(selectedPerson) : '',
      telefon: selectedPerson?.telefon ?? '',
      referenz,
      termin,
      auftragstext,
      hinweis,
      rechnungsadresse,
      bearbeiter: (data.Mitarbeiter ?? []).find((m: AnyRecord) => m.id === bearbeiterId)?.name ?? '',
    };
  };

  // Live preview — debounced 400ms
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const doc = await genAuftragPdf(template, buildFields(), selectedHandwerker);
        if (cancelled) return;
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch { /* ignore preview errors */ }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedLiegenschaftId, selectedPersonId, selectedHandwerkerId, selectedGeraetId, auftragsartIdx, referenz, termin, auftragstext, hinweis, rechnungsadresse, bearbeiterId]);

  const getDoc = () => genAuftragPdf(template, buildFields(), selectedHandwerker);

  const herunterladen = async () => {
    setBusy(true);
    try {
      const doc = await getDoc();
      const fname = `Auftrag-${template.titel.replace(/[^a-zA-Z0-9]+/g, '-')}-${new Date().toLocaleDateString('de-CH').replace(/\./g, '-')}.pdf`;
      doc.save(fname);
      onStatus(`"${fname}" heruntergeladen.`);
    } catch (e: any) { onStatus(`Fehler: ${e?.message}`); }
    setBusy(false);
  };

  const drucken = async () => {
    setBusy(true);
    try {
      const doc = await getDoc();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      win?.addEventListener('load', () => { win.print(); });
    } catch (e: any) { onStatus(`Fehler: ${e?.message}`); }
    setBusy(false);
  };

  const speichern = async (target: 'liegenschaft' | 'mieter') => {
    if (!selectedLiegenschaftId) return;
    setBusy(true);
    try {
      const doc = await getDoc();
      const blob = doc.output('blob');
      const fname = `Auftrag-${template.titel.replace(/[^a-zA-Z0-9]+/g, '-')}-${new Date().toLocaleDateString('de-CH').replace(/\./g, '-')}.pdf`;
      const path = `dokumente/${selectedLiegenschaftId}/${Date.now()}-${fname}`;
      const { uploadData, getUrl } = await import('aws-amplify/storage');
      await uploadData({ path, data: blob }).result;
      const urlResult = await getUrl({ path });
      await save('Dokument', {
        id: `dok-${uid()}`,
        liegenschaftId: selectedLiegenschaftId,
        personId: target === 'mieter' && selectedPerson ? selectedPerson.id : undefined,
        titel: template.titel,
        kategorie: 'Auftrag',
        jahr: new Date().getFullYear(),
        dateiname: fname,
        dateiUrl: urlResult.url.toString(),
        sichtbarFuerKunden: false,
        freigabeStatus: 'Intern',
        volltext: '',
      });
      setSaveMsg(`Gespeichert bei ${target === 'mieter' && selectedPerson ? personDisplayName(selectedPerson) : selectedLiegenschaft?.name ?? 'Liegenschaft'}.`);
    } catch (e: any) { onStatus(`Fehler beim Speichern: ${e?.message}`); }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal auftrag-wide-modal">
        <div className="modal-head">
          <h2>📋 {template.titel}</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="auftrag-editor-layout">
          {/* LEFT — form */}
          <div className="auftrag-editor-form">
            <FormularKIAssistent
              data={data}
              onFill={daten => {
                if (daten.liegenschaftId) setSelectedLiegenschaftId(daten.liegenschaftId);
                if (daten.personId) setSelectedPersonId(daten.personId);
                if (daten.handwerkerId) setSelectedHandwerkerId(daten.handwerkerId);
                if (daten.auftragstext) setAuftragstext(daten.auftragstext);
                if (daten.termin) setTermin(daten.termin);
                if (daten.referenz) setReferenz(daten.referenz);
                if (daten.hinweis) setHinweis(daten.hinweis);
                if (daten.auftragsartLabel) {
                  const idx = AUFTRAGSARTEN.findIndex((a: any) => a.label === daten.auftragsartLabel);
                  if (idx >= 0) setAuftragsartIdx(idx);
                }
              }}
            />
            <div className="auftrag-form-section">
              <h3>Liegenschaft & Person</h3>
              <label>Liegenschaft *
                <SearchSelect
                  value={selectedLiegenschaftId}
                  onChange={v => setSelectedLiegenschaftId(v)}
                  placeholder="— Liegenschaft suchen —"
                  options={data.Liegenschaft
                    .filter((l: AnyRecord) => !['Archiviert','Gelöscht'].includes(l.status))
                    .map((l: AnyRecord) => ({ value: l.id, label: `${l.liegenschaftNummer} · ${l.strasse ?? l.name}` }))}
                />
              </label>
              <label>Mieter / Person
                <SearchSelect
                  value={selectedPersonId}
                  onChange={setSelectedPersonId}
                  placeholder="— Person suchen —"
                  disabled={!selectedLiegenschaftId}
                  options={persons.map((p: AnyRecord) => ({ value: p.id, label: `${personDisplayName(p)} (${p.rolle})` }))}
                />
              </label>
            </div>

            <div className="auftrag-form-section">
              <h3>Handwerker</h3>
              <label>Handwerker / Firma
                <SearchSelect
                  value={selectedHandwerkerId}
                  onChange={setSelectedHandwerkerId}
                  placeholder="— Firma oder Gewerk suchen —"
                  options={(data.Handwerker ?? [])
                    .filter((h: AnyRecord) => h.status !== 'Archiviert' && h.status !== 'Gelöscht')
                    .map((h: AnyRecord) => ({ value: h.id, label: `${h.firma} · ${h.gewerk}` }))}
                />
              </label>
              {selectedHandwerker && (
                <div className="auftrag-hw-info">
                  {selectedHandwerker.kontaktperson && <span>👤 {selectedHandwerker.kontaktperson}</span>}
                  {selectedHandwerker.telefon && <span>📞 {selectedHandwerker.telefon}</span>}
                  {selectedHandwerker.email && <span>✉ {selectedHandwerker.email}</span>}
                </div>
              )}
            </div>

            <div className="auftrag-form-section">
              <h3>Auftragsdetails</h3>
              {liegenschaftGeraete.length > 0 && (
                <label>Gerät / Anlage
                  <select value={selectedGeraetId} onChange={(e) => setSelectedGeraetId(e.target.value)}>
                    <option value="">— Gerät wählen (optional) —</option>
                    {liegenschaftGeraete.map((g: AnyRecord) => (
                      <option key={g.id} value={g.id}>{g.typ || g.dateiname} · {g.titel}{g.standort ? ' (' + g.standort + ')' : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>Auftragsart
                <select value={auftragsartIdx} onChange={(e) => setAuftragsartIdx(Number(e.target.value))}>
                  {AUFTRAGSARTEN.map((a, i) => (
                    <option key={i} value={i}>{a.label}</option>
                  ))}
                </select>
              </label>
              <label>Auftragstext <span style={{ color: '#2563eb', fontSize: 11 }}>(aus Auftragsart vorausgefüllt, editierbar)</span>
                <textarea rows={4} value={auftragstext} onChange={(e) => setAuftragstext(e.target.value)} style={{ border: '1px solid #ddd6cc', borderRadius: 12, padding: '10px 12px', fontSize: 13, resize: 'vertical', width: '100%' }} />
              </label>
              <label>Unsere Referenz
                <input value={referenz} onChange={(e) => setReferenz(e.target.value)} placeholder="z.B. Fallnummer oder Stichwort" />
              </label>
              <label>Termin
                <input value={termin} onChange={(e) => setTermin(e.target.value)} placeholder="möglichst bald" />
              </label>
              <label>Hinweis (für Handwerker)
                <textarea rows={2} value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="z.B. Schlüssel bei uns im Büro, bitte vorab anrufen ..." style={{ border: '1px solid #ddd6cc', borderRadius: 12, padding: '10px 12px', fontSize: 13, resize: 'vertical', width: '100%' }} />
              </label>
              <label>Rechnungsadresse
                <input value={rechnungsadresse} onChange={(e) => setRechnungsadresse(e.target.value)} placeholder="z.B. Meinefirma GmbH, Musterstrasse 1" />
              </label>
            </div>

            <div className="auftrag-form-section">
              <h3>Bearbeiter / Unterschrift</h3>
              <label>Ausgefüllt von
                <select value={bearbeiterId} onChange={(e) => setBearbeiterId(e.target.value)}>
                  <option value="">— Person wählen —</option>
                  {(data.Mitarbeiter ?? []).filter((m: AnyRecord) => m.status !== 'Inaktiv').map((m: AnyRecord) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.funktion || m.gruppe}</option>
                  ))}
                </select>
              </label>
            </div>

            {saveMsg && <p className="hint" style={{ color: '#166534' }}>{saveMsg}</p>}

            <div className="auftrag-actions">
              <div className="auftrag-save-group">
                <span style={{ fontSize: 12, color: '#6f7b8e', fontWeight: 700 }}>Speichern bei:</span>
                <button disabled={!selectedLiegenschaftId || busy} onClick={() => speichern('liegenschaft')}>📁 Liegenschaft</button>
                <button disabled={!selectedPersonId || busy} onClick={() => speichern('mieter')}>👤 Mieter</button>
              </div>
              <div className="auftrag-save-group">
                <button disabled={busy} onClick={drucken}>🖨 Drucken</button>
                <button className="primary" disabled={busy} onClick={herunterladen}>⬇ Herunterladen</button>
              </div>
            </div>
          </div>

          {/* RIGHT — live preview */}
          <div className="auftrag-preview-pane">
            <div className="auftrag-preview-label">Live-Vorschau</div>
            {previewUrl
              ? <iframe src={previewUrl} className="auftrag-preview-iframe" title="Vorschau" />
              : <div className="auftrag-preview-placeholder">Vorschau wird geladen …</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function FormularSendModal({ template, mode, data, save, onClose, onStatus }: any) {
  if (mode === 'auftrag') {
    return <AuftragModal template={template} data={data} save={save} onClose={onClose} onStatus={onStatus} />;
  }

  const [selectedLiegenschaftId, setSelectedLiegenschaftId] = useState(data.Liegenschaft[0]?.id ?? '');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [busy, setBusy] = useState(false);

  const persons = data.KontaktPerson.filter(
    (p: AnyRecord) => p.liegenschaftId === selectedLiegenschaftId && !['Archiviert', 'Gelöscht'].includes(p.kontoStatus ?? '')
  );
  const selectedPerson = data.KontaktPerson.find((p: AnyRecord) => p.id === selectedPersonId);
  const selectedLiegenschaft = data.Liegenschaft.find((l: AnyRecord) => l.id === selectedLiegenschaftId);

  useEffect(() => { setSelectedPersonId(persons[0]?.id ?? ''); }, [selectedLiegenschaftId]);

  const mergeData = selectedPerson ? buildMergeData(selectedPerson, selectedLiegenschaft ?? {}) : null;

  const sendInApp = async () => {
    if (!selectedPerson) return;
    setBusy(true);
    await save('Dokument', {
      id: `dok-${uid()}`,
      liegenschaftId: selectedLiegenschaftId || undefined,
      personId: selectedPerson.id,
      titel: template.titel,
      kategorie: template.kategorie ?? 'Allgemein',
      jahr: new Date().getFullYear(),
      dateiname: template.vorlageDateiUrl?.split('/').pop() ?? template.titel,
      dateiUrl: template.vorlageDateiUrl ?? '',
      sichtbarFuerKunden: true,
      freigabeStatus: 'Freigegeben',
      volltext: '',
    });
    setBusy(false);
    onStatus(`"${template.titel}" wurde ${personDisplayName(selectedPerson)} in der App zugewiesen.`);
    onClose();
  };

  const sendMail = () => {
    if (!selectedPerson?.email) return;
    const vorname = splitPersonName(selectedPerson).vorname;
    const subject = encodeURIComponent(`${template.titel} – Immobilientool`);
    const body = encodeURIComponent(
      `Guten Tag ${vorname || personDisplayName(selectedPerson)}\n\nAnbei erhalten Sie: ${template.titel}.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nFreundliche Grüsse\nImmobilientool\nMusterstrasse 1, 4000 Basel\nTel. +41 00 000 00 00`
    );
    window.open(`mailto:${selectedPerson.email}?subject=${subject}&body=${body}`, '_self');
    onClose();
  };

  const fillDocx = async () => {
    if (!selectedPerson || !template.vorlageDateiUrl || !mergeData) return;
    setBusy(true);
    try {
      const urlResult = await getUrl({ path: template.vorlageDateiUrl });
      const response = await fetch(urlResult.url.toString());
      const arrayBuffer = await response.arrayBuffer();
      const { default: PizZip } = await import('pizzip');
      const { default: Docxtemplater } = await import('docxtemplater');
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render(mergeData);
      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const fname = `${template.titel}-${personDisplayName(selectedPerson)}.docx`.replace(/\s+/g, '-');
      downloadBlob(blob, fname);
      onStatus(`Word-Dokument "${fname}" heruntergeladen.`);
    } catch (e: any) {
      onStatus(`Fehler beim Ausfüllen: ${e?.message ?? String(e)}`);
    }
    setBusy(false);
    onClose();
  };

  const modalTitle = mode === 'app' ? 'In App senden' : mode === 'mail' ? 'Per Mail senden' : 'Vorlage ausfüllen';

  return (
    <Modal title={`${modalTitle}: ${template.titel}`} onClose={onClose}>
      <div className="form-grid">
        <label>Liegenschaft
          <select value={selectedLiegenschaftId} onChange={(e) => setSelectedLiegenschaftId(e.target.value)}>
            <option value="">— Liegenschaft wählen —</option>
            {data.Liegenschaft.map((l: AnyRecord) => (
              <option key={l.id} value={l.id}>{l.liegenschaftNummer} · {l.name}</option>
            ))}
          </select>
        </label>
        <label>Person / Mieter
          <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)}>
            <option value="">— Person wählen —</option>
            {persons.map((p: AnyRecord) => (
              <option key={p.id} value={p.id}>{personDisplayName(p)} ({p.rolle})</option>
            ))}
          </select>
        </label>

        {mode === 'mail' && selectedPerson && (
          <div style={{ gridColumn: '1/-1' }}>
            <p className="hint"><strong>An:</strong> {selectedPerson.email || '⚠ Keine E-Mail hinterlegt'}<br />Öffnet Ihr Mail-Programm mit vorausgefülltem Betreff und Text.</p>
          </div>
        )}

        {mode === 'fill' && mergeData && (
          <div style={{ gridColumn: '1/-1' }}>
            <p className="hint" style={{ marginBottom: 10 }}>Das Word-Dokument wird mit diesen Daten ausgefüllt und heruntergeladen:</p>
            <div className="template-field-grid">
              {Object.entries(mergeData).map(([k, v]) => (
                <span key={k} title={`{{${k}}}`}><strong>{'{{'}{k}{'}}'}</strong> → {String(v) || '—'}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button onClick={onClose}>Abbrechen</button>
        {mode === 'app' && <button className="primary" disabled={!selectedPersonId || busy} onClick={sendInApp}>{busy ? 'Wird gespeichert ...' : 'In App zuweisen'}</button>}
        {mode === 'mail' && <button className="primary" disabled={!selectedPersonId || !selectedPerson?.email} onClick={sendMail}>Mail öffnen</button>}
        {mode === 'fill' && <button className="primary" disabled={!selectedPersonId || busy} onClick={fillDocx}>{busy ? 'Wird erstellt ...' : 'Ausfüllen & herunterladen'}</button>}
      </div>
    </Modal>
  );
}

function Documents({ data, propertyId, employeeId, employee, save }: any) {
  const model = employee ? 'MitarbeiterDokument' : 'Dokument';

  const docs = data[model].filter((d: AnyRecord) =>
    employee ? d.mitarbeiterId === employeeId : d.liegenschaftId === propertyId
  );
  const propertyPersons = employee
    ? []
    : (data.KontaktPerson ?? []).filter((p: AnyRecord) =>
      p.liegenschaftId === propertyId && !['Archiviert', 'Gelöscht'].includes(p.kontoStatus ?? '')
    );

  const [draft, setDraft] = useState({
    titel: '',
    kategorie: employee ? 'Lohnabrechnung' : 'Mietvertrag',
    jahr: thisYear,
    datum: new Date().toISOString().slice(0, 10),
    dateiname: '',
    dateiUrl: '',
    liegenschaftId: propertyId,
    personId: '',
    mitarbeiterId: employeeId,
    sichtbarFuerKunden: true,
    vertraulich: employee ? true : false,
  });

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');

  const kategorien = employee
    ? ['Lohnabrechnung', 'Arbeitsvertrag', 'Bestätigung', 'Personalakte', 'Sonstiges']
    : ['Mietvertrag', 'Hausordnung', 'Versicherung', 'Rechnung', 'Abnahmeprotokoll', 'Plan', 'Schlüsselquittung', 'Rapport', 'Offerte', 'Sonstiges'];

  const jahre = Array.from({ length: 8 }, (_, i) => thisYear - 3 + i);

  const handleUploadAndSave = async () => {
    if (!draft.titel.trim()) {
      setUploadStatus('Bitte Titel eingeben.');
      return;
    }

    let dateiname = draft.dateiname;
    let dateiUrl = draft.dateiUrl;

    try {
      setUploadStatus('Lade Datei hoch ...');

      if (file) {
        const safeName = file.name.replaceAll(' ', '_');
        const path = employee
          ? `mitarbeiter/${employeeId}/${Date.now()}-${safeName}`
          : `dokumente/${propertyId}/${Date.now()}-${safeName}`;

        const uploadTask = uploadData({
          path,
          data: file,
        });

        await uploadTask.result;

        const urlResult = await getUrl({ path });

        dateiname = file.name;
        dateiUrl = urlResult.url.toString();
      }

      const item = {
        ...draft,
        id: `${model}-${uid()}`,
        jahr: Number(draft.jahr),
        dateiname,
        dateiUrl,
        personId: employee ? undefined : (draft.personId || undefined),
        createdAt: new Date(draft.datum).toISOString(),
        updatedAt: nowIso(),
      };

      delete (item as any).datum;

      await save(model, item);

      setDraft({
        titel: '',
        kategorie: employee ? 'Lohnabrechnung' : 'Mietvertrag',
        jahr: thisYear,
        datum: new Date().toISOString().slice(0, 10),
        dateiname: '',
        dateiUrl: '',
        liegenschaftId: propertyId,
        personId: '',
        mitarbeiterId: employeeId,
        sichtbarFuerKunden: true,
        vertraulich: employee ? true : false,
      });

      setFile(null);
      setUploadStatus('Dokument gespeichert.');
    } catch (error) {
      console.warn(error);
      setUploadStatus('Upload/Speichern fehlgeschlagen.');
    }
  };

  return (
    <Panel title={employee ? 'Mitarbeiterdokumente / Lohnunterlagen' : 'Dokumente'}>
      <div className="form-grid">
        <label>
          Datei hochladen
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              setFile(selected);
              setDraft({
                ...draft,
                dateiname: selected?.name ?? '',
                titel: draft.titel || selected?.name?.replace(/\.[^/.]+$/, '') || '',
              });
            }}
          />
        </label>

        <label>
          Titel
          <input
            value={draft.titel}
            onChange={(e) => setDraft({ ...draft, titel: e.target.value })}
            placeholder=""
          />
        </label>

        <label>
          Kategorie
          <select
            value={draft.kategorie}
            onChange={(e) => setDraft({ ...draft, kategorie: e.target.value })}
          >
            {kategorien.map((kategorie) => (
              <option key={kategorie} value={kategorie}>
                {kategorie}
              </option>
            ))}
          </select>
        </label>

        <label>
          Jahr
          <select
            value={draft.jahr}
            onChange={(e) => setDraft({ ...draft, jahr: Number(e.target.value) })}
          >
            {jahre.map((jahr) => (
              <option key={jahr} value={jahr}>
                {jahr}
              </option>
            ))}
          </select>
        </label>

        <label>
          Datum
          <input
            type="date"
            value={draft.datum}
            onChange={(e) => setDraft({ ...draft, datum: e.target.value })}
          />
        </label>

        {!employee && (
          <label>
            Mieter / Eigentümer
            <select
              value={draft.personId}
              onChange={(e) => setDraft({ ...draft, personId: e.target.value })}
            >
              <option value="">Liegenschaft allgemein / intern</option>
              {propertyPersons.map((person: AnyRecord) => (
                <option key={person.id} value={person.id}>
                  {personDisplayName(person)} ({person.rolle})
                </option>
              ))}
            </select>
          </label>
        )}

        {!employee && (
          <label>
            Sichtbarkeit
            <select
              value={draft.sichtbarFuerKunden ? 'true' : 'false'}
              onChange={(e) => setDraft({ ...draft, sichtbarFuerKunden: e.target.value === 'true' })}
            >
              <option value="true">Kunde sichtbar</option>
              <option value="false">Intern</option>
            </select>
          </label>
        )}

        {employee && (
          <label>
            Vertraulich
            <select
              value={draft.vertraulich ? 'true' : 'false'}
              onChange={(e) => setDraft({ ...draft, vertraulich: e.target.value === 'true' })}
            >
              <option value="true">Vertraulich</option>
              <option value="false">Normal</option>
            </select>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
        {uploadStatus && <span className="hint">{uploadStatus}</span>}
        <button className="primary" onClick={handleUploadAndSave}>
          Dokument hochladen & speichern
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {docs.length === 0 ? (
          <p className="hint">Noch keine Dokumente vorhanden.</p>
        ) : (
          docs
            .slice()
            .sort((a: AnyRecord, b: AnyRecord) =>
              String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
            )
            .map((d: AnyRecord) => (
              <div className="list-row" key={d.id}>
                <div>
                  <strong>{d.jahr} · {d.titel}</strong>
                  <span>
                    {d.kategorie} · {d.dateiname || 'Keine Datei'} · {deDate(d.createdAt)}
                    {!employee && d.personId ? ` · ${personDisplayName(propertyPersons.find((p: AnyRecord) => p.id === d.personId) ?? {})}` : ''}
                    {!employee && d.belegId ? ` · Beleg ${d.belegId}` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {d.dateiUrl && <DocOpenButton url={d.dateiUrl} titel={d.titel} />}
                  <Badge>{employee ? (d.vertraulich ? 'Vertraulich' : 'Normal') : d.sichtbarFuerKunden ? 'Kunde sichtbar' : 'Intern'}</Badge>
                </div>
              </div>
            ))
        )}
      </div>
    </Panel>
  );
}
function Closings({ data, propertyId, save }: any) { const [draft] = useState({ titel: '', jahr: thisYear, kategorie: 'Jahresrechnung', dateiname: '', liegenschaftId: propertyId, sichtbarFuerEigentuemer: true, sichtbarFuerMieter: false }); return <Panel title="Abschlüsse"><EditFields item={draft} fields={['titel','jahr','kategorie','dateiname','dateiUrl','sichtbarFuerEigentuemer','sichtbarFuerMieter']} onSave={(x) => save('Abschluss', { ...x, id: `ab-${uid()}` })} />{data.Abschluss.filter((a: AnyRecord) => a.liegenschaftId === propertyId).map((a: AnyRecord) => <div className="list-row"><div><strong>{a.jahr} · {a.titel}</strong><span>{a.kategorie} · {a.dateiname}</span></div></div>)}</Panel>; }
const statusForKey = (key: AnyRecord) => ['Verfügbar', 'Ausgegeben'].includes(key.status) ? (key.status === 'Ausgegeben' ? 'Bei Mieter/Eigentümer' : 'Im Haus') : key.status || 'Im Haus';
const keyStatusTone = (status: string) => status === 'Im Haus' || status === 'Verfügbar' ? 'green' : status === 'Verloren' ? 'red' : status === 'Archiviert' ? '' : 'orange';
const keyHolder = (data: Record<string, AnyRecord[]>, key: AnyRecord) => key.ausgegebenAn || key.empfaengerName || (key.personId ? personName(data, key.personId) : '') || (key.handwerkerId ? workerName(data, key.handwerkerId) : '') || key.standort || 'Verwaltung / Haus';
const keyHistory = (key: AnyRecord): AnyRecord[] => {
  try {
    const parsed = JSON.parse(key.verlaufJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const appendKeyHistory = (key: AnyRecord, text: string, details?: string) => JSON.stringify([
  { id: `kh-${uid()}`, zeit: nowIso(), text, details },
  ...keyHistory(key),
].slice(0, 25));
const keyReceiptFileName = (key: AnyRecord) => `schluesselquittung-${String(key.nummer || key.id).replace(/[^a-z0-9-]+/gi, '-')}.pdf`;
type SignaturePoint = { x: number; y: number };
type SignatureStroke = SignaturePoint[];

function pdfLiteral(value: string) {
  const normalized = String(value || '').replace(/\r?\n/g, ' ');
  let out = '';

  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (char === '\\' || char === '(' || char === ')') {
      out += `\\${char}`;
    } else if (code < 32 || code > 126) {
      out += code <= 255 ? `\\${code.toString(8).padStart(3, '0')}` : '?';
    } else {
      out += char;
    }
  }

  return `(${out})`;
}

function makePdf(objects: string[]) {
  const header = '%PDF-1.4\n';
  const bodyParts: string[] = [];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const part = `${index + 1} 0 obj\n${object}\nendobj\n`;
    bodyParts.push(part);
    offset += part.length;
  });
  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}\n%%EOF`,
  ].join('\n');
  return new Blob([header, ...bodyParts, xref], { type: 'application/pdf' });
}

function generateKeyReceiptPdfBlob(input: AnyRecord) {
  const line = (x1: number, y1: number, x2: number, y2: number) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const rect = (x: number, y: number, w: number, h: number) => `${x} ${y} ${w} ${h} re S`;
  const text = (x: number, y: number, value: string, size = 11, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td ${pdfLiteral(value)} Tj ET`;
  const wrap = (value: string, max = 52) => {
    const words = String(value || '-').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > max && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) lines.push(current);
    return lines.length ? lines.slice(0, 2) : ['-'];
  };
  const multilineText = (x: number, y: number, value: string, size = 11) => wrap(value).map((lineText, index) => text(x, y - (index * 14), lineText, size)).join('\n');
  const row = (y: number, label: string, value: string, height = 41) => [
    rect(40, y - height, 515, height),
    text(64, y - 25, label, 11, true),
    multilineText(170, y - 25, value || '-', 11),
  ].join('\n');
  const signaturePaths = (input.signatureStrokes || [])
    .filter((stroke: SignatureStroke) => stroke.length > 1)
    .map((stroke: SignatureStroke) => {
      const points = stroke.map((point) => ({
        x: 50 + (point.x / 520) * 300,
        y: 165 + ((150 - point.y) / 150) * 62,
      }));
      return `${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} m ${points.slice(1).map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)} l`).join(' ')} S`;
    })
    .join('\n');

  const commands = [
    '0.2 w',
    text(40, 790, 'IMMOBILIENTOOL IMMOBILIEN', 17, true),
    text(40, 772, 'Musterstrasse 1 · 4000 Basel · +41 00 000 00 00', 8),
    text(40, 754, 'info@example.invalid', 8),
    text(56, 705, 'SCHLÜSSELQUITTUNG', 20, true),
    line(40, 682, 555, 682),
    line(40, 678, 555, 678),
    row(620, 'Liegenschaft', input.liegenschaft, 44),
    row(568, 'Mieter', input.empfaenger, 44),
    row(516, 'Objekt', input.objekt, 44),
    row(464, 'Schliessung', input.schliessung, 44),
    row(412, 'Anz. Schlüssel/', String(input.anzahl || '1'), 44),
    text(64, 374, 'Bezeichnung', 11, true),
    multilineText(170, 374, input.bezeichnung || '-', 11),
    text(48, 318, 'Diverses:', 11, true),
    multilineText(126, 318, input.bemerkung || '-', 11),
    text(48, 246, 'Schlüssel erhalten bescheinigt', 11),
    signaturePaths ? '1.15 w' : '',
    signaturePaths,
    '0.2 w',
    line(48, 150, 360, 150),
    text(48, 133, 'Datum und Unterschrift', 10),
    text(48, 60, input.ortDatum, 10),
  ].join('\n');

  const stream = `${commands}\n`;
  return makePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ]);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function Keys({ data, property, propertyId, save, remove, setSelectedWorkerId, setView }: any) {
  const propertyKeys = data.Schluessel.filter((s: AnyRecord) => s.liegenschaftId === propertyId);
  const propertyPersons = data.KontaktPerson.filter((p: AnyRecord) => p.liegenschaftId === propertyId);
  const [selectedKeyId, setSelectedKeyId] = useState(propertyKeys[0]?.id ?? '');
  const selectedKey = propertyKeys.find((key: AnyRecord) => key.id === selectedKeyId) ?? propertyKeys[0];
  const objektOptionen = Array.from(new Set(
    data.KontaktPerson
      .filter((p: AnyRecord) => p.liegenschaftId === propertyId)
      .map((p: AnyRecord) => String(p.wohnungsNummer ?? '').trim())
      .filter(Boolean)
  )).sort();

  const [newKey, setNewKey] = useState({
    bezeichnung: '',
    nummer: '',
    anzahl: 1,
    schliessung: '',
    objekt: '',
    standort: 'Verwaltung / Haus',
    personId: '',
    bemerkung: '',
  });
  const [issueDraft, setIssueDraft] = useState({
    personId: '',
    empfaengerTyp: 'Mieter',
    empfaengerName: '',
    empfaengerAdresse: '',
    objekt: '',
    anzahl: 1,
    ausgabeOrt: 'Basel',
    ausgegebenAm: new Date().toISOString().slice(0, 10),
    ausgegebenVon: '',
    bemerkung: '',
  });
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [signatureStrokes, setSignatureStrokes] = useState<SignatureStroke[]>([]);
  const [activeSignatureStroke, setActiveSignatureStroke] = useState<SignatureStroke>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!selectedKey && propertyKeys[0]?.id) setSelectedKeyId(propertyKeys[0].id);
  }, [selectedKey, propertyKeys]);

  useEffect(() => {
    if (!selectedKey) return;
    setIssueDraft((old) => ({
      ...old,
      objekt: selectedKey.objekt || old.objekt || '',
      anzahl: Number(selectedKey.anzahl || old.anzahl || 1),
      bemerkung: selectedKey.bemerkung || old.bemerkung || '',
    }));
  }, [selectedKey?.id]);

  const createKey = async () => {
    if (!newKey.bezeichnung.trim() || !newKey.nummer.trim()) {
      setStatus('Bitte Bezeichnung und Schlüsselnummer erfassen.');
      return;
    }
    const item = {
      ...newKey,
      id: `key-${uid()}`,
      liegenschaftId: propertyId,
      anzahl: Number(newKey.anzahl || 1),
      status: 'Im Haus',
      verlaufJson: JSON.stringify([{ id: `kh-${uid()}`, zeit: nowIso(), text: 'Schlüssel im Haus erfasst', details: newKey.standort }]),
      createdAt: nowIso(),
    };
    await save('Schluessel', item);
    setSelectedKeyId(item.id);
    setNewKey({ bezeichnung: '', nummer: '', anzahl: 1, schliessung: '', objekt: '', standort: 'Verwaltung / Haus', personId: '', bemerkung: '' });
    setStatus('Schlüssel erfasst.');
  };

  const selectPerson = (personId: string) => {
    const person = propertyPersons.find((p: AnyRecord) => p.id === personId);
    setIssueDraft({
      ...issueDraft,
      personId,
      empfaengerTyp: person?.rolle || 'Mieter',
      empfaengerName: person ? personDisplayName(person) : '',
      empfaengerAdresse: person?.adresse || `${property.strasse ?? ''}, ${property.plz ?? ''} ${property.ort ?? ''}`,
      objekt: issueDraft.objekt || person?.wohnungsNummer || '',
    });
  };

  const receiptPayloadForKey = (key: AnyRecord, overrides: AnyRecord = {}) => ({
    liegenschaft: `${property.liegenschaftNummer ?? ''} - ${property.name ?? ''}`.trim(),
    empfaenger: overrides.empfaengerName || key.empfaengerName || key.ausgegebenAn || keyHolder(data, key),
    objekt: overrides.objekt || key.objekt || property.name,
    schliessung: key.schliessung || key.nummer,
    anzahl: overrides.anzahl || key.anzahl || 1,
    bezeichnung: key.bezeichnung,
    bemerkung: overrides.bemerkung ?? key.bemerkung ?? '',
    ortDatum: `${overrides.ausgabeOrt || key.ausgabeOrt || property.ort || ''}, ${overrides.ausgegebenAm || key.ausgegebenAm || new Date().toISOString().slice(0, 10)}`,
    signatureStrokes: overrides.signatureStrokes || [],
  });

  const downloadReceiptAgain = () => {
    if (!selectedKey) return;
    const blob = generateKeyReceiptPdfBlob(receiptPayloadForKey(selectedKey));
    downloadBlob(blob, selectedKey.quittungDateiname || keyReceiptFileName(selectedKey));
  };

  const deleteKey = async () => {
    if (!selectedKey) return;
    const ok = window.confirm(`Schlüssel "${selectedKey.bezeichnung} · ${selectedKey.nummer}" wirklich löschen?`);
    if (!ok) return;

    const nextKey = propertyKeys.find((key: AnyRecord) => key.id !== selectedKey.id);
    setSelectedKeyId(nextKey?.id ?? '');
    await remove('Schluessel', selectedKey.id);
    setStatus('Schlüssel gelöscht.');
  };

  const createReceipt = async () => {
    if (!selectedKey) return;
    if (!issueDraft.empfaengerName.trim()) {
      setStatus('Bitte Empfänger erfassen.');
      return;
    }
    setStatus('Erzeuge Schlüsselquittung ...');
    const filename = keyReceiptFileName(selectedKey);
    const receiptPayload = receiptPayloadForKey(selectedKey, issueDraft);
    const blob = generateKeyReceiptPdfBlob(receiptPayload);
    downloadBlob(blob, filename);

    let dateiUrl = '';
    try {
      const path = `dokumente/${propertyId}/schluesselquittungen/${Date.now()}-${filename}`;
      await uploadData({ path, data: blob }).result;
      const urlResult = await getUrl({ path });
      dateiUrl = urlResult.url.toString();
    } catch (error) {
      console.warn(error);
      setStatus('PDF wurde lokal erzeugt. Upload in AWS ist fehlgeschlagen.');
    }

    const docId = `doc-${uid()}`;
    if (dateiUrl) {
      await save('Dokument', {
        id: docId,
        liegenschaftId: propertyId,
        personId: issueDraft.personId || undefined,
        titel: `Schlüsselquittung ${selectedKey.bezeichnung}`,
        kategorie: 'Schlüsselquittung',
        jahr: new Date(issueDraft.ausgegebenAm).getFullYear(),
        dateiname: filename,
        dateiUrl,
        version: 1,
        freigabeStatus: 'Intern',
        sichtbarFuerKunden: false,
        volltext: `${selectedKey.bezeichnung} ${selectedKey.nummer} ${issueDraft.empfaengerName}`,
        createdAt: new Date(issueDraft.ausgegebenAm).toISOString(),
      });
    }

    await save('Schluessel', {
      ...selectedKey,
      personId: issueDraft.personId || null,
      handwerkerId: null,
      status: issueDraft.empfaengerTyp === 'Handwerker' ? 'Bei Handwerker' : 'Bei Mieter/Eigentümer',
      ausgegebenAn: issueDraft.empfaengerName,
      ausgegebenAm: issueDraft.ausgegebenAm,
      rueckgabeAm: null,
      objekt: issueDraft.objekt || selectedKey.objekt,
      anzahl: Number(issueDraft.anzahl || selectedKey.anzahl || 1),
      empfaengerTyp: issueDraft.empfaengerTyp,
      empfaengerName: issueDraft.empfaengerName,
      empfaengerAdresse: issueDraft.empfaengerAdresse,
      ausgabeOrt: issueDraft.ausgabeOrt,
      ausgegebenVon: issueDraft.ausgegebenVon,
      bemerkung: issueDraft.bemerkung || selectedKey.bemerkung,
      quittungDokumentId: dateiUrl ? docId : selectedKey.quittungDokumentId,
      quittungDateiUrl: dateiUrl || selectedKey.quittungDateiUrl,
      quittungDateiname: dateiUrl ? filename : selectedKey.quittungDateiname,
      letzteBewegungAm: nowIso(),
      verlaufJson: appendKeyHistory(selectedKey, 'Schlüssel ausgegeben', `${issueDraft.empfaengerName} · ${issueDraft.ausgegebenAm}`),
    });
    setStatus(dateiUrl ? 'PDF erzeugt, heruntergeladen und in AWS gespeichert.' : 'PDF erzeugt und heruntergeladen.');
  };

  const pointFromSignatureEvent = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(520, ((event.clientX - bounds.left) / bounds.width) * 520)),
      y: Math.max(0, Math.min(150, ((event.clientY - bounds.top) / bounds.height) * 150)),
    };
  };

  const startSignature = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveSignatureStroke([pointFromSignatureEvent(event)]);
  };

  const moveSignature = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!activeSignatureStroke.length) return;
    setActiveSignatureStroke((old) => [...old, pointFromSignatureEvent(event)]);
  };

  const endSignature = () => {
    if (activeSignatureStroke.length > 1) {
      setSignatureStrokes((old) => [...old, activeSignatureStroke]);
    }
    setActiveSignatureStroke([]);
  };

  const signaturePath = (stroke: SignatureStroke) => stroke.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

  const createSignedReceiptFromPad = async () => {
    if (!selectedKey) return;
    const strokes = activeSignatureStroke.length > 1 ? [...signatureStrokes, activeSignatureStroke] : signatureStrokes;

    if (!strokes.length) {
      setStatus('Bitte zuerst auf dem Feld unterschreiben.');
      return;
    }
    if (!issueDraft.empfaengerName.trim()) {
      setStatus('Bitte Empfänger erfassen.');
      return;
    }

    setStatus('Erzeuge und speichere unterschriebene Schlüsselquittung ...');
    const filename = keyReceiptFileName({ ...selectedKey, nummer: `${selectedKey.nummer}-unterschrieben` });
    const blob = generateKeyReceiptPdfBlob(receiptPayloadForKey(selectedKey, { ...issueDraft, signatureStrokes: strokes }));
    downloadBlob(blob, filename);

    try {
      const path = `dokumente/${propertyId}/schluesselquittungen/unterschrieben/${Date.now()}-${filename}`;
      await uploadData({ path, data: blob }).result;
      const urlResult = await getUrl({ path });
      const dateiUrl = urlResult.url.toString();
      const docId = `doc-${uid()}`;

      await save('Dokument', {
        id: docId,
        liegenschaftId: propertyId,
        personId: issueDraft.personId || selectedKey.personId || undefined,
        titel: `Unterschriebene Schlüsselquittung ${selectedKey.bezeichnung}`,
        kategorie: 'Schlüsselquittung',
        jahr: new Date(issueDraft.ausgegebenAm).getFullYear(),
        dateiname: filename,
        dateiUrl,
        version: 1,
        freigabeStatus: 'Intern',
        sichtbarFuerKunden: false,
        volltext: `${selectedKey.bezeichnung} ${selectedKey.nummer} digital unterschrieben`,
        createdAt: nowIso(),
      });

      await save('Schluessel', {
        ...selectedKey,
        personId: issueDraft.personId || selectedKey.personId || null,
        status: issueDraft.empfaengerTyp === 'Handwerker' ? 'Bei Handwerker' : 'Bei Mieter/Eigentümer',
        ausgegebenAn: issueDraft.empfaengerName,
        ausgegebenAm: issueDraft.ausgegebenAm,
        objekt: issueDraft.objekt || selectedKey.objekt,
        anzahl: Number(issueDraft.anzahl || selectedKey.anzahl || 1),
        empfaengerTyp: issueDraft.empfaengerTyp,
        empfaengerName: issueDraft.empfaengerName,
        empfaengerAdresse: issueDraft.empfaengerAdresse,
        ausgabeOrt: issueDraft.ausgabeOrt,
        ausgegebenVon: issueDraft.ausgegebenVon,
        bemerkung: issueDraft.bemerkung || selectedKey.bemerkung,
        unterschriebeneQuittungDokumentId: docId,
        unterschriebeneQuittungDateiUrl: dateiUrl,
        unterschriebeneQuittungDateiname: filename,
        letzteBewegungAm: nowIso(),
        verlaufJson: appendKeyHistory(selectedKey, 'Digital unterschriebene Quittung gespeichert', `${issueDraft.empfaengerName} · ${issueDraft.ausgegebenAm}`),
      });

      setSignatureStrokes([]);
      setActiveSignatureStroke([]);
      setStatus('Digital unterschriebene Quittung gespeichert.');
    } catch (error) {
      console.warn(error);
      setStatus('Digital unterschriebene Quittung konnte nicht gespeichert werden.');
    }
  };

  const returnKey = async () => {
    if (!selectedKey) return;
    await save('Schluessel', {
      ...selectedKey,
      status: 'Im Haus',
      rueckgabeAm: new Date().toISOString().slice(0, 10),
      personId: null,
      handwerkerId: null,
      ausgegebenAn: '',
      empfaengerName: '',
      letzteBewegungAm: nowIso(),
      verlaufJson: appendKeyHistory(selectedKey, 'Schlüssel zurück im Haus', new Date().toLocaleDateString('de-CH')),
    });
    setStatus('Schlüssel als im Haus markiert.');
  };

  const uploadSignedReceipt = async () => {
    if (!selectedKey || !signedFile) {
      setStatus('Bitte unterschriebene Quittung auswählen.');
      return;
    }
    setStatus('Lade unterschriebene Quittung hoch ...');
    try {
      const safeName = signedFile.name.replaceAll(' ', '_');
      const path = `dokumente/${propertyId}/schluesselquittungen/unterschrieben/${Date.now()}-${safeName}`;
      await uploadData({ path, data: signedFile }).result;
      const urlResult = await getUrl({ path });
      const dateiUrl = urlResult.url.toString();
      const docId = `doc-${uid()}`;
      await save('Dokument', {
        id: docId,
        liegenschaftId: propertyId,
        personId: selectedKey.personId || undefined,
        titel: `Unterschriebene Schlüsselquittung ${selectedKey.bezeichnung}`,
        kategorie: 'Schlüsselquittung',
        jahr: thisYear,
        dateiname: signedFile.name,
        dateiUrl,
        version: 1,
        freigabeStatus: 'Intern',
        sichtbarFuerKunden: false,
        volltext: `${selectedKey.bezeichnung} ${selectedKey.nummer} unterschrieben`,
        createdAt: nowIso(),
      });
      await save('Schluessel', {
        ...selectedKey,
        unterschriebeneQuittungDokumentId: docId,
        unterschriebeneQuittungDateiUrl: dateiUrl,
        unterschriebeneQuittungDateiname: signedFile.name,
        verlaufJson: appendKeyHistory(selectedKey, 'Unterschriebene Quittung hochgeladen', signedFile.name),
      });
      setSignedFile(null);
      setStatus('Unterschriebene Quittung gespeichert.');
    } catch (error) {
      console.warn(error);
      setStatus('Upload der unterschriebenen Quittung fehlgeschlagen.');
    }
  };

  return (
    <div className="keys-layout">
      <Panel title="Schlüssel erfassen">
        {status && <p className="hint" style={{ color: status.includes('Fehler') ? '#dc2626' : '#166534', marginBottom: 12 }}>{status}</p>}

        <div className="key-form-grid">
          {/* Zeile 1 — Schlüssel-Identifikation */}
          <div className="key-form-section">
            <div className="key-form-section-label">Schlüssel</div>
            <div className="form-grid">
              <label>Bezeichnung *
                <input value={newKey.bezeichnung} onChange={(e) => setNewKey({ ...newKey, bezeichnung: e.target.value })} placeholder="z.B. Wohnungsschlüssel" />
              </label>
              <label>Nummer / Marke *
                <input value={newKey.nummer} onChange={(e) => setNewKey({ ...newKey, nummer: e.target.value })} placeholder="z.B. A-204713" />
              </label>
              <label>Schliessung
                <input value={newKey.schliessung} onChange={(e) => setNewKey({ ...newKey, schliessung: e.target.value })} placeholder="z.B. ABUS, Kaba …" />
              </label>
              <label>Anzahl
                <input type="number" min="1" max="50" value={newKey.anzahl} onChange={(e) => setNewKey({ ...newKey, anzahl: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          {/* Zeile 2 — Zuordnung */}
          <div className="key-form-section">
            <div className="key-form-section-label">Zuordnung</div>
            <div className="form-grid">
              <label>Mieter / Person
                <select value={newKey.personId} onChange={(e) => {
                  const p = propertyPersons.find((p: AnyRecord) => p.id === e.target.value);
                  setNewKey({ ...newKey, personId: e.target.value, objekt: newKey.objekt || (p?.wohnungsNummer ?? '') });
                }}>
                  <option value="">— Person wählen (optional) —</option>
                  {propertyPersons
                    .filter((p: AnyRecord) => !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? ''))
                    .map((p: AnyRecord) => (
                      <option key={p.id} value={p.id}>{personDisplayName(p)} · {p.rolle}{p.wohnungsNummer ? ` (${p.wohnungsNummer})` : ''}</option>
                    ))}
                </select>
              </label>
              <label>Objekt / Wohnung
                {objektOptionen.length > 0 ? (
                  <select value={newKey.objekt} onChange={(e) => setNewKey({ ...newKey, objekt: e.target.value })}>
                    <option value="">— Objekt wählen —</option>
                    {objektOptionen.map((nr: string) => <option key={nr} value={nr}>{nr}</option>)}
                    <option value="Allgemein">Allgemein (kein Objekt)</option>
                  </select>
                ) : (
                  <input value={newKey.objekt} onChange={(e) => setNewKey({ ...newKey, objekt: e.target.value })} placeholder="z.B. EG Rechts, 1. OG …" />
                )}
              </label>
              <label>Aktueller Standort
                <select value={newKey.standort} onChange={(e) => setNewKey({ ...newKey, standort: e.target.value })}>
                  {['Verwaltung / Haus', 'Schlüsseldepot', 'Bei Handwerker', 'Ausgegeben', 'Sonstiges'].map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>Bemerkung
                <textarea value={newKey.bemerkung} onChange={(e) => setNewKey({ ...newKey, bemerkung: e.target.value })} placeholder="Optionale Notizen …" />
              </label>
            </div>
          </div>
        </div>

        <div className="key-actions" style={{ marginTop: 16 }}>
          <button className="primary" onClick={createKey}>Schlüssel erfassen & speichern</button>
        </div>
      </Panel>

      <Panel title="Schlüsselbestand">
        {propertyKeys.length === 0 ? <p className="hint">Noch keine Schlüssel vorhanden.</p> : (
          <div className="key-list">
            {propertyKeys.map((key: AnyRecord) => {
              const status = statusForKey(key);
              return (
                <button key={key.id} className={`key-card ${selectedKey?.id === key.id ? 'selected' : ''}`} onClick={() => setSelectedKeyId(key.id)}>
                  <div>
                    <strong>{key.bezeichnung} · {key.nummer}</strong>
                    <span>{key.objekt || property.name} · {keyHolder(data, key)}</span>
                  </div>
                  <Badge tone={keyStatusTone(status)}>{status}</Badge>
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {selectedKey && (
        <Panel title="Schlüssel Details" className="key-detail-panel">
          <div className="info-grid">
            <Info label="Bezeichnung" value={selectedKey.bezeichnung} />
            <Info label="Nummer" value={selectedKey.nummer} />
            <Info label="Status" value={statusForKey(selectedKey)} />
            <Info label="Aktueller Standort / Inhaber" value={keyHolder(data, selectedKey)} />
            <Info label="Objekt" value={selectedKey.objekt || '—'} />
            <Info label="Schliessung" value={selectedKey.schliessung || '—'} />
            <Info label="Anzahl" value={selectedKey.anzahl || 1} />
            <Info label="Ausgegeben am" value={selectedKey.ausgegebenAm || '—'} />
          </div>

          <div className="key-document-actions">
            <button onClick={downloadReceiptAgain}>Schlüsselquittung erneut herunterladen</button>
            {selectedKey.quittungDateiUrl && <a href={selectedKey.quittungDateiUrl} target="_blank" rel="noreferrer">Erzeugte Schlüsselquittung öffnen</a>}
            {selectedKey.unterschriebeneQuittungDateiUrl && <a href={selectedKey.unterschriebeneQuittungDateiUrl} target="_blank" rel="noreferrer">Unterschriebene Quittung öffnen</a>}
            {selectedKey.handwerkerId && <button onClick={() => { setSelectedWorkerId(selectedKey.handwerkerId); setView('handwerkerDetail'); }}>Handwerker öffnen</button>}
            {statusForKey(selectedKey) !== 'Im Haus' && <button onClick={returnKey}>Als im Haus markieren</button>}
            <button className="danger" onClick={deleteKey}>Schlüssel löschen</button>
          </div>

          <div className="key-issue-box">
            <h3>Abholung / Ausgabe erfassen</h3>
            <div className="form-grid">
              <label>Person auswählen<select value={issueDraft.personId} onChange={(e) => selectPerson(e.target.value)}><option value="">Manuell erfassen</option>{propertyPersons.map((person: AnyRecord) => <option key={person.id} value={person.id}>{personDisplayName(person)} · {person.rolle}</option>)}</select></label>
              <label>Empfängertyp<select value={issueDraft.empfaengerTyp} onChange={(e) => setIssueDraft({ ...issueDraft, empfaengerTyp: e.target.value })}>{['Mieter', 'Eigentümer', 'Handwerker', 'Sonstige'].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Name Empfänger<input value={issueDraft.empfaengerName} onChange={(e) => setIssueDraft({ ...issueDraft, empfaengerName: e.target.value })} /></label>
              <label>Adresse Empfänger<input value={issueDraft.empfaengerAdresse} onChange={(e) => setIssueDraft({ ...issueDraft, empfaengerAdresse: e.target.value })} /></label>
              <label>Objekt / Wohnung
                {objektOptionen.length > 0 ? (
                  <select value={issueDraft.objekt} onChange={(e) => setIssueDraft({ ...issueDraft, objekt: e.target.value })}>
                    <option value="">— Objekt wählen —</option>
                    {objektOptionen.map((nr: string) => <option key={nr} value={nr}>{nr}</option>)}
                    <option value="Allgemein">Allgemein</option>
                  </select>
                ) : (
                  <input value={issueDraft.objekt} onChange={(e) => setIssueDraft({ ...issueDraft, objekt: e.target.value })} placeholder="z.B. EG Rechts" />
                )}
              </label>
              <label>Anzahl<input type="number" min="1" value={issueDraft.anzahl} onChange={(e) => setIssueDraft({ ...issueDraft, anzahl: Number(e.target.value) })} /></label>
              <label>Ort<input value={issueDraft.ausgabeOrt} onChange={(e) => setIssueDraft({ ...issueDraft, ausgabeOrt: e.target.value })} /></label>
              <label>Datum<input type="date" value={issueDraft.ausgegebenAm} onChange={(e) => setIssueDraft({ ...issueDraft, ausgegebenAm: e.target.value })} /></label>
              <label>Ausgegeben durch<input value={issueDraft.ausgegebenVon} onChange={(e) => setIssueDraft({ ...issueDraft, ausgegebenVon: e.target.value })} /></label>
              <label>Bemerkung<textarea value={issueDraft.bemerkung} onChange={(e) => setIssueDraft({ ...issueDraft, bemerkung: e.target.value })} /></label>
            </div>
            <div className="signature-pad-wrap">
              <div className="signature-pad-head">
                <strong>Direkt unterschreiben</strong>
                <button onClick={() => { setSignatureStrokes([]); setActiveSignatureStroke([]); }}>Unterschrift löschen</button>
              </div>
              <svg
                className="signature-pad"
                viewBox="0 0 520 150"
                onPointerDown={startSignature}
                onPointerMove={moveSignature}
                onPointerUp={endSignature}
                onPointerCancel={endSignature}
                onPointerLeave={endSignature}
              >
                <line x1="24" y1="118" x2="496" y2="118" />
                {[...signatureStrokes, activeSignatureStroke].filter((stroke) => stroke.length > 1).map((stroke, index) => (
                  <path key={index} d={signaturePath(stroke)} />
                ))}
              </svg>
            </div>
            <div className="key-actions">
              <button onClick={createSignedReceiptFromPad}>Unterschrieben speichern</button>
              <button className="primary" onClick={createReceipt}>Ausgabe speichern & PDF herunterladen</button>
            </div>
          </div>

          <div className="key-upload-box">
            <h3>Unterschriebene Schlüsselquittung speichern</h3>
            <div className="key-upload-row">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)} />
              <button onClick={uploadSignedReceipt}>Quittung hochladen</button>
            </div>
          </div>

          <div className="key-history">
            <h3>Verlauf</h3>
            {keyHistory(selectedKey).length === 0 ? <p className="hint">Noch kein Verlauf vorhanden.</p> : keyHistory(selectedKey).map((entry) => (
              <div className="timeline-row" key={entry.id}>
                <span>•</span>
                <div><strong>{entry.text}</strong><p>{deDate(entry.zeit)} · {entry.details || '—'}</p></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {status && <div className="keys-status hint">{status}</div>}
    </div>
  );
}
function Chat({ data, propertyId, caseId, save }: any) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messages = data.ChatMessage
    .filter((m: AnyRecord) => (caseId ? m.schadenfallId === caseId : m.liegenschaftId === propertyId))
    .filter((m: AnyRecord) => String(m.absenderTyp ?? '').toLowerCase() !== 'intern')
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(a.zeitstempel ?? a.createdAt ?? '').localeCompare(String(b.zeitstempel ?? b.createdAt ?? ''))
    );

  const isAdministrationMessage = (m: AnyRecord) => {
    const typ = String(m.absenderTyp ?? '').toLowerCase();
    const absender = String(m.absender ?? '').toLowerCase();
    const isCustomerType = ['kunde', 'mieter', 'eigentuemer', 'eigentümer', 'owner', 'tenant'].includes(typ);

    if (isCustomerType) return false;

    return (
      typ === 'verwaltung' ||
      typ === 'admin' ||
      typ === 'portal' ||
      (typ === 'mitarbeiter' && !absender.includes('@')) ||
      absender.includes('verwaltung') ||
      absender.includes('portal') ||
      absender.includes('@portal')
    );
  };

  const parseMessage = (nachricht: string) => {
    if (!nachricht?.startsWith('[[ANHANG]]')) {
      return { text: nachricht, fileUrl: '', fileName: '', fileType: '' };
    }

    const parts = nachricht.split('|');
    return {
      text: parts[4] || '',
      fileUrl: parts[1] || '',
      fileName: parts[2] || 'Anhang',
      fileType: parts[3] || '',
    };
  };

  const sendMessage = async () => {
    if (!text.trim() && !file) return;

    setSending(true);
    setError('');

    try {
      let nachricht = text.trim();

      if (file) {
        const safeName = file.name.replaceAll(' ', '_');
        const path = `chat/${caseId ?? propertyId}/${Date.now()}-${safeName}`;

        await uploadData({
          path,
          data: file,
        }).result;

        const urlResult = await getUrl({ path });
        const fileUrl = urlResult.url.toString();

        nachricht = `[[ANHANG]]|${fileUrl}|${file.name}|${file.type}|${text.trim()}`;
      }

      const item = {
        id: `chat-${uid()}`,
        liegenschaftId: propertyId,
        schadenfallId: caseId,
        absender: 'Verwaltung',
        absenderTyp: 'mitarbeiter',
        nachricht,
        zeitstempel: nowIso(),
        createdAt: nowIso(),
      };

      setText('');
      setFile(null);

      const result = await save('ChatMessage', item);
      if (!result?.ok) {
        setError('Nachricht wurde lokal angezeigt, konnte aber noch nicht mit AWS synchronisiert werden.');
      }
    } catch (error) {
      console.warn('Chat konnte nicht gesendet werden', error);
      setError('Nachricht konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel title="Chat">
      <div
        className="chatbox"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 14,
          background: '#f8fafc',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          minHeight: 360,
        }}
      >
        {messages.length === 0 ? (
          <p className="hint">Noch keine Nachrichten vorhanden.</p>
        ) : (
          messages.map((m: AnyRecord) => {
            const intern = isAdministrationMessage(m);
            const parsed = parseMessage(m.nachricht ?? '');
            const isImage = parsed.fileType.startsWith('image/');

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: intern ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '64%',
                    background: intern ? '#162033' : '#ffffff',
                    color: intern ? '#ffffff' : '#162033',
                    border: intern ? '1px solid #162033' : '1px solid #e2e8f0',
                    borderRadius: intern ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 12px',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      fontSize: 11,
                      opacity: 0.75,
                    }}
                  >
                    <strong>{m.absender || (intern ? 'Verwaltung' : 'Kunde')}</strong>
                    <span>{deDate(m.zeitstempel ?? m.createdAt)}</span>
                  </div>

                  {parsed.text && (
                    <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {parsed.text}
                    </div>
                  )}

                  {parsed.fileUrl && isImage && (
                    <a href={parsed.fileUrl} target="_blank" rel="noreferrer">
                      <img
                        src={parsed.fileUrl}
                        alt={parsed.fileName}
                        style={{
                          marginTop: 8,
                          maxWidth: '100%',
                          borderRadius: 12,
                          display: 'block',
                        }}
                      />
                    </a>
                  )}

                  {parsed.fileUrl && !isImage && (
                    <a
                      href={parsed.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        marginTop: 8,
                        color: intern ? '#bfdbfe' : '#2f6fed',
                        fontWeight: 800,
                      }}
                    >
                      📎 {parsed.fileName}
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        className="send"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: 10,
          marginTop: 12,
          alignItems: 'center',
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={file ? `Nachricht zu ${file.name}...` : 'Nachricht schreiben...'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
        />

        <label
          style={{
            border: '1px solid #d9d0c3',
            background: '#f8f4ec',
            borderRadius: 10,
            padding: '9px 12px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          📎 Upload
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <button onClick={sendMessage} disabled={sending}>
          {sending ? 'Sendet...' : 'Senden'}
        </button>
      </div>
      {error && <p className="hint">{error}</p>}

      {file && (
        <div className="hint" style={{ marginTop: 8 }}>
          Ausgewählt: {file.name}
        </div>
      )}
    </Panel>
  );
}

// ─── Urlaubskalender ──────────────────────────────────────────────────────────

const URLAUB_TYPEN = ['Ferien', 'Krank', 'Überzeitabbau', 'Sonstiges'];
const URLAUB_STATUS_FARBE: Record<string, string> = {
  Genehmigt: 'green', Ausstehend: 'orange', Abgelehnt: 'red',
};

function berechneUrlaubsanspruch(eintrittsdatum: string | undefined, kontingent: number, jahr: number): { anspruch: number; istGekuerzt: boolean; info: string } {
  const k = kontingent || 25;
  if (!eintrittsdatum) return { anspruch: k, istGekuerzt: false, info: '' };
  const eintritt = new Date(eintrittsdatum);
  if (isNaN(eintritt.getTime())) return { anspruch: k, istGekuerzt: false, info: '' };
  const eintrittsJahr = eintritt.getFullYear();
  if (eintrittsJahr < jahr) return { anspruch: k, istGekuerzt: false, info: '' };
  if (eintrittsJahr > jahr) return { anspruch: 0, istGekuerzt: true, info: 'Eintritt noch nicht erfolgt' };
  // Eintritt im aktuellen Jahr → anteilig
  const eintrittMonat = eintritt.getMonth(); // 0 = Januar
  const verbleibeneMonate = 12 - eintrittMonat;
  // Auf max. 2 Nachkommastellen runden
  const anspruch = Math.round((verbleibeneMonate / 12) * k * 100) / 100;
  const df = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' });
  return { anspruch, istGekuerzt: true, info: `Eintritt ${df.format(eintritt)} · ${verbleibeneMonate}/12 Monate` };
}

function werktage(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

const PERSON_CHIP_COLORS = ['#2563eb','#16a34a','#d97706','#9333ea','#0891b2','#e11d48','#0d9488'];
const chipColor = (name: string) => PERSON_CHIP_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % PERSON_CHIP_COLORS.length];

function UrlaubskalenderView({ data, employee, rights, save, remove }: any) {
  type UrlaubTab = 'Kalender' | 'Meine Anträge' | 'Alle Anträge' | 'Zeiterfassung';
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [tab, setTab] = useState<UrlaubTab>('Kalender');
  const [anzeigeMonat, setAnzeigeMonat] = useState(today.getMonth());
  const [anzeigeJahr, setAnzeigeJahr] = useState(today.getFullYear());
  const [showNeu, setShowNeu] = useState(false);
  const [neuVorbelegung, setNeuVorbelegung] = useState<string | null>(null);
  const [bearbeitenAntrag, setBearbeitenAntrag] = useState<AnyRecord | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [genehmigungsNotiz, setGenehmigungsNotiz] = useState<Record<string, string>>({});

  const antraege: AnyRecord[] = data.UrlaubsAntrag ?? [];
  const zeitEintraege: AnyRecord[] = data.ZeiterfassungEintrag ?? [];
  const spesenEintraege: AnyRecord[] = data.SpesenSyncEintrag ?? [];

  const istGenehmigerIn = employee?.gruppe === 'HR' || employee?.gruppe === 'Geschäftsführung' || employee?.gruppe === 'Geschäftsführer' || employee?.gruppe === 'CEO / Geschäftsführung' || hasRight(rights, 'mitarbeiter:bearbeiten');

  const meineAntraege = antraege.filter((a: AnyRecord) =>
    String(a.mitarbeiterId ?? '') === String(employee?.id ?? '') ||
    String(a.email ?? '').toLowerCase() === String(employee?.email ?? '').toLowerCase()
  );
  const ausstehende = antraege.filter((a: AnyRecord) => a.status === 'Ausstehend');

  const genehmigeAntrag = async (antrag: AnyRecord) => {
    await save('UrlaubsAntrag', { ...antrag, status: 'Genehmigt', genehmigtVon: employee?.name ?? 'HR', genehmigtAm: nowIso(), genehmigungsNotiz: genehmigungsNotiz[antrag.id] ?? '', updatedAt: nowIso() });
  };
  const lehneAb = async (antrag: AnyRecord) => {
    await save('UrlaubsAntrag', { ...antrag, status: 'Abgelehnt', genehmigtVon: employee?.name ?? 'HR', genehmigtAm: nowIso(), genehmigungsNotiz: genehmigungsNotiz[antrag.id] ?? '', updatedAt: nowIso() });
  };
  const storniereAntrag = async (antrag: AnyRecord) => {
    if (!window.confirm(`Antrag «${antrag.typ} ${antrag.startDatum} – ${antrag.endDatum}» wirklich zurückziehen?`)) return;
    await save('UrlaubsAntrag', { ...antrag, status: 'Abgelehnt', genehmigungsNotiz: 'Selbst zurückgezogen', updatedAt: nowIso() });
  };

  const loescheAntrag = async (antrag: AnyRecord) => {
    if (!window.confirm(`Eintrag «${antrag.typ} ${antrag.startDatum} – ${antrag.endDatum}» von ${antrag.mitarbeiterName} wirklich löschen?`)) return;
    await remove('UrlaubsAntrag', antrag.id);
    if (selectedTag) setSelectedTag(null);
  };

  // Alle aktiven Anträge an einem Datum
  const antraegeAnTag = (ds: string): AnyRecord[] =>
    antraege.filter((a: AnyRecord) => a.status !== 'Abgelehnt' && a.startDatum && a.endDatum && ds >= a.startDatum && ds <= a.endDatum);

  // Konflikte: andere Mitarbeiter in einem Zeitraum
  const konflikteInZeitraum = (start: string, end: string): AnyRecord[] =>
    antraege.filter((a: AnyRecord) => {
      if (a.status === 'Abgelehnt') return false;
      const istEigen = String(a.mitarbeiterId ?? '') === String(employee?.id ?? '') || String(a.email ?? '').toLowerCase() === String(employee?.email ?? '').toLowerCase();
      if (istEigen) return false;
      return a.startDatum && a.endDatum && !(end < a.startDatum || start > a.endDatum);
    });

  const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const ersterTag = new Date(anzeigeJahr, anzeigeMonat, 1);
  const tageImMonat = new Date(anzeigeJahr, anzeigeMonat + 1, 0).getDate();
  const startWochentag = (ersterTag.getDay() + 6) % 7;

  const vorherigerMonat = () => { if (anzeigeMonat === 0) { setAnzeigeMonat(11); setAnzeigeJahr(y => y - 1); } else setAnzeigeMonat(m => m - 1); };
  const naechsterMonat = () => { if (anzeigeMonat === 11) { setAnzeigeMonat(0); setAnzeigeJahr(y => y + 1); } else setAnzeigeMonat(m => m + 1); };

  const jahresAnspruch = berechneUrlaubsanspruch(employee?.eintrittsdatum, employee?.urlaubsKontingent ?? 25, anzeigeJahr);
  const eigeneKontingent = jahresAnspruch.anspruch;
  const eigeneGenommen = meineAntraege.filter((a: AnyRecord) => a.status === 'Genehmigt' && a.typ === 'Ferien' && String(a.antragsDatum ?? '').startsWith(String(anzeigeJahr))).reduce((s: number, a: AnyRecord) => s + (Number(a.anzahlTage) || 0), 0);
  const eigeneRest = eigeneKontingent - eigeneGenommen;
  const eigenePending = meineAntraege.filter((a: AnyRecord) => a.status === 'Ausstehend').length;

  // Zeiterfassung nur für HR / Admin / Genehmiger sichtbar — normale MA sehen nur eigene Zeiten in "Mein Profil"
  const tabs: UrlaubTab[] = ['Kalender', 'Meine Anträge', ...(istGenehmigerIn ? ['Alle Anträge' as UrlaubTab, 'Zeiterfassung' as UrlaubTab] : [])];

  // Tagesdetail für den ausgewählten Tag
  const selectedTagAntraege = selectedTag ? antraegeAnTag(selectedTag) : [];
  const selectedTagDate = selectedTag ? new Date(selectedTag + 'T12:00:00') : null;

  const oeffneNeuMitDatum = (ds: string) => { setNeuVorbelegung(ds); setShowNeu(true); };

  return (
    <div>
      <Title title="Urlaubskalender" sub="Ferienanträge stellen, verwalten und genehmigen."
        actions={<button className="primary small" onClick={() => { setNeuVorbelegung(null); setShowNeu(true); }}>+ Urlaub beantragen</button>} />

      {/* KPI-Leiste */}
      <div className="urlaub-kpis">
        <div className="urlaub-kpi blue">
          <span>Kontingent {anzeigeJahr}</span>
          <strong>{eigeneKontingent}</strong>
          {jahresAnspruch.istGekuerzt && <small>{jahresAnspruch.info}</small>}
        </div>
        <div className="urlaub-kpi green">
          <span>Genehmigt genommen</span>
          <strong>{eigeneGenommen}</strong>
        </div>
        <div className={`urlaub-kpi ${eigeneRest < 3 ? 'red' : 'gray'}`}>
          <span>Verbleibend</span>
          <strong>{eigeneRest}</strong>
        </div>
        {eigenePending > 0 && (
          <div className="urlaub-kpi orange" style={{ cursor: 'pointer' }} onClick={() => setTab('Meine Anträge')}>
            <span>Ausstehend</span>
            <strong>{eigenePending}</strong>
          </div>
        )}
        {istGenehmigerIn && ausstehende.length > 0 && (
          <div className="urlaub-kpi orange" style={{ cursor: 'pointer' }} onClick={() => setTab('Alle Anträge')}>
            <span>Zur Genehmigung</span>
            <strong>{ausstehende.length}</strong>
          </div>
        )}
      </div>

      {showNeu && <UrlaubsAntragFormular employee={employee} antraege={antraege} save={save} vorbelegung={neuVorbelegung} onClose={() => setShowNeu(false)} />}
      {bearbeitenAntrag && <UrlaubsAntragFormular employee={employee} antraege={antraege} save={save} antrag={bearbeitenAntrag} onClose={() => setBearbeitenAntrag(null)} />}

      <div className="tabs sticky-tabs">
        {tabs.map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Alle Anträge' && ausstehende.length > 0 && <span className="tab-badge">{ausstehende.length}</span>}
          </button>
        ))}
      </div>

      {/* ── KALENDER ── */}
      {tab === 'Kalender' && (
        <div className="urlaub-kalender-layout">
          <div className="urlaub-cal-main">
            {/* Monat-Navigation */}
            <div className="urlaub-cal-nav">
              <button className="small" onClick={vorherigerMonat}>‹ Vorheriger</button>
              <strong>{MONATSNAMEN[anzeigeMonat]} {anzeigeJahr}</strong>
              <button className="small" onClick={naechsterMonat}>Nächster ›</button>
            </div>
            {/* Wochentage */}
            <div className="urlaub-cal-grid">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                <div key={d} className="urlaub-cal-dow">{d}</div>
              ))}
              {Array.from({ length: startWochentag }).map((_, i) => <div key={`leer-${i}`} />)}
              {Array.from({ length: tageImMonat }, (_, i) => {
                const ds = `${anzeigeJahr}-${String(anzeigeMonat + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                const datum = new Date(ds + 'T12:00:00');
                const istHeute = ds === todayStr;
                const istWochenende = datum.getDay() === 0 || datum.getDay() === 6;
                const istAusgewaehlt = ds === selectedTag;
                const eintraege = antraegeAnTag(ds);
                const meineEintraege = eintraege.filter((a: AnyRecord) => String(a.mitarbeiterId ?? '') === String(employee?.id ?? '') || String(a.email ?? '').toLowerCase() === String(employee?.email ?? '').toLowerCase());
                const andereEintraege = eintraege.filter((a: AnyRecord) => !meineEintraege.includes(a));

                return (
                  <button
                    key={ds}
                    className={`urlaub-cal-tag ${istHeute ? 'heute' : ''} ${istWochenende ? 'wochenende' : ''} ${istAusgewaehlt ? 'ausgewaehlt' : ''} ${meineEintraege.length > 0 ? 'eigener-urlaub' : ''}`}
                    onClick={() => setSelectedTag(ds === selectedTag ? null : ds)}
                  >
                    <span className="tag-nummer">{i + 1}</span>
                    {/* Eigener Urlaub */}
                    {meineEintraege.map((a: AnyRecord) => (
                      <span key={a.id} className={`tag-chip eigen ${a.typ === 'Krank' ? 'krank' : a.typ === 'Überzeitabbau' ? 'ueza' : 'ferien'} ${a.status === 'Ausstehend' ? 'pending' : ''}`}>Ich</span>
                    ))}
                    {/* Andere Mitarbeiter */}
                    <div className="tag-andere">
                      {andereEintraege.slice(0, 3).map((a: AnyRecord) => (
                        <span key={a.id} className={`tag-dot ${a.status === 'Ausstehend' ? 'pending' : ''}`} style={{ background: chipColor(a.mitarbeiterName ?? '') }} title={`${a.mitarbeiterName}: ${a.typ} (${a.status})`}>
                          {(a.mitarbeiterName ?? '?').charAt(0)}
                        </span>
                      ))}
                      {andereEintraege.length > 3 && <span className="tag-dot-more">+{andereEintraege.length - 3}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Legende */}
            <div className="urlaub-legende">
              {[['ferien', 'Eigene Ferien'], ['krank', 'Krank/Abwesend'], ['ueza', 'Überzeitabbau'], ['pending', 'Ausstehend']].map(([cls, label]) => (
                <div key={cls} className="urlaub-legende-item">
                  <span className={`tag-chip eigen ${cls}`}>&nbsp;</span>
                  <span>{label}</span>
                </div>
              ))}
              <div className="urlaub-legende-item">
                <span className="tag-dot" style={{ background: '#2563eb' }}>A</span>
                <span>Anderer Mitarbeiter</span>
              </div>
            </div>
          </div>

          {/* Tages-Detail Panel */}
          <div className="urlaub-tag-panel">
            {selectedTag && selectedTagDate ? (
              <>
                <div className="urlaub-tag-panel-header">
                  <div>
                    <strong>{selectedTagDate.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718095' }}>{selectedTagAntraege.length === 0 ? 'Keine Abwesenheiten' : `${selectedTagAntraege.length} Abwesenheit${selectedTagAntraege.length !== 1 ? 'en' : ''}`}</p>
                  </div>
                  <button className="small" onClick={() => setSelectedTag(null)}>✕</button>
                </div>
                {selectedTagAntraege.length === 0 ? (
                  <p style={{ color: '#718095', fontSize: 13, margin: '12px 0' }}>Keine Abwesenheiten an diesem Tag.</p>
                ) : (
                  <div className="urlaub-tag-liste">
                    {selectedTagAntraege.map((a: AnyRecord) => {
                      const istEigen = String(a.mitarbeiterId ?? '') === String(employee?.id ?? '') || String(a.email ?? '').toLowerCase() === String(employee?.email ?? '').toLowerCase();
                      return (
                        <div key={a.id} className="urlaub-tag-eintrag">
                          <span className="urlaub-tag-dot" style={{ background: chipColor(a.mitarbeiterName ?? '') }}>{(a.mitarbeiterName ?? '?').charAt(0)}</span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: 13 }}>{a.mitarbeiterName}</strong>
                            <span style={{ display: 'block', fontSize: 11, color: '#718095' }}>{a.typ} · {a.startDatum} – {a.endDatum}</span>
                          </div>
                          <Badge tone={URLAUB_STATUS_FARBE[a.status] ?? ''}>{a.status}</Badge>
                          {(istEigen || istGenehmigerIn) && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="small" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setBearbeitenAntrag(a)} title="Bearbeiten">✎</button>
                              <button className="small danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => loescheAntrag(a)} title="Löschen">✕</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedTagDate.getDay() !== 0 && selectedTagDate.getDay() !== 6 && (
                  <button className="primary" style={{ width: '100%', marginTop: 12 }} onClick={() => oeffneNeuMitDatum(selectedTag)}>
                    + Urlaub für diesen Tag
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
                <p style={{ margin: 0, fontSize: 13 }}>Tag anklicken für Details</p>
              </div>
            )}

            {/* Nächste Abwesenheiten */}
            <div style={{ marginTop: 20 }}>
              <strong style={{ fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nächste Abwesenheiten</strong>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...antraege]
                  .filter((a: AnyRecord) => a.status !== 'Abgelehnt' && a.endDatum && a.endDatum >= todayStr)
                  .sort((a: AnyRecord, b: AnyRecord) => String(a.startDatum ?? '').localeCompare(String(b.startDatum ?? '')))
                  .slice(0, 6)
                  .map((a: AnyRecord) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e9eef5' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: chipColor(a.mitarbeiterName ?? ''), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{(a.mitarbeiterName ?? '?').charAt(0)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 12, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.mitarbeiterName}</strong>
                        <span style={{ fontSize: 11, color: '#718095' }}>{a.startDatum} – {a.endDatum}</span>
                      </div>
                      <Badge tone={URLAUB_STATUS_FARBE[a.status] ?? ''}>{a.status}</Badge>
                    </div>
                  ))}
                {antraege.filter((a: AnyRecord) => a.status !== 'Abgelehnt' && a.endDatum >= todayStr).length === 0 && (
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Keine bevorstehenden Abwesenheiten.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MEINE ANTRÄGE ── */}
      {tab === 'Meine Anträge' && (
        <div>
          {meineAntraege.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌴</div>
              <strong style={{ display: 'block', fontSize: 16, color: '#374151' }}>Noch keine Anträge</strong>
              <p style={{ margin: '8px 0 16px', fontSize: 14 }}>Klicke auf «+ Urlaub beantragen» oder wähle im Kalender einen Tag.</p>
              <button className="primary" onClick={() => { setNeuVorbelegung(null); setShowNeu(true); }}>Jetzt Urlaub beantragen</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...meineAntraege].sort((a: AnyRecord, b: AnyRecord) => String(b.startDatum ?? '').localeCompare(String(a.startDatum ?? ''))).map((a: AnyRecord) => {
                const tageText = a.anzahlTage ? `${a.anzahlTage} Arbeitstag${Number(a.anzahlTage) !== 1 ? 'e' : ''}` : '';
                return (
                  <div key={a.id} className={`urlaub-antrag-card status-${(a.status ?? '').toLowerCase().replace('ä', 'ae')}`}>
                    <div className="urlaub-antrag-icon">
                      {a.typ === 'Ferien' ? '🌴' : a.typ === 'Krank' ? '🤒' : a.typ === 'Überzeitabbau' ? '⏱' : '📋'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 15 }}>{a.typ}</strong>
                        <Badge tone={URLAUB_STATUS_FARBE[a.status] ?? ''}>{a.status}</Badge>
                        {a.quelle === 'App' && <Badge>App</Badge>}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
                        {a.startDatum} – {a.endDatum}
                        {tageText && <span style={{ marginLeft: 8, color: '#718095' }}>({tageText})</span>}
                      </p>
                      {a.beschreibung && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#718095' }}>{a.beschreibung}</p>}
                      {a.genehmigungsNotiz && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#92400e', background: '#fef9ef', padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>Notiz: {a.genehmigungsNotiz}</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button className="small" onClick={() => setBearbeitenAntrag(a)}>Bearbeiten</button>
                      {a.status === 'Ausstehend' && (
                        <button className="small" onClick={() => storniereAntrag(a)}>Zurückziehen</button>
                      )}
                      <button className="small danger" onClick={() => loescheAntrag(a)}>Löschen</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ALLE ANTRÄGE (HR/Chef) ── */}
      {tab === 'Alle Anträge' && istGenehmigerIn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ausstehende.length > 0 && (
            <Panel title={`${ausstehende.length} Antrag${ausstehende.length !== 1 ? 'anträge'  : ''} zur Genehmigung`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ausstehende.map((a: AnyRecord) => {
                  const konflikte = konflikteInZeitraum(a.startDatum, a.endDatum).filter((k: AnyRecord) => String(k.mitarbeiterId ?? '') !== String(a.mitarbeiterId ?? ''));
                  return (
                    <div key={a.id} className="urlaub-approve-card">
                      <div style={{ display: 'flex', gap: 14, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                        <span style={{ width: 40, height: 40, borderRadius: '50%', background: chipColor(a.mitarbeiterName ?? ''), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{(a.mitarbeiterName ?? '?').charAt(0)}</span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 15 }}>{a.mitarbeiterName}</strong>
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Badge>{a.typ}</Badge>
                            <span style={{ fontSize: 13 }}>{a.startDatum} → {a.endDatum}</span>
                            {a.anzahlTage && <span style={{ fontSize: 13, color: '#718095' }}>· {a.anzahlTage} Tage</span>}
                          </div>
                          {a.beschreibung && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718095' }}>{a.beschreibung}</p>}
                          {konflikte.length > 0 && (
                            <div style={{ marginTop: 6, padding: '6px 10px', background: '#fef9ef', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                              ⚠️ Konflikt: {konflikte.map((k: AnyRecord) => k.mitarbeiterName).join(', ')} {konflikte.length === 1 ? 'ist' : 'sind'} in diesem Zeitraum auch abwesend
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                        <input placeholder="Notiz (optional)" value={genehmigungsNotiz[a.id] ?? ''} onChange={e => setGenehmigungsNotiz(prev => ({ ...prev, [a.id]: e.target.value }))} style={{ fontSize: 13, padding: '7px 10px' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="small primary" style={{ flex: 1 }} onClick={() => genehmigeAntrag(a)}>✓ Genehmigen</button>
                          <button className="small danger" style={{ flex: 1 }} onClick={() => lehneAb(a)}>✕ Ablehnen</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
          <Panel title="Alle Anträge">
            {antraege.length === 0 ? <p className="hint">Noch keine Anträge vorhanden.</p> : (
              <table className="data-table">
                <thead><tr><th>Mitarbeiter</th><th>Typ</th><th>Zeitraum</th><th>Tage</th><th>Status</th><th>Quelle</th><th></th></tr></thead>
                <tbody>
                  {[...antraege].sort((a: AnyRecord, b: AnyRecord) => String(b.startDatum ?? '').localeCompare(String(a.startDatum ?? ''))).map((a: AnyRecord) => (
                    <tr key={a.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 24, height: 24, borderRadius: '50%', background: chipColor(a.mitarbeiterName ?? ''), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{(a.mitarbeiterName ?? '?').charAt(0)}</span><strong>{a.mitarbeiterName}</strong></div></td>
                      <td>{a.typ}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{a.startDatum} – {a.endDatum}</td>
                      <td>{a.anzahlTage ?? '—'}</td>
                      <td><Badge tone={URLAUB_STATUS_FARBE[a.status] ?? ''}>{a.status}</Badge></td>
                      <td><Badge>{a.quelle ?? 'Portal'}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="small" style={{ padding: '3px 8px' }} onClick={() => setBearbeitenAntrag(a)}>Bearbeiten</button>
                          <button className="small danger" style={{ padding: '3px 8px' }} onClick={() => loescheAntrag(a)}>Löschen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {/* ── ZEITERFASSUNG ── */}
      {tab === 'Zeiterfassung' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Synchronisierte Arbeitsstunden">
            <p className="hint">Aus der Zeiterfassung-App synchronisierte Einträge (Einstellungen → IMMOBILIENTOOL Server).</p>
            {zeitEintraege.length === 0 ? <p className="hint">Noch keine Einträge synchronisiert.</p> : (
              <table className="data-table">
                <thead><tr><th>Mitarbeiter</th><th>Datum</th><th>Start</th><th>Ende</th><th>Stunden</th><th>Typ</th></tr></thead>
                <tbody>
                  {[...zeitEintraege].sort((a: AnyRecord, b: AnyRecord) => String(b.startZeit ?? '').localeCompare(String(a.startZeit ?? ''))).slice(0, 100).map((e: AnyRecord) => {
                    const start = e.startZeit ? new Date(e.startZeit) : null;
                    const end = e.endZeit ? new Date(e.endZeit) : null;
                    const stunden = start && end ? ((end.getTime() - start.getTime()) / 3600000 - (e.pauseMinuten || 0) / 60).toFixed(1) : '—';
                    const typ = e.istUrlaub ? 'Urlaub' : e.istKrank ? 'Krank' : e.istUeberzeitabbau ? 'ÜZA' : 'Arbeit';
                    return (
                      <tr key={e.id}>
                        <td>{e.email?.split('@')[0] ?? '—'}</td>
                        <td>{start ? start.toLocaleDateString('de-CH') : '—'}</td>
                        <td>{start ? start.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{end ? end.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : 'Läuft'}</td>
                        <td>{stunden}</td>
                        <td><Badge tone={typ === 'Arbeit' ? 'green' : typ === 'Krank' ? 'red' : 'orange'}>{typ}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
          {istGenehmigerIn && spesenEintraege.length > 0 && (
            <Panel title="Spesen (App-Sync)">
              <table className="data-table">
                <thead><tr><th>Datum</th><th>Titel</th><th>Betrag</th><th>Status</th></tr></thead>
                <tbody>
                  {[...spesenEintraege].sort((a: AnyRecord, b: AnyRecord) => String(b.datum ?? '').localeCompare(String(a.datum ?? ''))).map((s: AnyRecord) => (
                    <tr key={s.id}>
                      <td>{s.datum}</td>
                      <td>{s.titel}</td>
                      <td>{s.betrag ? `CHF ${Number(s.betrag).toFixed(2)}` : '—'}</td>
                      <td><Badge tone={s.status === 'Genehmigt' ? 'green' : s.status === 'Abgelehnt' ? 'red' : 'orange'}>{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function UrlaubsAntragFormular({ employee, antraege, save, vorbelegung, antrag: vorhandenerAntrag, onClose }: any) {
  const istBearbeitung = !!vorhandenerAntrag;
  const heute = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState({
    startDatum: vorhandenerAntrag?.startDatum ?? vorbelegung ?? heute,
    endDatum:   vorhandenerAntrag?.endDatum   ?? vorbelegung ?? heute,
    typ:         vorhandenerAntrag?.typ        ?? 'Ferien',
    beschreibung: vorhandenerAntrag?.beschreibung ?? '',
  });
  const [meldung, setMeldung] = useState('');
  const [loading, setLoading] = useState(false);

  const tage = draft.startDatum && draft.endDatum
    ? werktage(new Date(draft.startDatum), new Date(draft.endDatum))
    : 0;

  // Konflikte — bei Bearbeitung den eigenen Antrag ausschliessen
  const konflikte: AnyRecord[] = (antraege ?? []).filter((a: AnyRecord) => {
    if (a.status === 'Abgelehnt') return false;
    if (istBearbeitung && a.id === vorhandenerAntrag.id) return false;
    const istEigen = String(a.mitarbeiterId ?? '') === String(employee?.id ?? '') || String(a.email ?? '').toLowerCase() === String(employee?.email ?? '').toLowerCase();
    if (istEigen) return false;
    return draft.startDatum && draft.endDatum && a.startDatum && a.endDatum && !(draft.endDatum < a.startDatum || draft.startDatum > a.endDatum);
  });

  const absenden = async () => {
    if (!draft.startDatum || !draft.endDatum) { setMeldung('Bitte Start- und Enddatum wählen.'); return; }
    if (draft.endDatum < draft.startDatum) { setMeldung('Enddatum muss nach dem Startdatum liegen.'); return; }
    setLoading(true);
    setMeldung(istBearbeitung ? 'Änderungen werden gespeichert …' : 'Antrag wird eingereicht …');
    try {
      if (istBearbeitung) {
        // Bearbeitung: Status auf Ausstehend zurücksetzen → HR muss erneut genehmigen
        await save('UrlaubsAntrag', {
          ...vorhandenerAntrag,
          startDatum:   draft.startDatum,
          endDatum:     draft.endDatum,
          anzahlTage:   tage,
          typ:          draft.typ,
          beschreibung: draft.beschreibung.trim(),
          status:       'Ausstehend',
          antragsDatum: nowIso(),
          genehmigtVon: null,
          genehmigtAm:  null,
          genehmigungsNotiz: '',
          updatedAt:    nowIso(),
        });
      } else {
        await save('UrlaubsAntrag', {
          id: `urlaub-${uid()}`,
          mitarbeiterId: employee?.id ?? '',
          mitarbeiterName: employee?.name ?? 'Unbekannt',
          email: employee?.email ?? '',
          startDatum: draft.startDatum,
          endDatum:   draft.endDatum,
          anzahlTage: tage,
          typ:         draft.typ,
          beschreibung: draft.beschreibung.trim(),
          status:      'Ausstehend',
          antragsDatum: nowIso(),
          quelle:      'Portal',
          createdAt:   nowIso(),
          updatedAt:   nowIso(),
        });
      }
      onClose();
    } catch (error: any) {
      setMeldung(error?.message ?? 'Antrag konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={istBearbeitung ? `Urlaub bearbeiten · ${vorhandenerAntrag.mitarbeiterName}` : 'Urlaub beantragen'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 340 }}>
        {istBearbeitung && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#78350f' }}>
            ℹ️ Nach dem Speichern wird der Antrag erneut zur Genehmigung durch HR / Geschäftsführung vorgelegt.
          </div>
        )}
        <div className="form-grid">
          <label>Typ
            <select value={draft.typ} onChange={e => setDraft({ ...draft, typ: e.target.value })}>
              {URLAUB_TYPEN.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Von
            <input type="date" value={draft.startDatum} onChange={e => setDraft({ ...draft, startDatum: e.target.value })} />
          </label>
          <label>Bis (inkl.)
            <input type="date" value={draft.endDatum} min={draft.startDatum} onChange={e => setDraft({ ...draft, endDatum: e.target.value })} />
          </label>
          <label>Arbeitstage (berechnet)
            <input readOnly value={`${tage} Arbeitstage`} style={{ background: '#f8fafc', color: '#718095' }} />
          </label>
        </div>
        <label>Bemerkung (optional)
          <textarea value={draft.beschreibung} onChange={e => setDraft({ ...draft, beschreibung: e.target.value })} rows={2} style={{ resize: 'vertical' }} />
        </label>
        {konflikte.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#78350f' }}>
            <strong>⚠️ Konflikt:</strong> {konflikte.map((k: AnyRecord) => k.mitarbeiterName).join(', ')} {konflikte.length === 1 ? 'ist' : 'sind'} in diesem Zeitraum bereits abwesend.
          </div>
        )}
        {meldung && <p style={{ color: meldung.includes('…') ? '#2563eb' : '#dc2626', fontSize: 13, margin: 0 }}>{meldung}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Abbrechen</button>
          <button className="primary" onClick={absenden} disabled={loading}>
            {istBearbeitung ? 'Änderungen speichern' : 'Antrag einreichen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ExternChat({ data, employee, save, setView, setSelectedCaseId, setSelectedPersonId }: any) {
  type ExtSel = { type: 'case'; id: string } | { type: 'person'; id: string } | null;
  const [sel, setSel] = useState<ExtSel>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'faelle' | 'personen'>('faelle');
  const [q, setQ] = useState('');

  // Cases with at least one chat message OR all active cases
  const activeCases = (data.Schadenfall as AnyRecord[])
    .filter(f => !['ARCHIVIERT'].includes(statusValue(f.status)) && !String(f.titel ?? '').startsWith('[GELÖSCHT]'))
    .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')));

  // Persons (active KontaktPersonen) who have direct messages
  const activePersons = (data.KontaktPerson as AnyRecord[])
    .filter(p => !['Archiviert', 'Gelöscht'].includes(p.kontoStatus ?? '') && !String(p.name ?? '').startsWith('[GELÖSCHT]'));

  const filteredCases = activeCases.filter(f =>
    !q || JSON.stringify(f).toLowerCase().includes(q.toLowerCase())
  );
  const filteredPersons = activePersons.filter(p =>
    !q || JSON.stringify(p).toLowerCase().includes(q.toLowerCase())
  );

  // Messages for current selection
  const messages = useMemo(() => {
    const all = data.ChatMessage as AnyRecord[];
    let filtered: AnyRecord[] = [];
    if (!sel) return [];
    if (sel.type === 'case') {
      filtered = all.filter(m => m.schadenfallId === sel.id && m.absenderTyp !== 'intern' && m.absenderTyp !== 'intern-dm');
    } else {
      filtered = all.filter(m => m.personId === sel.id && !m.schadenfallId);
    }
    return filtered.slice().sort((a, b) => String(a.zeitstempel ?? a.createdAt ?? '').localeCompare(String(b.zeitstempel ?? b.createdAt ?? '')));
  }, [data.ChatMessage, sel]);

  const sendMsg = async () => {
    if (!text.trim() || !sel) return;
    setSending(true);
    try {
      const item: AnyRecord = {
        id: `extchat-${uid()}`,
        absender: employee?.name ?? 'Verwaltung',
        absenderTyp: 'mitarbeiter',
        nachricht: text.trim(),
        zeitstempel: nowIso(),
        createdAt: nowIso(),
      };
      if (sel.type === 'case') {
        const fall = data.Schadenfall.find((f: AnyRecord) => f.id === sel.id);
        item.schadenfallId = sel.id;
        item.liegenschaftId = fall?.liegenschaftId;
        item.personId = fall?.personId;
      } else {
        const person = data.KontaktPerson.find((p: AnyRecord) => p.id === sel.id);
        item.personId = sel.id;
        item.liegenschaftId = person?.liegenschaftId;
      }
      const result = await save('ChatMessage', item);
      setStatus(result?.ok ? '' : 'Lokal gesendet – AWS prüfen.');
      setText('');
    } catch { setStatus('Senden fehlgeschlagen.'); }
    finally { setSending(false); }
  };

  const selectedCase = sel?.type === 'case' ? data.Schadenfall.find((f: AnyRecord) => f.id === sel.id) : null;
  const selectedPerson = sel?.type === 'person' ? data.KontaktPerson.find((p: AnyRecord) => p.id === sel.id) : null;
  const chatTitle = sel?.type === 'case' ? `${selectedCase?.fallNummer ?? ''} · ${selectedCase?.titel ?? 'Fall'}`
    : sel?.type === 'person' ? personDisplayName(selectedPerson ?? {})
    : 'Konversation wählen';
  const chatSub = sel?.type === 'case'
    ? `${propertyName(data, selectedCase?.liegenschaftId)} · ${personName(data, selectedCase?.personId)}`
    : sel?.type === 'person' ? `${selectedPerson?.rolle ?? ''} · ${selectedPerson?.email ?? ''}`
    : '';

  // Unread count = messages from kunde/extern
  const caseUnread = useMemo(() => {
    const counts: Record<string, number> = {};
    (data.ChatMessage as AnyRecord[]).forEach(m => {
      if (!m.schadenfallId) return;
      if (m.absenderTyp === 'intern' || m.absenderTyp === 'intern-dm' || m.absenderTyp === 'mitarbeiter') return;
      counts[m.schadenfallId] = (counts[m.schadenfallId] ?? 0) + 1;
    });
    return counts;
  }, [data.ChatMessage]);

  return (
    <div>
      <Title title="Externer Chat" sub="Kommunikation mit Mietern und Eigentümern — nach Fall oder Person." />
      <div className="internal-chat-layout">

        {/* LEFT */}
        <div className="ichat-sidebar">
          <input className="search" placeholder="Suche …" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10, fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button className="small" style={{ flex: 1, background: tab === 'faelle' ? '#0e1d32' : '#fff', color: tab === 'faelle' ? '#fff' : '#172033', border: '1px solid #ddd6cc', borderRadius: 10, padding: '8px 0', fontWeight: 600, cursor: 'pointer' }} onClick={() => setTab('faelle')}>Nach Fall</button>
            <button className="small" style={{ flex: 1, background: tab === 'personen' ? '#0e1d32' : '#fff', color: tab === 'personen' ? '#fff' : '#172033', border: '1px solid #ddd6cc', borderRadius: 10, padding: '8px 0', fontWeight: 600, cursor: 'pointer' }} onClick={() => setTab('personen')}>Nach Person</button>
          </div>

          {tab === 'faelle' && (
            <div className="ichat-section">
              <div className="ichat-section-label">⚠️ Aktive Fälle</div>
              {filteredCases.length === 0 && <p className="hint" style={{ margin: '8px 0' }}>Keine Fälle.</p>}
              {filteredCases.map(fall => (
                <button key={fall.id}
                  className={`internal-case ${sel?.type === 'case' && sel.id === fall.id ? 'active' : ''}`}
                  onClick={() => setSel({ type: 'case', id: fall.id })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{fall.fallNummer ?? ''} {fall.titel}</strong>
                    {caseUnread[fall.id] ? <span className="ichat-unread">{caseUnread[fall.id]}</span> : null}
                  </div>
                  <span>{propertyName(data, fall.liegenschaftId)} · {statusLabel(statusValue(fall.status))}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'personen' && (
            <div className="ichat-section">
              <div className="ichat-section-label">👤 Mieter & Eigentümer</div>
              {filteredPersons.length === 0 && <p className="hint" style={{ margin: '8px 0' }}>Keine Personen.</p>}
              {filteredPersons.slice(0, 60).map(p => (
                <button key={p.id}
                  className={`internal-case ichat-colleague ${sel?.type === 'person' && sel.id === p.id ? 'active' : ''}`}
                  onClick={() => setSel({ type: 'person', id: p.id })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={personDisplayName(p)} url={undefined} />
                    <div>
                      <strong>{personDisplayName(p)}</strong>
                      <span>{p.rolle} · {propertyName(data, p.liegenschaftId)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <section className="detail internal-chat-main">
          {!sel ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 14, color: '#8290a7' }}>
              <span style={{ fontSize: 48 }}>💬</span>
              <p style={{ margin: 0, fontSize: 14 }}>Fall oder Person auswählen um den Chat zu öffnen.</p>
            </div>
          ) : (
            <>
              <div className="internal-chat-head">
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {sel.type === 'person' && <span className="ichat-avatar">{initials(chatTitle)}</span>}
                    {chatTitle}
                  </h2>
                  <p>{chatSub}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {sel.type === 'case' && selectedCase && (
                    <button onClick={() => { setSelectedCaseId(sel.id); setView('fallDetail'); }}>Fall öffnen</button>
                  )}
                  {sel.type === 'person' && selectedPerson && (
                    <button onClick={() => { setSelectedPersonId(sel.id); setView('personDetail'); }}>Person öffnen</button>
                  )}
                </div>
              </div>

              <div className="internal-chat-messages">
                {messages.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: '#8290a7' }}>
                    <span style={{ fontSize: 32 }}>💬</span>
                    <p style={{ margin: 0, fontSize: 14 }}>Noch keine Nachrichten. Schreibe eine erste Nachricht.</p>
                  </div>
                ) : messages.map((m: AnyRecord) => {
                  const isMine = m.absenderTyp === 'mitarbeiter' || m.absender === employee?.name;
                  const senderMa = (data.Mitarbeiter ?? []).find((ma: AnyRecord) => ma.name === m.absender);
                  return (
                    <div key={m.id} className={`internal-message ${isMine ? 'mine' : ''}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                      <Avatar name={m.absender || (isMine ? 'V' : 'K')} url={senderMa?.photoUrl} />
                      <div style={{ flex: 1 }}>
                        <header>
                          <strong>{m.absender || (isMine ? 'Verwaltung' : 'Kunde')}</strong>
                          <span>{deDate(m.zeitstempel ?? m.createdAt)}</span>
                        </header>
                        <p>{m.nachricht}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="internal-send">
                <input value={text} onChange={e => setText(e.target.value)}
                  placeholder={`Nachricht an ${sel.type === 'person' ? personDisplayName(selectedPerson ?? {}) : selectedCase?.titel ?? 'Empfänger'} …`}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }} />
                <button onClick={sendMsg} disabled={sending || !text.trim()}>{sending ? '…' : 'Senden'}</button>
              </div>
              {status && <p className="hint">{status}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

type ChatSel =
  | { type: 'team' }
  | { type: 'case'; id: string }
  | { type: 'dm'; mitarbeiterId: string; name: string };

const dmConversationId = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`;

// ─── Chat-Referenzen ──────────────────────────────────────────────────────────

interface ChatReferenz { type: string; id: string; label: string; }

const CHAT_REF_KATEGORIEN = [
  { type: 'schadenfall', label: 'Meldung / Fall', icon: '⚠️' },
  { type: 'liegenschaft', label: 'Liegenschaft', icon: '🏢' },
  { type: 'person', label: 'Person / Partei', icon: '👤' },
  { type: 'handwerker', label: 'Handwerker', icon: '🔧' },
  { type: 'geraet', label: 'Gerät / Anlage', icon: '⚙️' },
];

const chatRefIcon = (type: string) =>
  CHAT_REF_KATEGORIEN.find(k => k.type === type)?.icon ?? '🔗';

const chatRefColor = (type: string): string => ({
  schadenfall: '#fef3c7', liegenschaft: '#dbeafe', person: '#dcfce7', handwerker: '#ede9fe', geraet: '#fce7f3',
} as Record<string, string>)[type] ?? '#f1f5f9';

const chatRefBorder = (type: string): string => ({
  schadenfall: '#f59e0b', liegenschaft: '#3b82f6', person: '#22c55e', handwerker: '#8b5cf6', geraet: '#ec4899',
} as Record<string, string>)[type] ?? '#94a3b8';

function ChatReferenzPicker({ data, onSelect, onClose }: any) {
  const [kategorie, setKategorie] = useState('schadenfall');
  const [q, setQ] = useState('');

  const items = useMemo((): { id: string; label: string }[] => {
    switch (kategorie) {
      case 'schadenfall':
        return (data.Schadenfall ?? [])
          .filter((f: AnyRecord) => !['ARCHIVIERT'].includes(statusValue(f.status)) && !String(f.titel ?? '').startsWith('[GELÖSCHT]'))
          .map((f: AnyRecord) => ({ id: f.id, label: `${f.fallNummer || '—'} · ${f.titel}` }));
      case 'liegenschaft':
        return (data.Liegenschaft ?? [])
          .filter((l: AnyRecord) => !['Archiviert','Gelöscht'].includes(l.status ?? ''))
          .map((l: AnyRecord) => ({ id: l.id, label: `${l.liegenschaftNummer} · ${l.name}` }));
      case 'person':
        return (data.KontaktPerson ?? [])
          .filter((p: AnyRecord) => !['Archiviert','Gelöscht'].includes(p.kontoStatus ?? ''))
          .map((p: AnyRecord) => ({ id: p.id, label: `${personDisplayName(p)} · ${p.rolle}` }));
      case 'handwerker':
        return (data.Handwerker ?? [])
          .filter((h: AnyRecord) => h.status !== 'Archiviert')
          .map((h: AnyRecord) => ({ id: h.id, label: `${h.firma} · ${h.gewerk}` }));
      case 'geraet':
        return (data.Dokument ?? [])
          .filter((d: AnyRecord) => d.kategorie === 'Gerät')
          .map(geraetFromDokument)
          .map((g: AnyRecord) => ({ id: g.id, label: `${g.titel || g.bezeichnung} · ${g.typ || g.dateiname}` }));
      default: return [];
    }
  }, [kategorie, data]);

  const filtered = items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase()));
  const icon = CHAT_REF_KATEGORIEN.find(k => k.type === kategorie)?.icon ?? '🔗';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="chat-ref-picker" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>@ Referenz hinzufügen</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="chat-ref-picker-tabs">
          {CHAT_REF_KATEGORIEN.map(k => (
            <button key={k.type}
              className={`chat-ref-tab ${kategorie === k.type ? 'active' : ''}`}
              onClick={() => { setKategorie(k.type); setQ(''); }}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <input className="search" placeholder={`${icon} Suchen …`} value={q} onChange={e => setQ(e.target.value)} style={{ margin: '10px 0', fontSize: 13 }} />
        <div className="chat-ref-picker-list">
          {filtered.length === 0 && <p className="hint">Keine Einträge.</p>}
          {filtered.slice(0, 30).map(item => (
            <button key={item.id} className="chat-ref-picker-item"
              onClick={() => onSelect({ type: kategorie, id: item.id, label: item.label })}>
              <span>{icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatReferenzKarte({ ref_, data, setView, setSelectedCaseId, setSelectedPersonId, setSelectedPropertyId, setSelectedWorkerId, isMine }: any) {
  const nav = () => {
    switch (ref_.type) {
      case 'schadenfall': setSelectedCaseId(ref_.id); setView('fallDetail'); break;
      case 'liegenschaft': setSelectedPropertyId(ref_.id); setView('liegenschaftDetail'); break;
      case 'person': setSelectedPersonId(ref_.id); setView('personDetail'); break;
      case 'handwerker': setSelectedWorkerId(ref_.id); setView('handwerkerDetail'); break;
    }
  };
  const canNav = ['schadenfall','liegenschaft','person','handwerker'].includes(ref_.type);
  const bg = isMine ? 'rgba(255,255,255,.12)' : chatRefColor(ref_.type);
  const border = chatRefBorder(ref_.type);

  return (
    <div style={{ background: bg, border: `1px solid ${border}40`, borderLeft: `3px solid ${border}`, borderRadius: 10, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{chatRefIcon(ref_.type)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: isMine ? 'rgba(255,255,255,.7)' : border, marginBottom: 1 }}>
            {CHAT_REF_KATEGORIEN.find(k => k.type === ref_.type)?.label ?? 'Referenz'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isMine ? '#fff' : '#172033', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
            {ref_.label}
          </div>
        </div>
      </div>
      {canNav && (
        <button onClick={nav} style={{ border: `1px solid ${border}40`, background: isMine ? 'rgba(255,255,255,.15)' : '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: isMine ? '#fff' : border, whiteSpace: 'nowrap', flexShrink: 0 }}>
          Öffnen →
        </button>
      )}
    </div>
  );
}

function InternalChat({ data, employee, save, setView, setSelectedCaseId, setSelectedPersonId, setSelectedPropertyId, setSelectedWorkerId }: any) {
  const [selection, setSelection] = useState<ChatSel>({ type: 'team' });
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [referenz, setReferenz] = useState<ChatReferenz | null>(null);
  const [zeigeRefPicker, setZeigeRefPicker] = useState(false);
  const colleagues = (data.Mitarbeiter ?? []).filter((m: AnyRecord) => m.id !== employee?.id && m.status !== 'Inaktiv');

  // Resolve messages for current selection
  const messages = useMemo(() => {
    const all = data.ChatMessage as AnyRecord[];
    let filtered: AnyRecord[] = [];
    if (selection.type === 'team') {
      filtered = all.filter(m => m.absenderTyp === 'intern' && !m.schadenfallId);
    } else if (selection.type === 'case') {
      filtered = all.filter(m => m.absenderTyp === 'intern' && m.schadenfallId === selection.id);
    } else {
      const convId = dmConversationId(employee?.id ?? '', selection.mitarbeiterId);
      filtered = all.filter(m => m.absenderTyp === 'intern-dm' && m.liegenschaftId === convId);
    }
    return filtered.slice().sort((a, b) => String(a.zeitstempel ?? a.createdAt ?? '').localeCompare(String(b.zeitstempel ?? b.createdAt ?? '')));
  }, [data.ChatMessage, selection, employee?.id]);

  // Unread count per colleague (messages from them, not from me)
  const dmUnread = useMemo(() => {
    const counts: Record<string, number> = {};
    (data.ChatMessage as AnyRecord[]).forEach(m => {
      if (m.absenderTyp !== 'intern-dm') return;
      if (m.absender === employee?.name) return;
      counts[m.liegenschaftId] = (counts[m.liegenschaftId] ?? 0) + 1;
    });
    return counts;
  }, [data.ChatMessage, employee?.name]);

  const parseInternalMessage = (nachricht: string) => {
    if (nachricht?.startsWith('[[ANHANG]]')) {
      const parts = nachricht.split('|');
      return { ref: null, text: parts[4] || '', fileUrl: parts[1] || '', fileName: parts[2] || 'Anhang', fileType: parts[3] || '' };
    }
    const refMatch = nachricht?.match(/^\[\[REF:([^:]+):([^:]+):([^\]]+)\]\]\n?/);
    if (refMatch) {
      return { ref: { type: refMatch[1], id: refMatch[2], label: refMatch[3] }, text: nachricht.slice(refMatch[0].length), fileUrl: '', fileName: '', fileType: '' };
    }
    return { ref: null, text: nachricht, fileUrl: '', fileName: '', fileType: '' };
  };

  const sendMessage = async () => {
    if (!text.trim() && !file && !referenz) return;
    setSending(true); setStatus('');
    try {
      let nachricht = text.trim();

      // Referenz als Präfix einbauen
      if (referenz) {
        nachricht = `[[REF:${referenz.type}:${referenz.id}:${referenz.label}]]\n${nachricht}`;
      }

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const ctxKey = selection.type === 'case' ? selection.id : selection.type === 'dm' ? `dm-${selection.mitarbeiterId}` : 'team';
        const path = `intern-chat/${ctxKey}/${Date.now()}-${safeName}`;
        await uploadData({ path, data: file }).result;
        const urlResult = await getUrl({ path });
        nachricht = `[[ANHANG]]|${urlResult.url.toString()}|${file.name}|${file.type}|${text.trim()}`;
      }

      const item: AnyRecord = {
        id: `intchat-${uid()}`,
        absender: employee?.name ?? 'Verwaltung',
        absenderTyp: selection.type === 'dm' ? 'intern-dm' : 'intern',
        nachricht,
        zeitstempel: nowIso(),
        createdAt: nowIso(),
      };

      if (selection.type === 'case') {
        const fall = data.Schadenfall.find((f: AnyRecord) => f.id === selection.id);
        item.schadenfallId = selection.id;
        item.liegenschaftId = fall?.liegenschaftId;
        item.personId = fall?.personId;
      } else if (selection.type === 'dm') {
        item.liegenschaftId = dmConversationId(employee?.id ?? '', selection.mitarbeiterId);
        item.personId = selection.mitarbeiterId;
      }

      const result = await save('ChatMessage', item);
      setStatus(result?.ok ? '' : 'Lokal gesendet – AWS prüfen.');
      setText(''); setFile(null); setReferenz(null);
    } catch {
      setStatus('Senden fehlgeschlagen.');
    } finally {
      setSending(false);
    }
  };

  const selectedCase = selection.type === 'case' ? data.Schadenfall.find((f: AnyRecord) => f.id === selection.id) : null;
  const chatTitle = selection.type === 'team' ? 'Allgemeiner Teamchat'
    : selection.type === 'case' ? (selectedCase ? `${selectedCase.fallNummer ?? ''} · ${selectedCase.titel}` : 'Fall')
    : selection.name;
  const chatSub = selection.type === 'team' ? 'Interne Nachrichten für alle Mitarbeitenden.'
    : selection.type === 'case' ? (selectedCase ? `${propertyName(data, selectedCase.liegenschaftId)} · ${personName(data, selectedCase.personId)}` : '')
    : `Direktnachricht mit ${selection.name}`;

  return (
    <div>
      <Title title="Interner Chat" sub="Teamkommunikation: Direktnachrichten unter Mitarbeitenden und Fallchats." />
      <div className="internal-chat-layout">

        {/* LEFT SIDEBAR */}
        <div className="ichat-sidebar">

          {/* INTERNE CHATS — Mitarbeiter DMs */}
          <div className="ichat-section">
            <div className="ichat-section-label">💬 Interne Chats</div>
            <button
              className={`internal-case ${selection.type === 'team' ? 'active' : ''}`}
              onClick={() => setSelection({ type: 'team' })}>
              <strong>Allgemeiner Teamchat</strong>
              <span>Für alle Mitarbeitenden</span>
            </button>
            {colleagues.map((col: AnyRecord) => {
              const convId = dmConversationId(employee?.id ?? '', col.id);
              const unread = dmUnread[convId] ?? 0;
              return (
                <button key={col.id}
                  className={`internal-case ichat-colleague ${selection.type === 'dm' && selection.mitarbeiterId === col.id ? 'active' : ''}`}
                  onClick={() => setSelection({ type: 'dm', mitarbeiterId: col.id, name: col.name })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={col.name} url={col.photoUrl} />
                    <div>
                      <strong>{col.name}</strong>
                      <span>{col.funktion || col.gruppe || 'Mitarbeiter'}</span>
                    </div>
                    {unread > 0 && <span className="ichat-unread">{unread}</span>}
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* RIGHT — Chat area */}
        <section className="detail internal-chat-main">
          <div className="internal-chat-head">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {selection.type === 'dm' && (() => {
                  const col = data.Mitarbeiter?.find((m: AnyRecord) => m.id === selection.mitarbeiterId);
                  return <Avatar name={selection.name} url={col?.photoUrl} />;
                })()}
                {chatTitle}
              </h2>
              <p>{chatSub}</p>
            </div>
            {selection.type === 'case' && selectedCase && (
              <button onClick={() => { setSelectedCaseId(selectedCase.id); setView('fallDetail'); }}>Fall öffnen</button>
            )}
          </div>

          <div className="internal-chat-messages">
            {messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#8290a7' }}>
                <span style={{ fontSize: 36 }}>{selection.type === 'dm' ? '💬' : '📋'}</span>
                <p style={{ margin: 0, fontSize: 14 }}>
                  {selection.type === 'dm' ? `Schreib ${selection.name} eine Nachricht.` : 'Noch keine Nachrichten in diesem Bereich.'}
                </p>
              </div>
            ) : (
              messages.map((message: AnyRecord) => {
                const parsed = parseInternalMessage(message.nachricht ?? '');
                const isMine = message.absender === employee?.name;
                const isImage = parsed.fileType.startsWith('image/');
                const sender = (data.Mitarbeiter ?? []).find((m: AnyRecord) => m.name === message.absender);
                return (
                  <div key={message.id} className={`internal-message ${isMine ? 'mine' : ''}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                    <Avatar name={message.absender || 'M'} url={sender?.photoUrl} />
                    <div style={{ flex: 1 }}>
                      <header>
                        <strong>{message.absender || 'Mitarbeiter'}</strong>
                        <span>{deDate(message.zeitstempel ?? message.createdAt)}</span>
                      </header>
                      {parsed.ref && (
                        <ChatReferenzKarte ref_={parsed.ref} data={data}
                          setView={setView} setSelectedCaseId={setSelectedCaseId}
                          setSelectedPersonId={setSelectedPersonId} setSelectedPropertyId={setSelectedPropertyId}
                          setSelectedWorkerId={setSelectedWorkerId} isMine={isMine} />
                      )}
                      {parsed.text && <p>{parsed.text}</p>}
                      {parsed.fileUrl && isImage && <a href={parsed.fileUrl} target="_blank" rel="noreferrer"><img src={parsed.fileUrl} alt={parsed.fileName} /></a>}
                      {parsed.fileUrl && !isImage && <a href={parsed.fileUrl} target="_blank" rel="noreferrer">📎 {parsed.fileName}</a>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Referenz-Chip über dem Eingabefeld */}
          {referenz && (
            <div className="chat-ref-chip">
              <span className="chat-ref-icon">{chatRefIcon(referenz.type)}</span>
              <span className="chat-ref-label">{referenz.label}</span>
              <button className="chat-ref-remove" onClick={() => setReferenz(null)}>×</button>
            </div>
          )}

          <div className="internal-send">
            <button className="chat-ref-btn" title="Referenz hinzufügen (@)" onClick={() => setZeigeRefPicker(true)}>@</button>
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder={referenz ? `Kommentar zu "${referenz.label}" …` : file ? `Nachricht zu "${file.name}" …` : selection.type === 'dm' ? `Nachricht an ${selection.name} …` : 'Interne Nachricht schreiben …'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <label title="Datei anhängen">
              📎
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={sendMessage} disabled={sending}>{sending ? '…' : 'Senden'}</button>
          </div>
          {file && <p className="hint" style={{ marginTop: 6 }}>📎 {file.name} · <button style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }} onClick={() => setFile(null)}>entfernen</button></p>}
          {status && <p className="hint">{status}</p>}

          {/* Referenz-Picker Modal */}
          {zeigeRefPicker && (
            <ChatReferenzPicker
              data={data}
              onSelect={(ref: ChatReferenz) => { setReferenz(ref); setZeigeRefPicker(false); }}
              onClose={() => setZeigeRefPicker(false)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
function Timeline({ items }: any) { return <div>{items.map((x:AnyRecord,i:number)=><div className="timeline-row"><span>{i+1}</span><div><strong>{x.titel||x.name||x.bezeichnung||x.nachricht||x.firma}</strong><p>{x.status||x.kategorie||x.typ||x.dateiname||x.createdAt||'Eintrag'}</p></div></div>)}</div>; }
function Modal({ title, children, onClose }: any) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>; }

function DocOpenButton({ url, titel, label = 'Öffnen' }: { url?: string; titel?: string; label?: string }) {
  const [pdfUrl, setPdfUrl] = React.useState('');
  if (!url) return null;
  const isS3Path = !url.startsWith('http');
  const open = async () => {
    try {
      const resolved = isS3Path ? (await getUrl({ path: url })).url.toString() : url;
      setPdfUrl(resolved);
    } catch { window.open(url, '_blank'); }
  };
  return (
    <>
      <button className="small" onClick={open} style={{ border: '1px solid #ddd6cc', background: '#fff', borderRadius: 10, padding: '6px 12px', fontSize: 13, color: '#172033', cursor: 'pointer' }}>{label}</button>
      {pdfUrl && (
        <div className="modal-backdrop" onClick={() => setPdfUrl('')}>
          <div className="pdf-viewer-modal" onClick={e => e.stopPropagation()}>
            <div className="pdf-viewer-header">
              <span>📄 {titel || label}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={pdfUrl} download target="_blank" rel="noreferrer" style={{ border: '1px solid #ddd6cc', background: '#fff', borderRadius: 10, padding: '7px 14px', fontSize: 13, color: '#172033', textDecoration: 'none', fontWeight: 600 }}>⬇ Herunterladen</a>
                <button onClick={() => setPdfUrl('')} style={{ border: 'none', background: '#f1f5f9', borderRadius: 999, width: 34, height: 34, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>×</button>
              </div>
            </div>
            <iframe src={pdfUrl} className="pdf-viewer-iframe" title={titel || label} />
          </div>
        </div>
      )}
    </>
  );
}
function EditFields({ item, fields, onSave }: { item: AnyRecord; fields: string[]; onSave: (x: AnyRecord)=>void }) { const [draft, setDraft] = useState<AnyRecord>(item); useEffect(()=>setDraft(item),[item?.id]); return <div className="form-grid">{fields.map((f)=><label key={f}>{labelFor(f)}{f.toLowerCase().includes('sichtbar')||typeof draft[f]==='boolean'?<select value={String(draft[f] ?? false)} onChange={e=>setDraft({...draft,[f]:e.target.value==='true'})}><option value="true">Ja</option><option value="false">Nein</option></select>:<input value={draft[f] ?? ''} type={typeof draft[f] === 'number' ? 'number' : 'text'} onChange={e=>setDraft({...draft,[f]: e.target.value})}/>}</label>)}<button className="primary" onClick={()=>onSave({...draft, updatedAt: nowIso()})}>Speichern</button></div>; }
function labelFor(f:string){return ({ vorname:'Vorname', nachname:'Nachname', adresse:'Adresse', liegenschaft:'Liegenschaft', wohnung:'Wohnung', mietbeginn:'Mietbeginn', zaehlerstaende:'Zählerstände', schluessel:'Schlüssel', kuendigungsdatum:'Kündigungsdatum', auszugstermin:'Auszugstermin', liegenschaftNummer:'Liegenschaftsnummer', plz:'PLZ', ort:'Ort', typ:'Typ', status:'Status', zustandText:'Zustand/Bemerkung', personId:'Person', handwerkerId:'Handwerker', sichtbarInApp:'In App sichtbar', sichtbarFuerKunden:'Für Kunden sichtbar', sichtbarFuerEigentuemer:'Für Eigentümer sichtbar', sichtbarFuerMieter:'Für Mieter sichtbar', photoUrl:'Bild-URL', teamSichtbar:'In „Unser Team“ anzeigen', teamSortierung:'Team-Sortierung', jahreslohn:'Jahreslohn', kinder:'Kinder', neuerWert:'Neuer Wert', alterWert:'Alter Wert' } as any)[f] ?? f.charAt(0).toUpperCase()+f.slice(1)}

export default App;
