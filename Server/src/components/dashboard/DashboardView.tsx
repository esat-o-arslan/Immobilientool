import React from 'react';
import type { ViewType } from '../../types/domain.types';

interface Props {
  liegenschaften: any[];
  faelle: any[];
  chats: any[];
  setCurrentView: (view: ViewType) => void;
}

export function DashboardView({ liegenschaften, faelle, chats, setCurrentView }: Props) {
  const offeneFaelleListe = faelle
    .filter((x: any) => ['Offen', 'OFFEN', 'Neu'].includes(x.status))
    .sort((a: any, b: any) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));

  const bearbeitungFaelleListe = faelle
    .filter((x: any) => ['In Bearbeitung', 'IN_BEARBEITUNG'].includes(x.status))
    .sort((a: any, b: any) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));

  const offeneFaelle = offeneFaelleListe.length;
  const bearbeitungFaelle = bearbeitungFaelleListe.length;
  const aktiveLiegenschaften = liegenschaften.filter((x: any) => x.status === 'Aktiv').length;
  const offeneEinladungen = liegenschaften
    .flatMap((x: any) => x.personen ?? [])
    .filter((x: any) => x.kontoStatus === 'Einladung ausstehend').length;

  const cards = [
    {
      title: 'Offene Meldungen',
      value: offeneFaelle,
      subtitle: 'Neu eingegangen',
      bg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
      border: '#fecdd3',
      text: '#be123c',
      dot: '#e11d48',
      target: 'faelle' as ViewType,
    },
    {
      title: 'In Bearbeitung',
      value: bearbeitungFaelle,
      subtitle: 'Aktive Arbeiten',
      bg: 'linear-gradient(135deg, #eef4ff 0%, #dbeafe 100%)',
      border: '#bfdbfe',
      text: '#1d4ed8',
      dot: '#2563eb',
      target: 'faelle' as ViewType,
    },
    {
      title: 'Aktive Liegenschaften',
      value: aktiveLiegenschaften,
      subtitle: 'Stammdaten öffnen',
      bg: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%)',
      border: '#bbf7d0',
      text: '#15803d',
      dot: '#22c55e',
      target: 'liegenschaften' as ViewType,
    },
    {
      title: 'Offene Einladungen',
      value: offeneEinladungen,
      subtitle: 'Konten prüfen',
      bg: 'linear-gradient(135deg, #fff9e8 0%, #fef3c7 100%)',
      border: '#fde68a',
      text: '#b45309',
      dot: '#f59e0b',
      target: 'liegenschaften' as ViewType,
    },
    {
      title: 'Chat-Nachrichten',
      value: chats.length,
      subtitle: 'Kommunikation öffnen',
      bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
      border: '#a5f3fc',
      text: '#0f766e',
      dot: '#06b6d4',
      target: 'suche' as ViewType,
    },
  ];

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          background: '#fffdf9',
          border: '1px solid #e7dfd4',
          borderRadius: 18,
          padding: 22,
          boxShadow: '0 8px 20px rgba(20, 32, 51, 0.05)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: '#2f6fed', letterSpacing: 0.5, marginBottom: 8 }}>
          IMMOBILIENTOOL IMMOBILIEN · VERWALTUNG
        </div>

        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, color: '#162033' }}>Dashboard</h1>

        <p style={{ margin: '10px 0 0 0', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          Aufgeräumte Übersicht mit offenen Meldungen, laufenden Arbeiten und wichtigen Schnellzugriffen.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 16,
          width: '100%',
        }}
      >
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={() => setCurrentView(card.target)}
            style={{
              border: `1px solid ${card.border}`,
              background: card.bg,
              borderRadius: 16,
              padding: 16,
              minHeight: 110,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
              cursor: 'pointer',
              textAlign: 'left',
              minWidth: 0,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: card.dot,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: card.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.35,
                    lineHeight: 1.3,
                  }}
                >
                  {card.title}
                </div>
              </div>

              <div style={{ marginTop: 7, fontSize: 12, color: '#64748b' }}>{card.subtitle}</div>
            </div>

            <div style={{ fontSize: 34, fontWeight: 800, color: '#162033' }}>{card.value}</div>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)',
          gap: 16,
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#fffdf9',
            border: '1px solid #e7dfd4',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: '#162033', marginBottom: 12 }}>
            Schnellzugriffe
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <button onClick={() => setCurrentView('faelle')} style={quickActionStyle}>
              Neue Meldung prüfen
            </button>
            <button onClick={() => setCurrentView('kalender')} style={quickActionStyle}>
              Termin erfassen
            </button>
            <button onClick={() => setCurrentView('liegenschaften')} style={quickActionStyle}>
              Liegenschaft suchen
            </button>
            <button onClick={() => setCurrentView('handwerker')} style={quickActionStyle}>
              Handwerker öffnen
            </button>
            <button onClick={() => setCurrentView('mitarbeiter')} style={quickActionStyle}>
              Mitarbeiter & Rechte
            </button>
            <button onClick={() => setCurrentView('suche')} style={quickActionStyle}>
              Globale Suche
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#fffdf9',
            border: '1px solid #e7dfd4',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <DashboardFallListe
              titel="Offene Meldungen"
              leerText="Keine offenen Meldungen."
              faelle={offeneFaelleListe}
              badgeStyle={badgeRedStyle}
              badgeText={(fall) => fall.prioritaet || 'Normal'}
              setCurrentView={setCurrentView}
            />

            <DashboardFallListe
              titel="In Bearbeitung"
              leerText="Keine Meldungen in Bearbeitung."
              faelle={bearbeitungFaelleListe}
              badgeStyle={badgeBlueStyle}
              badgeText={() => 'In Bearbeitung'}
              setCurrentView={setCurrentView}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardFallListe({
  titel,
  leerText,
  faelle,
  badgeStyle,
  badgeText,
  setCurrentView,
}: {
  titel: string;
  leerText: string;
  faelle: any[];
  badgeStyle: React.CSSProperties;
  badgeText: (fall: any) => string;
  setCurrentView: (view: ViewType) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#162033', marginBottom: 12 }}>{titel}</div>

      {faelle.length === 0 ? (
        <div style={{ fontSize: 13, color: '#64748b' }}>{leerText}</div>
      ) : (
        faelle.slice(0, 6).map((fall: any) => (
          <button key={fall.id} onClick={() => setCurrentView('faelle')} style={dashboardListItemStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#162033' }}>{fall.titel}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                {fall.liegenschaftName || fall.liegenschaft || 'Ohne Liegenschaft'} ·{' '}
                {fall.personName || fall.person || 'Ohne Person'}
              </div>
            </div>
            <span style={badgeStyle}>{badgeText(fall)}</span>
          </button>
        ))
      )}
    </div>
  );
}

const quickActionStyle: React.CSSProperties = {
  border: '1px solid #d9d0c3',
  background: '#f8f4ec',
  borderRadius: 12,
  padding: '13px 12px',
  textAlign: 'left',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
  color: '#162033',
};

const dashboardListItemStyle: React.CSSProperties = {
  width: '100%',
  border: '0',
  borderBottom: '1px solid #eee6dc',
  background: 'transparent',
  padding: '11px 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  textAlign: 'left',
  cursor: 'pointer',
};

const badgeRedStyle: React.CSSProperties = {
  background: '#fee2e2',
  color: '#b91c1c',
  borderRadius: 999,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const badgeBlueStyle: React.CSSProperties = {
  background: '#dbeafe',
  color: '#1d4ed8',
  borderRadius: 999,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};