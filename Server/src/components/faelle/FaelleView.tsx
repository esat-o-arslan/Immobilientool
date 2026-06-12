import React, { useMemo, useState } from 'react';
import { sendeAWSChatNachricht, updateAWS } from '../../awsService';

type FallTab = 'infos' | 'chat' | 'bilder' | 'dokumente';

const STATUS_OPTIONS = ['Offen', 'In Bearbeitung', 'Beleg nachgereicht', 'Erledigt'];
const PRIORITAET_OPTIONS = ['Dringend', 'Hoch', 'Normal', 'Niedrig'];
const KATEGORIE_OPTIONS = ['Heizung', 'Wasser', 'Sanitär', 'Elektrik', 'Schimmel', 'Fenster', 'Schlüssel', 'Unterlagen', 'Sonstiges'];

const createInitialFormData = (liegenschaften: any[], mitarbeiterListe: any[]) => ({
  titel: '',
  liegenschaftId: liegenschaften[0]?.id ?? '',
  direktzustellungAn: mitarbeiterListe[0]?.id ?? '',
  status: 'Offen',
  prioritaet: 'Dringend',
  kategorie: 'Heizung',
  kontaktkanal: 'bewirtschafter',
  mietobjekt: '',
  stockwerk: '',
  schadensort: '',
  seitWann: '',
  zugangMoeglich: 'Ja',
  wieEntstanden: '',
  bemerkung: '',
  firma: '',
  vorname: '',
  nachname: '',
  strasse: '',
  plzOrt: '',
  email: '',
  telefon: '',
  beschreibung: '',
});

function normalizeStatus(status?: string) {
  if (!status) return 'Offen';
  if (status === 'OFFEN' || status === 'Neu') return 'Offen';
  if (status === 'IN_BEARBEITUNG') return 'In Bearbeitung';
  if (status === 'BELEG_NACHGEREICHT') return 'Beleg nachgereicht';
  if (status === 'ERLEDIGT') return 'Erledigt';
  return status;
}

function awsStatus(status: string) {
  if (status === 'Offen' || status === 'Neu') return 'OFFEN';
  if (status === 'In Bearbeitung') return 'IN_BEARBEITUNG';
  if (status === 'Beleg nachgereicht') return 'BELEG_NACHGEREICHT';
  if (status === 'Erledigt') return 'ERLEDIGT';
  return status;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isInternalSender(msg: any) {
  const typ = String(msg.absenderTyp ?? '').toLowerCase();
  const sender = String(msg.absender ?? msg.senderName ?? '').toLowerCase();

  return (
    typ === 'mitarbeiter' ||
    typ === 'verwaltung' ||
    sender.includes('portal') ||
    sender.includes('verwaltung') ||
    sender.includes('@portal') ||
    sender.includes('max') ||
    sender.includes('jasmin') ||
    sender.includes('francesco') ||
    sender.includes('nicole')
  );
}

export function FaelleView({
  faelle,
  setFaelle,
  liegenschaften,
  mitarbeiterListe,
  handwerker = [],
  chats = [],
  setChats,
}: any) {
  const [selectedFallId, setSelectedFallId] = useState(faelle[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<FallTab>('infos');
  const [showNewFallForm, setShowNewFallForm] = useState(false);
  const [newChatText, setNewChatText] = useState('');
  const [formData, setFormData] = useState(createInitialFormData(liegenschaften, mitarbeiterListe));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [editFall, setEditFall] = useState<any | null>(null);
  const [saveInfo, setSaveInfo] = useState('');

  const requiredFields = ['vorname', 'nachname', 'strasse', 'plzOrt', 'email', 'beschreibung', 'prioritaet'];

  const fieldLabels: Record<string, string> = {
    titel: 'Titel',
    liegenschaftId: 'Liegenschaft',
    direktzustellungAn: 'Direkt zustellen an',
    status: 'Status',
    prioritaet: 'Dringlichkeit',
    kategorie: 'Kategorie',
    kontaktkanal: 'Kontaktkanal',
    mietobjekt: 'Mietobjekt',
    stockwerk: 'Stockwerk',
    schadensort: 'Schadensort',
    seitWann: 'Seit wann',
    zugangMoeglich: 'Zugang möglich',
    wieEntstanden: 'Wie entstanden',
    bemerkung: 'Bemerkung',
    firma: 'Firma',
    vorname: 'Vorname',
    nachname: 'Nachname',
    strasse: 'Strasse',
    plzOrt: 'PLZ / Ort',
    email: 'E-Mail',
    telefon: 'Telefon',
    beschreibung: 'Fehlermeldung / Beschreibung Schaden',
  };

  const selectedFall = useMemo(
    () => faelle.find((x: any) => x.id === selectedFallId) ?? faelle[0],
    [faelle, selectedFallId]
  );

  const selectedLiegenschaft = liegenschaften.find((l: any) => l.id === selectedFall?.liegenschaftId);

  const selectedZustellung = mitarbeiterListe.find(
    (m: any) => m.id === selectedFall?.direktzustellungAn || m.id === selectedFall?.verantwortlicherMitarbeiterId
  );

  const selectedHandwerker = handwerker.find((h: any) => h.id === selectedFall?.handwerkerId);

  const selectedChats = useMemo(() => {
    if (!selectedFall) return [];
    return chats
      .filter((x: any) => x.schadenfallId === selectedFall.id || x.fallId === selectedFall.id)
      .sort((a: any, b: any) =>
        String(a.zeitstempel ?? a.createdAt ?? a.zeit ?? '').localeCompare(String(b.zeitstempel ?? b.createdAt ?? b.zeit ?? ''))
      );
  }, [chats, selectedFall]);

  const getStatusColor = (status: string) => {
    const s = normalizeStatus(status);
    if (s === 'Offen') return '#e11d48';
    if (s === 'In Bearbeitung') return '#f59e0b';
    if (s === 'Beleg nachgereicht') return '#2563eb';
    if (s === 'Erledigt') return '#16a34a';
    return '#64748b';
  };

  const isEmailValid = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

  const getFieldError = (key: string) => {
    const value = String(formData[key as keyof typeof formData] ?? '').trim();

    if (requiredFields.includes(key) && !value) {
      return `${fieldLabels[key]} ist ein Pflichtfeld.`;
    }

    if (key === 'email' && value && !isEmailValid(value)) {
      return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    }

    return '';
  };

  const errors = Object.keys(fieldLabels).reduce((acc: Record<string, string>, key) => {
    const error = getFieldError(key);
    if (error) acc[key] = error;
    return acc;
  }, {});

  const isFormValid = requiredFields.every((key) => !getFieldError(key)) && !getFieldError('email');
  const showFieldError = (key: string) => (submitAttempted || touched[key]) && !!errors[key];

  const updateForm = (key: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const markTouched = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const resetForm = () => {
    setFormData(createInitialFormData(liegenschaften, mitarbeiterListe));
    setTouched({});
    setSubmitAttempted(false);
  };

  const startEdit = (fall: any) => {
    setEditFall({
      id: fall.id,
      status: normalizeStatus(fall.status),
      prioritaet: fall.prioritaet ?? 'Normal',
      kategorie: fall.kategorie ?? 'Sonstiges',
      verantwortlicherMitarbeiterId: fall.verantwortlicherMitarbeiterId ?? fall.direktzustellungAn ?? '',
      handwerkerId: fall.handwerkerId ?? '',
      frist: fall.frist ? String(fall.frist).slice(0, 16) : '',
    });
    setSaveInfo('');
  };

  const updateEdit = (key: string, value: string) => {
    setEditFall((prev: any) => ({ ...(prev ?? {}), [key]: value }));
  };

  const handleSaveFall = async () => {
    if (!selectedFall || !editFall) return;

    const input: Record<string, any> = {
      id: selectedFall.id,
      status: awsStatus(editFall.status),
      prioritaet: editFall.prioritaet,
      kategorie: editFall.kategorie,
      verantwortlicherMitarbeiterId: editFall.verantwortlicherMitarbeiterId || null,
      frist: editFall.frist ? new Date(editFall.frist).toISOString() : null,
    };

    if (editFall.handwerkerId) {
      input.handwerkerId = editFall.handwerkerId;
    }

    try {
      setSaveInfo('Speichere...');
      const updated = await updateAWS('Schadenfall', input);

      if (setFaelle) {
        setFaelle((prev: any[]) =>
          prev.map((fall) =>
            fall.id === selectedFall.id
              ? {
                  ...fall,
                  ...updated,
                  status: normalizeStatus(updated?.status ?? input.status),
                  prioritaet: updated?.prioritaet ?? input.prioritaet,
                  kategorie: updated?.kategorie ?? input.kategorie,
                  verantwortlicherMitarbeiterId:
                    updated?.verantwortlicherMitarbeiterId ?? input.verantwortlicherMitarbeiterId,
                  handwerkerId: updated?.handwerkerId ?? input.handwerkerId ?? fall.handwerkerId,
                  frist: updated?.frist ?? input.frist,
                }
              : fall
          )
        );
      }

      setSaveInfo('Gespeichert.');
      setEditFall(null);
    } catch (error) {
      console.error('Schadenfall konnte nicht gespeichert werden', error);
      setSaveInfo('Speichern fehlgeschlagen.');
    }
  };

  const handleCreateFall = () => {
    setSubmitAttempted(true);
    if (!isFormValid) return;

    const newId = `f-${Date.now()}`;
    const ref = `SI-${new Date().getFullYear()}-${String(faelle.length + 1).padStart(4, '0')}`;
    const titel = formData.titel.trim() || `${formData.kategorie} – ${formData.nachname}, ${formData.vorname}`;

    const neuerFall = {
      id: newId,
      referenz: ref,
      titel,
      liegenschaftId: formData.liegenschaftId,
      direktzustellungAn: formData.direktzustellungAn,
      verantwortlicherMitarbeiterId: formData.direktzustellungAn,
      status: formData.status,
      prioritaet: formData.prioritaet,
      kategorie: formData.kategorie,
      formular: {
        kontaktkanal: formData.kontaktkanal,
        mietobjekt: formData.mietobjekt,
        stockwerk: formData.stockwerk,
        schadensort: formData.schadensort,
        seitWann: formData.seitWann,
        zugangMoeglich: formData.zugangMoeglich,
        wieEntstanden: formData.wieEntstanden,
        bemerkung: formData.bemerkung,
        firma: formData.firma,
        vorname: formData.vorname,
        nachname: formData.nachname,
        strasse: formData.strasse,
        plzOrt: formData.plzOrt,
        email: formData.email,
        telefon: formData.telefon,
        kontaktperson: `${formData.vorname} ${formData.nachname}`.trim(),
        beschreibung: formData.beschreibung,
      },
      bilder: [],
      dokumente: [],
    };

    if (setFaelle) {
      setFaelle((prev: any[]) => [neuerFall, ...prev]);
    }

    setSelectedFallId(newId);
    setActiveTab('infos');
    setShowNewFallForm(false);
    resetForm();
  };

  const handleSendChat = () => {
    if (!newChatText.trim() || !selectedFall || !setChats) return;

    const text = newChatText.trim();

    const neueNachricht = {
      id: `c-${Date.now()}`,
      schadenfallId: selectedFall.id,
      absender: 'Verwaltung',
      absenderTyp: 'mitarbeiter',
      senderName: 'Immobilientool',
      empfaengerName: selectedFall.formular?.kontaktperson ?? 'Kunde',
      nachricht: text,
      text,
      kanal: selectedFall.formular?.kontaktkanal ?? 'bewirtschafter',
      zeitstempel: new Date().toISOString(),
      zeit: new Date().toISOString(),
    };

    setChats((prev: any[]) => [...prev, neueNachricht]);

    sendeAWSChatNachricht({
      schadenfallId: selectedFall.id,
      liegenschaftId: selectedFall.liegenschaftId,
      personId: selectedFall.personId,
      absender: 'Verwaltung',
      absenderTyp: 'mitarbeiter',
      nachricht: text,
    }).catch((error) => {
      console.warn('Chat konnte nicht in AWS gespeichert werden. Lokal wurde er trotzdem angezeigt.', error);
    });

    setNewChatText('');
  };

  const tabs: { key: FallTab; label: string }[] = [
    { key: 'infos', label: 'Infos' },
    { key: 'chat', label: 'Chat' },
    { key: 'bilder', label: 'Bilder' },
    { key: 'dokumente', label: 'Dokumente' },
  ];

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: '#162033' }}>Schadenfälle</h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Schadenmeldungen mit Formularinhalt, Pflichtfeldern, Anhängen und direkter Korrespondenz.
          </p>
        </div>

        <button
          onClick={() => {
            setShowNewFallForm((prev: boolean) => !prev);
            if (showNewFallForm) resetForm();
          }}
          style={primaryButtonStyle}
        >
          {showNewFallForm ? 'Erfassung schliessen' : 'Neuen Schadenfall erfassen'}
        </button>
      </div>

      {showNewFallForm && (
        <NewFallForm
          formData={formData}
          updateForm={updateForm}
          markTouched={markTouched}
          showFieldError={showFieldError}
          errors={errors}
          isFormValid={isFormValid}
          submitAttempted={submitAttempted}
          handleCreateFall={handleCreateFall}
          liegenschaften={liegenschaften}
          mitarbeiterListe={mitarbeiterListe}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={panelStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
            Offene und gemeldete Fälle
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faelle.map((x: any) => {
              const liegenschaft = liegenschaften.find((l: any) => l.id === x.liegenschaftId);
              const isActive = x.id === selectedFall?.id;

              return (
                <button
                  key={x.id}
                  onClick={() => {
                    setSelectedFallId(x.id);
                    setActiveTab('infos');
                    setEditFall(null);
                    setSaveInfo('');
                  }}
                  style={{
                    width: '100%',
                    border: isActive ? '1px solid #93c5fd' : '1px solid #e7dfd4',
                    background: isActive ? '#eef4ff' : '#ffffff',
                    borderRadius: 14,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#162033', lineHeight: 1.3 }}>{x.titel}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {liegenschaft?.name ?? x.liegenschaftAdresse ?? 'Unbekannte Liegenschaft'}
                      </div>
                    </div>

                    <div style={referencePillStyle}>{x.referenz ?? x.id}</div>
                  </div>

                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={badgeStyle(getStatusColor(x.status), '#ffffff')}>{normalizeStatus(x.status)}</span>
                    <span style={badgeStyle('#b45309', '#fff7ed', '#fed7aa')}>{x.prioritaet ?? 'Normal'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={panelStyle}>
          {selectedFall ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#162033', lineHeight: 1.2 }}>{selectedFall.titel}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>
                    {selectedLiegenschaft?.name ?? selectedFall.liegenschaftAdresse ?? '-'} ·{' '}
                    {selectedLiegenschaft?.strasse ?? selectedLiegenschaft?.ort ?? selectedFall.plzOrt ?? '-'}
                  </div>
                </div>

                <div style={referencePillStyle}>{selectedFall.referenz ?? selectedFall.id}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={badgeStyle(getStatusColor(selectedFall.status), '#ffffff')}>
                  Status: {normalizeStatus(selectedFall.status)}
                </span>
                <span style={badgeStyle('#b45309', '#fff7ed', '#fed7aa')}>
                  Priorität: {selectedFall.prioritaet ?? 'Normal'}
                </span>
                <span style={badgeStyle('#166534', '#f0fdf4', '#bbf7d0')}>
                  Kategorie: {selectedFall.kategorie ?? 'Sonstiges'}
                </span>
                {selectedZustellung && (
                  <span style={badgeStyle('#334155', '#f8fafc', '#cbd5e1')}>Mitarbeiter: {selectedZustellung.name}</span>
                )}
                {selectedHandwerker && (
                  <span style={badgeStyle('#7c2d12', '#fff7ed', '#fed7aa')}>Handwerker: {selectedHandwerker.firma}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        border: active ? '1px solid #2f6fed' : '1px solid #d9d0c3',
                        background: active ? '#eef4ff' : '#f8f4ec',
                        color: active ? '#2f6fed' : '#334155',
                        borderRadius: 999,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'infos' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 10, alignItems: 'center' }}>
                    {saveInfo && <span style={{ color: saveInfo.includes('fehl') ? '#dc2626' : '#16a34a', fontSize: 13 }}>{saveInfo}</span>}
                    {!editFall ? (
                      <button onClick={() => startEdit(selectedFall)} style={secondaryButtonStyle}>
                        Bearbeiten
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setEditFall(null)} style={secondaryButtonStyle}>
                          Abbrechen
                        </button>
                        <button onClick={handleSaveFall} style={primaryButtonStyle}>
                          Speichern
                        </button>
                      </>
                    )}
                  </div>

                  {editFall ? (
                    <div style={{ ...panelInnerStyle, marginBottom: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <Field label="Status">
                          <select value={editFall.status} onChange={(e) => updateEdit('status', e.target.value)} style={getInputStyle(false)}>
                            {STATUS_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </Field>

                        <Field label="Priorität">
                          <select value={editFall.prioritaet} onChange={(e) => updateEdit('prioritaet', e.target.value)} style={getInputStyle(false)}>
                            {PRIORITAET_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </Field>

                        <Field label="Kategorie">
                          <select value={editFall.kategorie} onChange={(e) => updateEdit('kategorie', e.target.value)} style={getInputStyle(false)}>
                            {KATEGORIE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </Field>

                        <Field label="Frist / Termin">
                          <input type="datetime-local" value={editFall.frist} onChange={(e) => updateEdit('frist', e.target.value)} style={getInputStyle(false)} />
                        </Field>

                        <Field label="Verantwortlicher Mitarbeiter">
                          <select
                            value={editFall.verantwortlicherMitarbeiterId}
                            onChange={(e) => updateEdit('verantwortlicherMitarbeiterId', e.target.value)}
                            style={getInputStyle(false)}
                          >
                            <option value="">Nicht zugewiesen</option>
                            {mitarbeiterListe.map((m: any) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Handwerker">
                          <select value={editFall.handwerkerId} onChange={(e) => updateEdit('handwerkerId', e.target.value)} style={getInputStyle(false)}>
                            <option value="">Kein Handwerker</option>
                            {handwerker.map((h: any) => (
                              <option key={h.id} value={h.id}>{h.firma} · {h.gewerk}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
                    <InfoBox label="Direkt zugewiesen an" value={selectedZustellung?.name ?? 'Keine direkte Zuweisung'} />
                    <InfoBox label="Handwerker" value={selectedHandwerker?.firma ?? 'Kein Handwerker zugewiesen'} />
                    <InfoBox label="Frist" value={formatDateTime(selectedFall.frist)} />
                    <InfoBox label="Kontaktkanal" value={selectedFall.formular?.kontaktkanal ?? '-'} />
                    <InfoBox label="Mietobjekt" value={selectedFall.formular?.mietobjekt ?? '-'} />
                    <InfoBox label="Stockwerk" value={selectedFall.formular?.stockwerk ?? '-'} />
                    <InfoBox label="Schadensort" value={selectedFall.formular?.schadensort ?? '-'} />
                    <InfoBox label="Seit wann" value={selectedFall.formular?.seitWann ?? '-'} />
                    <InfoBox
                      label="Kontaktperson"
                      value={
                        selectedFall.formular?.kontaktperson ||
                        `${selectedFall.formular?.vorname ?? ''} ${selectedFall.formular?.nachname ?? ''}`.trim() ||
                        selectedFall.gemeldetVon ||
                        '-'
                      }
                    />
                    <InfoBox label="Zugang möglich" value={selectedFall.formular?.zugangMoeglich ?? '-'} />
                    <InfoBox label="Firma" value={selectedFall.formular?.firma ?? '-'} />
                    <InfoBox label="Strasse" value={selectedFall.formular?.strasse ?? '-'} />
                    <InfoBox label="PLZ / Ort" value={selectedFall.formular?.plzOrt ?? selectedFall.plzOrt ?? '-'} />
                    <InfoBox label="E-Mail" value={selectedFall.formular?.email ?? '-'} />
                    <InfoBox label="Telefon" value={selectedFall.formular?.telefon ?? '-'} />
                  </div>

                  <SectionBox title="Fehlermeldung / Beschreibung Schaden">
                    {selectedFall.formular?.beschreibung ?? selectedFall.beschreibung ?? '-'}
                  </SectionBox>

                  <SectionBox title="Wie entstanden">{selectedFall.formular?.wieEntstanden ?? '-'}</SectionBox>
                  <SectionBox title="Bemerkung">{selectedFall.formular?.bemerkung ?? '-'}</SectionBox>
                </>
              )}

              {activeTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={chatPanelStyle}>
                    {selectedChats.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: 14 }}>Noch keine Nachrichten zu diesem Schadenfall vorhanden.</div>
                    ) : (
                      selectedChats.map((msg: any) => {
                        const intern = isInternalSender(msg);
                        const sender = msg.absender ?? msg.senderName ?? 'Unbekannt';
                        const text = msg.nachricht ?? msg.text ?? '';

                        return (
                          <div key={msg.id} style={{ display: 'flex', justifyContent: intern ? 'flex-end' : 'flex-start' }}>
                            <div
                              style={{
                                maxWidth: '70%',
                                background: intern ? '#162033' : '#ffffff',
                                color: intern ? '#ffffff' : '#162033',
                                border: intern ? '1px solid #162033' : '1px solid #e2e8f0',
                                borderRadius: 14,
                                padding: '10px 12px',
                              }}
                            >
                              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 5, fontSize: 11, opacity: 0.75 }}>
                                <strong>{sender}</strong>
                                <span>{formatDateTime(msg.zeitstempel ?? msg.createdAt ?? msg.zeit)}</span>
                              </div>
                              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={panelInnerStyle}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Neue Nachricht verfassen</div>
                    <textarea value={newChatText} onChange={(e) => setNewChatText(e.target.value)} placeholder="Nachricht schreiben ..." style={getTextareaStyle(false)} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      <button onClick={handleSendChat} style={primaryButtonStyle}>Nachricht senden</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bilder' && (
                <SectionBox title="Bilder">
                  Noch keine Bilder hinterlegt. Als nächstes verbinden wir hier die Foto-URLs aus AWS Storage.
                </SectionBox>
              )}

              {activeTab === 'dokumente' && (
                <SectionBox title="Dokumente">
                  Dokumenten-Upload bauen wir als nächsten Schritt mit S3 Storage, Kategorie, Jahr und Datum.
                </SectionBox>
              )}
            </>
          ) : (
            <div style={{ color: '#64748b' }}>Keine Schadenfälle vorhanden.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewFallForm(props: any) {
  const {
    formData,
    updateForm,
    markTouched,
    showFieldError,
    errors,
    isFormValid,
    submitAttempted,
    handleCreateFall,
    liegenschaften,
    mitarbeiterListe,
  } = props;

  return (
    <div style={{ ...panelStyle, marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#162033', marginBottom: 8 }}>Neues Schadenformular</div>

      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
        Felder mit <span style={{ color: '#dc2626', fontWeight: 700 }}>*</span> sind Pflichtfelder.
      </div>

      {!isFormValid && submitAttempted && (
        <div style={{ marginBottom: 14, background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.5 }}>
          Bitte ergänze alle Pflichtfelder, bevor du den Schadenfall speicherst.
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={sectionTitleStyle}>Meldedaten</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Field label="Vorname" required error={showFieldError('vorname') ? errors.vorname : ''}>
            <input value={formData.vorname} onChange={(e) => updateForm('vorname', e.target.value)} onBlur={() => markTouched('vorname')} style={getInputStyle(showFieldError('vorname'))} />
          </Field>

          <Field label="Nachname" required error={showFieldError('nachname') ? errors.nachname : ''}>
            <input value={formData.nachname} onChange={(e) => updateForm('nachname', e.target.value)} onBlur={() => markTouched('nachname')} style={getInputStyle(showFieldError('nachname'))} />
          </Field>

          <Field label="Firma">
            <input value={formData.firma} onChange={(e) => updateForm('firma', e.target.value)} style={getInputStyle(false)} />
          </Field>

          <Field label="Telefon">
            <input value={formData.telefon} onChange={(e) => updateForm('telefon', e.target.value)} style={getInputStyle(false)} />
          </Field>

          <Field label="Strasse" required error={showFieldError('strasse') ? errors.strasse : ''}>
            <input value={formData.strasse} onChange={(e) => updateForm('strasse', e.target.value)} onBlur={() => markTouched('strasse')} style={getInputStyle(showFieldError('strasse'))} />
          </Field>

          <Field label="PLZ / Ort" required error={showFieldError('plzOrt') ? errors.plzOrt : ''}>
            <input value={formData.plzOrt} onChange={(e) => updateForm('plzOrt', e.target.value)} onBlur={() => markTouched('plzOrt')} style={getInputStyle(showFieldError('plzOrt'))} />
          </Field>

          <Field label="E-Mail" required error={showFieldError('email') ? errors.email : ''}>
            <input value={formData.email} onChange={(e) => updateForm('email', e.target.value)} onBlur={() => markTouched('email')} style={getInputStyle(showFieldError('email'))} />
          </Field>

          <Field label="Kontaktkanal">
            <select value={formData.kontaktkanal} onChange={(e) => updateForm('kontaktkanal', e.target.value)} style={getInputStyle(false)}>
              <option value="bewirtschafter">Bewirtschafter</option>
              <option value="buchhalter">Buchhalter</option>
              <option value="allgemein">Allgemein</option>
            </select>
          </Field>
        </div>
      </div>

      <div>
        <div style={sectionTitleStyle}>Schadendaten</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Field label="Titel">
            <input value={formData.titel} onChange={(e) => updateForm('titel', e.target.value)} placeholder="Optional, sonst automatisch" style={getInputStyle(false)} />
          </Field>

          <Field label="Liegenschaft">
            <select value={formData.liegenschaftId} onChange={(e) => updateForm('liegenschaftId', e.target.value)} style={getInputStyle(false)}>
              {liegenschaften.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>

          <Field label="Direkt zustellen an">
            <select value={formData.direktzustellungAn} onChange={(e) => updateForm('direktzustellungAn', e.target.value)} style={getInputStyle(false)}>
              {mitarbeiterListe.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Field label="Dringlichkeit" required error={showFieldError('prioritaet') ? errors.prioritaet : ''}>
            <select value={formData.prioritaet} onChange={(e) => updateForm('prioritaet', e.target.value)} onBlur={() => markTouched('prioritaet')} style={getInputStyle(showFieldError('prioritaet'))}>
              {PRIORITAET_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>

          <Field label="Kategorie">
            <select value={formData.kategorie} onChange={(e) => updateForm('kategorie', e.target.value)} style={getInputStyle(false)}>
              {KATEGORIE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>

          <Field label="Status">
            <select value={formData.status} onChange={(e) => updateForm('status', e.target.value)} style={getInputStyle(false)}>
              {STATUS_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>

          <Field label="Mietobjekt">
            <input value={formData.mietobjekt} onChange={(e) => updateForm('mietobjekt', e.target.value)} style={getInputStyle(false)} />
          </Field>

          <Field label="Stockwerk">
            <input value={formData.stockwerk} onChange={(e) => updateForm('stockwerk', e.target.value)} style={getInputStyle(false)} />
          </Field>

          <Field label="Schadensort">
            <input value={formData.schadensort} onChange={(e) => updateForm('schadensort', e.target.value)} style={getInputStyle(false)} />
          </Field>

          <Field label="Seit wann">
            <input type="date" value={formData.seitWann} onChange={(e) => updateForm('seitWann', e.target.value)} style={getInputStyle(false)} />
          </Field>

          <Field label="Zugang möglich">
            <select value={formData.zugangMoeglich} onChange={(e) => updateForm('zugangMoeglich', e.target.value)} style={getInputStyle(false)}>
              <option value="Ja">Ja</option>
              <option value="Nein">Nein</option>
              <option value="Nach Absprache">Nach Absprache</option>
            </select>
          </Field>

          <Field label="Fehlermeldung / Beschreibung Schaden" required fullWidth error={showFieldError('beschreibung') ? errors.beschreibung : ''}>
            <textarea value={formData.beschreibung} onChange={(e) => updateForm('beschreibung', e.target.value)} onBlur={() => markTouched('beschreibung')} style={getTextareaStyle(showFieldError('beschreibung'))} />
          </Field>

          <Field label="Wie entstanden" fullWidth>
            <textarea value={formData.wieEntstanden} onChange={(e) => updateForm('wieEntstanden', e.target.value)} style={getTextareaStyle(false)} />
          </Field>

          <Field label="Bemerkung" fullWidth>
            <textarea value={formData.bemerkung} onChange={(e) => updateForm('bemerkung', e.target.value)} style={getTextareaStyle(false)} />
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={handleCreateFall} style={{ ...primaryButtonStyle, opacity: isFormValid ? 1 : 0.92 }}>
          Schadenfall speichern
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, fullWidth = false, required = false, error = '' }: any) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      {children}
      {error && <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626', lineHeight: 1.4 }}>{error}</div>}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#162033', lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#334155', lineHeight: 1.6, fontSize: 14 }}>{children}</div>
    </div>
  );
}

function badgeStyle(textColor: string, background: string, borderColor?: string): React.CSSProperties {
  return {
    background,
    color: textColor,
    border: `1px solid ${borderColor ?? `${textColor}33`}`,
    borderRadius: 999,
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 700,
  };
}

function getInputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 12,
    border: hasError ? '1px solid #dc2626' : '1px solid #d9d0c3',
    background: hasError ? '#fff7f7' : '#fff',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
  };
}

function getTextareaStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 92,
    padding: '11px 12px',
    borderRadius: 12,
    border: hasError ? '1px solid #dc2626' : '1px solid #d9d0c3',
    background: hasError ? '#fff7f7' : '#fff',
    fontSize: 14,
    boxSizing: 'border-box',
    resize: 'vertical',
    outline: 'none',
  };
}

const panelStyle: React.CSSProperties = {
  background: '#fffdf9',
  border: '1px solid #e7dfd4',
  borderRadius: 18,
  padding: 18,
  boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
  minWidth: 0,
};

const panelInnerStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 14,
};

const chatPanelStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const referencePillStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  background: '#f8fafc',
  borderRadius: 999,
  padding: '7px 10px',
  whiteSpace: 'nowrap',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#162033',
  marginBottom: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  border: '1px solid #2f6fed',
  background: '#2f6fed',
  color: '#fff',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #d9d0c3',
  background: '#f8f4ec',
  color: '#162033',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
