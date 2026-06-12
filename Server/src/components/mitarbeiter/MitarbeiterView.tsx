import React, { useMemo, useState } from 'react';

type PermissionType = 'viewcases' | 'editcases' | 'viewfinances' | 'managestaff';

const SYSTEM_PERMISSIONS: {
  id: PermissionType;
  label: string;
  description: string;
}[] = [
  {
    id: 'viewcases',
    label: 'Schadenfälle einsehen',
    description: 'Darf Schadenfälle und zugehörige Chats lesen.',
  },
  {
    id: 'editcases',
    label: 'Schadenfälle bearbeiten',
    description: 'Darf Schadenfälle erfassen und mutieren.',
  },
  {
    id: 'viewfinances',
    label: 'Finanzdaten einsehen',
    description: 'Darf finanzbezogene Informationen und Buchhaltungsdaten sehen.',
  },
  {
    id: 'managestaff',
    label: 'Mitarbeiter verwalten',
    description: 'Darf Personal, Gruppen und Rechte verwalten.',
  },
];

export function MitarbeiterView({
  gruppen = [],
  setGruppen,
  mitarbeiterListe = [],
  setMitarbeiterListe,
  simulierterMitarbeiterId,
  setSimulierterMitarbeiterId,
}: any) {
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  const [newMitarbeiter, setNewMitarbeiter] = useState({
    name: '',
    email: '',
    telefon: '',
    gruppenId: gruppen[0]?.id ?? '',
  });

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAllowedChannels, setNewGroupAllowedChannels] = useState<string[]>([]);
  const [newGroupPermissions, setNewGroupPermissions] = useState<PermissionType[]>(['viewcases']);

  const gruppenMap = useMemo(() => {
    return new Map<string, any>(gruppen.map((g: any) => [g.id, g]));
  }, [gruppen]);

  const gruppenMitCount = useMemo(() => {
    return gruppen.map((gruppe: any) => {
      const mitarbeiterInGruppe = mitarbeiterListe.filter(
        (m: any) => m.gruppenId === gruppe.id
      );

      return {
        ...gruppe,
        anzahl: mitarbeiterInGruppe.length,
      };
    });
  }, [gruppen, mitarbeiterListe]);

  const mitarbeiterMitGruppe = useMemo(() => {
    return mitarbeiterListe.map((m: any) => {
      const gruppe = gruppenMap.get(m.gruppenId);
      const defaultPermissions: PermissionType[] = gruppe?.defaultPermissions ?? [];
      const customPermissions = m.customPermissions ?? {};

      const effektiveRechte = SYSTEM_PERMISSIONS.filter((perm) => {
        if (customPermissions[perm.id] !== undefined) {
          return customPermissions[perm.id];
        }
        return defaultPermissions.includes(perm.id);
      }).map((perm) => perm.label);

      return {
        ...m,
        gruppenName: gruppe?.name ?? 'Ohne Gruppe',
        allowedChannels: gruppe?.allowedChannels ?? [],
        defaultPermissions,
        effektiveRechte,
      };
    });
  }, [mitarbeiterListe, gruppenMap]);

  const simulierterMitarbeiter = mitarbeiterListe.find(
    (m: any) => m.id === simulierterMitarbeiterId
  );

  const hatBerechtigung = (mitarbeiterId: string, permission: PermissionType) => {
    const mitarbeiter = mitarbeiterListe.find((m: any) => m.id === mitarbeiterId);
    if (!mitarbeiter) return false;

    if (mitarbeiter.customPermissions?.[permission] !== undefined) {
      return mitarbeiter.customPermissions[permission];
    }

    const gruppe = gruppen.find((g: any) => g.id === mitarbeiter.gruppenId);
    return gruppe?.defaultPermissions?.includes(permission) ?? false;
  };

  const kannMitarbeiterVerwalten = hatBerechtigung(
    simulierterMitarbeiterId,
    'managestaff'
  );

  const toggleGroupPermission = (permission: PermissionType) => {
    setNewGroupPermissions((prev: PermissionType[]) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleGroupChannel = (channel: string) => {
    setNewGroupAllowedChannels((prev: string[]) =>
      prev.includes(channel)
        ? prev.filter((x) => x !== channel)
        : [...prev, channel]
    );
  };

  const handleCreateMitarbeiter = () => {
    if (!newMitarbeiter.name.trim() || !newMitarbeiter.email.trim() || !newMitarbeiter.gruppenId) {
      return;
    }

    const kuerzel =
      newMitarbeiter.name
        .trim()
        .split(' ')
        .map((x) => x[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'MA';

    const neuerMitarbeiter = {
      id: `m-${Date.now()}`,
      name: newMitarbeiter.name.trim(),
      email: newMitarbeiter.email.trim(),
      telefon: newMitarbeiter.telefon.trim() || '-',
      gruppenId: newMitarbeiter.gruppenId,
      status: 'Eingeladen',
      kuerzel,
      customPermissions: {},
    };

    if (setMitarbeiterListe) {
      setMitarbeiterListe((prev: any[]) => [...prev, neuerMitarbeiter]);
    }

    setNewMitarbeiter({
      name: '',
      email: '',
      telefon: '',
      gruppenId: gruppen[0]?.id ?? '',
    });
    setShowNewUserForm(false);
  };

  const handleCreateGruppe = () => {
    if (!newGroupName.trim()) return;

    const neueGruppe = {
      id: `g-${Date.now()}`,
      name: newGroupName.trim(),
      allowedChannels: newGroupAllowedChannels,
      defaultPermissions: newGroupPermissions,
    };

    if (setGruppen) {
      setGruppen((prev: any[]) => [...prev, neueGruppe]);
    }

    setNewGroupName('');
    setNewGroupAllowedChannels([]);
    setNewGroupPermissions(['viewcases']);
    setShowNewGroupForm(false);
  };

  const handleChangeMitarbeiterGruppe = (mitarbeiterId: string, gruppenId: string) => {
    if (!setMitarbeiterListe) return;

    setMitarbeiterListe((prev: any[]) =>
      prev.map((m) =>
        m.id === mitarbeiterId
          ? {
              ...m,
              gruppenId,
            }
          : m
      )
    );
  };

  const handleToggleStatus = (mitarbeiterId: string) => {
    if (!setMitarbeiterListe) return;

    setMitarbeiterListe((prev: any[]) =>
      prev.map((m) =>
        m.id === mitarbeiterId
          ? {
              ...m,
              status: m.status === 'Aktiv' ? 'Eingeladen' : 'Aktiv',
            }
          : m
      )
    );
  };

  const handleToggleCustomPermission = (
    mitarbeiterId: string,
    permission: PermissionType,
    currentValue: boolean | undefined
  ) => {
    if (!setMitarbeiterListe) return;

    setMitarbeiterListe((prev: any[]) =>
      prev.map((m) => {
        if (m.id !== mitarbeiterId) return m;

        const nextCustomPermissions = { ...(m.customPermissions ?? {}) };

        if (currentValue === undefined) {
          nextCustomPermissions[permission] = true;
        } else if (currentValue === true) {
          nextCustomPermissions[permission] = false;
        } else {
          delete nextCustomPermissions[permission];
        }

        return {
          ...m,
          customPermissions: nextCustomPermissions,
        };
      })
    );
  };

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: '#162033' }}>Mitarbeiter & Rechte</h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Rollen, Rechtegruppen, Rechte-Overrides und Benutzerverwaltung.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowNewGroupForm((prev: boolean) => !prev)}
            style={secondaryButtonStyle}
          >
            {showNewGroupForm ? 'Gruppe schliessen' : 'Neue Gruppe'}
          </button>

          <button
            onClick={() => setShowNewUserForm((prev: boolean) => !prev)}
            style={primaryButtonStyle}
          >
            {showNewUserForm ? 'Einladung schliessen' : 'Mitarbeiter einladen'}
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#fffdf9',
          border: '1px solid #e7dfd4',
          borderRadius: 18,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>
          KANZLEI-SIMULATOR
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, alignItems: 'center' }}>
          <select
            value={simulierterMitarbeiterId ?? ''}
            onChange={(e) => setSimulierterMitarbeiterId?.(e.target.value)}
            style={inputStyle}
          >
            {mitarbeiterListe.map((m: any) => {
              const gruppe = gruppenMap.get(m.gruppenId);
              return (
                <option key={m.id} value={m.id}>
                  {m.name} · {gruppe?.name ?? 'Ohne Gruppe'}
                </option>
              );
            })}
          </select>

          <div style={{ fontSize: 13, color: '#475569' }}>
            Aktiver Benutzer:{' '}
            <span style={{ fontWeight: 700, color: '#162033' }}>
              {simulierterMitarbeiter?.name ?? '-'}
            </span>{' '}
            · Mitarbeiterverwaltung:{' '}
            <span style={{ fontWeight: 700, color: kannMitarbeiterVerwalten ? '#166534' : '#b45309' }}>
              {kannMitarbeiterVerwalten ? 'erlaubt' : 'nicht erlaubt'}
            </span>
          </div>
        </div>
      </div>

      {showNewGroupForm && (
        <div style={formCardStyle}>
          <div style={formTitleStyle}>Neue Berechtigungsgruppe</div>

          <Field label="Gruppenname">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Standard-Rechte">
            <div style={chipWrapStyle}>
              {SYSTEM_PERMISSIONS.map((perm) => {
                const active = newGroupPermissions.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() => toggleGroupPermission(perm.id)}
                    style={chipStyle(active)}
                  >
                    {perm.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Kanäle">
            <div style={chipWrapStyle}>
              {['bewirtschafter', 'buchhalter', 'allgemein'].map((channel) => {
                const active = newGroupAllowedChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleGroupChannel(channel)}
                    style={chipStyle(active)}
                  >
                    {channel}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={handleCreateGruppe} style={primaryButtonStyle}>
              Gruppe speichern
            </button>
          </div>
        </div>
      )}

      {showNewUserForm && (
        <div style={formCardStyle}>
          <div style={formTitleStyle}>Neuen Mitarbeiter einladen</div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Name">
              <input
                value={newMitarbeiter.name}
                onChange={(e) =>
                  setNewMitarbeiter((prev) => ({ ...prev, name: e.target.value }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="E-Mail">
              <input
                value={newMitarbeiter.email}
                onChange={(e) =>
                  setNewMitarbeiter((prev) => ({ ...prev, email: e.target.value }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="Telefon">
              <input
                value={newMitarbeiter.telefon}
                onChange={(e) =>
                  setNewMitarbeiter((prev) => ({ ...prev, telefon: e.target.value }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="Gruppe">
              <select
                value={newMitarbeiter.gruppenId}
                onChange={(e) =>
                  setNewMitarbeiter((prev) => ({ ...prev, gruppenId: e.target.value }))
                }
                style={inputStyle}
              >
                {gruppen.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={handleCreateMitarbeiter} style={primaryButtonStyle}>
              Einladung senden
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 16,
        }}
      >
        {gruppenMitCount.map((gruppe: any) => (
          <div
            key={gruppe.id}
            style={{
              background: '#fffdf9',
              border: '1px solid #e7dfd4',
              borderRadius: 18,
              padding: 16,
              boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#162033', marginBottom: 10 }}>
              {gruppe.name}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>
              KANÄLE
            </div>

            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              {gruppe.allowedChannels?.join(', ') || '-'}
            </div>

            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>
              STANDARD-RECHTE
            </div>

            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              {gruppe.defaultPermissions?.length
                ? SYSTEM_PERMISSIONS.filter((x) => gruppe.defaultPermissions.includes(x.id))
                    .map((x) => x.label)
                    .join(', ')
                : '-'}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
              {gruppe.anzahl} {gruppe.anzahl === 1 ? 'Person' : 'Personen'}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: '#fffdf9',
          border: '1px solid #e7dfd4',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.2fr 1fr 1.2fr 0.8fr',
            gap: 12,
            padding: '14px 16px',
            background: '#f8f4ec',
            borderBottom: '1px solid #e7dfd4',
            fontSize: 12,
            fontWeight: 800,
            color: '#64748b',
          }}
        >
          <div>Name</div>
          <div>E-Mail</div>
          <div>Gruppe</div>
          <div>Rechte</div>
          <div>Status</div>
        </div>

        {mitarbeiterMitGruppe.map((m: any, index: number) => {
          const gruppe = gruppenMap.get(m.gruppenId);
          const defaultPermissions: PermissionType[] = gruppe?.defaultPermissions ?? [];
          const customPermissions = m.customPermissions ?? {};

          return (
            <div
              key={m.id ?? index}
              style={{
                padding: '16px',
                borderBottom:
                  index === mitarbeiterMitGruppe.length - 1 ? 'none' : '1px solid #f0ebe3',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 1.2fr 1fr 1.2fr 0.8fr',
                  gap: 12,
                  fontSize: 14,
                  color: '#162033',
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {m.kuerzel} · {m.telefon ?? '-'}
                  </div>
                </div>

                <div style={{ color: '#64748b', wordBreak: 'break-word' }}>{m.email}</div>

                <div>
                  <select
                    value={m.gruppenId}
                    onChange={(e) => handleChangeMitarbeiterGruppe(m.id, e.target.value)}
                    style={inputStyle}
                    disabled={!kannMitarbeiterVerwalten}
                  >
                    {gruppen.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                    {m.allowedChannels?.join(', ') || '-'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SYSTEM_PERMISSIONS.map((perm) => {
                    const currentValue = customPermissions[perm.id];
                    const inherited = defaultPermissions.includes(perm.id);

                    let label = inherited ? 'Gruppe' : 'Nein';
                    let bg = '#f8fafc';
                    let color = '#475569';
                    let border = '#e2e8f0';

                    if (currentValue === true) {
                      label = 'Erlaubt';
                      bg = '#f0fdf4';
                      color = '#166534';
                      border = '#bbf7d0';
                    } else if (currentValue === false) {
                      label = 'Entzogen';
                      bg = '#fff1f2';
                      color = '#be123c';
                      border = '#fecdd3';
                    } else if (inherited) {
                      bg = '#eff6ff';
                      color = '#1d4ed8';
                      border = '#bfdbfe';
                    }

                    return (
                      <button
                        key={`${m.id}-${perm.id}`}
                        type="button"
                        onClick={() =>
                          handleToggleCustomPermission(m.id, perm.id, currentValue)
                        }
                        disabled={!kannMitarbeiterVerwalten}
                        title={perm.description}
                        style={{
                          border: `1px solid ${border}`,
                          background: bg,
                          color,
                          borderRadius: 999,
                          padding: '6px 9px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: kannMitarbeiterVerwalten ? 'pointer' : 'default',
                        }}
                      >
                        {perm.label}: {label}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(m.id)}
                    disabled={!kannMitarbeiterVerwalten}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '5px 9px',
                      borderRadius: 999,
                      background: m.status === 'Aktiv' ? '#f0fdf4' : '#fff7ed',
                      color: m.status === 'Aktiv' ? '#166534' : '#b45309',
                      border:
                        m.status === 'Aktiv'
                          ? '1px solid #bbf7d0'
                          : '1px solid #fed7aa',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: kannMitarbeiterVerwalten ? 'pointer' : 'default',
                    }}
                  >
                    {m.status ?? 'Aktiv'}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
                Effektive Rechte: {m.effektiveRechte?.join(', ') || '-'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const formCardStyle: React.CSSProperties = {
  background: '#fffdf9',
  border: '1px solid #e7dfd4',
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
  boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
};

const formTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#162033',
  marginBottom: 14,
};

const chipWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

function chipStyle(active: boolean): React.CSSProperties {
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 12,
  border: '1px solid #d9d0c3',
  background: '#fff',
  fontSize: 14,
  boxSizing: 'border-box',
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
  background: '#fff',
  color: '#334155',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};