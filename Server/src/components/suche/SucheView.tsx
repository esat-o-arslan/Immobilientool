import React, { useMemo, useState } from 'react';

type Bereich = 'Alle' | 'Liegenschaft' | 'Person' | 'Schadenfall' | 'Chat' | 'Mitarbeiter';

type SuchResultat = {
  typ: Bereich;
  titel: string;
  untertitel: string;
  detail?: string;
  score: number;
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const containsAll = (haystack: string, needles: string[]) =>
  needles.every((needle) => haystack.includes(needle));

const scoreText = (haystack: string, needles: string[], title = '') => {
  if (!needles.length) return 0;
  let score = 0;
  const normalizedTitle = normalize(title);

  for (const needle of needles) {
    if (normalizedTitle === needle) score += 80;
    else if (normalizedTitle.startsWith(needle)) score += 45;
    else if (normalizedTitle.includes(needle)) score += 25;

    if (haystack.includes(needle)) score += 10;
  }

  if (containsAll(haystack, needles)) score += 30;
  return score;
};

export function SucheView({ liegenschaften, faelle, chats, mitarbeiterListe = [] }: any) {
  const [term, setTerm] = useState('');
  const [bereich, setBereich] = useState<Bereich>('Alle');

  const results = useMemo(() => {
    const raw = term.trim();
    const needles = normalize(raw).split(/\s+/).filter(Boolean);
    if (!needles.length) return [] as SuchResultat[];

    const alleResultate: SuchResultat[] = [];

    for (const x of liegenschaften) {
      const text = normalize([
        x.name,
        x.strasse,
        x.plz,
        x.ort,
        x.liegenschaftNummer,
        x.lgNummer,
        x.status,
        ...(x.personen ?? []).flatMap((p: any) => [p.name, p.email, p.telefon, p.rolle, p.wohnungsNummer, p.stockwerk]),
      ].filter(Boolean).join(' '));
      const score = scoreText(text, needles, x.name);
      if (score > 0 && containsAll(text, needles)) {
        alleResultate.push({
          typ: 'Liegenschaft',
          titel: x.name,
          untertitel: [x.strasse, x.plz, x.ort].filter(Boolean).join(', ') || x.lgNummer || '-',
          detail: `Nr. ${x.liegenschaftNummer ?? x.lgNummer ?? '-'} · ${x.personen?.length ?? 0} Personen`,
          score,
        });
      }
    }

    for (const l of liegenschaften) {
      for (const p of l.personen ?? []) {
        const text = normalize([p.name, p.vorname, p.nachname, p.email, p.telefon, p.rolle, p.kontoStatus, p.wohnungsNummer, p.stockwerk, l.name, l.strasse, l.ort].filter(Boolean).join(' '));
        const score = scoreText(text, needles, p.name);
        if (score > 0 && containsAll(text, needles)) {
          alleResultate.push({
            typ: 'Person',
            titel: p.name,
            untertitel: `${p.rolle ?? 'Person'} · ${l.name}`,
            detail: [p.email, p.telefon, p.wohnungsNummer, p.stockwerk].filter(Boolean).join(' · '),
            score,
          });
        }
      }
    }

    for (const x of faelle) {
      const liegenschaft = liegenschaften.find((l: any) => l.id === x.liegenschaftId);
      const text = normalize([
        x.titel,
        x.referenz,
        x.kategorie,
        x.status,
        x.prioritaet,
        x.formular?.beschreibung,
        x.formular?.wieEntstanden,
        x.formular?.mietobjekt,
        x.formular?.stockwerk,
        x.formular?.strasse,
        x.formular?.plzOrt,
        x.formular?.bemerkung,
        liegenschaft?.name,
        liegenschaft?.ort,
      ].filter(Boolean).join(' '));
      const score = scoreText(text, needles, x.titel);
      if (score > 0 && containsAll(text, needles)) {
        alleResultate.push({
          typ: 'Schadenfall',
          titel: x.titel,
          untertitel: `${x.referenz ?? '-'} · ${x.status ?? '-'}`,
          detail: `${x.prioritaet ?? 'Normal'} · ${liegenschaft?.name ?? x.formular?.strasse ?? '-'}`,
          score,
        });
      }
    }

    for (const x of chats) {
      const fall = faelle.find((f: any) => f.id === x.schadenfallId);
      const text = normalize([x.senderName, x.text, x.kanal, x.empfaengerName, fall?.titel, fall?.referenz].filter(Boolean).join(' '));
      const score = scoreText(text, needles, x.senderName ?? 'Nachricht');
      if (score > 0 && containsAll(text, needles)) {
        alleResultate.push({
          typ: 'Chat',
          titel: x.senderName ?? 'Nachricht',
          untertitel: x.text ?? '-',
          detail: fall ? `Zum Fall: ${fall.titel}` : x.kanal,
          score,
        });
      }
    }

    for (const m of mitarbeiterListe) {
      const text = normalize([m.name, m.email, m.telefon, m.kuerzel, m.status, m.gruppenId].filter(Boolean).join(' '));
      const score = scoreText(text, needles, m.name);
      if (score > 0 && containsAll(text, needles)) {
        alleResultate.push({
          typ: 'Mitarbeiter',
          titel: m.name,
          untertitel: [m.email, m.telefon].filter(Boolean).join(' · '),
          detail: `Kürzel ${m.kuerzel ?? '-'} · ${m.status ?? '-'}`,
          score,
        });
      }
    }

    return alleResultate
      .filter((item) => bereich === 'Alle' || item.typ === bereich)
      .sort((a, b) => b.score - a.score || a.typ.localeCompare(b.typ));
  }, [term, bereich, liegenschaften, faelle, chats, mitarbeiterListe]);

  const bereiche: Bereich[] = ['Alle', 'Liegenschaft', 'Person', 'Schadenfall', 'Chat', 'Mitarbeiter'];

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #fffdf9 0%, #f8f5ef 100%)',
          border: '1px solid #e7dfd4',
          borderRadius: 18,
          padding: 20,
          marginBottom: 16,
          boxShadow: '0 8px 20px rgba(20, 32, 51, 0.05)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: '#2f6fed', letterSpacing: 0.5, marginBottom: 8 }}>
          IMMOBILIENTOOL IMMOBILIEN · GLOBALE SUCHE
        </div>

        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.08, color: '#162033' }}>
          Suche über alle Bereiche
        </h1>

        <p style={{ margin: '10px 0 0 0', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          Durchsucht Liegenschaften, Personen, Mitarbeiter, Schadenfälle und Chats mit Mehrwort-Suche.
        </p>

        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="z. B. Basel Heizung, Wohnung 1, Mitarbeitende, Fall 2026 ..."
          style={{
            marginTop: 16,
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid #d9d0c3',
            background: '#fff',
            fontSize: 14,
            color: '#162033',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {bereiche.map((item) => (
            <button
              key={item}
              onClick={() => setBereich(item)}
              style={{
                border: '1px solid #d9d0c3',
                background: bereich === item ? '#162033' : '#fffdf9',
                color: bereich === item ? '#fff' : '#162033',
                borderRadius: 999,
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {!term.trim() ? (
        <div style={{ background: '#fffdf9', border: '1px solid #e7dfd4', borderRadius: 18, padding: 20, color: '#6b7280', fontSize: 14 }}>
          Gib einen Suchbegriff ein. Mehrere Wörter werden kombiniert.
        </div>
      ) : (
        <div style={{ background: '#fffdf9', border: '1px solid #e7dfd4', borderRadius: 18, padding: 16, boxShadow: '0 8px 18px rgba(20, 32, 51, 0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#162033', marginBottom: 12 }}>
            {results.length} Treffer
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 12, background: '#f8f4ec', color: '#6b7280', fontSize: 14 }}>
                Keine passenden Resultate gefunden.
              </div>
            ) : (
              results.map((item, index) => (
                <div key={`${item.typ}-${item.titel}-${index}`} style={{ padding: 14, borderRadius: 12, background: '#f8f4ec', border: '1px solid #e7dfd4' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#2f6fed', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                    {item.typ}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#162033', marginBottom: 4 }}>
                    {item.titel}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    {item.untertitel}
                  </div>
                  {item.detail && (
                    <div style={{ marginTop: 5, fontSize: 12, color: '#8a6f4d', lineHeight: 1.4 }}>
                      {item.detail}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
