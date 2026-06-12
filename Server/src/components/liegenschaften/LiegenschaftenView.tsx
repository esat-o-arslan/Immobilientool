import React, { useEffect, useMemo, useState } from 'react';

type PropertyTab = 'uebersicht' | 'objektchat' | 'personenchat' | 'parteien';

const createInitialPropertyForm = (mitarbeiterListe: any[]) => ({
  name: '',
  liegenschaftNummer: '',
  strasse: '',
  plz: '',
  ort: '',
  status: 'Aktiv',
  bewirtschafterIds: mitarbeiterListe.slice(0, 1).map((x: any) => x.id),
  buchhalterIds: mitarbeiterListe.slice(0, 1).map((x: any) => x.id),
});

const createPropertyEditForm = (liegenschaft: any) => ({
  name: liegenschaft?.name ?? '',
  liegenschaftNummer: liegenschaft?.liegenschaftNummer ?? '',
  strasse: liegenschaft?.strasse ?? '',
  plz: liegenschaft?.plz ?? '',
  ort: liegenschaft?.ort ?? '',
  status: liegenschaft?.status ?? 'Aktiv',
  bewirtschafterIds: liegenschaft?.bewirtschafterIds ?? [],
  buchhalterIds: liegenschaft?.buchhalterIds ?? [],
});

const createPersonEditForm = (person: any) => ({
  name: person?.name ?? '',
  rolle: person?.rolle ?? '',
  email: person?.email ?? '',
  telefon: person?.telefon ?? '',
  kontoStatus: person?.kontoStatus ?? 'Aktiv',
  wohnungsNummer: person?.wohnungsNummer ?? '',
  stockwerk: person?.stockwerk ?? '',
});

export function LiegenschaftenView({
  liegenschaften = [],
  selectedLiegenschaftId,
  selectedPersonId,
  setSelectedLiegenschaftId,
  setSelectedPersonId,
  mitarbeiterListe = [],
  faelle = [],
  chats = [],
  setLiegenschaften,
  setChats,
}: any) {
  const [activeTab, setActiveTab] = useState<PropertyTab>('uebersicht');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreatePersonForm, setShowCreatePersonForm] = useState(false);
  const [showInactivePersons, setShowInactivePersons] = useState(false);

  const [newObjektMessage, setNewObjektMessage] = useState('');
  const [newPersonMessage, setNewPersonMessage] = useState('');

  const [propertyForm, setPropertyForm] = useState(createInitialPropertyForm(mitarbeiterListe));
  const [propertySubmitAttempted, setPropertySubmitAttempted] = useState(false);

  const [isEditingProperty, setIsEditingProperty] = useState(false);
  const [isEditingPerson, setIsEditingPerson] = useState(false);

  const [propertyEditForm, setPropertyEditForm] = useState(createPropertyEditForm(liegenschaften[0]));
  const [personEditForm, setPersonEditForm] = useState(
    createPersonEditForm(liegenschaften[0]?.personen?.[0])
  );

  const [newPersonForm, setNewPersonForm] = useState({
    name: '',
    rolle: 'Mieter',
    email: '',
    telefon: '',
    kontoStatus: 'Aktiv',
    wohnungsNummer: '',
    stockwerk: '',
  });

  const aktuelleLiegenschaft =
    liegenschaften.find((x: any) => x.id === selectedLiegenschaftId) ?? liegenschaften[0];

  const aktuellePerson =
    aktuelleLiegenschaft?.personen?.find((x: any) => x.id === selectedPersonId) ??
    aktuelleLiegenschaft?.personen?.find((x: any) => x.aktiv !== false) ??
    aktuelleLiegenschaft?.personen?.[0];

  useEffect(() => {
    setPropertyEditForm(createPropertyEditForm(aktuelleLiegenschaft));
  }, [aktuelleLiegenschaft]);

  useEffect(() => {
    setPersonEditForm(createPersonEditForm(aktuellePerson));
  }, [aktuellePerson]);

  const aktivePersonen =
    aktuelleLiegenschaft?.personen?.filter((x: any) => x.aktiv !== false) ?? [];

  const ausgeschiedenePersonen =
    aktuelleLiegenschaft?.personen?.filter((x: any) => x.aktiv === false) ?? [];

  const personenFaelle = useMemo(() => {
    return faelle
      .filter((x: any) => x.personId === aktuellePerson?.id)
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt ?? a.datum ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? b.datum ?? 0).getTime();
        return bTime - aTime;
      });
  }, [faelle, aktuellePerson]);

  const offenePersonenFaelle = personenFaelle.filter((x: any) => x.status !== 'Erledigt');
  const altePersonenFaelle = personenFaelle.filter((x: any) => x.status === 'Erledigt');

  const objektChats = useMemo(() => {
    return chats
      .filter(
        (x: any) =>
          x.liegenschaftId === aktuelleLiegenschaft?.id && !x.schadenfallId && !x.personId
      )
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt ?? a.zeit ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? b.zeit ?? 0).getTime();
        return aTime - bTime;
      });
  }, [chats, aktuelleLiegenschaft]);

  const personenChats = useMemo(() => {
    return chats
      .filter(
        (x: any) =>
          x.liegenschaftId === aktuelleLiegenschaft?.id &&
          x.personId === aktuellePerson?.id &&
          !x.schadenfallId
      )
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt ?? a.zeit ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? b.zeit ?? 0).getTime();
        return aTime - bTime;
      });
  }, [chats, aktuelleLiegenschaft, aktuellePerson]);

  const kontaktJournal = useMemo(() => {
    return [...personenChats].sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt ?? a.zeit ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? b.zeit ?? 0).getTime();
      return bTime - aTime;
    });
  }, [personenChats]);

  const bewirtschafter = mitarbeiterListe.filter((x: any) =>
    aktuelleLiegenschaft?.bewirtschafterIds?.includes(x.id)
  );

  const buchhalter = mitarbeiterListe.filter((x: any) =>
    aktuelleLiegenschaft?.buchhalterIds?.includes(x.id)
  );

  const tabs: { key: PropertyTab; label: string }[] = [
    { key: 'uebersicht', label: 'Übersicht' },
    { key: 'objektchat', label: 'Objekt-Chat' },
    { key: 'personenchat', label: 'Personen-Chat' },
    { key: 'parteien', label: 'Parteien' },
  ];

  const propertyErrors = {
    name: !propertyForm.name.trim() ? 'Name ist ein Pflichtfeld.' : '',
    liegenschaftNummer: !propertyForm.liegenschaftNummer.trim()
      ? 'Liegenschaftsnummer ist ein Pflichtfeld.'
      : '',
    strasse: !propertyForm.strasse.trim() ? 'Strasse ist ein Pflichtfeld.' : '',
    plz: !propertyForm.plz.trim() ? 'PLZ ist ein Pflichtfeld.' : '',
    ort: !propertyForm.ort.trim() ? 'Ort ist ein Pflichtfeld.' : '',
  };

  const isPropertyFormValid = Object.values(propertyErrors).every((x) => !x);

  const updatePropertyForm = (key: string, value: any) => {
    setPropertyForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const updatePropertyEditForm = (key: string, value: any) => {
    setPropertyEditForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const updatePersonEditForm = (key: string, value: any) => {
    setPersonEditForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const updateNewPersonForm = (key: string, value: string) => {
    setNewPersonForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleCreateProperty = () => {
    setPropertySubmitAttempted(true);
    if (!isPropertyFormValid) return;

    const newId = `l-${Date.now()}`;
    const neueLiegenschaft = {
      id: newId,
      liegenschaftNummer: propertyForm.liegenschaftNummer,
      name: propertyForm.name,
      strasse: propertyForm.strasse,
      plz: propertyForm.plz,
      ort: propertyForm.ort,
      status: propertyForm.status,
      bewirtschafterIds: propertyForm.bewirtschafterIds,
      buchhalterIds: propertyForm.buchhalterIds,
      personen: [],
    };

    if (setLiegenschaften) {
      setLiegenschaften((prev: any[]) => [neueLiegenschaft, ...prev]);
    }

    setSelectedLiegenschaftId?.(newId);
    setSelectedPersonId?.('');
    setShowCreateForm(false);
    setPropertySubmitAttempted(false);
    setPropertyForm(createInitialPropertyForm(mitarbeiterListe));
    setActiveTab('uebersicht');
  };

  const handleSaveProperty = () => {
    if (!aktuelleLiegenschaft || !setLiegenschaften) return;

    setLiegenschaften((prev: any[]) =>
      prev.map((item: any) =>
        item.id === aktuelleLiegenschaft.id
          ? {
              ...item,
              name: propertyEditForm.name,
              liegenschaftNummer: propertyEditForm.liegenschaftNummer,
              strasse: propertyEditForm.strasse,
              plz: propertyEditForm.plz,
              ort: propertyEditForm.ort,
              status: propertyEditForm.status,
              bewirtschafterIds: propertyEditForm.bewirtschafterIds,
              buchhalterIds: propertyEditForm.buchhalterIds,
            }
          : item
      )
    );

    setIsEditingProperty(false);
  };

  const handleSavePerson = () => {
    if (!aktuelleLiegenschaft || !aktuellePerson || !setLiegenschaften) return;

    setLiegenschaften((prev: any[]) =>
      prev.map((lieg: any) =>
        lieg.id === aktuelleLiegenschaft.id
          ? {
              ...lieg,
              personen: lieg.personen.map((person: any) =>
                person.id === aktuellePerson.id
                  ? {
                      ...person,
                      name: personEditForm.name,
                      rolle: personEditForm.rolle,
                      email: personEditForm.email,
                      telefon: personEditForm.telefon,
                      kontoStatus: personEditForm.kontoStatus,
                      wohnungsNummer: personEditForm.wohnungsNummer,
                      stockwerk: personEditForm.stockwerk,
                    }
                  : person
              ),
            }
          : lieg
      )
    );

    setIsEditingPerson(false);
  };

  const handleCreatePerson = () => {
    if (!aktuelleLiegenschaft || !setLiegenschaften || !newPersonForm.name.trim()) return;

    const neuePerson = {
      id: `p-${Date.now()}`,
      name: newPersonForm.name,
      rolle: newPersonForm.rolle,
      email: newPersonForm.email,
      telefon: newPersonForm.telefon,
      kontoStatus: newPersonForm.kontoStatus,
      wohnungsNummer: newPersonForm.wohnungsNummer,
      stockwerk: newPersonForm.stockwerk,
      aktiv: true,
      austrittsdatum: '',
      austrittsgrund: '',
    };

    setLiegenschaften((prev: any[]) =>
      prev.map((lieg: any) =>
        lieg.id === aktuelleLiegenschaft.id
          ? {
              ...lieg,
              personen: [...(lieg.personen ?? []), neuePerson],
            }
          : lieg
      )
    );

    setSelectedPersonId?.(neuePerson.id);
    setShowCreatePersonForm(false);
    setActiveTab('parteien');
    setNewPersonForm({
      name: '',
      rolle: 'Mieter',
      email: '',
      telefon: '',
      kontoStatus: 'Aktiv',
      wohnungsNummer: '',
      stockwerk: '',
    });
  };

  const handleMarkPersonInactive = () => {
    if (!aktuelleLiegenschaft || !aktuellePerson || !setLiegenschaften) return;

    const austrittsdatum = new Date().toISOString().slice(0, 10);

    setLiegenschaften((prev: any[]) =>
      prev.map((lieg: any) =>
        lieg.id === aktuelleLiegenschaft.id
          ? {
              ...lieg,
              personen: lieg.personen.map((person: any) =>
                person.id === aktuellePerson.id
                  ? {
                      ...person,
                      aktiv: false,
                      kontoStatus: 'Ausgetreten',
                      austrittsdatum,
                      austrittsgrund: 'Manuell ausgetreten',
                    }
                  : person
              ),
            }
          : lieg
      )
    );

    const nextActivePerson = aktivePersonen.filter((x: any) => x.id !== aktuellePerson.id)[0];
    setSelectedPersonId?.(nextActivePerson?.id ?? '');
    setIsEditingPerson(false);
  };

  const handleSendObjektChat = () => {
    if (!newObjektMessage.trim() || !aktuelleLiegenschaft || !setChats) return;

    const neueNachricht = {
      id: `oc-${Date.now()}`,
      liegenschaftId: aktuelleLiegenschaft.id,
      personId: null,
      schadenfallId: null,
      kanal: 'objekt',
      senderTyp: 'mitarbeiter',
      senderId: 'm1',
      senderName: 'Immobilientool',
      empfaengerName: aktuelleLiegenschaft.name,
      text: newObjektMessage.trim(),
      createdAt: new Date().toISOString(),
    };

    setChats((prev: any[]) => [...prev, neueNachricht]);
    setNewObjektMessage('');
  };

  const handleSendPersonChat = () => {
    if (!newPersonMessage.trim() || !aktuelleLiegenschaft || !aktuellePerson || !setChats) return;

    const neueNachricht = {
      id: `pc-${Date.now()}`,
      liegenschaftId: aktuelleLiegenschaft.id,
      personId: aktuellePerson.id,
      schadenfallId: null,
      kanal: 'person',
      senderTyp: 'mitarbeiter',
      senderId: 'm1',
      senderName: 'Immobilientool',
      empfaengerName: aktuellePerson.name,
      text: newPersonMessage.trim(),
      createdAt: new Date().toISOString(),
    };

    setChats((prev: any[]) => [...prev, neueNachricht]);
    setNewPersonMessage('');
  };

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          marginBottom: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30, color: '#162033' }}>Liegenschaften Stammdaten</h1>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Objekte, Parteien, Zuständigkeiten, Historie und Kommunikation zentral verwalten.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsEditingProperty((prev) => !prev)}
            style={secondaryButtonStyle}
          >
            {isEditingProperty ? 'Bearbeitung abbrechen' : 'Liegenschaft bearbeiten'}
          </button>

          <button
            onClick={() => setShowCreateForm((prev) => !prev)}
            style={primaryButtonStyle}
          >
            {showCreateForm ? 'Erfassung schliessen' : 'Neue Liegenschaft erfassen'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div
          style={{
            background: '#fffdf9',
            border: '1px solid #e7dfd4',
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#162033', marginBottom: 8 }}>
            Neue Liegenschaft
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
            Erfasse alle relevanten Stammdaten für ein neues Objekt.
          </div>

          {!isPropertyFormValid && propertySubmitAttempted && (
            <div
              style={{
                marginBottom: 14,
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#9f1239',
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
              }}
            >
              Bitte alle Pflichtfelder der Liegenschaft ergänzen.
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Name" required error={propertySubmitAttempted ? propertyErrors.name : ''}>
              <input
                value={propertyForm.name}
                onChange={(e) => updatePropertyForm('name', e.target.value)}
                style={getInputStyle(!!propertySubmitAttempted && !!propertyErrors.name)}
              />
            </Field>

            <Field
              label="Liegenschaftsnummer"
              required
              error={propertySubmitAttempted ? propertyErrors.liegenschaftNummer : ''}
            >
              <input
                value={propertyForm.liegenschaftNummer}
                onChange={(e) => updatePropertyForm('liegenschaftNummer', e.target.value)}
                style={getInputStyle(
                  !!propertySubmitAttempted && !!propertyErrors.liegenschaftNummer
                )}
              />
            </Field>

            <Field label="Strasse" required error={propertySubmitAttempted ? propertyErrors.strasse : ''}>
              <input
                value={propertyForm.strasse}
                onChange={(e) => updatePropertyForm('strasse', e.target.value)}
                style={getInputStyle(!!propertySubmitAttempted && !!propertyErrors.strasse)}
              />
            </Field>

            <Field label="PLZ" required error={propertySubmitAttempted ? propertyErrors.plz : ''}>
              <input
                value={propertyForm.plz}
                onChange={(e) => updatePropertyForm('plz', e.target.value)}
                style={getInputStyle(!!propertySubmitAttempted && !!propertyErrors.plz)}
              />
            </Field>

            <Field label="Ort" required error={propertySubmitAttempted ? propertyErrors.ort : ''}>
              <input
                value={propertyForm.ort}
                onChange={(e) => updatePropertyForm('ort', e.target.value)}
                style={getInputStyle(!!propertySubmitAttempted && !!propertyErrors.ort)}
              />
            </Field>

            <Field label="Status">
              <select
                value={propertyForm.status}
                onChange={(e) => updatePropertyForm('status', e.target.value)}
                style={getInputStyle(false)}
              >
                <option value="Aktiv">Aktiv</option>
                <option value="Inaktiv">Inaktiv</option>
              </select>
            </Field>

            <Field label="Bewirtschafter" fullWidth>
              <div style={multiSelectWrapStyle}>
                {mitarbeiterListe.map((m: any) => {
                  const active = propertyForm.bewirtschafterIds.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={`bew-create-${m.id}`}
                      onClick={() =>
                        updatePropertyForm(
                          'bewirtschafterIds',
                          active
                            ? propertyForm.bewirtschafterIds.filter((id: string) => id !== m.id)
                            : [...propertyForm.bewirtschafterIds, m.id]
                        )
                      }
                      style={multiSelectItemStyle(active)}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Buchhalter" fullWidth>
              <div style={multiSelectWrapStyle}>
                {mitarbeiterListe.map((m: any) => {
                  const active = propertyForm.buchhalterIds.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={`buch-create-${m.id}`}
                      onClick={() =>
                        updatePropertyForm(
                          'buchhalterIds',
                          active
                            ? propertyForm.buchhalterIds.filter((id: string) => id !== m.id)
                            : [...propertyForm.buchhalterIds, m.id]
                        )
                      }
                      style={multiSelectItemStyle(active)}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={handleCreateProperty} style={primaryButtonStyle}>
              Liegenschaft speichern
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {liegenschaften.map((x: any) => (
          <button
            key={x.id}
            onClick={() => {
              setSelectedLiegenschaftId?.(x.id);
              setSelectedPersonId?.(
                x.personen?.find((p: any) => p.aktiv !== false)?.id ?? x.personen?.[0]?.id ?? ''
              );
              setActiveTab('uebersicht');
              setIsEditingProperty(false);
              setIsEditingPerson(false);
            }}
            style={{
              border: x.id === aktuelleLiegenschaft?.id ? '1px solid #2f6fed' : '1px solid #d9d0c3',
              background: x.id === aktuelleLiegenschaft?.id ? '#eef4ff' : '#fffdf9',
              color: x.id === aktuelleLiegenschaft?.id ? '#2f6fed' : '#162033',
              borderRadius: 999,
              padding: '10px 14px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {x.name}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '330px minmax(0, 1fr)',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            {isEditingProperty ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#162033' }}>
                  Liegenschaft bearbeiten
                </div>

                <input
                  value={propertyEditForm.name}
                  onChange={(e) => updatePropertyEditForm('name', e.target.value)}
                  style={getInputStyle(false)}
                  placeholder="Objektname"
                />

                <input
                  value={propertyEditForm.strasse}
                  onChange={(e) => updatePropertyEditForm('strasse', e.target.value)}
                  style={getInputStyle(false)}
                  placeholder="Strasse"
                />

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
                  <input
                    value={propertyEditForm.plz}
                    onChange={(e) => updatePropertyEditForm('plz', e.target.value)}
                    style={getInputStyle(false)}
                    placeholder="PLZ"
                  />
                  <input
                    value={propertyEditForm.ort}
                    onChange={(e) => updatePropertyEditForm('ort', e.target.value)}
                    style={getInputStyle(false)}
                    placeholder="Ort"
                  />
                </div>

                <input
                  value={propertyEditForm.liegenschaftNummer}
                  onChange={(e) => updatePropertyEditForm('liegenschaftNummer', e.target.value)}
                  style={getInputStyle(false)}
                  placeholder="Liegenschaftsnummer"
                />

                <select
                  value={propertyEditForm.status}
                  onChange={(e) => updatePropertyEditForm('status', e.target.value)}
                  style={getInputStyle(false)}
                >
                  <option value="Aktiv">Aktiv</option>
                  <option value="Inaktiv">Inaktiv</option>
                </select>

                <div>
                  <div style={miniLabelStyle}>Bewirtschafter</div>
                  <div style={multiSelectWrapStyle}>
                    {mitarbeiterListe.map((m: any) => {
                      const active = propertyEditForm.bewirtschafterIds.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={`bew-edit-${m.id}`}
                          onClick={() =>
                            updatePropertyEditForm(
                              'bewirtschafterIds',
                              active
                                ? propertyEditForm.bewirtschafterIds.filter(
                                    (id: string) => id !== m.id
                                  )
                                : [...propertyEditForm.bewirtschafterIds, m.id]
                            )
                          }
                          style={multiSelectItemStyle(active)}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={miniLabelStyle}>Buchhalter</div>
                  <div style={multiSelectWrapStyle}>
                    {mitarbeiterListe.map((m: any) => {
                      const active = propertyEditForm.buchhalterIds.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={`buch-edit-${m.id}`}
                          onClick={() =>
                            updatePropertyEditForm(
                              'buchhalterIds',
                              active
                                ? propertyEditForm.buchhalterIds.filter(
                                    (id: string) => id !== m.id
                                  )
                                : [...propertyEditForm.buchhalterIds, m.id]
                            )
                          }
                          style={multiSelectItemStyle(active)}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button onClick={handleSaveProperty} style={primaryButtonStyle}>
                    Änderungen speichern
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#162033', marginBottom: 8 }}>
                  {aktuelleLiegenschaft?.name}
                </div>
                <div style={mutedTextStyle}>{aktuelleLiegenschaft?.strasse}</div>
                <div style={mutedTextStyle}>
                  {aktuelleLiegenschaft?.plz} {aktuelleLiegenschaft?.ort}
                </div>
                <div style={{ ...mutedTextStyle, marginTop: 6 }}>
                  Nr. {aktuelleLiegenschaft?.liegenschaftNummer}
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionLabel>Zuständigkeiten</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={smallTitleStyle}>Bewirtschaftung</div>
                {bewirtschafter.length === 0 ? (
                  <div style={mutedTextStyle}>Keine Bewirtschafter zugewiesen.</div>
                ) : (
                  bewirtschafter.map((x: any) => (
                    <div key={x.id} style={listItemTextStyle}>
                      {x.name}
                    </div>
                  ))
                )}
              </div>

              <div>
                <div style={smallTitleStyle}>Buchhaltung</div>
                {buchhalter.length === 0 ? (
                  <div style={mutedTextStyle}>Keine Buchhalter zugewiesen.</div>
                ) : (
                  buchhalter.map((x: any) => (
                    <div key={x.id} style={listItemTextStyle}>
                      {x.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <SectionLabel>Parteien</SectionLabel>

              <button
                onClick={() => setShowCreatePersonForm((prev) => !prev)}
                style={smallActionButtonStyle}
              >
                {showCreatePersonForm ? 'Schliessen' : 'Neue Partei'}
              </button>
            </div>

            {showCreatePersonForm && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <input
                  value={newPersonForm.name}
                  onChange={(e) => updateNewPersonForm('name', e.target.value)}
                  placeholder="Name"
                  style={getInputStyle(false)}
                />

                <select
                  value={newPersonForm.rolle}
                  onChange={(e) => updateNewPersonForm('rolle', e.target.value)}
                  style={getInputStyle(false)}
                >
                  <option value="Mieter">Mieter</option>
                  <option value="Eigentümer">Eigentümer</option>
                  <option value="Verwaltungsbeirat">Verwaltungsbeirat</option>
                  <option value="Hauswart">Hauswart</option>
                  <option value="Sonstige Partei">Sonstige Partei</option>
                </select>

                <input
                  value={newPersonForm.email}
                  onChange={(e) => updateNewPersonForm('email', e.target.value)}
                  placeholder="E-Mail"
                  style={getInputStyle(false)}
                />

                <input
                  value={newPersonForm.telefon}
                  onChange={(e) => updateNewPersonForm('telefon', e.target.value)}
                  placeholder="Telefon"
                  style={getInputStyle(false)}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input
                    value={newPersonForm.wohnungsNummer}
                    onChange={(e) => updateNewPersonForm('wohnungsNummer', e.target.value)}
                    placeholder="Wohnung"
                    style={getInputStyle(false)}
                  />
                  <input
                    value={newPersonForm.stockwerk}
                    onChange={(e) => updateNewPersonForm('stockwerk', e.target.value)}
                    placeholder="Stockwerk"
                    style={getInputStyle(false)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleCreatePerson} style={primaryButtonStyle}>
                    Partei hinzufügen
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aktivePersonen.length ? (
                aktivePersonen.map((x: any) => (
                  <button
                    key={x.id}
                    onClick={() => {
                      setSelectedPersonId?.(x.id);
                      setActiveTab('parteien');
                      setIsEditingPerson(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border:
                        x.id === aktuellePerson?.id ? '1px solid #93c5fd' : '1px solid #e7dfd4',
                      background: x.id === aktuellePerson?.id ? '#eef4ff' : '#ffffff',
                      borderRadius: 12,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#162033' }}>{x.name}</div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                      {x.rolle} · {x.kontoStatus}
                    </div>
                  </button>
                ))
              ) : (
                <div style={mutedTextStyle}>Keine aktiven Parteien vorhanden.</div>
              )}
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setShowInactivePersons((prev) => !prev)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  borderRadius: 12,
                  padding: 12,
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                {showInactivePersons
                  ? 'Ausgeschiedene Parteien ausblenden'
                  : 'Ausgeschiedene Parteien anzeigen'}{' '}
                <span style={{ color: '#64748b', fontWeight: 600 }}>
                  ({ausgeschiedenePersonen.length})
                </span>
              </button>

              {showInactivePersons && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {ausgeschiedenePersonen.length ? (
                    ausgeschiedenePersonen.map((x: any) => (
                      <button
                        key={x.id}
                        onClick={() => {
                          setSelectedPersonId?.(x.id);
                          setActiveTab('parteien');
                          setIsEditingPerson(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border:
                            x.id === aktuellePerson?.id ? '1px solid #cbd5e1' : '1px solid #e7dfd4',
                          background: '#f8fafc',
                          borderRadius: 12,
                          padding: 12,
                          cursor: 'pointer',
                          opacity: 0.92,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#334155' }}>{x.name}</div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                          {x.rolle} · {x.kontoStatus}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                          Austritt: {x.austrittsdatum ?? '-'}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div style={mutedTextStyle}>Keine ausgeschiedenen Parteien vorhanden.</div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#162033' }}>
                  {aktuellePerson?.name ?? aktuelleLiegenschaft?.name}
                </div>
                <div style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>
                  {aktuellePerson
                    ? `${aktuellePerson?.rolle} · ${aktuellePerson?.email ?? '-'}`
                    : 'Liegenschaftsübersicht'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {aktuellePerson && aktuellePerson.aktiv !== false && (
                  <>
                    <button
                      onClick={() => setIsEditingPerson((prev) => !prev)}
                      style={secondaryButtonStyle}
                    >
                      {isEditingPerson ? 'Bearbeitung abbrechen' : 'Partei bearbeiten'}
                    </button>

                    <button onClick={handleMarkPersonInactive} style={dangerButtonStyle}>
                      Austritt erfassen
                    </button>
                  </>
                )}
              </div>
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

            {activeTab === 'uebersicht' && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 14,
                    marginBottom: 14,
                  }}
                >
                  <InfoBox label="Objektname" value={aktuelleLiegenschaft?.name ?? '-'} />
                  <InfoBox
                    label="Adresse"
                    value={`${aktuelleLiegenschaft?.strasse ?? '-'}, ${aktuelleLiegenschaft?.plz ?? '-'} ${aktuelleLiegenschaft?.ort ?? '-'}`}
                  />
                  <InfoBox
                    label="Liegenschaftsnummer"
                    value={aktuelleLiegenschaft?.liegenschaftNummer ?? '-'}
                  />
                  <InfoBox label="Status" value={aktuelleLiegenschaft?.status ?? '-'} />
                </div>

                {aktuellePerson && (
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: 16,
                      padding: 16,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                      Aktuell ausgewählte Partei
                    </div>

                    {isEditingPerson && aktuellePerson.aktiv !== false ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <input
                          value={personEditForm.name}
                          onChange={(e) => updatePersonEditForm('name', e.target.value)}
                          style={getInputStyle(false)}
                          placeholder="Name"
                        />
                        <input
                          value={personEditForm.rolle}
                          onChange={(e) => updatePersonEditForm('rolle', e.target.value)}
                          style={getInputStyle(false)}
                          placeholder="Rolle"
                        />
                        <input
                          value={personEditForm.email}
                          onChange={(e) => updatePersonEditForm('email', e.target.value)}
                          style={getInputStyle(false)}
                          placeholder="E-Mail"
                        />
                        <input
                          value={personEditForm.telefon}
                          onChange={(e) => updatePersonEditForm('telefon', e.target.value)}
                          style={getInputStyle(false)}
                          placeholder="Telefon"
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <input
                            value={personEditForm.wohnungsNummer}
                            onChange={(e) =>
                              updatePersonEditForm('wohnungsNummer', e.target.value)
                            }
                            style={getInputStyle(false)}
                            placeholder="Wohnung"
                          />
                          <input
                            value={personEditForm.stockwerk}
                            onChange={(e) => updatePersonEditForm('stockwerk', e.target.value)}
                            style={getInputStyle(false)}
                            placeholder="Stockwerk"
                          />
                        </div>
                        <select
                          value={personEditForm.kontoStatus}
                          onChange={(e) => updatePersonEditForm('kontoStatus', e.target.value)}
                          style={getInputStyle(false)}
                        >
                          <option value="Aktiv">Aktiv</option>
                          <option value="Einladung ausstehend">Einladung ausstehend</option>
                          <option value="Inaktiv">Inaktiv</option>
                        </select>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                          <button onClick={handleSavePerson} style={primaryButtonStyle}>
                            Partei speichern
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#162033', marginBottom: 8 }}>
                          {aktuellePerson.name}
                        </div>
                        <div style={mutedTextStyle}>{aktuellePerson.rolle}</div>
                        <div style={mutedTextStyle}>{aktuellePerson.email ?? '-'}</div>
                        <div style={mutedTextStyle}>{aktuellePerson.telefon ?? '-'}</div>
                        <div style={{ ...mutedTextStyle, marginTop: 6 }}>
                          Status: {aktuellePerson.kontoStatus ?? '-'}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'objektchat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    minHeight: 220,
                  }}
                >
                  {objektChats.length === 0 ? (
                    <div style={mutedTextStyle}>
                      Noch keine objektbezogenen Nachrichten vorhanden.
                    </div>
                  ) : (
                    objektChats.map((x: any) => <ChatMessage key={x.id} message={x} />)
                  )}
                </div>

                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e7dfd4',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                    Neue Nachricht im Objekt-Chat
                  </div>
                  <textarea
                    value={newObjektMessage}
                    onChange={(e) => setNewObjektMessage(e.target.value)}
                    placeholder="Nachricht zur gesamten Liegenschaft schreiben ..."
                    style={textareaStyle}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button onClick={handleSendObjektChat} style={primaryButtonStyle}>
                      Nachricht senden
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'personenchat' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
                <CardInset title="Direkte Kommunikation mit der Partei">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 14,
                        padding: 12,
                        minHeight: 220,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      {aktuellePerson ? (
                        personenChats.length === 0 ? (
                          <div style={mutedTextStyle}>
                            Noch keine direkten Nachrichten mit dieser Partei vorhanden.
                          </div>
                        ) : (
                          personenChats.map((x: any) => <ChatMessage key={x.id} message={x} />)
                        )
                      ) : (
                        <div style={mutedTextStyle}>Keine Partei ausgewählt.</div>
                      )}
                    </div>

                    {aktuellePerson && aktuellePerson.aktiv !== false && (
                      <>
                        <textarea
                          value={newPersonMessage}
                          onChange={(e) => setNewPersonMessage(e.target.value)}
                          placeholder="Nachricht direkt an die ausgewählte Partei schreiben ..."
                          style={textareaStyle}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={handleSendPersonChat} style={primaryButtonStyle}>
                            Nachricht senden
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </CardInset>

                <CardInset title="Kontaktjournal / Nachvollziehbarkeit">
                  {kontaktJournal.length === 0 ? (
                    <div style={mutedTextStyle}>
                      Noch keine Kommunikationshistorie für diese Partei vorhanden.
                    </div>
                  ) : (
                    kontaktJournal.map((entry: any) => (
                      <div key={entry.id} style={rowItemStyle}>
                        <div style={{ fontWeight: 700, color: '#162033' }}>
                          {entry.senderName ?? 'Unbekannt'}
                        </div>
                        <div style={{ color: '#475569', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                          {entry.text}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleString('de-CH')
                            : '-'}
                        </div>
                      </div>
                    ))
                  )}
                </CardInset>
              </div>
            )}

            {activeTab === 'parteien' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <CardInset title="Aktuelle und frühere Schadenfälle">
                  {!aktuellePerson ? (
                    <div style={mutedTextStyle}>Keine Partei ausgewählt.</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <div style={smallTitleStyle}>Offene / laufende Fälle</div>
                        {offenePersonenFaelle.length === 0 ? (
                          <div style={mutedTextStyle}>Keine offenen Schadenfälle vorhanden.</div>
                        ) : (
                          offenePersonenFaelle.map((x: any) => (
                            <div key={x.id} style={rowItemStyle}>
                              <div style={{ fontWeight: 700, color: '#162033' }}>{x.titel}</div>
                              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                                {x.status} · {x.prioritaet}
                              </div>
                              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                                {x.referenz ?? '-'}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div>
                        <div style={smallTitleStyle}>Frühere Schäden / Historie</div>
                        {altePersonenFaelle.length === 0 ? (
                          <div style={mutedTextStyle}>
                            Keine erledigten oder älteren Schäden vorhanden.
                          </div>
                        ) : (
                          altePersonenFaelle.map((x: any) => (
                            <div key={x.id} style={rowItemStyle}>
                              <div style={{ fontWeight: 700, color: '#162033' }}>{x.titel}</div>
                              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                                {x.status} · {x.prioritaet}
                              </div>
                              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                                {x.referenz ?? '-'}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </CardInset>

                <CardInset title="Parteiendaten">
                  {aktuellePerson ? (
                    <>
                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Name</div>
                        <div style={valueStyle}>{aktuellePerson.name}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Rolle</div>
                        <div style={valueStyle}>{aktuellePerson.rolle ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>E-Mail</div>
                        <div style={valueStyle}>{aktuellePerson.email ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Telefon</div>
                        <div style={valueStyle}>{aktuellePerson.telefon ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Wohnung</div>
                        <div style={valueStyle}>{aktuellePerson.wohnungsNummer ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Stockwerk</div>
                        <div style={valueStyle}>{aktuellePerson.stockwerk ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Kontostatus</div>
                        <div style={valueStyle}>{aktuellePerson.kontoStatus ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Aktiv</div>
                        <div style={valueStyle}>{aktuellePerson.aktiv === false ? 'Nein' : 'Ja'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Austrittsdatum</div>
                        <div style={valueStyle}>{aktuellePerson.austrittsdatum ?? '-'}</div>
                      </div>

                      <div style={rowItemStyle}>
                        <div style={miniLabelStyle}>Austrittsgrund</div>
                        <div style={valueStyle}>{aktuellePerson.austrittsgrund ?? '-'}</div>
                      </div>
                    </>
                  ) : (
                    <div style={mutedTextStyle}>Keine Partei ausgewählt.</div>
                  )}
                </CardInset>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  error = '',
  fullWidth = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  fullWidth?: boolean;
}) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      {children}
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{error}</div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fffdf9',
        border: '1px solid #e7dfd4',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
      }}
    >
      {children}
    </div>
  );
}

function CardInset({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#162033', lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: any }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#162033', marginBottom: 4 }}>
        {message.senderName ?? 'Unbekannt'}
        {message.empfaengerName ? ` → ${message.empfaengerName}` : ''}
      </div>
      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{message.text}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
        {message.createdAt ? new Date(message.createdAt).toLocaleString('de-CH') : '-'}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: '#64748b',
        textTransform: 'uppercase',
        fontWeight: 800,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

const mutedTextStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 13,
  lineHeight: 1.5,
};

const listItemTextStyle: React.CSSProperties = {
  color: '#162033',
  fontSize: 14,
  lineHeight: 1.5,
};

const smallTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#475569',
  marginBottom: 6,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 700,
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#162033',
  fontWeight: 700,
  lineHeight: 1.4,
};

const rowItemStyle: React.CSSProperties = {
  padding: '10px 0',
  borderBottom: '1px solid #e2e8f0',
};

const multiSelectWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

function multiSelectItemStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? '1px solid #2f6fed' : '1px solid #d9d0c3',
    background: active ? '#eef4ff' : '#fff',
    color: active ? '#2f6fed' : '#334155',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
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

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 100,
  padding: '11px 12px',
  borderRadius: 12,
  border: '1px solid #d9d0c3',
  background: '#fff',
  fontSize: 14,
  boxSizing: 'border-box',
  resize: 'vertical',
  outline: 'none',
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
  background: '#fffdf9',
  color: '#334155',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const smallActionButtonStyle: React.CSSProperties = {
  border: '1px solid #d9d0c3',
  background: '#fff',
  color: '#334155',
  padding: '8px 10px',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const dangerButtonStyle: React.CSSProperties = {
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#b91c1c',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};