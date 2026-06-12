import React from 'react';
import type { ViewType } from '../../types/domain.types';

interface Props {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  userLabel: string;
}

export function Sidebar({ currentView, setCurrentView, userLabel }: Props) {
  const items: { key: ViewType; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '◫' },
    { key: 'liegenschaften', label: 'Liegenschaften', icon: '⌂' },
    { key: 'faelle', label: 'Meldungen', icon: '△' },
    { key: 'dokumente', label: 'Dokumente', icon: '▤' },
    { key: 'kalender', label: 'Kalender', icon: '◷' },
    { key: 'schluessel', label: 'Schlüssel', icon: '⚿' },
    { key: 'handwerker', label: 'Handwerker', icon: '⚒' },
    { key: 'finanzen', label: 'Finanzen', icon: '◎' },
    { key: 'mieterportal', label: 'Mieterportal', icon: '▣' },
    { key: 'mitarbeiter', label: 'Mitarbeiter & Rechte', icon: '👥' },
    { key: 'ki', label: 'KI-Assistent', icon: '✦' },
    { key: 'suche', label: 'Globale Suche', icon: '⌕' },
  ];

  return (
    <aside
      style={{
        width: 228,
        minWidth: 228,
        background: 'linear-gradient(180deg, #142033 0%, #18284a 100%)',
        color: '#ffffff',
        padding: 16,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.8 }}>IMMOBILIENTOOL</div>
        <div style={{ marginTop: 3, fontSize: 9, letterSpacing: 2.4, color: '#cbd5e1' }}>
          IMMOBILIEN
        </div>
      </div>

      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          color: '#8fa3bf',
          marginBottom: 8,
        }}
      >
        Hauptmenü
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => {
          const active = currentView === item.key;

          return (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key)}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '11px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#ffffff',
                background: active
                  ? 'linear-gradient(90deg, #2f6fed 0%, #3b82f6 100%)'
                  : 'rgba(255,255,255,0.035)',
                boxShadow: active ? '0 8px 14px rgba(47, 111, 237, 0.24)' : 'none',
              }}
            >
              <span style={{ width: 16, textAlign: 'center', opacity: 0.95, fontSize: 12 }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#8fa3bf',
            textTransform: 'uppercase',
            letterSpacing: 1.1,
          }}
        >
          Angemeldet
        </div>
        <div
          style={{
            marginTop: 7,
            fontSize: 12,
            fontWeight: 600,
            color: '#e2e8f0',
            wordBreak: 'break-word',
          }}
        >
          {userLabel}
        </div>
      </div>
    </aside>
  );
}