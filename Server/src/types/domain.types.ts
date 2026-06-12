export type ViewType =
  | 'dashboard'
  | 'faelle'
  | 'liegenschaften'
  | 'mitarbeiter'
  | 'suche'
  | 'dokumente'
  | 'kalender'
  | 'mieterportal'
  | 'finanzen'
  | 'handwerker'
  | 'schluessel'
  | 'ki';

export type PermissionType =
  | 'view_cases'
  | 'edit_cases'
  | 'view_finances'
  | 'manage_staff'
  | 'manage_properties'
  | 'global_search';

export type ChatChannelType =
  | 'bewirtschafter'
  | 'buchhalter'
  | 'allgemein'
  | 'objekt'
  | 'person';

export interface MitarbeiterGruppe {
  id: string;
  name: string;
  defaultPermissions: PermissionType[];
  allowedChannels: ChatChannelType[];
}

export interface MitarbeiterProfil {
  id: string;
  name: string;
  email: string;
  telefon: string;
  gruppenId: string;
  kuerzel: string;
  status: 'Aktiv' | 'Eingeladen';
  customPermissions: Partial<Record<PermissionType, boolean>>;
}

export interface KontaktPerson {
  id: string;
  vorname?: string;
  nachname?: string;
  name: string;
  rolle: 'Eigentümer' | 'Mieter' | 'Hauswart' | 'Beirat' | 'Kontaktperson' | 'Handwerker';
  email: string;
  telefon: string;
  kontoStatus: 'Aktiv' | 'Nicht registriert' | 'Inaktiv' | 'Einladung ausstehend' | 'Ausgetreten';
  wohnungsNummer?: string;
  stockwerk?: string;
  einzugsdatum?: string;
  auszugsdatum?: string;
  aktiv?: boolean;
  austrittsdatum?: string;
  austrittsgrund?: string;
}

export interface Liegenschaft {
  id: string;
  liegenschaftNummer: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  status: 'Aktiv' | 'Inaktiv';
  bewirtschafterIds: string[];
  buchhalterIds: string[];
  personen: KontaktPerson[];
}

export interface SchadenFormData {
  liegenschaftId: string;
  personId: string;
  kontaktkanal: ChatChannelType;
  direktAnMitarbeiterId?: string;
  strasse: string;
  plzOrt: string;
  mietobjekt: string;
  stockwerk: string;
  kategorien: string[];
  schluesselVerloren: boolean;
  zusaetzlicherSchluessel: boolean;
  dringlichkeit: 'Niedrig' | 'Normal' | 'Hoch' | 'Dringend';
  beschreibung: string;
  wieEntstanden?: string;
  bemerkung?: string;
  einwilligung: boolean;
  bildUrls: string[];
}

export interface ChatMessage {
  id: string;
  schadenfallId?: string | null;
  personId?: string | null;
  liegenschaftId: string;
  kanal: ChatChannelType;
  senderTyp: 'person' | 'mitarbeiter' | 'system';
  senderId: string;
  senderName: string;
  empfaengerName?: string;
  text: string;
  createdAt: string;
}

export type SchadenStatus = 'Neu' | 'In Bearbeitung' | 'Offerten eingeholt' | 'Handwerker beauftragt' | 'Wartet auf Rückmeldung' | 'Erledigt' | 'Archiviert';

export interface Schadenfall {
  id: string;
  referenz: string;
  liegenschaftId: string;
  personId: string;
  titel: string;
  status: SchadenStatus;
  prioritaet: 'Niedrig' | 'Normal' | 'Hoch' | 'Dringend';
  kategorie: string;
  direktzustellungAn?: string;
  frist?: string;
  erinnerung?: string;
  erstelltAm: string;
  aktualisiertAm: string;
  formular: SchadenFormData;
  chatIds: string[];
  bilder?: string[];
  dokumente?: string[];
}

export interface Dokument {
  id: string;
  liegenschaftId: string;
  personId?: string;
  belegId?: string;
  titel: string;
  kategorie: 'Mietvertrag' | 'Hausordnung' | 'Versicherung' | 'Rechnung' | 'Abnahmeprotokoll' | 'Plan' | 'Schlüsselquittung' | 'Sonstiges';
  jahr: number;
  dateiname: string;
  dateiUrl?: string;
  version: number;
  freigabeStatus: 'Intern' | 'Kunde sichtbar' | 'Archiviert';
  hochgeladenAm: string;
  volltext?: string;
}

export interface KalenderTermin {
  id: string;
  titel: string;
  typ: 'Handwerkertermin' | 'Übergabetermin' | 'Wohnungsabnahme' | 'Besichtigung' | 'Eigentümerversammlung' | 'Sonstiges';
  liegenschaftId: string;
  personIds: string[];
  handwerkerId?: string;
  start: string;
  ende: string;
  ort: string;
  beschreibung?: string;
  erinnerungMinuten: number;
  sichtbarInApp: boolean;
  status: 'Geplant' | 'Bestätigt' | 'Erledigt' | 'Abgesagt';
}

export interface FinanzEintrag {
  id: string;
  liegenschaftId: string;
  titel: string;
  betrag: number;
  faelligAm: string;
  status: 'Offen' | 'Bezahlt' | 'Überfällig';
  kategorie: 'Rechnung' | 'Budget' | 'Unterhalt' | 'Nebenkosten' | 'Einnahme' | 'Ausgabe';
}

export interface Handwerker {
  id: string;
  firma: string;
  gewerk: 'Elektriker' | 'Sanitär' | 'Maler' | 'Reinigung' | 'Heizung' | 'Schreiner' | 'Sonstiges';
  email: string;
  telefon: string;
  bewertung: number;
  einsaetze: number;
  durchschnittskosten: number;
}

export interface Schluessel {
  id: string;
  liegenschaftId: string;
  personId?: string;
  handwerkerId?: string;
  bezeichnung: string;
  nummer: string;
  anzahl?: number;
  objekt?: string;
  schliessung?: string;
  standort?: string;
  status: 'Verfügbar' | 'Im Haus' | 'Bei Mieter/Eigentümer' | 'Bei Handwerker' | 'Ausgeliehen' | 'Verloren' | 'Archiviert';
  ausgegebenAn?: string;
  ausgegebenAm?: string;
  rueckgabeAm?: string;
  empfaengerTyp?: string;
  empfaengerName?: string;
  empfaengerAdresse?: string;
  ausgabeOrt?: string;
  ausgegebenVon?: string;
  letzteBewegungAm?: string;
  bemerkung?: string;
  quittungDokumentId?: string;
  quittungDateiUrl?: string;
  quittungDateiname?: string;
  unterschriebeneQuittungDokumentId?: string;
  unterschriebeneQuittungDateiUrl?: string;
  unterschriebeneQuittungDateiname?: string;
  verlaufJson?: string;
}
