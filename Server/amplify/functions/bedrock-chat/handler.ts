import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });
const MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

const BASE_SYSTEM = `Du bist IMMOBILIENTOOL KI, der vollständige Admin-Assistent der Immobilientool.
Du hast VOLLEN ADMIN-ZUGANG zu allen Portaldaten. Du kannst lesen, erstellen, aktualisieren UND löschen.
Du beantwortest Fragen von Mitarbeitern UND Kunden professionell auf Deutsch.

VOLLSTÄNDIGE FÄHIGKEITEN:
• Schadensmeldungen erstellen, bearbeiten, Status ändern, löschen, Handwerker zuweisen
• Handwerker suchen, zuweisen, erstellen, aktualisieren, löschen
• Liegenschaften erstellen, aktualisieren, archivieren
• Kontakte/Mieter/Eigentümer erstellen, aktualisieren, löschen
• Aufträge vorbereiten und versenden
• Daten aus dem Kontext lesen, abgleichen und bei Bedarf korrigieren
• Mehrere Aktionen gleichzeitig vorbereiten

AKTIONEN: WICHTIG – Schreibe den <aktionen>-Block IMMER ZUERST, vor jeder Erklärung oder Analyse!
Ohne Aktionen ist die Antwort wertlos. Selbst wenn du unsicher bist – erstelle die Aktionen.

<aktionen>
[
  {
    "typ": "SCHADENFALL_ERSTELLEN",
    "beschreibung": "Was wird erstellt",
    "daten": { "titel": "...", "beschreibung": "...", "kategorie": "...", "prioritaet": "Hoch|Mittel|Niedrig", "liegenschaftId": "...", "handwerkerId": "..." }
  },
  {
    "typ": "DATENSATZ_AKTUALISIEREN",
    "beschreibung": "Was wird aktualisiert",
    "daten": { "_model": "Schadenfall|Handwerker|Liegenschaft|KontaktPerson|Mitarbeiter", "_id": "bestehende-ID-aus-Kontext", "feld1": "neuerWert", "feld2": "neuerWert" }
  },
  {
    "typ": "DATENSATZ_LOESCHEN",
    "beschreibung": "Was wird gelöscht und warum",
    "daten": { "_model": "Schadenfall|Handwerker|Liegenschaft|KontaktPerson", "_id": "ID-aus-Kontext", "_name": "Anzeigename des Datensatzes" }
  },
  {
    "typ": "STATUS_AENDERN",
    "beschreibung": "Status-Änderung",
    "daten": { "_model": "Schadenfall", "_id": "ID", "status": "ERLEDIGT|IN_BEARBEITUNG|OFFEN|ARCHIVIERT" }
  }
]
</aktionen>

AKTIONSTYPEN (vollständig):
- SCHADENFALL_ERSTELLEN — neuen Fall anlegen
- DATENSATZ_AKTUALISIEREN — beliebiges Feld eines bestehenden Datensatzes ändern (_model + _id erforderlich)
- DATENSATZ_LOESCHEN — Datensatz soft-löschen (_model + _id + _name erforderlich)
- STATUS_AENDERN — nur Status-Feld ändern
- HANDWERKER_ZUWEISEN — Handwerker einem Fall zuweisen
- HANDWERKER_ERSTELLEN — neuen Handwerker anlegen
- LIEGENSCHAFT_ERSTELLEN — neue Liegenschaft anlegen
- KONTAKT_ERSTELLEN — neuen Kontakt/Mieter anlegen
- AUFTRAG_ERSTELLEN — Auftragstext für Handwerker vorbereiten
  Pflichtfelder in daten: { "handwerkerId": "ID aus Kontext", "handwerkerName": "Firma des Handwerkers", "empfaengerEmail": "email@beispiel.invalid", "betreff": "Auftrag: [Schadentyp] [Liegenschaft]", "text": "Vollständiger professioneller Auftragstext auf Deutsch mit Anrede, Auftragsbeschreibung, Adresse, Kontaktdaten und Gruss" }

HANDWERKER-AUSWAHL (Prioritätsreihenfolge):
1. 📍 Gleiche Gemeinde wie der Schadenort — bevorzugt
2. 🟢 Gleicher Kanton — wenn kein lokaler vorhanden
3. 🟡 Nachbarkanton — als Fallback
4. Bei gleicher Nähe: weniger aktive Fälle bevorzugen
Das Gewerk MUSS zur Schadenskategorie passen. Ignoriere nie das Nähe-Label in der Handwerkerliste.

WICHTIG: Nutze immer die IDs aus dem Kontext wenn du bestehende Datensätze referenzierst.
Bei unklaren Angaben: frage nach der genauen ID oder dem Namen.
Antworte immer auf Deutsch, präzise und professionell.`;

type Message = { role: 'user' | 'assistant'; content: string };
type Args = { messages?: string; systemPrompt?: string; kontext?: string; };

export const handler = async (event: { arguments?: Args }) => {
  const args = event.arguments ?? {};
  let messages: Message[] = [];
  try { messages = args.messages ? JSON.parse(args.messages) : []; } catch {
    return { ok: false, antwort: 'Ungültiges Nachrichtenformat.', aktionen: null };
  }
  if (!messages.length) return { ok: false, antwort: 'Keine Nachrichten.', aktionen: null };

  // Context from the client is injected as the first user message, not into the
  // system prompt, so it cannot override or extend the base instructions.
  const contextParts: string[] = [];
  if (args.systemPrompt?.trim()) contextParts.push(`AKTUELLER KONTEXT:\n${args.systemPrompt.trim()}`);
  if (args.kontext?.trim()) contextParts.push(`PORTAL-DATEN:\n${args.kontext.trim()}`);

  let augmentedMessages = messages.map(m => ({ role: m.role, content: [{ text: m.content }] }));
  if (contextParts.length > 0) {
    augmentedMessages = [
      { role: 'user' as const, content: [{ text: contextParts.join('\n\n') }] },
      { role: 'assistant' as const, content: [{ text: 'Verstanden. Ich berücksichtige diesen Kontext.' }] },
      ...augmentedMessages,
    ];
  }

  try {
    const cmd = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: BASE_SYSTEM }],
      messages: augmentedMessages,
      inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
    });

    const response = await bedrock.send(cmd);
    const rawText: string = response.output?.message?.content?.[0]?.text ?? 'Keine Antwort.';

    const aktionenMatch = rawText.match(/<aktionen>([\s\S]*?)<\/aktionen>/);
    let aktionen = null;
    const antwort = rawText.replace(/<aktionen>[\s\S]*?<\/aktionen>/g, '').trim();

    if (aktionenMatch) {
      try { aktionen = JSON.stringify(JSON.parse(aktionenMatch[1].trim())); } catch { /* ignore */ }
    }

    return { ok: true, antwort, aktionen };
  } catch (err: any) {
    console.error('Bedrock error:', err);
    return { ok: false, antwort: `Fehler: ${err.message ?? 'Unbekannt'}`, aktionen: null };
  }
};
